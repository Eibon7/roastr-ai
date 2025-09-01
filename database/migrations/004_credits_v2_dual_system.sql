-- Migration: Credits v2 - Dual Credit System (Analysis + Roasts)
-- Created: 2025-09-01
-- Purpose: Implement dual credit system with monthly reset and atomic consumption
-- Issue: #297

-- Drop existing usage_counters table if it exists (from migration 002)
DROP TABLE IF EXISTS usage_counters CASCADE;

-- Create enhanced usage_counters table for Credits v2
CREATE TABLE usage_counters (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Billing period tracking (supports both Stripe cycles and natural months)
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Analysis credits (consumed by: gatekeeper, toxicity, shields, etc.)
    analysis_used INTEGER NOT NULL DEFAULT 0,
    analysis_limit INTEGER NOT NULL,
    
    -- Roast credits (consumed only when generating/responding with roasts)
    roast_used INTEGER NOT NULL DEFAULT 0,
    roast_limit INTEGER NOT NULL,
    
    -- Metadata for debugging and audit
    last_analysis_at TIMESTAMPTZ,
    last_roast_at TIMESTAMPTZ,
    
    -- Billing integration
    stripe_customer_id VARCHAR(255), -- For linking to Stripe billing cycles
    billing_cycle_anchor INTEGER, -- Day of month for billing cycle (1-31)
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE (user_id, period_start, period_end),
    CHECK (analysis_used >= 0),
    CHECK (roast_used >= 0),
    CHECK (analysis_limit >= 0),
    CHECK (roast_limit >= 0),
    CHECK (period_start < period_end)
);

-- Indexes for performance
CREATE INDEX idx_usage_counters_user_id ON usage_counters (user_id);
CREATE INDEX idx_usage_counters_period ON usage_counters (period_start, period_end);
CREATE INDEX idx_usage_counters_user_period ON usage_counters (user_id, period_start, period_end);
CREATE INDEX idx_usage_counters_stripe_customer ON usage_counters (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Create credit consumption audit log
CREATE TABLE credit_consumption_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Credit details
    credit_type VARCHAR(20) NOT NULL CHECK (credit_type IN ('analysis', 'roast')),
    amount_consumed INTEGER NOT NULL DEFAULT 1,
    
    -- Context
    action_type VARCHAR(50) NOT NULL, -- 'gatekeeper_check', 'toxicity_analysis', 'roast_generation', etc.
    platform VARCHAR(50), -- 'twitter', 'youtube', etc.
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_credit_log_user_id (user_id),
    INDEX idx_credit_log_type (credit_type),
    INDEX idx_credit_log_consumed_at (consumed_at),
    INDEX idx_credit_log_user_type_date (user_id, credit_type, consumed_at)
);

-- Create function to get or create active period for user
CREATE OR REPLACE FUNCTION get_or_create_active_period(
    p_user_id UUID,
    p_analysis_limit INTEGER DEFAULT NULL,
    p_roast_limit INTEGER DEFAULT NULL
) RETURNS usage_counters AS $$
DECLARE
    current_period usage_counters;
    period_start_date TIMESTAMPTZ;
    period_end_date TIMESTAMPTZ;
    user_stripe_info RECORD;
BEGIN
    -- Get current active period
    SELECT * INTO current_period
    FROM usage_counters
    WHERE user_id = p_user_id
    AND period_start <= NOW()
    AND period_end > NOW()
    ORDER BY period_start DESC
    LIMIT 1;
    
    -- Return existing period if found
    IF FOUND THEN
        RETURN current_period;
    END IF;
    
    -- Get user's Stripe billing info if available
    SELECT 
        us.stripe_customer_id,
        us.current_period_start,
        us.current_period_end
    INTO user_stripe_info
    FROM user_subscriptions us
    WHERE us.user_id = p_user_id
    AND us.status = 'active';
    
    -- Calculate period dates
    IF user_stripe_info.current_period_start IS NOT NULL AND user_stripe_info.current_period_end IS NOT NULL THEN
        -- Use Stripe billing cycle
        period_start_date := user_stripe_info.current_period_start;
        period_end_date := user_stripe_info.current_period_end;
    ELSE
        -- Fallback to natural month
        period_start_date := DATE_TRUNC('month', NOW());
        period_end_date := period_start_date + INTERVAL '1 month';
    END IF;
    
    -- Get plan limits if not provided
    IF p_analysis_limit IS NULL OR p_roast_limit IS NULL THEN
        -- Get limits from user's plan (implement based on your plan system)
        -- For now, use default free plan limits
        p_analysis_limit := COALESCE(p_analysis_limit, 100);
        p_roast_limit := COALESCE(p_roast_limit, 10);
    END IF;
    
    -- Create new period
    INSERT INTO usage_counters (
        user_id,
        period_start,
        period_end,
        analysis_used,
        analysis_limit,
        roast_used,
        roast_limit,
        stripe_customer_id
    ) VALUES (
        p_user_id,
        period_start_date,
        period_end_date,
        0,
        p_analysis_limit,
        0,
        p_roast_limit,
        user_stripe_info.stripe_customer_id
    ) RETURNING * INTO current_period;
    
    RETURN current_period;
END;
$$ LANGUAGE plpgsql;

-- Create function for atomic credit consumption
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID,
    p_credit_type VARCHAR(20),
    p_amount INTEGER DEFAULT 1,
    p_action_type VARCHAR(50) DEFAULT 'unknown',
    p_platform VARCHAR(50) DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    consumption_successful BOOLEAN := FALSE;
    current_period usage_counters;
BEGIN
    -- Validate input
    IF p_credit_type NOT IN ('analysis', 'roast') THEN
        RAISE EXCEPTION 'Invalid credit type: %', p_credit_type;
    END IF;
    
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive: %', p_amount;
    END IF;
    
    -- Get current period (will create if needed)
    SELECT * INTO current_period FROM get_or_create_active_period(p_user_id);
    
    -- Atomic consumption with limit check
    IF p_credit_type = 'analysis' THEN
        UPDATE usage_counters
        SET 
            analysis_used = analysis_used + p_amount,
            last_analysis_at = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id
        AND period_start = current_period.period_start
        AND period_end = current_period.period_end
        AND analysis_used + p_amount <= analysis_limit;
    ELSE -- roast
        UPDATE usage_counters
        SET 
            roast_used = roast_used + p_amount,
            last_roast_at = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id
        AND period_start = current_period.period_start
        AND period_end = current_period.period_end
        AND roast_used + p_amount <= roast_limit;
    END IF;
    
    -- Check if consumption was successful
    consumption_successful := FOUND;
    
    -- Log consumption attempt (successful or failed)
    INSERT INTO credit_consumption_log (
        user_id,
        credit_type,
        amount_consumed,
        action_type,
        platform,
        metadata
    ) VALUES (
        p_user_id,
        p_credit_type,
        CASE WHEN consumption_successful THEN p_amount ELSE 0 END,
        p_action_type,
        p_platform,
        p_metadata || jsonb_build_object('success', consumption_successful)
    );
    
    RETURN consumption_successful;
END;
$$ LANGUAGE plpgsql;

-- Create function to check credit availability
CREATE OR REPLACE FUNCTION check_credit_availability(
    p_user_id UUID,
    p_credit_type VARCHAR(20) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    current_period usage_counters;
    result JSONB;
BEGIN
    -- Get current period
    SELECT * INTO current_period FROM get_or_create_active_period(p_user_id);
    
    -- Build result
    result := jsonb_build_object(
        'period_start', current_period.period_start,
        'period_end', current_period.period_end,
        'analysis', jsonb_build_object(
            'used', current_period.analysis_used,
            'limit', current_period.analysis_limit,
            'remaining', current_period.analysis_limit - current_period.analysis_used,
            'percentage_used', ROUND((current_period.analysis_used::DECIMAL / current_period.analysis_limit) * 100, 2)
        ),
        'roast', jsonb_build_object(
            'used', current_period.roast_used,
            'limit', current_period.roast_limit,
            'remaining', current_period.roast_limit - current_period.roast_used,
            'percentage_used', ROUND((current_period.roast_used::DECIMAL / current_period.roast_limit) * 100, 2)
        )
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_consumption_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for usage_counters
CREATE POLICY "Users can view own usage counters"
    ON usage_counters FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can manage usage counters"
    ON usage_counters FOR ALL
    USING (true); -- System operations need full access

-- RLS Policies for credit_consumption_log
CREATE POLICY "Users can view own credit log"
    ON credit_consumption_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert credit log"
    ON credit_consumption_log FOR INSERT
    WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_usage_counters_updated_at
    BEFORE UPDATE ON usage_counters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE usage_counters IS 'Tracks dual credit system usage (analysis + roast credits) with monthly reset';
COMMENT ON TABLE credit_consumption_log IS 'Audit log for all credit consumption attempts';
COMMENT ON FUNCTION get_or_create_active_period IS 'Gets current billing period or creates new one with plan limits';
COMMENT ON FUNCTION consume_credits IS 'Atomically consumes credits with limit checking and audit logging';
COMMENT ON FUNCTION check_credit_availability IS 'Returns current credit status for user';
