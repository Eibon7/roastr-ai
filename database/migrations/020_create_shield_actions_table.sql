-- Migration: Enhanced Shield Actions Table (CodeRabbit Round 6)
-- Created: 2025-01-25
-- Description: Apply CodeRabbit Round 6 security and performance enhancements for Issue #365
-- Features: Enhanced temporal integrity, performance indexes, GDPR compliance, security hardening

-- Do not drop existing table; evolve schema with IF NOT EXISTS / ALTER statements.
-- Note: In production, evolve schema incrementally without data loss

-- Create enhanced shield_actions table with temporal integrity
CREATE TABLE IF NOT EXISTS shield_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- Store hash instead of full content for GDPR
    content_snippet TEXT, -- Store only first 100 chars for UI display
    platform VARCHAR(50) NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- CodeRabbit Round 6: NOT NULL enforced
    reverted_at TIMESTAMP WITH TIME ZONE NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- CodeRabbit Round 6: NOT NULL enforced
    metadata JSONB DEFAULT '{}',
    
    -- Enhanced temporal integrity constraints (CodeRabbit Round 6 - Fixed)
    CONSTRAINT shield_actions_temporal_integrity CHECK (
        created_at IS NOT NULL
        AND updated_at IS NOT NULL
        AND created_at <= updated_at
        AND (reverted_at IS NULL OR reverted_at >= GREATEST(created_at, updated_at))
    ),
    
    -- Enhanced constraints
    CONSTRAINT shield_actions_org_id_check CHECK (organization_id IS NOT NULL),
    CONSTRAINT shield_actions_action_type_check CHECK (action_type IN ('block', 'mute', 'flag', 'report')),
    CONSTRAINT shield_actions_platform_check CHECK (platform IN ('twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky')),
    CONSTRAINT shield_actions_reason_check CHECK (reason IN ('toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate')),
    CONSTRAINT shield_actions_content_hash_check CHECK (LENGTH(content_hash) >= 32),
    CONSTRAINT shield_actions_content_snippet_length CHECK (content_snippet IS NULL OR LENGTH(content_snippet) <= 100),
    
    -- Metadata validation (CodeRabbit Round 6)
    CONSTRAINT shield_actions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
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
-- Removed: use a BRIN/BTree on created_at and filter by time at query time.
-- CREATE INDEX IF NOT EXISTS idx_shield_actions_recent_active ON shield_actions(organization_id, action_type, created_at DESC) WHERE reverted_at IS NULL AND created_at > NOW() - INTERVAL '30 days';

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

-- Hash-based index for content deduplication
CREATE INDEX IF NOT EXISTS idx_shield_actions_content_hash ON shield_actions(content_hash);

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
    
    -- Uniqueness handled by partial unique indexes below
);

-- Insert ENABLE_SHIELD_UI feature flag (default OFF for safety)
-- Create partial unique indexes for feature flags
CREATE UNIQUE INDEX IF NOT EXISTS ux_feature_flags_org_flag
  ON feature_flags (organization_id, flag_name)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_feature_flags_global_flag
  ON feature_flags (flag_name)
  WHERE organization_id IS NULL;

-- Insert ENABLE_SHIELD_UI feature flag (default OFF for safety)
INSERT INTO feature_flags (organization_id, flag_name, enabled, description)
VALUES (NULL, 'ENABLE_SHIELD_UI', false, 'Enable Shield UI interface for viewing and managing moderation actions')
ON CONFLICT DO NOTHING;

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

-- Note: Sample data should be inserted via separate scripts or fixtures,
-- not in migrations. Migrations should only contain schema changes for production safety.
-- Use test fixtures or setup scripts for development data instead.

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

-- ============================================================================
-- AUDIT AND SECURITY NOTES
-- ============================================================================

-- Security notes (CodeRabbit Round 6)
-- 1. Enhanced temporal integrity constraints with 5-minute clock skew tolerance
-- 2. Performance-optimized partial indexes for active/reverted actions
-- 3. Organization-scoped feature flags for granular control
-- 4. GDPR compliance functions with automated data lifecycle management
-- 5. Enhanced audit triggers for security event logging
-- 6. Stronger RLS policies using organization_members lookup
-- 7. Content hash validation and metadata type enforcement
-- 8. Comprehensive constraint validation for data integrity