-- Migration: Plan Limits Configuration
-- Issue #99: Move usage limit configuration to database
-- Allows modifying plan limits without code deployment

-- ============================================================================
-- PLAN LIMITS TABLE
-- ============================================================================

-- Create plan_limits table for storing configurable limits per plan
CREATE TABLE IF NOT EXISTS plan_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id VARCHAR(50) NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    
    -- Response limits
    max_roasts INTEGER NOT NULL DEFAULT 100,
    monthly_responses_limit INTEGER NOT NULL DEFAULT 100,
    
    -- Platform limits
    max_platforms INTEGER NOT NULL DEFAULT 1,
    integrations_limit INTEGER NOT NULL DEFAULT 2,
    
    -- Feature toggles
    shield_enabled BOOLEAN DEFAULT FALSE,
    custom_prompts BOOLEAN DEFAULT FALSE,
    priority_support BOOLEAN DEFAULT FALSE,
    api_access BOOLEAN DEFAULT FALSE,
    analytics_enabled BOOLEAN DEFAULT FALSE,
    custom_tones BOOLEAN DEFAULT FALSE,
    dedicated_support BOOLEAN DEFAULT FALSE,
    
    -- Cost control limits
    monthly_tokens_limit INTEGER,
    daily_api_calls_limit INTEGER,
    
    -- Additional settings
    settings JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    -- Ensure one limit configuration per plan
    UNIQUE(plan_id)
);

-- Create index for faster lookups
CREATE INDEX idx_plan_limits_plan_id ON plan_limits(plan_id);

-- ============================================================================
-- MIGRATE EXISTING PLAN LIMITS FROM HARDCODED VALUES
-- ============================================================================

-- Insert default limits based on existing hardcoded values
INSERT INTO plan_limits (
    plan_id, 
    max_roasts, 
    monthly_responses_limit,
    max_platforms,
    integrations_limit,
    shield_enabled,
    custom_prompts,
    priority_support,
    api_access,
    analytics_enabled,
    custom_tones,
    dedicated_support,
    monthly_tokens_limit,
    daily_api_calls_limit
) VALUES
    -- Free plan limits
    ('free', 100, 100, 1, 2, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 10000, 100),
    
    -- Pro plan limits
    ('pro', 1000, 1000, 5, 5, TRUE, FALSE, TRUE, FALSE, TRUE, FALSE, FALSE, 100000, 1000),
    
    -- Creator Plus plan limits
    ('creator_plus', -1, 5000, -1, 999, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 500000, -1),
    
    -- Custom plan limits (enterprise)
    ('custom', -1, 999999, -1, 999, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, -1, -1)
ON CONFLICT (plan_id) DO UPDATE SET
    updated_at = NOW();

-- ============================================================================
-- AUDIT LOG FOR PLAN LIMIT CHANGES
-- ============================================================================

-- Create audit log table for tracking plan limit modifications
CREATE TABLE IF NOT EXISTS plan_limits_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id VARCHAR(50) NOT NULL,
    
    -- Change details
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Before and after values
    old_values JSONB,
    new_values JSONB,
    
    -- Change metadata
    change_reason TEXT,
    ip_address INET,
    user_agent TEXT
);

-- Create index for audit queries
CREATE INDEX idx_plan_limits_audit_plan_id ON plan_limits_audit(plan_id, changed_at DESC);
CREATE INDEX idx_plan_limits_audit_changed_by ON plan_limits_audit(changed_by, changed_at DESC);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_plan_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER plan_limits_updated_at_trigger
    BEFORE UPDATE ON plan_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_plan_limits_updated_at();

-- Function to log plan limit changes
CREATE OR REPLACE FUNCTION log_plan_limits_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO plan_limits_audit (
            plan_id,
            action,
            changed_by,
            old_values,
            new_values
        ) VALUES (
            NEW.plan_id,
            'update',
            NEW.updated_by,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO plan_limits_audit (
            plan_id,
            action,
            changed_by,
            new_values
        ) VALUES (
            NEW.plan_id,
            'create',
            NEW.updated_by,
            to_jsonb(NEW)
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO plan_limits_audit (
            plan_id,
            action,
            changed_by,
            old_values
        ) VALUES (
            OLD.plan_id,
            'delete',
            current_setting('app.current_user_id', true)::UUID,
            to_jsonb(OLD)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log all changes
CREATE TRIGGER plan_limits_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON plan_limits
    FOR EACH ROW
    EXECUTE FUNCTION log_plan_limits_change();

-- ============================================================================
-- FUNCTIONS FOR PLAN LIMIT RETRIEVAL
-- ============================================================================

-- Function to get plan limits with caching support
CREATE OR REPLACE FUNCTION get_plan_limits(p_plan_id VARCHAR(50))
RETURNS JSONB AS $$
DECLARE
    v_limits JSONB;
BEGIN
    SELECT to_jsonb(pl.*) INTO v_limits
    FROM plan_limits pl
    WHERE pl.plan_id = p_plan_id;
    
    -- Return free plan limits as default if not found
    IF v_limits IS NULL THEN
        SELECT to_jsonb(pl.*) INTO v_limits
        FROM plan_limits pl
        WHERE pl.plan_id = 'free';
    END IF;
    
    RETURN v_limits;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if a specific limit is exceeded
CREATE OR REPLACE FUNCTION check_plan_limit(
    p_plan_id VARCHAR(50),
    p_limit_type VARCHAR(50),
    p_current_usage INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
BEGIN
    -- Get the specific limit value
    CASE p_limit_type
        WHEN 'roasts' THEN
            SELECT max_roasts INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'platforms' THEN
            SELECT max_platforms INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'monthly_responses' THEN
            SELECT monthly_responses_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'integrations' THEN
            SELECT integrations_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'monthly_tokens' THEN
            SELECT monthly_tokens_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'daily_api_calls' THEN
            SELECT daily_api_calls_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        ELSE
            RETURN FALSE; -- Unknown limit type
    END CASE;
    
    -- -1 means unlimited
    IF v_limit = -1 THEN
        RETURN FALSE; -- Not exceeded
    END IF;
    
    -- Check if current usage exceeds limit
    RETURN p_current_usage >= v_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on plan_limits table
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

-- Policy for reading plan limits (everyone can read)
CREATE POLICY "plan_limits_read_policy" ON plan_limits
    FOR SELECT
    USING (true);

-- Policy for updating plan limits (only admins)
CREATE POLICY "plan_limits_update_policy" ON plan_limits
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- Policy for inserting plan limits (only admins)
CREATE POLICY "plan_limits_insert_policy" ON plan_limits
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- Policy for deleting plan limits (only admins)
CREATE POLICY "plan_limits_delete_policy" ON plan_limits
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
        )
    );

-- Enable RLS on audit table
ALTER TABLE plan_limits_audit ENABLE ROW LEVEL SECURITY;

-- Policy for reading audit logs (only admins)
CREATE POLICY "plan_limits_audit_read_policy" ON plan_limits_audit
    FOR SELECT
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

COMMENT ON TABLE plan_limits IS 'Configurable limits for each subscription plan';
COMMENT ON COLUMN plan_limits.max_roasts IS 'Maximum number of roasts per month (-1 for unlimited)';
COMMENT ON COLUMN plan_limits.max_platforms IS 'Maximum number of platform integrations (-1 for unlimited)';
COMMENT ON COLUMN plan_limits.monthly_responses_limit IS 'Monthly response generation limit';
COMMENT ON COLUMN plan_limits.settings IS 'Additional JSON configuration for plan-specific settings';

COMMENT ON TABLE plan_limits_audit IS 'Audit log for tracking changes to plan limits';
COMMENT ON FUNCTION get_plan_limits IS 'Retrieve plan limits as JSON for a given plan ID';
COMMENT ON FUNCTION check_plan_limit IS 'Check if a specific usage limit has been exceeded for a plan';