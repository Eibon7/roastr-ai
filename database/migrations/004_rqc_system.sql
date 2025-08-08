-- Migration: Add RQC (Roast Quality Control) system tables and configuration
-- Created: 2025-08-08
-- Purpose: Support multi-plan RQC with basic moderation for Free/Pro and advanced review for Creator+/Enterprise

-- Add RQC configuration columns to user_subscriptions table
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS rqc_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS roast_intensity_level INTEGER DEFAULT 3 CHECK (roast_intensity_level BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS custom_style_prompt TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rqc_max_regenerations INTEGER DEFAULT 3 CHECK (rqc_max_regenerations BETWEEN 1 AND 10);

-- Update RQC settings based on plan
UPDATE user_subscriptions 
SET rqc_enabled = CASE 
    WHEN plan IN ('creator_plus') THEN TRUE 
    ELSE FALSE 
END;

-- Comments for documentation
COMMENT ON COLUMN user_subscriptions.rqc_enabled IS 'Enable RQC advanced review system (Creator+ and Enterprise only)';
COMMENT ON COLUMN user_subscriptions.roast_intensity_level IS 'Roast intensity level from 1 (mild) to 5 (brutal)';
COMMENT ON COLUMN user_subscriptions.custom_style_prompt IS 'Custom style prompt for RQC reviewers (admin-editable only)';
COMMENT ON COLUMN user_subscriptions.rqc_max_regenerations IS 'Maximum roast regeneration attempts in RQC process';

-- Create table for RQC review history
CREATE TABLE IF NOT EXISTS rqc_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Content being reviewed
    original_comment TEXT NOT NULL,
    roast_text TEXT NOT NULL,
    roast_attempt INTEGER DEFAULT 1,
    
    -- Review process
    moderator_verdict VARCHAR(10) CHECK (moderator_verdict IN ('pass', 'fail')),
    moderator_reason TEXT,
    
    comedian_verdict VARCHAR(10) CHECK (comedian_verdict IN ('pass', 'fail')),  
    comedian_reason TEXT,
    
    style_reviewer_verdict VARCHAR(10) CHECK (style_reviewer_verdict IN ('pass', 'fail')),
    style_reviewer_reason TEXT,
    
    -- Final decision
    final_decision VARCHAR(20) NOT NULL CHECK (final_decision IN ('approved', 'rejected', 'regenerate')),
    published BOOLEAN DEFAULT FALSE,
    
    -- Performance metrics
    review_duration_ms INTEGER,
    total_tokens_used INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,
    
    -- Metadata
    user_config JSONB DEFAULT '{}', -- intensity level, custom prompt, etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX (user_id, created_at),
    INDEX (final_decision, created_at)
);

-- Enable RLS on rqc_reviews table
ALTER TABLE rqc_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rqc_reviews
CREATE POLICY "Users can view own RQC reviews"
    ON rqc_reviews FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage RQC reviews"
    ON rqc_reviews FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view all RQC reviews"
    ON rqc_reviews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Create table for RQC configuration per plan
CREATE TABLE IF NOT EXISTS rqc_plan_configs (
    plan VARCHAR(20) PRIMARY KEY,
    basic_moderation_enabled BOOLEAN DEFAULT TRUE,
    advanced_review_enabled BOOLEAN DEFAULT FALSE,
    max_regenerations INTEGER DEFAULT 3,
    cost_multiplier DECIMAL(3,2) DEFAULT 1.0,
    
    -- Prompt templates
    basic_moderation_prompt TEXT DEFAULT NULL,
    moderator_prompt TEXT DEFAULT NULL,
    comedian_prompt TEXT DEFAULT NULL,
    style_reviewer_prompt TEXT DEFAULT NULL,
    fallback_prompt TEXT DEFAULT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default RQC configurations for each plan
INSERT INTO rqc_plan_configs (plan, basic_moderation_enabled, advanced_review_enabled, max_regenerations, cost_multiplier) VALUES
('free', TRUE, FALSE, 0, 0.5),
('pro', TRUE, FALSE, 0, 0.8), 
('creator_plus', FALSE, TRUE, 3, 1.5)
ON CONFLICT (plan) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rqc_reviews_user_id_created ON rqc_reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rqc_reviews_final_decision ON rqc_reviews(final_decision);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_rqc_enabled ON user_subscriptions(rqc_enabled) WHERE rqc_enabled = TRUE;

-- Function to get user RQC configuration
CREATE OR REPLACE FUNCTION get_user_rqc_config(user_uuid UUID)
RETURNS TABLE (
    plan TEXT,
    rqc_enabled BOOLEAN,
    intensity_level INTEGER,
    custom_style_prompt TEXT,
    max_regenerations INTEGER,
    basic_moderation_enabled BOOLEAN,
    advanced_review_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.plan,
        us.rqc_enabled,
        us.roast_intensity_level,
        us.custom_style_prompt,
        us.rqc_max_regenerations,
        rpc.basic_moderation_enabled,
        rpc.advanced_review_enabled
    FROM user_subscriptions us
    JOIN rqc_plan_configs rpc ON us.plan = rpc.plan
    WHERE us.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log RQC review
CREATE OR REPLACE FUNCTION log_rqc_review(
    user_uuid UUID,
    original_comment TEXT,
    roast_text TEXT,
    attempt_num INTEGER,
    moderator_pass VARCHAR(10),
    moderator_reason TEXT,
    comedian_pass VARCHAR(10),
    comedian_reason TEXT,
    style_pass VARCHAR(10),
    style_reason TEXT,
    final_decision VARCHAR(20),
    review_duration INTEGER DEFAULT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,
    config_json JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    review_id UUID;
BEGIN
    INSERT INTO rqc_reviews (
        user_id, 
        original_comment, 
        roast_text, 
        roast_attempt,
        moderator_verdict, 
        moderator_reason,
        comedian_verdict, 
        comedian_reason,
        style_reviewer_verdict, 
        style_reviewer_reason,
        final_decision,
        review_duration_ms,
        total_tokens_used,
        cost_cents,
        user_config
    ) VALUES (
        user_uuid,
        original_comment,
        roast_text,
        attempt_num,
        moderator_pass,
        moderator_reason,
        comedian_pass,
        comedian_reason,
        style_pass,
        style_reason,
        final_decision,
        review_duration,
        tokens_used,
        cost_cents,
        config_json
    ) RETURNING id INTO review_id;
    
    RETURN review_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger for rqc_plan_configs
CREATE TRIGGER update_rqc_plan_configs_updated_at 
    BEFORE UPDATE ON rqc_plan_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE rqc_reviews IS 'Stores RQC review history and results for advanced quality control';
COMMENT ON TABLE rqc_plan_configs IS 'Configuration for RQC system per subscription plan';
COMMENT ON FUNCTION get_user_rqc_config IS 'Get complete RQC configuration for a user based on their plan';
COMMENT ON FUNCTION log_rqc_review IS 'Log an RQC review attempt with all reviewer verdicts';