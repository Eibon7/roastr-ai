-- Migration: Shield Events Persistence with GDPR Compliance
-- Issue: 359 - Shield events + Offenders with GDPR retention
-- 
-- This migration creates the core tables for Shield event persistence,
-- offender tracking, and implements GDPR-compliant data retention.

-- ============================================================================
-- ENSURE REQUIRED EXTENSIONS
-- ============================================================================

-- Ensure pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SHIELD EVENTS TABLE
-- ============================================================================

-- Shield events table for tracking moderation actions
CREATE TABLE shield_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Multi-tenant support
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Can be null for system actions
    
    -- Platform information
    platform VARCHAR(50) NOT NULL, -- twitter, youtube, discord, twitch, etc.
    account_ref VARCHAR(255), -- Platform account reference (user handle, channel ID, etc.)
    
    -- External references
    external_comment_id VARCHAR(500) NOT NULL, -- Platform-specific comment/message ID
    external_author_id VARCHAR(500) NOT NULL, -- Platform-specific author ID
    external_author_username VARCHAR(255), -- Author username for display/logging
    
    -- Content analysis
    original_text TEXT, -- ⚠️ GDPR: Only for Shield-moderated comments, anonimized at 80 days, purged at 90
    original_text_hash VARCHAR(64), -- SHA-256 hash for post-anonymization reference
    text_salt VARCHAR(32), -- Unique salt for hash generation
    toxicity_score DECIMAL(3,2) CHECK (toxicity_score >= 0 AND toxicity_score <= 1),
    toxicity_labels JSONB DEFAULT '[]', -- ["TOXICITY", "SEVERE_TOXICITY", "INSULT", etc.]
    
    -- Shield action taken
    action_taken VARCHAR(50) NOT NULL, -- hide_comment, block_user, timeout_user, report_user, etc.
    action_reason TEXT NOT NULL, -- Detailed reason for the action
    action_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, executed, failed, reverted
    action_details JSONB DEFAULT '{}', -- Platform-specific action details
    
    -- Processing information
    processed_by VARCHAR(50) NOT NULL DEFAULT 'shield_worker', -- shield_worker, admin, system
    processing_time_ms INTEGER, -- Time taken to process the action
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}', -- Additional context, platform-specific data
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ, -- When the action was actually executed
    reverted_at TIMESTAMPTZ, -- If the action was reverted
    
    -- GDPR compliance tracking
    anonymized_at TIMESTAMPTZ, -- When original_text was anonymized (day 80)
    scheduled_purge_at TIMESTAMPTZ, -- When record should be purged (day 90)
    
    -- Constraints with CHECK validation (NOT DEFERRABLE for better performance)
    CONSTRAINT shield_events_platform_check CHECK (platform IN ('twitter', 'youtube', 'discord', 'twitch', 'facebook', 'instagram', 'tiktok', 'reddit', 'bluesky')) NOT DEFERRABLE,
    CONSTRAINT shield_events_action_status_check CHECK (action_status IN ('pending', 'executed', 'failed', 'reverted')) NOT DEFERRABLE,
    CONSTRAINT shield_events_toxicity_score_check CHECK (toxicity_score IS NULL OR (toxicity_score >= 0 AND toxicity_score <= 1)) NOT DEFERRABLE
);

-- ============================================================================
-- OFFENDER PROFILES TABLE
-- ============================================================================

-- Offender profiles for tracking repeat offenders across platforms
CREATE TABLE offender_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Multi-tenant support
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Platform identification
    platform VARCHAR(50) NOT NULL,
    external_author_id VARCHAR(500) NOT NULL,
    external_author_username VARCHAR(255), -- Latest known username
    
    -- Offence tracking (within 90-day window)
    offense_count INTEGER DEFAULT 0,
    first_offense_at TIMESTAMPTZ,
    last_offense_at TIMESTAMPTZ,
    
    -- Severity tracking
    severity_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    max_toxicity_score DECIMAL(3,2),
    avg_toxicity_score DECIMAL(3,2),
    
    -- Actions taken summary
    actions_taken JSONB DEFAULT '{}', -- {"block_user": 2, "timeout_user": 5, "hide_comment": 10}
    last_action_taken VARCHAR(50),
    last_action_at TIMESTAMPTZ,
    
    -- Risk assessment
    risk_score DECIMAL(3,2) DEFAULT 0.0, -- Calculated risk score
    escalation_level INTEGER DEFAULT 0, -- 0-5, higher = more severe actions needed
    
    -- Platform-specific metadata
    platform_metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure uniqueness per organization/platform/author
    UNIQUE(organization_id, platform, external_author_id),
    
    -- Constraints with CHECK validation (NOT DEFERRABLE for better performance)
    CONSTRAINT offender_profiles_platform_check CHECK (platform IN ('twitter', 'youtube', 'discord', 'twitch', 'facebook', 'instagram', 'tiktok', 'reddit', 'bluesky')) NOT DEFERRABLE,
    CONSTRAINT offender_profiles_severity_check CHECK (severity_level IN ('low', 'medium', 'high', 'critical')) NOT DEFERRABLE,
    CONSTRAINT offender_profiles_escalation_check CHECK (escalation_level >= 0 AND escalation_level <= 5) NOT DEFERRABLE
);

-- ============================================================================
-- GDPR RETENTION LOG TABLE
-- ============================================================================

-- Table to track GDPR retention operations for audit purposes
CREATE TABLE shield_retention_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Operation details
    operation_type VARCHAR(20) NOT NULL, -- anonymize, purge, cleanup
    operation_status VARCHAR(20) NOT NULL, -- success, failed, partial
    
    -- Batch information
    batch_id UUID DEFAULT gen_random_uuid(), -- Groups related operations
    records_processed INTEGER DEFAULT 0,
    records_anonymized INTEGER DEFAULT 0,
    records_purged INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    
    -- Error tracking
    error_message TEXT,
    error_details JSONB,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints with CHECK validation (NOT DEFERRABLE for better performance)
    CONSTRAINT retention_log_operation_type_check CHECK (operation_type IN ('anonymize', 'purge', 'cleanup')) NOT DEFERRABLE,
    CONSTRAINT retention_log_status_check CHECK (operation_status IN ('success', 'failed', 'partial')) NOT DEFERRABLE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Shield events indexes - composite indexes for better performance
CREATE INDEX idx_shield_events_org_platform_status ON shield_events(organization_id, platform, action_status);
CREATE INDEX idx_shield_events_author_platform_created ON shield_events(external_author_id, platform, created_at DESC);
CREATE INDEX idx_shield_events_created_at ON shield_events(created_at);
CREATE INDEX idx_shield_events_toxicity_score ON shield_events(toxicity_score) WHERE toxicity_score IS NOT NULL;
CREATE INDEX idx_shield_events_action_status ON shield_events(action_status);
CREATE INDEX idx_shield_events_org_created ON shield_events(organization_id, created_at DESC);

-- GDPR retention indexes (optimized for GDPR queries)
CREATE INDEX idx_shield_events_anonymized_at ON shield_events(anonymized_at) WHERE anonymized_at IS NULL;
CREATE INDEX idx_shield_events_scheduled_purge ON shield_events(scheduled_purge_at) WHERE scheduled_purge_at IS NOT NULL;

-- Offender profiles indexes - improved composite indexes for better query performance
CREATE INDEX idx_offender_profiles_org_platform_severity ON offender_profiles(organization_id, platform, severity_level);
CREATE INDEX idx_offender_profiles_platform_author ON offender_profiles(platform, external_author_id);
CREATE INDEX idx_offender_profiles_last_offense_severity ON offender_profiles(last_offense_at DESC, severity_level);
CREATE INDEX idx_offender_profiles_severity ON offender_profiles(severity_level);
CREATE INDEX idx_offender_profiles_updated_at ON offender_profiles(updated_at);
CREATE INDEX idx_offender_profiles_escalation_level ON offender_profiles(escalation_level) WHERE escalation_level > 0;

-- Retention log indexes
CREATE INDEX idx_retention_log_batch_id ON shield_retention_log(batch_id);
CREATE INDEX idx_retention_log_created_at ON shield_retention_log(started_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE shield_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE offender_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shield_retention_log ENABLE ROW LEVEL SECURITY;

-- Shield events RLS policies (granular policies for better security)
CREATE POLICY "shield_events_org_select" ON shield_events
    FOR SELECT TO authenticated
    USING (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "shield_events_org_insert" ON shield_events
    FOR INSERT TO authenticated
    WITH CHECK (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "shield_events_org_update" ON shield_events
    FOR UPDATE TO authenticated
    USING (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "shield_events_org_delete" ON shield_events
    FOR DELETE TO authenticated
    USING (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ));

-- Offender profiles RLS policies (granular policies for better security)
CREATE POLICY "offender_profiles_org_select" ON offender_profiles
    FOR SELECT TO authenticated
    USING (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "offender_profiles_org_insert" ON offender_profiles
    FOR INSERT TO authenticated
    WITH CHECK (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "offender_profiles_org_update" ON offender_profiles
    FOR UPDATE TO authenticated
    USING (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ))
    WITH CHECK (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "offender_profiles_org_delete" ON offender_profiles
    FOR DELETE TO authenticated
    USING (organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
    ));

-- Retention log RLS policies (admin only)
CREATE POLICY "retention_log_admin_access" ON shield_retention_log
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND is_admin = true
    ));

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update offender profiles when shield events are created
CREATE OR REPLACE FUNCTION update_offender_profile()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    current_max_toxicity DECIMAL(3,2);
    current_avg_toxicity DECIMAL(3,2);
    current_actions JSONB;
    action_count INTEGER;
BEGIN
    -- Only process executed actions
    IF NEW.action_status != 'executed' THEN
        RETURN NEW;
    END IF;
    
    -- Insert or update offender profile
    INSERT INTO offender_profiles (
        organization_id,
        platform,
        external_author_id,
        external_author_username,
        offense_count,
        first_offense_at,
        last_offense_at,
        max_toxicity_score,
        avg_toxicity_score,
        actions_taken,
        last_action_taken,
        last_action_at,
        updated_at
    ) VALUES (
        NEW.organization_id,
        NEW.platform,
        NEW.external_author_id,
        NEW.external_author_username,
        1,
        NEW.created_at,
        NEW.created_at,
        COALESCE(NEW.toxicity_score, 0),
        COALESCE(NEW.toxicity_score, 0),
        jsonb_build_object(NEW.action_taken, 1),
        NEW.action_taken,
        NEW.executed_at,
        NOW()
    )
    ON CONFLICT (organization_id, platform, external_author_id) DO UPDATE SET
        offense_count = offender_profiles.offense_count + 1,
        last_offense_at = NEW.created_at,
        external_author_username = NEW.external_author_username,
        max_toxicity_score = GREATEST(COALESCE(offender_profiles.max_toxicity_score, 0), COALESCE(NEW.toxicity_score, 0)),
        avg_toxicity_score = (
            (COALESCE(offender_profiles.avg_toxicity_score, 0) * offender_profiles.offense_count + COALESCE(NEW.toxicity_score, 0)) / 
            (offender_profiles.offense_count + 1)
        ),
        actions_taken = (
            offender_profiles.actions_taken || 
            jsonb_build_object(
                NEW.action_taken, 
                COALESCE((offender_profiles.actions_taken->>NEW.action_taken)::INTEGER, 0) + 1
            )
        ),
        last_action_taken = NEW.action_taken,
        last_action_at = NEW.executed_at,
        updated_at = NOW();
    
    -- Update severity level based on offense count and toxicity
    SELECT offense_count INTO current_count
    FROM offender_profiles 
    WHERE organization_id = NEW.organization_id 
      AND platform = NEW.platform 
      AND external_author_id = NEW.external_author_id;
    
    -- Calculate severity level with null safety to prevent runtime errors
    UPDATE offender_profiles SET
        severity_level = CASE
            WHEN current_count >= 10 OR COALESCE(max_toxicity_score, 0) >= 0.9 THEN 'critical'
            WHEN current_count >= 5 OR COALESCE(max_toxicity_score, 0) >= 0.7 THEN 'high'
            WHEN current_count >= 2 OR COALESCE(max_toxicity_score, 0) >= 0.5 THEN 'medium'
            ELSE 'low'
        END,
        escalation_level = LEAST(5, FLOOR(COALESCE(current_count, 0) / 2)::INTEGER),
        risk_score = LEAST(1.0, (COALESCE(current_count, 0) * 0.1 + COALESCE(max_toxicity_score, 0)) / 2)
    WHERE organization_id = NEW.organization_id 
      AND platform = NEW.platform 
      AND external_author_id = NEW.external_author_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update offender profiles (optimized for action_status changes)
CREATE TRIGGER shield_events_update_offender_profile
    AFTER INSERT OR UPDATE OF action_status ON shield_events
    FOR EACH ROW
    EXECUTE FUNCTION update_offender_profile();

-- Function to set GDPR purge schedule
CREATE OR REPLACE FUNCTION set_gdpr_purge_schedule()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set purge schedule for records with original_text
    IF NEW.original_text IS NOT NULL THEN
        NEW.scheduled_purge_at = COALESCE(NEW.created_at, NOW()) + INTERVAL '90 days';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set GDPR purge schedule
CREATE TRIGGER shield_events_set_purge_schedule
    BEFORE INSERT ON shield_events
    FOR EACH ROW
    EXECUTE FUNCTION set_gdpr_purge_schedule();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get offender history within 90 days
CREATE OR REPLACE FUNCTION get_offender_history(
    p_organization_id UUID,
    p_platform VARCHAR(50),
    p_external_author_id VARCHAR(500),
    p_days_back INTEGER DEFAULT 90
)
RETURNS TABLE (
    offense_count INTEGER,
    last_offense_at TIMESTAMPTZ,
    severity_level VARCHAR(20),
    recent_actions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        op.offense_count,
        op.last_offense_at,
        op.severity_level,
        op.actions_taken
    FROM offender_profiles op
    WHERE op.organization_id = p_organization_id
      AND op.platform = p_platform
      AND op.external_author_id = p_external_author_id
      AND op.last_offense_at >= NOW() - (p_days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old offender profiles (beyond 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_offender_profiles()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM offender_profiles
    WHERE last_offense_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO shield_retention_log (
        operation_type,
        operation_status,
        records_processed,
        records_purged,
        completed_at,
        metadata
    ) VALUES (
        'cleanup',
        'success',
        deleted_count,
        deleted_count,
        NOW(),
        jsonb_build_object('table', 'offender_profiles', 'cutoff_date', NOW() - INTERVAL '90 days')
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE shield_events IS 'Tracks Shield moderation events with GDPR-compliant retention. Text anonymized at 80 days, purged at 90 days.';
COMMENT ON TABLE offender_profiles IS 'Aggregated offender profiles for recidivism tracking within 90-day windows.';
COMMENT ON TABLE shield_retention_log IS 'Audit log for GDPR retention operations (anonymization, purging, cleanup).';

COMMENT ON COLUMN shield_events.original_text IS 'GDPR: Anonymized to hash at 80 days, purged at 90 days. Only for Shield-moderated comments.';
COMMENT ON COLUMN shield_events.original_text_hash IS 'SHA-256 hash of original text for post-anonymization reference.';
COMMENT ON COLUMN shield_events.scheduled_purge_at IS 'Automatic purge date (90 days from creation).';

COMMENT ON COLUMN offender_profiles.offense_count IS 'Number of offenses within 90-day rolling window.';
COMMENT ON COLUMN offender_profiles.severity_level IS 'Risk level: low, medium, high, critical based on frequency and toxicity.';
COMMENT ON COLUMN offender_profiles.escalation_level IS 'Action escalation level 0-5 for progressive discipline.';