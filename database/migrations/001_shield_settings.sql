-- Shield Settings Configuration Migration
-- Adds organization_settings and platform_settings tables for Issue #362

-- Enable uuid-ossp extension for uuid_generate_v4() function
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ORGANIZATION SHIELD SETTINGS
-- ============================================================================

-- Organization-level Shield configuration (defaults for the organization)
CREATE TABLE organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Shield configuration
    aggressiveness INTEGER NOT NULL DEFAULT 95,
    tau_roast_lower DECIMAL(3,2) NOT NULL DEFAULT 0.25,
    tau_shield DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    tau_critical DECIMAL(3,2) NOT NULL DEFAULT 0.90,
    
    -- Shield features
    shield_enabled BOOLEAN DEFAULT TRUE,
    auto_approve_shield_actions BOOLEAN DEFAULT FALSE,
    corrective_messages_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(organization_id),
    CONSTRAINT org_settings_aggressiveness_check CHECK (aggressiveness IN (90, 95, 98, 100)),
    CONSTRAINT org_settings_thresholds_order_check CHECK (
        tau_roast_lower >= 0 AND 
        tau_roast_lower < tau_shield AND 
        tau_shield < tau_critical AND 
        tau_critical <= 1
    ),
    CONSTRAINT org_settings_tau_roast_lower_check CHECK (tau_roast_lower >= 0 AND tau_roast_lower <= 1),
    CONSTRAINT org_settings_tau_shield_check CHECK (tau_shield >= 0 AND tau_shield <= 1),
    CONSTRAINT org_settings_tau_critical_check CHECK (tau_critical >= 0 AND tau_critical <= 1)
);

-- ============================================================================
-- PLATFORM-SPECIFIC SHIELD SETTINGS
-- ============================================================================

-- Platform-specific Shield configuration (overrides organization defaults)
CREATE TABLE platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    
    -- Shield configuration (nullable = inherit from organization)
    aggressiveness INTEGER NULL,
    tau_roast_lower DECIMAL(3,2) NULL,
    tau_shield DECIMAL(3,2) NULL,
    tau_critical DECIMAL(3,2) NULL,
    
    -- Platform-specific features
    shield_enabled BOOLEAN NULL, -- NULL = inherit from organization
    auto_approve_shield_actions BOOLEAN NULL,
    corrective_messages_enabled BOOLEAN NULL,
    
    -- Platform-specific settings
    response_frequency DECIMAL(3,2) DEFAULT 1.0,
    trigger_words TEXT[] DEFAULT ARRAY['roast', 'burn', 'insult'],
    max_responses_per_hour INTEGER DEFAULT 50,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Constraints
    UNIQUE(organization_id, platform),
    CONSTRAINT platform_settings_platform_check CHECK (platform IN ('twitter', 'youtube', 'bluesky', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok')),
    CONSTRAINT platform_settings_aggressiveness_check CHECK (aggressiveness IS NULL OR aggressiveness IN (90, 95, 98, 100)),
    CONSTRAINT platform_settings_thresholds_order_check CHECK (
        (tau_roast_lower IS NULL OR tau_shield IS NULL OR tau_critical IS NULL) OR
        (tau_roast_lower >= 0 AND 
         tau_roast_lower < tau_shield AND 
         tau_shield < tau_critical AND 
         tau_critical <= 1)
    ),
    CONSTRAINT platform_settings_tau_roast_lower_check CHECK (tau_roast_lower IS NULL OR (tau_roast_lower >= 0 AND tau_roast_lower <= 1)),
    CONSTRAINT platform_settings_tau_shield_check CHECK (tau_shield IS NULL OR (tau_shield >= 0 AND tau_shield <= 1)),
    CONSTRAINT platform_settings_tau_critical_check CHECK (tau_critical IS NULL OR (tau_critical >= 0 AND tau_critical <= 1)),
    CONSTRAINT platform_settings_response_frequency_check CHECK (response_frequency >= 0.0 AND response_frequency <= 1.0),
    CONSTRAINT platform_settings_max_responses_check CHECK (max_responses_per_hour > 0)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for efficient queries
CREATE INDEX idx_organization_settings_organization_id ON organization_settings(organization_id);
CREATE INDEX idx_platform_settings_organization_id ON platform_settings(organization_id);
CREATE INDEX idx_platform_settings_platform ON platform_settings(platform);
CREATE INDEX idx_platform_settings_org_platform ON platform_settings(organization_id, platform);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on settings tables
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_settings
CREATE POLICY org_settings_isolation ON organization_settings FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
) WITH CHECK (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

-- RLS Policies for platform_settings
CREATE POLICY platform_settings_isolation ON platform_settings FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
) WITH CHECK (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_organization_settings_updated_at 
    BEFORE UPDATE ON organization_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at 
    BEFORE UPDATE ON platform_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to validate effective thresholds
CREATE OR REPLACE FUNCTION validate_effective_thresholds()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate threshold ordering: tau_roast_lower < tau_shield < tau_critical
    IF NEW.tau_roast_lower IS NOT NULL AND NEW.tau_shield IS NOT NULL AND 
       NEW.tau_roast_lower >= NEW.tau_shield THEN
        RAISE EXCEPTION 'Shield threshold (%.2f) must be greater than roast threshold (%.2f)', 
            NEW.tau_shield, NEW.tau_roast_lower;
    END IF;
    
    IF NEW.tau_shield IS NOT NULL AND NEW.tau_critical IS NOT NULL AND 
       NEW.tau_shield >= NEW.tau_critical THEN
        RAISE EXCEPTION 'Critical threshold (%.2f) must be greater than shield threshold (%.2f)', 
            NEW.tau_critical, NEW.tau_shield;
    END IF;
    
    -- Validate threshold ranges (0-1)
    IF NEW.tau_roast_lower IS NOT NULL AND (NEW.tau_roast_lower < 0 OR NEW.tau_roast_lower > 1) THEN
        RAISE EXCEPTION 'Roast threshold must be between 0 and 1, got %.2f', NEW.tau_roast_lower;
    END IF;
    
    IF NEW.tau_shield IS NOT NULL AND (NEW.tau_shield < 0 OR NEW.tau_shield > 1) THEN
        RAISE EXCEPTION 'Shield threshold must be between 0 and 1, got %.2f', NEW.tau_shield;
    END IF;
    
    IF NEW.tau_critical IS NOT NULL AND (NEW.tau_critical < 0 OR NEW.tau_critical > 1) THEN
        RAISE EXCEPTION 'Critical threshold must be between 0 and 1, got %.2f', NEW.tau_critical;
    END IF;
    
    -- Validate aggressiveness values
    IF NEW.aggressiveness IS NOT NULL AND NEW.aggressiveness NOT IN (90, 95, 98, 100) THEN
        RAISE EXCEPTION 'Aggressiveness must be one of: 90, 95, 98, 100. Got %', NEW.aggressiveness;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply validation trigger to both tables
CREATE TRIGGER validate_organization_settings_thresholds 
    BEFORE INSERT OR UPDATE ON organization_settings 
    FOR EACH ROW EXECUTE FUNCTION validate_effective_thresholds();

CREATE TRIGGER validate_platform_settings_thresholds 
    BEFORE INSERT OR UPDATE ON platform_settings 
    FOR EACH ROW EXECUTE FUNCTION validate_effective_thresholds();

-- ============================================================================
-- DEFAULT ORGANIZATION SETTINGS
-- ============================================================================

-- Function to create default organization settings
CREATE OR REPLACE FUNCTION create_default_organization_settings()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default Shield settings for new organization
    INSERT INTO organization_settings (
        organization_id,
        aggressiveness,
        tau_roast_lower,
        tau_shield,
        tau_critical,
        shield_enabled,
        auto_approve_shield_actions,
        corrective_messages_enabled,
        created_by
    ) VALUES (
        NEW.id,
        95, -- Default "Balanced" aggressiveness
        0.25, -- Default τ_roast_lower
        0.70, -- Default τ_shield  
        0.90, -- Default τ_critical
        CASE 
            WHEN NEW.plan_id IN ('pro', 'creator_plus', 'custom') THEN TRUE
            ELSE FALSE
        END, -- Shield enabled for Pro+ plans
        FALSE, -- Manual approval by default
        TRUE, -- Corrective messages enabled
        NEW.owner_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default settings for new organizations
CREATE TRIGGER create_default_organization_settings_trigger
    AFTER INSERT ON organizations
    FOR EACH ROW EXECUTE FUNCTION create_default_organization_settings();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get effective settings for a platform (with inheritance)
CREATE OR REPLACE FUNCTION get_effective_shield_settings(org_id UUID, platform_name VARCHAR)
RETURNS TABLE (
    aggressiveness INTEGER,
    tau_roast_lower DECIMAL(3,2),
    tau_shield DECIMAL(3,2),
    tau_critical DECIMAL(3,2),
    shield_enabled BOOLEAN,
    auto_approve_shield_actions BOOLEAN,
    corrective_messages_enabled BOOLEAN,
    response_frequency DECIMAL(3,2),
    trigger_words TEXT[],
    max_responses_per_hour INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ps.aggressiveness, os.aggressiveness) as aggressiveness,
        COALESCE(ps.tau_roast_lower, os.tau_roast_lower) as tau_roast_lower,
        COALESCE(ps.tau_shield, os.tau_shield) as tau_shield,
        COALESCE(ps.tau_critical, os.tau_critical) as tau_critical,
        COALESCE(ps.shield_enabled, os.shield_enabled) as shield_enabled,
        COALESCE(ps.auto_approve_shield_actions, os.auto_approve_shield_actions) as auto_approve_shield_actions,
        COALESCE(ps.corrective_messages_enabled, os.corrective_messages_enabled) as corrective_messages_enabled,
        COALESCE(ps.response_frequency, 1.0) as response_frequency,
        COALESCE(ps.trigger_words, ARRAY['roast', 'burn', 'insult']) as trigger_words,
        COALESCE(ps.max_responses_per_hour, 50) as max_responses_per_hour
    FROM organization_settings os
    LEFT JOIN platform_settings ps ON ps.organization_id = os.organization_id 
        AND ps.platform = platform_name
    WHERE os.organization_id = org_id;
END;
$$ LANGUAGE plpgsql;

-- Function to validate threshold relationships
CREATE OR REPLACE FUNCTION validate_threshold_relationships(
    tau_roast_lower_val DECIMAL(3,2),
    tau_shield_val DECIMAL(3,2), 
    tau_critical_val DECIMAL(3,2)
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        tau_roast_lower_val >= 0 AND
        tau_roast_lower_val < tau_shield_val AND
        tau_shield_val < tau_critical_val AND
        tau_critical_val <= 1
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_effective_shield_settings TO authenticated;
GRANT EXECUTE ON FUNCTION validate_threshold_relationships TO authenticated;