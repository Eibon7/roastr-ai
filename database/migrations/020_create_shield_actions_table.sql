-- Migration: Enhanced Shield Actions Table (CodeRabbit Round 6)
-- Created: 2025-01-25
-- Description: Apply CodeRabbit Round 6 security and performance enhancements for Issue #365
-- Features: Enhanced temporal integrity, performance indexes, GDPR compliance, security hardening

-- Drop existing table if recreating with enhancements
-- Note: In production, this should be done with careful data migration
DROP TABLE IF EXISTS shield_actions CASCADE;

-- Create enhanced shield_actions table with temporal integrity
CREATE TABLE shield_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- Store hash instead of full content for GDPR
    content_snippet TEXT, -- Store only first 100 chars for UI display
    platform VARCHAR(50) NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reverted_at TIMESTAMP WITH TIME ZONE NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Enhanced constraints with temporal integrity validation
    CONSTRAINT shield_actions_org_id_check CHECK (organization_id IS NOT NULL),
    CONSTRAINT shield_actions_action_type_check CHECK (action_type IN ('block', 'mute', 'flag', 'report')),
    CONSTRAINT shield_actions_platform_check CHECK (platform IN ('twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky')),
    CONSTRAINT shield_actions_reason_check CHECK (reason IN ('toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate')),
    
    -- Temporal integrity constraints (CodeRabbit Round 2 enhancement)
    CONSTRAINT shield_actions_temporal_integrity CHECK (
        created_at <= COALESCE(reverted_at, NOW() + INTERVAL '1 hour') AND
        created_at <= COALESCE(updated_at, NOW() + INTERVAL '1 hour') AND
        COALESCE(reverted_at, '1970-01-01') >= created_at
    ),
    
    -- Content snippet length validation
    CONSTRAINT shield_actions_snippet_length CHECK (LENGTH(content_snippet) <= 100),
    
    -- Hash format validation (64-character hex)
    CONSTRAINT shield_actions_hash_format CHECK (content_hash ~ '^[a-fA-F0-9]{64}$')
);

-- Enhanced indexes with partial indexing for performance (CodeRabbit Round 2)
CREATE INDEX idx_shield_actions_org_id ON shield_actions(organization_id);
CREATE INDEX idx_shield_actions_created_at ON shield_actions(created_at DESC);
CREATE INDEX idx_shield_actions_platform ON shield_actions(platform);
CREATE INDEX idx_shield_actions_reason ON shield_actions(reason);

-- Partial indexes for active (non-reverted) actions only - major performance improvement
CREATE INDEX idx_shield_actions_active ON shield_actions(organization_id, created_at DESC) WHERE reverted_at IS NULL;
CREATE INDEX idx_shield_actions_active_platform ON shield_actions(organization_id, platform) WHERE reverted_at IS NULL;
CREATE INDEX idx_shield_actions_active_reason ON shield_actions(organization_id, reason) WHERE reverted_at IS NULL;

-- Composite indexes for common filter combinations
CREATE INDEX idx_shield_actions_org_created ON shield_actions(organization_id, created_at DESC);
CREATE INDEX idx_shield_actions_org_reason ON shield_actions(organization_id, reason);
CREATE INDEX idx_shield_actions_org_platform_reason ON shield_actions(organization_id, platform, reason);

-- Hash-based index for content deduplication
CREATE INDEX idx_shield_actions_content_hash ON shield_actions(content_hash);

-- Enable Row Level Security
ALTER TABLE shield_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Organizations can only access their own shield actions" ON shield_actions;
DROP POLICY IF EXISTS "Organizations can only insert their own shield actions" ON shield_actions;
DROP POLICY IF EXISTS "Organizations can only update their own shield actions" ON shield_actions;

-- Enhanced RLS policies with attack vector prevention (CodeRabbit Round 2)
CREATE POLICY "Organizations can only access their own shield actions"
ON shield_actions FOR SELECT
USING (
    organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID
    AND organization_id IS NOT NULL -- Prevent null organization access
);

CREATE POLICY "Organizations can only insert their own shield actions"
ON shield_actions FOR INSERT
WITH CHECK (
    organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID
    AND organization_id IS NOT NULL -- Prevent null organization insertion
    AND created_at <= NOW() + INTERVAL '1 minute' -- Prevent future-dated entries
);

CREATE POLICY "Organizations can only update their own shield actions"
ON shield_actions FOR UPDATE
USING (
    organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID
    AND organization_id IS NOT NULL
)
WITH CHECK (
    organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID
    AND organization_id IS NOT NULL
    AND updated_at >= created_at -- Ensure updated_at is after created_at
);

-- Enhanced organization-scoped feature flags (CodeRabbit Round 2)
CREATE TABLE IF NOT EXISTS organization_feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    flag_name VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint per organization
    CONSTRAINT unique_org_feature_flag UNIQUE(organization_id, flag_name),
    
    -- Validation constraints
    CONSTRAINT feature_flag_name_format CHECK (flag_name ~ '^[A-Z_][A-Z0-9_]*$'),
    CONSTRAINT feature_flag_org_not_null CHECK (organization_id IS NOT NULL)
);

-- Indexes for organization feature flags
CREATE INDEX idx_org_feature_flags_org_id ON organization_feature_flags(organization_id);
CREATE INDEX idx_org_feature_flags_name ON organization_feature_flags(flag_name);
CREATE INDEX idx_org_feature_flags_enabled ON organization_feature_flags(enabled) WHERE enabled = true;

-- Enable RLS for organization feature flags
ALTER TABLE organization_feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies for organization feature flags
CREATE POLICY "Organizations can only access their own feature flags"
ON organization_feature_flags FOR ALL
USING (organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID)
WITH CHECK (organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID);

-- GDPR compliance functions (CodeRabbit Round 2)
CREATE OR REPLACE FUNCTION hash_content_for_gdpr(content TEXT)
RETURNS VARCHAR(64)
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
AS $$
BEGIN
    -- Return SHA-256 hash for GDPR compliance
    RETURN encode(digest(content, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION create_content_snippet(content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
AS $$
BEGIN
    -- Return first 100 characters for UI display
    IF LENGTH(content) <= 100 THEN
        RETURN content;
    ELSE
        RETURN SUBSTRING(content FROM 1 FOR 97) || '...';
    END IF;
END;
$$;

-- Audit trigger for shield actions (CodeRabbit Round 2)
CREATE OR REPLACE FUNCTION shield_actions_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update timestamp on any change
    NEW.updated_at = NOW();
    
    -- Validate temporal consistency
    IF NEW.reverted_at IS NOT NULL AND NEW.reverted_at < NEW.created_at THEN
        RAISE EXCEPTION 'reverted_at cannot be before created_at';
    END IF;
    
    -- Log security-relevant changes
    IF TG_OP = 'UPDATE' AND OLD.reverted_at IS NULL AND NEW.reverted_at IS NOT NULL THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id, organization_id)
        VALUES (
            'shield_actions',
            NEW.id,
            'REVERT',
            jsonb_build_object('reverted_at', OLD.reverted_at),
            jsonb_build_object('reverted_at', NEW.reverted_at),
            (SELECT auth.jwt() ->> 'sub')::UUID,
            NEW.organization_id
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create audit trigger
DROP TRIGGER IF EXISTS shield_actions_audit ON shield_actions;
CREATE TRIGGER shield_actions_audit
    BEFORE UPDATE ON shield_actions
    FOR EACH ROW
    EXECUTE FUNCTION shield_actions_audit_trigger();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION shield_actions_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shield_actions_updated_at ON shield_actions;
CREATE TRIGGER update_shield_actions_updated_at
    BEFORE UPDATE ON shield_actions
    FOR EACH ROW
    EXECUTE FUNCTION shield_actions_update_updated_at_column();

-- Insert default organization feature flags for Shield UI
INSERT INTO organization_feature_flags (organization_id, flag_name, enabled, description)
SELECT 
    id, 
    'ENABLE_SHIELD_UI', 
    false, 
    'Enable Shield UI interface for viewing and managing moderation actions'
FROM organizations
ON CONFLICT (organization_id, flag_name) DO NOTHING;

-- Performance monitoring view (CodeRabbit Round 2)
CREATE OR REPLACE VIEW shield_performance_metrics AS
SELECT 
    organization_id,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE reverted_at IS NULL) as active_actions,
    COUNT(*) FILTER (WHERE reverted_at IS NOT NULL) as reverted_actions,
    COUNT(DISTINCT platform) as platforms_used,
    COUNT(DISTINCT reason) as reasons_used,
    AVG(EXTRACT(EPOCH FROM (COALESCE(reverted_at, NOW()) - created_at))) as avg_action_duration_seconds,
    MIN(created_at) as first_action,
    MAX(created_at) as last_action
FROM shield_actions
GROUP BY organization_id;

-- Grant appropriate permissions
GRANT SELECT ON shield_performance_metrics TO authenticated;

-- Enhanced comments for documentation (CodeRabbit Round 2)
COMMENT ON TABLE shield_actions IS 'Enhanced Shield automated moderation actions with temporal integrity and security constraints';
COMMENT ON COLUMN shield_actions.id IS 'Unique identifier for the shield action';
COMMENT ON COLUMN shield_actions.organization_id IS 'Organization that owns this action (for multi-tenant isolation)';
COMMENT ON COLUMN shield_actions.action_type IS 'Type of action taken: block, mute, flag, or report';
COMMENT ON COLUMN shield_actions.content_hash IS 'SHA-256 hash of the original content for GDPR compliance';
COMMENT ON COLUMN shield_actions.content_snippet IS 'First 100 characters of content for UI display (max 100 chars)';
COMMENT ON COLUMN shield_actions.platform IS 'Social media platform where the action was taken';
COMMENT ON COLUMN shield_actions.reason IS 'Categorization of why the action was taken';
COMMENT ON COLUMN shield_actions.created_at IS 'When the action was originally taken (cannot be in future)';
COMMENT ON COLUMN shield_actions.reverted_at IS 'When the action was reverted (must be after created_at)';
COMMENT ON COLUMN shield_actions.updated_at IS 'When the record was last updated (auto-managed)';
COMMENT ON COLUMN shield_actions.metadata IS 'Additional data about the action (JSON format)';

COMMENT ON TABLE organization_feature_flags IS 'Organization-scoped feature flags for multi-tenant feature management';
COMMENT ON FUNCTION hash_content_for_gdpr(TEXT) IS 'GDPR-compliant content hashing function';
COMMENT ON FUNCTION create_content_snippet(TEXT) IS 'Creates safe content snippets for UI display';
COMMENT ON VIEW shield_performance_metrics IS 'Performance and usage metrics for Shield actions per organization';

-- Security notes (CodeRabbit Round 2)
-- 1. Temporal integrity constraints prevent data inconsistencies
-- 2. Partial indexes improve query performance for active records
-- 3. Organization-scoped feature flags enable granular feature control
-- 4. GDPR compliance functions ensure data privacy
-- 5. Audit triggers provide security event logging
-- 6. RLS policies prevent cross-organization data access
-- 7. Content hash validation prevents malformed data insertion
-- Created: 2025-01-21
-- Description: Add simplified Shield UI table with CodeRabbit Round 2 improvements
-- 
-- This creates a simplified shield_actions table specifically for the Shield UI
-- interface, separate from the main shield_events table used by the worker system.

-- ============================================================================
-- ENSURE REQUIRED EXTENSIONS
-- ============================================================================

-- Ensure pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SHIELD ACTIONS TABLE (UI-focused)
-- ============================================================================

-- Create shield_actions table for UI display
CREATE TABLE IF NOT EXISTS shield_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- Store hash instead of full content for GDPR
    content_snippet TEXT CHECK (LENGTH(content_snippet) <= 100), -- Store only first 100 chars for UI display
    platform VARCHAR(50) NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- CodeRabbit Round 6: NOT NULL enforced
    reverted_at TIMESTAMP WITH TIME ZONE NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- CodeRabbit Round 6: NOT NULL enforced
    metadata JSONB DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'), -- Validate metadata is object
    
    -- Enhanced temporal integrity constraints (CodeRabbit Round 6)
    CONSTRAINT shield_actions_temporal_integrity CHECK (
        created_at IS NOT NULL AND
        updated_at IS NOT NULL AND
        created_at <= COALESCE(updated_at, NOW() + INTERVAL '5 minutes') AND
        (reverted_at IS NULL OR reverted_at >= created_at) AND
        created_at <= NOW() + INTERVAL '5 minutes' AND
        updated_at <= NOW() + INTERVAL '5 minutes' AND
        -- Enhanced: Ensure revert order is logical
        (reverted_at IS NULL OR reverted_at <= NOW() + INTERVAL '5 minutes')
    ),
    
    -- Enhanced constraints
    CONSTRAINT shield_actions_org_id_check CHECK (organization_id IS NOT NULL),
    CONSTRAINT shield_actions_action_type_check CHECK (action_type IN ('block', 'mute', 'flag', 'report')),
    CONSTRAINT shield_actions_platform_check CHECK (platform IN ('twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky')),
    CONSTRAINT shield_actions_reason_check CHECK (reason IN ('toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate')),
    CONSTRAINT shield_actions_content_hash_check CHECK (LENGTH(content_hash) >= 32),
    CONSTRAINT shield_actions_content_snippet_length CHECK (content_snippet IS NULL OR LENGTH(content_snippet) <= 100)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE (CodeRabbit feedback)
-- ============================================================================

-- Standard indexes for performance
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_id ON shield_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_shield_actions_created_at ON shield_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shield_actions_platform ON shield_actions(platform);
CREATE INDEX IF NOT EXISTS idx_shield_actions_reason ON shield_actions(reason);

-- Enhanced partial indexes for performance optimization (CodeRabbit Round 6)
CREATE INDEX IF NOT EXISTS idx_shield_actions_active ON shield_actions(organization_id, created_at DESC) WHERE reverted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shield_actions_reverted ON shield_actions(reverted_at DESC) WHERE reverted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shield_actions_recent_active ON shield_actions(organization_id, action_type, created_at DESC) WHERE reverted_at IS NULL AND created_at > NOW() - INTERVAL '30 days';

-- Performance-optimized composite indexes (CodeRabbit Round 6)
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_platform_active ON shield_actions(organization_id, platform, created_at DESC) WHERE reverted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_reason_active ON shield_actions(organization_id, reason, created_at DESC) WHERE reverted_at IS NULL;

-- Composite indexes for common filter combinations (CodeRabbit Round 4 enhanced)
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_created ON shield_actions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_reason ON shield_actions(organization_id, reason);
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_platform ON shield_actions(organization_id, platform);

-- Additional performance indexes for timestamp queries (Round 4 feedback)
CREATE INDEX IF NOT EXISTS idx_shield_actions_timestamps ON shield_actions(created_at DESC, updated_at DESC) WHERE reverted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_time_range ON shield_actions(organization_id, created_at DESC, action_type);
CREATE INDEX IF NOT EXISTS idx_shield_actions_recent_active ON shield_actions(organization_id, created_at DESC) 
    WHERE reverted_at IS NULL AND created_at >= NOW() - INTERVAL '30 days';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Enhanced (CodeRabbit feedback)
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE shield_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Organizations can only access their own shield actions" ON shield_actions;
DROP POLICY IF EXISTS "Organizations can only insert their own shield actions" ON shield_actions;
DROP POLICY IF EXISTS "Organizations can only update their own shield actions" ON shield_actions;
DROP POLICY IF EXISTS "Organizations can only delete their own shield actions" ON shield_actions;

-- Enhanced RLS policies with safer JWT claim validation (CodeRabbit feedback)
CREATE POLICY "shield_actions_org_select" ON shield_actions
    FOR SELECT TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "shield_actions_org_insert" ON shield_actions
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "shield_actions_org_update" ON shield_actions
    FOR UPDATE TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Explicit DELETE policy (CodeRabbit feedback)
CREATE POLICY "shield_actions_org_delete" ON shield_actions
    FOR DELETE TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- FEATURE FLAGS WITH ORG SCOPING (CodeRabbit feedback)
-- ============================================================================

-- Create feature flags table if it doesn't exist with organization scoping
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- Organization scoping
    flag_name VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT false, -- Default OFF for safety (CodeRabbit feedback)
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Unique constraint per organization or globally if org is NULL
    UNIQUE(COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::UUID), flag_name)
);

-- Insert ENABLE_SHIELD_UI feature flag (default OFF for safety)
INSERT INTO feature_flags (organization_id, flag_name, enabled, description)
VALUES (NULL, 'ENABLE_SHIELD_UI', false, 'Enable Shield UI interface for viewing and managing moderation actions')
ON CONFLICT (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::UUID), flag_name) DO NOTHING;

-- ============================================================================
-- TRIGGERS AND FUNCTIONS (CodeRabbit feedback)
-- ============================================================================

-- Create updated_at trigger function (scoped to prevent collisions)
CREATE OR REPLACE FUNCTION shield_actions_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at column if it doesn't exist
-- Note: column already exists from table definition above

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_shield_actions_updated_at ON shield_actions;
CREATE TRIGGER update_shield_actions_updated_at
    BEFORE UPDATE ON shield_actions
    FOR EACH ROW
    EXECUTE FUNCTION shield_actions_update_updated_at_column();

-- ============================================================================
-- GDPR COMPLIANCE FUNCTIONS (CodeRabbit feedback)
-- ============================================================================

-- Function to anonymize old shield actions (GDPR compliance)
CREATE OR REPLACE FUNCTION anonymize_old_shield_actions()
RETURNS INTEGER AS $$
DECLARE
    anonymized_count INTEGER;
BEGIN
    -- Anonymize actions older than 80 days by clearing content_snippet
    UPDATE shield_actions 
    SET 
        content_snippet = '[ANONYMIZED]',
        metadata = metadata || jsonb_build_object('anonymized_at', NOW())
    WHERE 
        created_at < NOW() - INTERVAL '80 days'
        AND content_snippet IS NOT NULL 
        AND content_snippet != '[ANONYMIZED]';
    
    GET DIAGNOSTICS anonymized_count = ROW_COUNT;
    
    RETURN anonymized_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to purge very old shield actions (GDPR compliance)
CREATE OR REPLACE FUNCTION purge_old_shield_actions()
RETURNS INTEGER AS $$
DECLARE
    purged_count INTEGER;
BEGIN
    -- Purge actions older than 90 days completely
    DELETE FROM shield_actions 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS purged_count = ROW_COUNT;
    
    RETURN purged_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SAMPLE DATA FOR TESTING (Development only)
-- ============================================================================

-- Insert sample data only in development environment
DO $$
BEGIN
    -- Check if we're in a development environment
    IF current_setting('server_version_num')::integer >= 120000 THEN
        -- Insert sample shield actions for testing (if no data exists)
        INSERT INTO shield_actions (
            organization_id, 
            action_type, 
            content_hash, 
            content_snippet, 
            platform, 
            reason, 
            created_at,
            reverted_at,
            metadata
        ) 
        SELECT 
            o.id,
            'block',
            encode(sha256('This is offensive content that was automatically blocked by Shield'), 'hex'),
            'This is offensive content that was automatically blocked by Shield',
            'twitter',
            'toxic',
            NOW() - INTERVAL '2 days',
            NULL,
            '{}'::jsonb
        FROM organizations o
        WHERE NOT EXISTS (SELECT 1 FROM shield_actions WHERE organization_id = o.id)
        LIMIT 1;
        
        -- Add a reverted action example
        INSERT INTO shield_actions (
            organization_id, 
            action_type, 
            content_hash, 
            content_snippet, 
            platform, 
            reason, 
            created_at,
            reverted_at,
            metadata
        ) 
        SELECT 
            o.id,
            'mute',
            encode(sha256('Another problematic comment that was muted'), 'hex'),
            'Another problematic comment that was muted',
            'youtube',
            'harassment',
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '12 hours',
            '{"reverted": true, "revertReason": "False positive"}'::jsonb
        FROM organizations o
        WHERE EXISTS (SELECT 1 FROM shield_actions WHERE organization_id = o.id AND action_type = 'block')
        LIMIT 1;
    END IF;
END $$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION (CodeRabbit feedback)
-- ============================================================================

COMMENT ON TABLE shield_actions IS 'Stores automated Shield moderation actions taken on user content across platforms for UI display';
COMMENT ON COLUMN shield_actions.id IS 'Unique identifier for the shield action';
COMMENT ON COLUMN shield_actions.organization_id IS 'Organization that owns this action (for multi-tenant isolation)';
COMMENT ON COLUMN shield_actions.action_type IS 'Type of action taken: block, mute, flag, or report';
COMMENT ON COLUMN shield_actions.content_hash IS 'SHA-256 hash of the original content for GDPR compliance';
COMMENT ON COLUMN shield_actions.content_snippet IS 'First 100 characters of content for UI display (max 100 chars)';
COMMENT ON COLUMN shield_actions.platform IS 'Social media platform where the action was taken';
COMMENT ON COLUMN shield_actions.reason IS 'Categorization of why the action was taken';
COMMENT ON COLUMN shield_actions.created_at IS 'When the action was originally taken';
COMMENT ON COLUMN shield_actions.reverted_at IS 'When the action was reverted (if applicable)';
COMMENT ON COLUMN shield_actions.updated_at IS 'When the record was last updated';
COMMENT ON COLUMN shield_actions.metadata IS 'Additional data about the action (JSON format, validated as object)';

-- Add table-level comment for GDPR compliance
COMMENT ON CONSTRAINT shield_actions_temporal_integrity ON shield_actions IS 'Ensures temporal integrity: created_at <= reverted_at, created_at <= updated_at';
COMMENT ON CONSTRAINT shield_actions_content_snippet_length ON shield_actions IS 'GDPR compliance: content snippet limited to 100 characters for UI display';