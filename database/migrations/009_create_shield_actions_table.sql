-- Migration: Create shield_actions table for Issue #365
-- Created: 2025-01-25
-- Description: Add table to store Shield automated moderation actions with RLS

-- Create shield_actions table
CREATE TABLE IF NOT EXISTS shield_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- Store hash instead of full content for GDPR
    content_snippet TEXT, -- Store only first 100 chars for UI display
    platform VARCHAR(50) NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reverted_at TIMESTAMP WITH TIME ZONE NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT shield_actions_org_id_check CHECK (organization_id IS NOT NULL),
    CONSTRAINT shield_actions_action_type_check CHECK (action_type IN ('block', 'mute', 'flag', 'report')),
    CONSTRAINT shield_actions_platform_check CHECK (platform IN ('twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky')),
    CONSTRAINT shield_actions_reason_check CHECK (reason IN ('toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_id ON shield_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_shield_actions_created_at ON shield_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shield_actions_platform ON shield_actions(platform);
CREATE INDEX IF NOT EXISTS idx_shield_actions_reason ON shield_actions(reason);
CREATE INDEX IF NOT EXISTS idx_shield_actions_reverted ON shield_actions(reverted_at) WHERE reverted_at IS NOT NULL;

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_created ON shield_actions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shield_actions_org_reason ON shield_actions(organization_id, reason);

-- Enable Row Level Security
ALTER TABLE shield_actions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Organizations can only access their own shield actions" ON shield_actions;
DROP POLICY IF EXISTS "Organizations can only insert their own shield actions" ON shield_actions;
DROP POLICY IF EXISTS "Organizations can only update their own shield actions" ON shield_actions;

-- Create RLS policies for multi-tenant isolation
CREATE POLICY "Organizations can only access their own shield actions"
ON shield_actions FOR SELECT
USING (organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID);

CREATE POLICY "Organizations can only insert their own shield actions"
ON shield_actions FOR INSERT
WITH CHECK (organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID);

CREATE POLICY "Organizations can only update their own shield actions"
ON shield_actions FOR UPDATE
USING (organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID)
WITH CHECK (organization_id = (SELECT auth.jwt() ->> 'org_id')::UUID);

-- Create feature flags table if it doesn't exist
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    flag_name VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert ENABLE_SHIELD_UI feature flag (default OFF for safety)
INSERT INTO feature_flags (flag_name, enabled, description)
VALUES ('ENABLE_SHIELD_UI', false, 'Enable Shield UI interface for viewing and managing moderation actions')
ON CONFLICT (flag_name) DO NOTHING;

-- Create updated_at trigger for shield_actions (scoped to prevent collisions)
CREATE OR REPLACE FUNCTION shield_actions_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column if it doesn't exist
ALTER TABLE shield_actions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger
DROP TRIGGER IF EXISTS update_shield_actions_updated_at ON shield_actions;
CREATE TRIGGER update_shield_actions_updated_at
    BEFORE UPDATE ON shield_actions
    FOR EACH ROW
    EXECUTE FUNCTION shield_actions_update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE shield_actions IS 'Stores automated Shield moderation actions taken on user content across platforms';
COMMENT ON COLUMN shield_actions.id IS 'Unique identifier for the shield action';
COMMENT ON COLUMN shield_actions.organization_id IS 'Organization that owns this action (for multi-tenant isolation)';
COMMENT ON COLUMN shield_actions.action_type IS 'Type of action taken: block, mute, flag, or report';
COMMENT ON COLUMN shield_actions.content_hash IS 'SHA-256 hash of the original content for GDPR compliance';
COMMENT ON COLUMN shield_actions.content_snippet IS 'First 100 characters of content for UI display';
COMMENT ON COLUMN shield_actions.platform IS 'Social media platform where the action was taken';
COMMENT ON COLUMN shield_actions.reason IS 'Categorization of why the action was taken';
COMMENT ON COLUMN shield_actions.created_at IS 'When the action was originally taken';
COMMENT ON COLUMN shield_actions.reverted_at IS 'When the action was reverted (if applicable)';
COMMENT ON COLUMN shield_actions.metadata IS 'Additional data about the action (JSON format)';
COMMENT ON COLUMN shield_actions.updated_at IS 'When the record was last updated';