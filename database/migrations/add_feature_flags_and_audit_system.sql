-- Migration: Add Feature Flags and Admin Audit System
-- Issue #294: Kill Switch global y panel de control de feature flags para administradores
-- Created: 2025-01-09

-- Create feature_flags table for dynamic feature management
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key VARCHAR(100) NOT NULL UNIQUE,
    flag_name VARCHAR(200) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    flag_type VARCHAR(50) NOT NULL DEFAULT 'boolean', -- 'boolean', 'string', 'number', 'json'
    flag_value JSONB DEFAULT 'false'::jsonb, -- Stores the actual value (boolean, string, number, or JSON)
    category VARCHAR(100) DEFAULT 'general', -- 'system', 'autopost', 'ui', 'experimental', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Create admin_audit_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL, -- 'kill_switch_toggle', 'feature_flag_update', 'user_suspend', etc.
    resource_type VARCHAR(100) NOT NULL, -- 'kill_switch', 'feature_flag', 'user', etc.
    resource_id VARCHAR(200), -- ID of the affected resource (flag_key, user_id, etc.)
    old_value JSONB, -- Previous state/value
    new_value JSONB, -- New state/value
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(is_enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);
CREATE INDEX IF NOT EXISTS idx_feature_flags_updated_at ON feature_flags(updated_at);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_type ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

-- Create updated_at trigger for feature_flags
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_flags_updated_at();

-- Insert initial feature flags
INSERT INTO feature_flags (flag_key, flag_name, description, is_enabled, category, flag_value) VALUES
-- Kill Switch (most important)
('KILL_SWITCH_AUTOPOST', 'Kill Switch - Autopost Global', 'Emergency kill switch to disable all automatic posting across all accounts', false, 'system', 'false'::jsonb),

-- Core System Features
('ENABLE_AUTOPOST', 'Enable Autopost', 'Allow automatic posting of responses to social media platforms', true, 'autopost', 'true'::jsonb),
('ENABLE_MANUAL_APPROVAL', 'Enable Manual Approval', 'Require manual approval before posting responses', false, 'autopost', 'false'::jsonb),

-- Platform-specific autopost controls
('AUTOPOST_TWITTER', 'Autopost - Twitter', 'Enable automatic posting to Twitter/X', true, 'autopost', 'true'::jsonb),
('AUTOPOST_YOUTUBE', 'Autopost - YouTube', 'Enable automatic posting to YouTube comments', true, 'autopost', 'true'::jsonb),
('AUTOPOST_INSTAGRAM', 'Autopost - Instagram', 'Enable automatic posting to Instagram', false, 'autopost', 'false'::jsonb),
('AUTOPOST_FACEBOOK', 'Autopost - Facebook', 'Enable automatic posting to Facebook', false, 'autopost', 'false'::jsonb),
('AUTOPOST_DISCORD', 'Autopost - Discord', 'Enable automatic posting to Discord', true, 'autopost', 'true'::jsonb),
('AUTOPOST_TWITCH', 'Autopost - Twitch', 'Enable automatic posting to Twitch', true, 'autopost', 'true'::jsonb),
('AUTOPOST_REDDIT', 'Autopost - Reddit', 'Enable automatic posting to Reddit', false, 'autopost', 'false'::jsonb),
('AUTOPOST_TIKTOK', 'Autopost - TikTok', 'Enable automatic posting to TikTok', false, 'autopost', 'false'::jsonb),
('AUTOPOST_BLUESKY', 'Autopost - Bluesky', 'Enable automatic posting to Bluesky', true, 'autopost', 'true'::jsonb),

-- UI Features
('ENABLE_STYLE_STUDIO', 'Enable Style Studio', 'Show Style Studio feature in the UI', true, 'ui', 'true'::jsonb),
('ENABLE_HALL_OF_FAME', 'Enable Hall of Fame', 'Show Hall of Fame feature in the UI', true, 'ui', 'true'::jsonb),
('ENABLE_POLICY_SIMULATOR', 'Enable Policy Simulator', 'Show Policy Simulator feature in the UI', false, 'ui', 'false'::jsonb),
('ENABLE_ENGAGEMENT_COPILOT', 'Enable Engagement Copilot', 'Show Engagement Copilot feature in the UI', false, 'ui', 'false'::jsonb),

-- Experimental Features
('ENABLE_AI_PERSONAS', 'Enable AI Personas', 'Allow users to create and use custom AI personas', false, 'experimental', 'false'::jsonb),
('ENABLE_ADVANCED_ANALYTICS', 'Enable Advanced Analytics', 'Show advanced analytics and insights', false, 'experimental', 'false'::jsonb),
('ENABLE_BULK_OPERATIONS', 'Enable Bulk Operations', 'Allow bulk operations on responses and comments', false, 'experimental', 'false'::jsonb),

-- Safety and Moderation
('ENABLE_SHIELD_MODE', 'Enable Shield Mode', 'Enable Shield automated moderation system', true, 'system', 'true'::jsonb),
('ENABLE_TOXICITY_FILTER', 'Enable Toxicity Filter', 'Filter out highly toxic content from processing', true, 'system', 'true'::jsonb),
('ENABLE_CONTENT_WARNINGS', 'Enable Content Warnings', 'Show content warnings for sensitive material', true, 'system', 'true'::jsonb)

ON CONFLICT (flag_key) DO NOTHING;

-- Add RLS policies for security
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write feature flags
CREATE POLICY "Admin only access to feature flags" ON feature_flags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true 
            AND users.active = true
        )
    );

-- Only admins can read audit logs, no one can modify them directly
CREATE POLICY "Admin read-only access to audit logs" ON admin_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true 
            AND users.active = true
        )
    );

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON admin_audit_logs
    FOR INSERT WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON feature_flags TO authenticated;
GRANT SELECT, INSERT ON admin_audit_logs TO authenticated;

-- Comments for documentation
COMMENT ON TABLE feature_flags IS 'Dynamic feature flags for controlling system behavior without deployments';
COMMENT ON TABLE admin_audit_logs IS 'Audit trail for all administrative actions and feature flag changes';
COMMENT ON COLUMN feature_flags.flag_key IS 'Unique identifier for the feature flag (used in code)';
COMMENT ON COLUMN feature_flags.flag_value IS 'JSONB value allowing boolean, string, number, or complex JSON values';
COMMENT ON COLUMN feature_flags.category IS 'Grouping for organizing flags in the admin UI';
COMMENT ON COLUMN admin_audit_logs.action_type IS 'Type of action performed (kill_switch_toggle, feature_flag_update, etc.)';
COMMENT ON COLUMN admin_audit_logs.resource_type IS 'Type of resource affected (kill_switch, feature_flag, user, etc.)';
COMMENT ON COLUMN admin_audit_logs.old_value IS 'Previous state before the change';
COMMENT ON COLUMN admin_audit_logs.new_value IS 'New state after the change';
