-- Migration for Issue #371: SPEC 15 — Backoffice (MVP)
-- Adds support for global thresholds, feature flags, and healthcheck storage

-- Global Shield Settings table for system-wide thresholds
CREATE TABLE IF NOT EXISTS global_shield_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    scope TEXT NOT NULL DEFAULT 'global',
    tau_roast_lower DECIMAL(4,3) NOT NULL DEFAULT 0.25,
    tau_shield DECIMAL(4,3) NOT NULL DEFAULT 0.70,
    tau_critical DECIMAL(4,3) NOT NULL DEFAULT 0.90,
    aggressiveness INTEGER NOT NULL DEFAULT 95,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT valid_thresholds CHECK (
        tau_roast_lower >= 0 AND tau_roast_lower <= 1 AND
        tau_shield >= 0 AND tau_shield <= 1 AND
        tau_critical >= 0 AND tau_critical <= 1 AND
        tau_roast_lower < tau_shield AND
        tau_shield < tau_critical
    ),
    CONSTRAINT valid_aggressiveness CHECK (aggressiveness IN (90, 95, 98, 100)),
    CONSTRAINT unique_global_scope UNIQUE(scope)
);

-- Backoffice Feature Flags table (extends existing feature_flags if needed)
DO $$
BEGIN
    -- Check if feature_flags table exists, create if not
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feature_flags') THEN
        CREATE TABLE feature_flags (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            flag_key TEXT NOT NULL UNIQUE,
            flag_name TEXT NOT NULL,
            is_enabled BOOLEAN NOT NULL DEFAULT false,
            flag_value JSONB DEFAULT 'true',
            description TEXT,
            category TEXT DEFAULT 'general',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_by UUID REFERENCES users(id)
        );
    END IF;
END $$;

-- Add backoffice-specific feature flags
INSERT INTO feature_flags (flag_key, flag_name, is_enabled, description, category) VALUES
    ('shop_enabled', 'Shop Feature', false, 'Enable/disable the shop functionality', 'backoffice'),
    ('roast_versions', 'Multiple Roast Versions', false, 'Enable generation of multiple roast versions', 'backoffice'),
    ('review_queue', 'Review Queue', false, 'Enable manual review queue for sensitive content', 'backoffice')
ON CONFLICT (flag_key) DO NOTHING;

-- Healthcheck Results table for storing API status checks
CREATE TABLE IF NOT EXISTS healthcheck_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    checked_by UUID NOT NULL REFERENCES users(id),
    results JSONB NOT NULL,
    platforms_checked TEXT[] NOT NULL,
    overall_status TEXT NOT NULL CHECK (overall_status IN ('OK', 'FAIL', 'PARTIAL')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for querying recent results
    INDEX idx_healthcheck_results_created_at ON healthcheck_results(created_at DESC)
);

-- Admin Audit Logs table (extends existing if needed)
DO $$
BEGIN
    -- Check if admin_audit_logs table exists, create if not
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_logs') THEN
        CREATE TABLE admin_audit_logs (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            admin_user_id UUID NOT NULL REFERENCES users(id),
            action_type TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id TEXT,
            old_value JSONB,
            new_value JSONB,
            description TEXT,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            -- Indexes for querying
            INDEX idx_audit_logs_admin_user ON admin_audit_logs(admin_user_id),
            INDEX idx_audit_logs_created_at ON admin_audit_logs(created_at DESC),
            INDEX idx_audit_logs_action_type ON admin_audit_logs(action_type),
            INDEX idx_audit_logs_resource_type ON admin_audit_logs(resource_type)
        );
    END IF;
END $$;

-- Row Level Security for global_shield_settings
ALTER TABLE global_shield_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify global settings
CREATE POLICY "Admins can access global shield settings" ON global_shield_settings
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'authenticated' AND 
           EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- Row Level Security for healthcheck_results
ALTER TABLE healthcheck_results ENABLE ROW LEVEL SECURITY;

-- Only admins can view healthcheck results
CREATE POLICY "Admins can access healthcheck results" ON healthcheck_results
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'authenticated' AND 
           EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- Update trigger for global_shield_settings
CREATE OR REPLACE FUNCTION update_global_shield_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER global_shield_settings_updated_at
    BEFORE UPDATE ON global_shield_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_global_shield_settings_timestamp();

-- Function to validate threshold hierarchy when updating
CREATE OR REPLACE FUNCTION validate_threshold_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tau_roast_lower >= NEW.tau_shield THEN
        RAISE EXCEPTION 'tau_roast_lower must be less than tau_shield';
    END IF;
    
    IF NEW.tau_shield >= NEW.tau_critical THEN
        RAISE EXCEPTION 'tau_shield must be less than tau_critical';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_thresholds
    BEFORE INSERT OR UPDATE ON global_shield_settings
    FOR EACH ROW
    EXECUTE FUNCTION validate_threshold_hierarchy();

-- Insert default global settings if none exist
INSERT INTO global_shield_settings (scope, tau_roast_lower, tau_shield, tau_critical, aggressiveness)
VALUES ('global', 0.25, 0.70, 0.90, 95)
ON CONFLICT (scope) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON global_shield_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON healthcheck_results TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_audit_logs TO service_role;
GRANT SELECT, UPDATE ON feature_flags TO service_role;

-- Comments for documentation
COMMENT ON TABLE global_shield_settings IS 'Global Shield thresholds configuration for backoffice management (Issue #371)';
COMMENT ON TABLE healthcheck_results IS 'Platform API healthcheck results for monitoring (Issue #371)';
COMMENT ON COLUMN global_shield_settings.tau_roast_lower IS 'Lower threshold for roast generation eligibility';
COMMENT ON COLUMN global_shield_settings.tau_shield IS 'Shield activation threshold for content moderation';
COMMENT ON COLUMN global_shield_settings.tau_critical IS 'Critical threshold for immediate action';
COMMENT ON COLUMN global_shield_settings.aggressiveness IS 'Overall Shield aggressiveness level (90/95/98/100)';