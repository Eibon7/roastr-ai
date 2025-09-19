-- Migration: Roast Engine Metadata Storage (Issue #363)
-- Description: Create table to store only roast metadata (GDPR compliant)
-- Created: 2025-01-18

-- Create roasts_metadata table for GDPR-compliant storage
CREATE TABLE IF NOT EXISTS roasts_metadata (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL,
    org_id UUID,
    platform VARCHAR(50) NOT NULL,
    comment_id VARCHAR(255),
    style VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
    versions_count INTEGER NOT NULL DEFAULT 1 CHECK (versions_count IN (1, 2)),
    auto_approve BOOLEAN NOT NULL DEFAULT false,
    transparency_applied BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, auto_approved, approved, declined
    tokens_used INTEGER DEFAULT 0,
    method VARCHAR(100), -- generation method used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance (CodeRabbit Round 5: added org_id index for multi-tenant queries)
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_user_id ON roasts_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_org_id ON roasts_metadata(org_id);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_created_at ON roasts_metadata(created_at);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_user_created ON roasts_metadata(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_org_user ON roasts_metadata(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_status ON roasts_metadata(status);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_platform ON roasts_metadata(platform);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_auto_approve ON roasts_metadata(auto_approve);

-- Create function to update updated_at timestamp (CodeRabbit Round 5: schema-qualified and security enhanced)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for roasts_metadata
CREATE TRIGGER update_roasts_metadata_updated_at
    BEFORE UPDATE ON roasts_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to get user roast configuration
CREATE OR REPLACE FUNCTION get_user_roast_config(user_uuid UUID)
RETURNS TABLE (
    plan VARCHAR(50),
    auto_approve BOOLEAN,
    default_style VARCHAR(50),
    language VARCHAR(10),
    transparency_mode VARCHAR(50)
) AS $$
BEGIN
    -- Security: Restrict search_path to prevent injection
    PERFORM set_config('search_path', 'public', true);
    
    RETURN QUERY
    SELECT 
        COALESCE(us.plan, 'free')::VARCHAR(50) as plan,
        COALESCE(rsp.auto_approve, false) as auto_approve,
        COALESCE(rsp.default_style, 'balanceado')::VARCHAR(50) as default_style,
        COALESCE(rsp.language, 'es')::VARCHAR(10) as language,
        COALESCE(rsp.transparency_mode, 'signature')::VARCHAR(50) as transparency_mode
    FROM users u
    LEFT JOIN user_subscriptions us ON u.id = us.user_id
    LEFT JOIN roastr_style_preferences rsp ON u.id = rsp.user_id
    WHERE u.id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create roast style preferences table if not exists
CREATE TABLE IF NOT EXISTS roastr_style_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auto_approve BOOLEAN NOT NULL DEFAULT false,
    default_style VARCHAR(50) NOT NULL DEFAULT 'balanceado',
    language VARCHAR(10) NOT NULL DEFAULT 'es',
    transparency_mode VARCHAR(50) NOT NULL DEFAULT 'signature',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for roast style preferences
CREATE INDEX IF NOT EXISTS idx_roastr_style_preferences_user_id ON roastr_style_preferences(user_id);

-- Enable RLS on roasts_metadata table
ALTER TABLE roasts_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roasts_metadata (WITH CHECK added for CodeRabbit Round 5)
CREATE POLICY "Users can only access their own roast metadata"
    ON roasts_metadata FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role can access all roast metadata
CREATE POLICY "Service role can access all roast metadata"
    ON roasts_metadata FOR ALL
    TO service_role
    USING (true);

-- Enable RLS on roastr_style_preferences table
ALTER TABLE roastr_style_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roastr_style_preferences (WITH CHECK added for CodeRabbit Round 5)
CREATE POLICY "Users can only access their own style preferences"
    ON roastr_style_preferences FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role can access all style preferences
CREATE POLICY "Service role can access all style preferences"
    ON roastr_style_preferences FOR ALL
    TO service_role
    USING (true);

-- Function to clean up old roast metadata (90 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_roast_metadata()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Security: Restrict search_path to prevent injection
    PERFORM set_config('search_path', 'public', true);
    
    DELETE FROM roasts_metadata
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get roast statistics for user
CREATE OR REPLACE FUNCTION get_user_roast_stats(user_uuid UUID, period_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_roasts INTEGER,
    auto_approved INTEGER,
    pending INTEGER,
    approved INTEGER,
    declined INTEGER,
    total_tokens INTEGER
) AS $$
BEGIN
    -- Security: Restrict search_path to prevent injection
    PERFORM set_config('search_path', 'public', true);
    
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_roasts,
        COUNT(*) FILTER (WHERE status = 'auto_approved')::INTEGER as auto_approved,
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending,
        COUNT(*) FILTER (WHERE status = 'approved')::INTEGER as approved,
        COUNT(*) FILTER (WHERE status = 'declined')::INTEGER as declined,
        COALESCE(SUM(tokens_used), 0)::INTEGER as total_tokens
    FROM roasts_metadata
    WHERE user_id = user_uuid
    AND created_at >= NOW() - INTERVAL '1 day' * period_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE roasts_metadata IS 'GDPR-compliant storage of roast generation metadata only (no sensitive text)';
COMMENT ON COLUMN roasts_metadata.id IS 'Unique identifier for the roast generation';
COMMENT ON COLUMN roasts_metadata.user_id IS 'User who generated the roast';
COMMENT ON COLUMN roasts_metadata.style IS 'Voice style used (flanders, balanceado, canalla, light, balanced, savage)';
COMMENT ON COLUMN roasts_metadata.versions_count IS 'Number of versions generated (1 or 2 based on flag)';
COMMENT ON COLUMN roasts_metadata.auto_approve IS 'Whether roast was set for auto-approval';
COMMENT ON COLUMN roasts_metadata.transparency_applied IS 'Whether transparency disclaimer was applied';
COMMENT ON COLUMN roasts_metadata.status IS 'Current status: pending, auto_approved, approved, declined';

COMMENT ON TABLE roastr_style_preferences IS 'User preferences for roast generation style and behavior';
COMMENT ON FUNCTION get_user_roast_config(UUID) IS 'Get complete roast configuration for a user';
COMMENT ON FUNCTION cleanup_old_roast_metadata() IS 'Clean up roast metadata older than 90 days (GDPR compliance)';
COMMENT ON FUNCTION get_user_roast_stats(UUID, INTEGER) IS 'Get roast generation statistics for a user';

-- Revoke public access and grant only to service roles for security
REVOKE ALL ON FUNCTION get_user_roast_config(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_old_roast_metadata() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_user_roast_stats(UUID, INTEGER) FROM PUBLIC;

-- Grant execute permissions only to service roles
GRANT EXECUTE ON FUNCTION get_user_roast_config(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_roast_metadata() TO service_role;
GRANT EXECUTE ON FUNCTION get_user_roast_stats(UUID, INTEGER) TO service_role;