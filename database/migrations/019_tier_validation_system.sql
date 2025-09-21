-- Migration: Tier Validation System - SPEC 10 (CodeRabbit Round 2 Enhanced)
-- Implements usage tracking and plan change management for tier limits with atomic operations

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
-- USAGE RESETS TABLE (CodeRabbit Round 2 - Non-destructive resets)
-- ============================================================================

-- Table to track usage resets for tier upgrades (preserves historical data)
CREATE TABLE IF NOT EXISTS usage_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Reset details
    reset_type VARCHAR(50) NOT NULL CHECK (reset_type IN ('tier_upgrade', 'manual_admin', 'billing_cycle')),
    reset_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_usage_resets_user_timestamp ON usage_resets(user_id, reset_timestamp DESC);
CREATE INDEX idx_usage_resets_type ON usage_resets(reset_type, reset_timestamp DESC);

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

-- View for easy tier usage reporting (considers reset markers)
CREATE OR REPLACE VIEW tier_usage_summary AS
SELECT 
    u.id as user_id,
    u.email,
    s.plan as current_plan,
    s.status as subscription_status,
    
    -- Current billing cycle
    COALESCE(s.current_period_start, DATE_TRUNC('month', NOW())) as cycle_start,
    COALESCE(s.current_period_end, DATE_TRUNC('month', NOW()) + INTERVAL '1 month') as cycle_end,
    
    -- Latest reset timestamp (for non-destructive counting)
    COALESCE(latest_reset.reset_timestamp, s.current_period_start, DATE_TRUNC('month', NOW())) as effective_cycle_start,
    
    -- Usage counts (from effective cycle start)
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
    -- Latest reset marker per user
    SELECT DISTINCT ON (user_id) 
        user_id,
        reset_timestamp
    FROM usage_resets 
    ORDER BY user_id, reset_timestamp DESC
) latest_reset ON u.id = latest_reset.user_id
LEFT JOIN (
    -- Roast usage from effective cycle start
    SELECT 
        user_id,
        COUNT(*) as roast_count
    FROM user_activities 
    WHERE activity_type = 'roast_generated'
        AND created_at >= COALESCE(
            (SELECT reset_timestamp FROM usage_resets WHERE user_id = user_activities.user_id ORDER BY reset_timestamp DESC LIMIT 1),
            (SELECT current_period_start FROM user_subscriptions WHERE user_id = user_activities.user_id),
            DATE_TRUNC('month', NOW())
        )
    GROUP BY user_id
) roast_usage ON u.id = roast_usage.user_id
LEFT JOIN (
    -- Analysis usage from effective cycle start
    SELECT 
        user_id,
        SUM(quantity) as analysis_count
    FROM analysis_usage
    WHERE created_at >= COALESCE(
        (SELECT reset_timestamp FROM usage_resets WHERE user_id = analysis_usage.user_id ORDER BY reset_timestamp DESC LIMIT 1),
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
-- FUNCTIONS FOR TIER VALIDATION (CodeRabbit Round 2 - Atomic operations)
-- ============================================================================

-- Function to record analysis usage (atomic)
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
    v_platform_validated VARCHAR(50);
BEGIN
    -- CodeRabbit Round 2 - Platform validation
    IF p_platform IS NOT NULL THEN
        v_platform_validated := LOWER(TRIM(p_platform));
        IF v_platform_validated NOT IN ('twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky') THEN
            RAISE EXCEPTION 'Unsupported platform: %. Supported platforms: twitter, youtube, instagram, facebook, discord, twitch, reddit, tiktok, bluesky', p_platform;
        END IF;
    END IF;

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
    
    -- Atomic upsert operation
    BEGIN
        -- Try to update existing record for this cycle
        UPDATE analysis_usage 
        SET 
            quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE user_id = p_user_id 
            AND billing_cycle_start = v_cycle_start
            AND analysis_type = p_analysis_type
            AND (platform = v_platform_validated OR (platform IS NULL AND v_platform_validated IS NULL))
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
                v_platform_validated,
                v_cycle_start, 
                v_cycle_end
            );
        END IF;
        
        RETURN TRUE;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to record analysis usage: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to check tier limits (atomic with proper error handling)
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
    v_reset_timestamp TIMESTAMPTZ;
BEGIN
    -- Input validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;
    
    IF p_limit_type NOT IN ('analysis', 'roast', 'platform') THEN
        RAISE EXCEPTION 'Invalid limit type: %. Valid types: analysis, roast, platform', p_limit_type;
    END IF;

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
    
    IF v_plan_limits IS NULL THEN
        RAISE EXCEPTION 'Plan limits not found for plan: %', v_user_plan;
    END IF;
    
    -- Get effective cycle start (considering resets)
    SELECT COALESCE(
        (SELECT reset_timestamp FROM usage_resets WHERE user_id = p_user_id ORDER BY reset_timestamp DESC LIMIT 1),
        (SELECT current_period_start FROM user_subscriptions WHERE user_id = p_user_id),
        DATE_TRUNC('month', NOW())
    ) INTO v_cycle_start;
    
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
                'allowed', false,
                'reason', 'unknown_limit_type'
            );
    END CASE;
    
    -- Check if unlimited (-1)
    IF v_limit = -1 THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'current_usage', v_current_usage,
            'limit', 'unlimited',
            'plan', v_user_plan
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

-- Function to process pending plan changes (atomic)
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
        FOR UPDATE -- Lock rows to prevent race conditions
    LOOP
        BEGIN
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
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but continue processing other changes
                INSERT INTO user_activities (
                    user_id,
                    activity_type,
                    details
                ) VALUES (
                    v_change.user_id,
                    'plan_change_failed',
                    jsonb_build_object(
                        'error', SQLERRM,
                        'change_id', v_change.id,
                        'old_plan', v_change.current_plan,
                        'new_plan', v_change.new_plan
                    )
                );
        END;
    END LOOP;
    
    RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- Function to process immediate tier upgrade (CodeRabbit Round 2 - Atomic operations)
CREATE OR REPLACE FUNCTION process_tier_upgrade(
    p_user_id UUID,
    p_new_tier VARCHAR(50),
    p_current_tier VARCHAR(50),
    p_triggered_by VARCHAR(100) DEFAULT 'user_action',
    p_metadata TEXT DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_reset_id UUID;
BEGIN
    -- CodeRabbit Round 2 - Atomic transaction with proper error handling
    BEGIN
        -- Validate inputs
        IF p_user_id IS NULL THEN
            RAISE EXCEPTION 'User ID cannot be null';
        END IF;
        
        IF p_new_tier IS NULL OR p_current_tier IS NULL THEN
            RAISE EXCEPTION 'Tier values cannot be null';
        END IF;
        
        -- Update user subscription immediately (atomic operation)
        UPDATE user_subscriptions 
        SET 
            plan = p_new_tier,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        -- Check if update affected any rows
        IF NOT FOUND THEN
            RAISE EXCEPTION 'User subscription not found for user_id: %', p_user_id;
        END IF;
        
        -- CodeRabbit Round 2 - Non-destructive usage reset using reset markers
        INSERT INTO usage_resets (
            user_id,
            reset_type,
            reset_timestamp,
            reason,
            metadata,
            created_by
        ) VALUES (
            p_user_id,
            'tier_upgrade',
            NOW(),
            'Tier upgrade from ' || p_current_tier || ' to ' || p_new_tier,
            jsonb_build_object(
                'old_tier', p_current_tier,
                'new_tier', p_new_tier,
                'triggered_by', p_triggered_by,
                'metadata', p_metadata::jsonb
            ),
            p_user_id
        ) RETURNING id INTO v_reset_id;
        
        -- Log the upgrade (atomic with above operations)
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
                'usage_reset_id', v_reset_id,
                'reset_method', 'non_destructive'
            )
        );
        
        v_result := jsonb_build_object(
            'success', true,
            'old_tier', p_current_tier,
            'new_tier', p_new_tier,
            'processed_at', NOW(),
            'usage_reset_id', v_reset_id,
            'reset_method', 'non_destructive'
        );
        
        RETURN v_result;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Atomic rollback on any error
            RAISE EXCEPTION 'Tier upgrade failed: %', SQLERRM;
    END;
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

-- Enable RLS on usage_resets
ALTER TABLE usage_resets ENABLE ROW LEVEL SECURITY;

-- Users can only see their own resets
CREATE POLICY "usage_resets_user_policy" ON usage_resets
    FOR SELECT
    USING (user_id = auth.uid());

-- Admins can manage all resets
CREATE POLICY "usage_resets_admin_policy" ON usage_resets
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
-- COMMENTS FOR DOCUMENTATION  
-- ============================================================================

COMMENT ON TABLE analysis_usage IS 'Tracks analysis usage per user per billing cycle for tier limit enforcement';
COMMENT ON TABLE usage_resets IS 'Non-destructive usage reset markers for tier upgrades (preserves historical data)';
COMMENT ON TABLE pending_plan_changes IS 'Manages deferred plan changes (downgrades) that apply at next billing cycle';
COMMENT ON VIEW tier_usage_summary IS 'Complete view of user tier limits and current usage for reporting (considers reset markers)';
COMMENT ON FUNCTION record_analysis_usage IS 'Records analysis usage for tier limit tracking with platform validation';
COMMENT ON FUNCTION check_tier_limit IS 'Validates if user can perform action based on tier limits (atomic, fail-safe)';
COMMENT ON FUNCTION process_pending_plan_changes IS 'Processes pending plan changes that are due to take effect (atomic with error handling)';
COMMENT ON FUNCTION process_tier_upgrade IS 'Processes immediate tier upgrades with non-destructive reset markers (atomic)';