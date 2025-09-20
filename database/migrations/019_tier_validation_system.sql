-- Migration: Tier Validation System - SPEC 10
-- Implements usage tracking and plan change management for tier limits

-- ============================================================================
-- ANALYSIS USAGE TRACKING TABLE
-- ============================================================================

-- Table to track analysis usage per billing cycle
CREATE TABLE IF NOT EXISTS analysis_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Usage tracking
    quantity INTEGER NOT NULL DEFAULT 1,
    analysis_type VARCHAR(50) DEFAULT 'toxicity_analysis',
    platform VARCHAR(50),
    
    -- Billing cycle tracking
    billing_cycle_start DATE NOT NULL,
    billing_cycle_end DATE NOT NULL,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure proper indexing for usage queries
    CONSTRAINT valid_quantity CHECK (quantity >= 0)
);

-- Indexes for performance
CREATE INDEX idx_analysis_usage_user_cycle ON analysis_usage(user_id, billing_cycle_start, billing_cycle_end);
CREATE INDEX idx_analysis_usage_created_at ON analysis_usage(created_at);
CREATE INDEX idx_analysis_usage_platform ON analysis_usage(platform, created_at);

-- ============================================================================
-- PENDING PLAN CHANGES TABLE
-- ============================================================================

-- Table to track deferred plan changes (for downgrades)
CREATE TABLE IF NOT EXISTS pending_plan_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Plan change details
    current_plan VARCHAR(50) NOT NULL,
    new_plan VARCHAR(50) NOT NULL,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('upgrade', 'downgrade')),
    
    -- Timing
    effective_date TIMESTAMPTZ NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Metadata
    reason TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Indexes for processing
CREATE INDEX idx_pending_plan_changes_user ON pending_plan_changes(user_id, effective_date);
CREATE INDEX idx_pending_plan_changes_processing ON pending_plan_changes(processed, effective_date);

-- ============================================================================
-- TIER USAGE SUMMARY VIEW
-- ============================================================================

-- View for easy tier usage reporting
CREATE OR REPLACE VIEW tier_usage_summary AS
SELECT 
    u.id as user_id,
    u.email,
    s.plan as current_plan,
    s.status as subscription_status,
    
    -- Current billing cycle
    COALESCE(s.current_period_start, DATE_TRUNC('month', NOW())) as cycle_start,
    COALESCE(s.current_period_end, DATE_TRUNC('month', NOW()) + INTERVAL '1 month') as cycle_end,
    
    -- Usage counts
    COALESCE(roast_usage.roast_count, 0) as roasts_this_cycle,
    COALESCE(analysis_usage.analysis_count, 0) as analysis_this_cycle,
    COALESCE(platform_usage.platform_count, 0) as active_platforms,
    
    -- Tier limits
    pl.monthly_responses_limit as roast_limit,
    pl.monthly_analysis_limit as analysis_limit,
    pl.integrations_limit as platform_limit,
    
    -- Usage percentages
    CASE 
        WHEN pl.monthly_responses_limit = -1 THEN 0
        ELSE ROUND((COALESCE(roast_usage.roast_count, 0)::FLOAT / pl.monthly_responses_limit) * 100, 2)
    END as roast_usage_percentage,
    
    CASE 
        WHEN pl.monthly_analysis_limit = -1 THEN 0
        ELSE ROUND((COALESCE(analysis_usage.analysis_count, 0)::FLOAT / pl.monthly_analysis_limit) * 100, 2)
    END as analysis_usage_percentage,
    
    -- Feature access
    pl.shield_enabled,
    pl.custom_tones as original_tone_enabled,
    pl.settings->>'embeddedJudge' = 'true' as embedded_judge_enabled

FROM users u
LEFT JOIN user_subscriptions s ON u.id = s.user_id
LEFT JOIN plan_limits pl ON COALESCE(s.plan, 'free') = pl.plan_id
LEFT JOIN (
    -- Roast usage in current cycle
    SELECT 
        user_id,
        COUNT(*) as roast_count
    FROM user_activities 
    WHERE activity_type = 'roast_generated'
        AND created_at >= COALESCE(
            (SELECT current_period_start FROM user_subscriptions WHERE user_id = user_activities.user_id),
            DATE_TRUNC('month', NOW())
        )
    GROUP BY user_id
) roast_usage ON u.id = roast_usage.user_id
LEFT JOIN (
    -- Analysis usage in current cycle
    SELECT 
        user_id,
        SUM(quantity) as analysis_count
    FROM analysis_usage
    WHERE created_at >= COALESCE(
        (SELECT current_period_start FROM user_subscriptions WHERE user_id = analysis_usage.user_id),
        DATE_TRUNC('month', NOW())
    )
    GROUP BY user_id
) analysis_usage ON u.id = analysis_usage.user_id
LEFT JOIN (
    -- Active platform integrations
    SELECT 
        user_id,
        COUNT(DISTINCT platform) as platform_count
    FROM user_integrations 
    WHERE status = 'active'
    GROUP BY user_id
) platform_usage ON u.id = platform_usage.user_id;

-- ============================================================================
-- FUNCTIONS FOR TIER VALIDATION
-- ============================================================================

-- Function to record analysis usage
CREATE OR REPLACE FUNCTION record_analysis_usage(
    p_user_id UUID,
    p_quantity INTEGER DEFAULT 1,
    p_analysis_type VARCHAR(50) DEFAULT 'toxicity_analysis',
    p_platform VARCHAR(50) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_cycle_start DATE;
    v_cycle_end DATE;
    v_existing_id UUID;
BEGIN
    -- Get user's billing cycle
    SELECT 
        COALESCE(current_period_start::DATE, DATE_TRUNC('month', NOW())::DATE),
        COALESCE(current_period_end::DATE, (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE)
    INTO v_cycle_start, v_cycle_end
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    -- Use month cycle if no subscription found
    IF v_cycle_start IS NULL THEN
        v_cycle_start := DATE_TRUNC('month', NOW())::DATE;
        v_cycle_end := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE;
    END IF;
    
    -- Try to update existing record for this cycle
    UPDATE analysis_usage 
    SET 
        quantity = quantity + p_quantity,
        updated_at = NOW()
    WHERE user_id = p_user_id 
        AND billing_cycle_start = v_cycle_start
        AND analysis_type = p_analysis_type
        AND (platform = p_platform OR (platform IS NULL AND p_platform IS NULL))
    RETURNING id INTO v_existing_id;
    
    -- Insert new record if none exists
    IF v_existing_id IS NULL THEN
        INSERT INTO analysis_usage (
            user_id, 
            quantity, 
            analysis_type, 
            platform,
            billing_cycle_start, 
            billing_cycle_end
        ) VALUES (
            p_user_id, 
            p_quantity, 
            p_analysis_type, 
            p_platform,
            v_cycle_start, 
            v_cycle_end
        );
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check tier limits
CREATE OR REPLACE FUNCTION check_tier_limit(
    p_user_id UUID,
    p_limit_type VARCHAR(50),
    p_quantity INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
    v_user_plan VARCHAR(50);
    v_plan_limits JSONB;
    v_current_usage INTEGER;
    v_limit INTEGER;
    v_cycle_start TIMESTAMPTZ;
BEGIN
    -- Get user plan
    SELECT COALESCE(plan, 'free') INTO v_user_plan
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    IF v_user_plan IS NULL THEN
        v_user_plan := 'free';
    END IF;
    
    -- Get plan limits
    SELECT to_jsonb(pl.*) INTO v_plan_limits
    FROM plan_limits pl
    WHERE plan_id = v_user_plan;
    
    -- Get billing cycle start
    SELECT COALESCE(current_period_start, DATE_TRUNC('month', NOW()))
    INTO v_cycle_start
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    IF v_cycle_start IS NULL THEN
        v_cycle_start := DATE_TRUNC('month', NOW());
    END IF;
    
    -- Check specific limit type
    CASE p_limit_type
        WHEN 'analysis' THEN
            v_limit := (v_plan_limits->>'monthly_analysis_limit')::INTEGER;
            SELECT COALESCE(SUM(quantity), 0) INTO v_current_usage
            FROM analysis_usage 
            WHERE user_id = p_user_id 
                AND created_at >= v_cycle_start;
                
        WHEN 'roast' THEN
            v_limit := (v_plan_limits->>'monthly_responses_limit')::INTEGER;
            SELECT COUNT(*) INTO v_current_usage
            FROM user_activities 
            WHERE user_id = p_user_id 
                AND activity_type = 'roast_generated'
                AND created_at >= v_cycle_start;
                
        WHEN 'platform' THEN
            v_limit := (v_plan_limits->>'integrations_limit')::INTEGER;
            SELECT COUNT(DISTINCT platform) INTO v_current_usage
            FROM user_integrations 
            WHERE user_id = p_user_id 
                AND status = 'active';
                
        ELSE
            RETURN jsonb_build_object(
                'allowed', true,
                'reason', 'unknown_limit_type'
            );
    END CASE;
    
    -- Check if unlimited (-1)
    IF v_limit = -1 THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'current_usage', v_current_usage,
            'limit', 'unlimited'
        );
    END IF;
    
    -- Check if limit would be exceeded
    IF v_current_usage + p_quantity > v_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_usage', v_current_usage,
            'limit', v_limit,
            'would_exceed', v_current_usage + p_quantity,
            'plan', v_user_plan,
            'limit_type', p_limit_type
        );
    END IF;
    
    RETURN jsonb_build_object(
        'allowed', true,
        'current_usage', v_current_usage,
        'limit', v_limit,
        'after_action', v_current_usage + p_quantity,
        'plan', v_user_plan
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to process pending plan changes
CREATE OR REPLACE FUNCTION process_pending_plan_changes()
RETURNS INTEGER AS $$
DECLARE
    v_processed_count INTEGER := 0;
    v_change RECORD;
BEGIN
    -- Process all pending changes that are due
    FOR v_change IN 
        SELECT * FROM pending_plan_changes 
        WHERE NOT processed 
            AND effective_date <= NOW()
        ORDER BY effective_date ASC
    LOOP
        -- Update user subscription
        UPDATE user_subscriptions 
        SET 
            plan = v_change.new_plan,
            updated_at = NOW()
        WHERE user_id = v_change.user_id;
        
        -- Mark as processed
        UPDATE pending_plan_changes 
        SET 
            processed = TRUE,
            processed_at = NOW()
        WHERE id = v_change.id;
        
        v_processed_count := v_processed_count + 1;
        
        -- Log the change
        INSERT INTO user_activities (
            user_id,
            activity_type,
            details
        ) VALUES (
            v_change.user_id,
            'plan_change_processed',
            jsonb_build_object(
                'old_plan', v_change.current_plan,
                'new_plan', v_change.new_plan,
                'change_type', v_change.change_type,
                'scheduled_date', v_change.effective_date
            )
        );
    END LOOP;
    
    RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- Function to process immediate tier upgrade
CREATE OR REPLACE FUNCTION process_tier_upgrade(
    p_user_id UUID,
    p_new_tier VARCHAR(50),
    p_current_tier VARCHAR(50),
    p_triggered_by VARCHAR(100) DEFAULT 'user_action',
    p_metadata TEXT DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Update user subscription immediately
    UPDATE user_subscriptions 
    SET 
        plan = p_new_tier,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Reset usage counters for current billing cycle
    UPDATE analysis_usage 
    SET 
        quantity = 0,
        updated_at = NOW()
    WHERE user_id = p_user_id 
        AND billing_cycle_start <= CURRENT_DATE
        AND billing_cycle_end >= CURRENT_DATE;
    
    -- Log the upgrade
    INSERT INTO user_activities (
        user_id,
        activity_type,
        details
    ) VALUES (
        p_user_id,
        'tier_upgrade_processed',
        jsonb_build_object(
            'old_tier', p_current_tier,
            'new_tier', p_new_tier,
            'triggered_by', p_triggered_by,
            'metadata', p_metadata::jsonb,
            'processed_at', NOW(),
            'usage_reset', true
        )
    );
    
    v_result := jsonb_build_object(
        'success', true,
        'old_tier', p_current_tier,
        'new_tier', p_new_tier,
        'processed_at', NOW(),
        'usage_reset', true
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on analysis_usage
ALTER TABLE analysis_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "analysis_usage_user_policy" ON analysis_usage
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins can see all usage
CREATE POLICY "analysis_usage_admin_policy" ON analysis_usage
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- Enable RLS on pending_plan_changes
ALTER TABLE pending_plan_changes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own plan changes
CREATE POLICY "pending_plan_changes_user_policy" ON pending_plan_changes
    FOR SELECT
    USING (user_id = auth.uid());

-- Admins can manage all plan changes
CREATE POLICY "pending_plan_changes_admin_policy" ON pending_plan_changes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- ============================================================================
-- SCHEDULED JOBS (commented for manual setup)
-- ============================================================================

-- Note: These would typically be set up as cron jobs or scheduled functions
-- SELECT cron.schedule('process-plan-changes', '0 0 * * *', 'SELECT process_pending_plan_changes()');

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert sample analysis usage (only in development)
DO $$
BEGIN
    IF current_setting('app.environment', true) = 'development' THEN
        -- Sample usage data would go here
        RAISE NOTICE 'Sample data not inserted in production';
    END IF;
END $$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION  
-- ============================================================================

COMMENT ON TABLE analysis_usage IS 'Tracks analysis usage per user per billing cycle for tier limit enforcement';
COMMENT ON TABLE pending_plan_changes IS 'Manages deferred plan changes (downgrades) that apply at next billing cycle';
COMMENT ON VIEW tier_usage_summary IS 'Complete view of user tier limits and current usage for reporting';
COMMENT ON FUNCTION record_analysis_usage IS 'Records analysis usage for tier limit tracking';
COMMENT ON FUNCTION check_tier_limit IS 'Validates if user can perform action based on tier limits';
COMMENT ON FUNCTION process_pending_plan_changes IS 'Processes pending plan changes that are due to take effect';