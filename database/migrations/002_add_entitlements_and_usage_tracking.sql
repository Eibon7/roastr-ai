-- Migration 002: Add Entitlements and Usage Tracking Tables
-- Issue #168: Backend Entitlements per plan from Stripe + usage limits

-- ============================================================================
-- ACCOUNT ENTITLEMENTS
-- ============================================================================

-- Account entitlements table - source of truth from Stripe Price metadata
CREATE TABLE account_entitlements (
    account_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Limits from Stripe Price metadata
    analysis_limit_monthly INTEGER NOT NULL DEFAULT 100,
    roast_limit_monthly INTEGER NOT NULL DEFAULT 100,
    
    -- Features from Stripe Price metadata
    model TEXT DEFAULT 'gpt-3.5-turbo',
    shield_enabled BOOLEAN DEFAULT FALSE,
    rqc_mode TEXT DEFAULT 'basic', -- basic, advanced, premium
    
    -- Stripe source information
    stripe_price_id TEXT,
    stripe_product_id TEXT,
    plan_name TEXT NOT NULL DEFAULT 'free',
    
    -- Metadata for debugging and auditing
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT account_entitlements_rqc_mode_check 
        CHECK (rqc_mode IN ('basic', 'advanced', 'premium')),
    CONSTRAINT account_entitlements_plan_name_check 
        CHECK (plan_name IN ('free', 'starter', 'pro', 'creator_plus', 'custom')),
    CONSTRAINT account_entitlements_limits_positive 
        CHECK (analysis_limit_monthly >= 0 AND roast_limit_monthly >= 0)
);

-- ============================================================================
-- USAGE COUNTERS
-- ============================================================================

-- Usage counters table - tracks monthly consumption
CREATE TABLE usage_counters (
    account_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Current usage counters
    analysis_used INTEGER DEFAULT 0,
    roasts_used INTEGER DEFAULT 0,
    
    -- Billing period tracking
    period_start DATE NOT NULL DEFAULT DATE_TRUNC('month', NOW())::DATE,
    period_end DATE NOT NULL DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month - 1 day')::DATE,
    
    -- Metadata for debugging
    last_analysis_at TIMESTAMPTZ,
    last_roast_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT usage_counters_usage_positive 
        CHECK (analysis_used >= 0 AND roasts_used >= 0),
    CONSTRAINT usage_counters_period_valid 
        CHECK (period_end > period_start)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for efficient queries
CREATE INDEX idx_account_entitlements_stripe_price_id ON account_entitlements(stripe_price_id);
CREATE INDEX idx_account_entitlements_plan_name ON account_entitlements(plan_name);
CREATE INDEX idx_account_entitlements_updated_at ON account_entitlements(updated_at);

CREATE INDEX idx_usage_counters_period_start ON usage_counters(period_start);
CREATE INDEX idx_usage_counters_period_end ON usage_counters(period_end);
CREATE INDEX idx_usage_counters_updated_at ON usage_counters(updated_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE account_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own entitlements and usage
CREATE POLICY account_entitlements_isolation ON account_entitlements FOR ALL 
    USING (account_id = auth.uid());
    
CREATE POLICY usage_counters_isolation ON usage_counters FOR ALL 
    USING (account_id = auth.uid());

-- Service role can manage all records for system operations
CREATE POLICY account_entitlements_service_access ON account_entitlements FOR ALL 
    USING (auth.role() = 'service_role');
    
CREATE POLICY usage_counters_service_access ON usage_counters FOR ALL 
    USING (auth.role() = 'service_role');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Apply automatic updated_at timestamp updates
CREATE TRIGGER update_account_entitlements_updated_at 
    BEFORE UPDATE ON account_entitlements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_counters_updated_at 
    BEFORE UPDATE ON usage_counters 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to check if user has reached usage limit
CREATE OR REPLACE FUNCTION check_usage_limit(
    user_id UUID,
    usage_type TEXT -- 'analysis' or 'roasts'
)
RETURNS BOOLEAN AS $$
DECLARE
    entitlements_record RECORD;
    usage_record RECORD;
    current_limit INTEGER;
    current_usage INTEGER;
BEGIN
    -- Get entitlements for user
    SELECT * INTO entitlements_record 
    FROM account_entitlements 
    WHERE account_id = user_id;
    
    -- Get current usage for user
    SELECT * INTO usage_record 
    FROM usage_counters 
    WHERE account_id = user_id 
        AND period_start <= CURRENT_DATE 
        AND period_end >= CURRENT_DATE;
    
    -- If no entitlements found, default to free plan limits
    IF entitlements_record IS NULL THEN
        IF usage_type = 'analysis' THEN
            current_limit := 100;
        ELSIF usage_type = 'roasts' THEN
            current_limit := 100;
        ELSE
            RETURN FALSE; -- Invalid usage type
        END IF;
    ELSE
        IF usage_type = 'analysis' THEN
            current_limit := entitlements_record.analysis_limit_monthly;
        ELSIF usage_type = 'roasts' THEN
            current_limit := entitlements_record.roast_limit_monthly;
        ELSE
            RETURN FALSE; -- Invalid usage type
        END IF;
    END IF;
    
    -- If no usage record found, usage is 0
    IF usage_record IS NULL THEN
        current_usage := 0;
    ELSE
        IF usage_type = 'analysis' THEN
            current_usage := usage_record.analysis_used;
        ELSIF usage_type = 'roasts' THEN
            current_usage := usage_record.roasts_used;
        END IF;
    END IF;
    
    -- Return true if under limit (allow unlimited if limit is -1)
    RETURN current_limit = -1 OR current_usage < current_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(
    user_id UUID,
    usage_type TEXT, -- 'analysis' or 'roasts'
    increment_by INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    current_month_start DATE := DATE_TRUNC('month', NOW())::DATE;
    current_month_end DATE := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month - 1 day')::DATE;
    rows_affected INTEGER;
BEGIN
    -- Validate usage type
    IF usage_type NOT IN ('analysis', 'roasts') THEN
        RAISE EXCEPTION 'Invalid usage_type. Must be analysis or roasts';
    END IF;
    
    -- Insert or update usage counter for current month
    INSERT INTO usage_counters (
        account_id, 
        analysis_used, 
        roasts_used,
        period_start,
        period_end,
        last_analysis_at,
        last_roast_at
    )
    VALUES (
        user_id,
        CASE WHEN usage_type = 'analysis' THEN increment_by ELSE 0 END,
        CASE WHEN usage_type = 'roasts' THEN increment_by ELSE 0 END,
        current_month_start,
        current_month_end,
        CASE WHEN usage_type = 'analysis' THEN NOW() ELSE NULL END,
        CASE WHEN usage_type = 'roasts' THEN NOW() ELSE NULL END
    )
    ON CONFLICT (account_id) 
    DO UPDATE SET
        analysis_used = CASE 
            WHEN usage_type = 'analysis' THEN usage_counters.analysis_used + increment_by
            ELSE usage_counters.analysis_used
        END,
        roasts_used = CASE 
            WHEN usage_type = 'roasts' THEN usage_counters.roasts_used + increment_by
            ELSE usage_counters.roasts_used
        END,
        last_analysis_at = CASE 
            WHEN usage_type = 'analysis' THEN NOW()
            ELSE usage_counters.last_analysis_at
        END,
        last_roast_at = CASE 
            WHEN usage_type = 'roasts' THEN NOW()
            ELSE usage_counters.last_roast_at
        END,
        -- Reset counters if we've moved to a new billing period
        period_start = CASE 
            WHEN usage_counters.period_start < current_month_start THEN current_month_start
            ELSE usage_counters.period_start
        END,
        period_end = CASE 
            WHEN usage_counters.period_end < current_month_end THEN current_month_end
            ELSE usage_counters.period_end
        END,
        updated_at = NOW()
    WHERE usage_counters.account_id = user_id;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset usage counters (for monthly cron job)
CREATE OR REPLACE FUNCTION reset_monthly_usage_counters()
RETURNS INTEGER AS $$
DECLARE
    rows_updated INTEGER;
    current_month_start DATE := DATE_TRUNC('month', NOW())::DATE;
    current_month_end DATE := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month - 1 day')::DATE;
BEGIN
    -- Reset all usage counters for accounts that have passed their billing period
    UPDATE usage_counters 
    SET 
        analysis_used = 0,
        roasts_used = 0,
        period_start = current_month_start,
        period_end = current_month_end,
        last_analysis_at = NULL,
        last_roast_at = NULL,
        updated_at = NOW()
    WHERE period_end < CURRENT_DATE;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    
    RETURN rows_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Function to create default entitlements for new users
CREATE OR REPLACE FUNCTION create_default_entitlements()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default free plan entitlements for new user
    INSERT INTO account_entitlements (
        account_id,
        analysis_limit_monthly,
        roast_limit_monthly,
        model,
        shield_enabled,
        rqc_mode,
        plan_name
    ) VALUES (
        NEW.id,
        100, -- Free plan: 100 analyses per month
        100, -- Free plan: 100 roasts per month
        'gpt-3.5-turbo',
        FALSE,
        'basic',
        'free'
    );
    
    -- Create initial usage counter for new user
    INSERT INTO usage_counters (
        account_id,
        analysis_used,
        roasts_used
    ) VALUES (
        NEW.id,
        0,
        0
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default entitlements for new users
CREATE TRIGGER create_default_entitlements_trigger
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_default_entitlements();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE account_entitlements IS 'Source of truth for user plan entitlements from Stripe Price metadata';
COMMENT ON TABLE usage_counters IS 'Monthly usage tracking with automatic reset functionality';

COMMENT ON COLUMN account_entitlements.analysis_limit_monthly IS 'Monthly limit for toxicity analysis requests (-1 for unlimited)';
COMMENT ON COLUMN account_entitlements.roast_limit_monthly IS 'Monthly limit for roast generation requests (-1 for unlimited)';
COMMENT ON COLUMN account_entitlements.model IS 'AI model to use (gpt-3.5-turbo, gpt-4, etc.)';
COMMENT ON COLUMN account_entitlements.shield_enabled IS 'Whether Shield automated moderation is enabled';
COMMENT ON COLUMN account_entitlements.rqc_mode IS 'Response Quality Control mode (basic, advanced, premium)';

COMMENT ON COLUMN usage_counters.period_start IS 'Start of current billing period (inclusive)';
COMMENT ON COLUMN usage_counters.period_end IS 'End of current billing period (inclusive)';

COMMENT ON FUNCTION check_usage_limit IS 'Check if user has reached their usage limit for analysis or roasts';
COMMENT ON FUNCTION increment_usage IS 'Increment usage counter and handle monthly period resets';
COMMENT ON FUNCTION reset_monthly_usage_counters IS 'Reset all usage counters at start of new billing period';