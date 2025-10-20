-- ============================================================================
-- Add Missing Tables for Multi-Tenant RLS Tests
-- Execute this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rpkhiemljhncddmhrilk/sql/new
-- ============================================================================

-- 1. Create posts table (social media posts being monitored)
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Platform details
    platform VARCHAR(50) NOT NULL,
    platform_post_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_username VARCHAR(255),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, platform, platform_post_id)
);

-- 2. Add post_id column to existing comments table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comments' AND column_name = 'post_id'
    ) THEN
        ALTER TABLE comments ADD COLUMN post_id UUID REFERENCES posts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Add content column to existing comments table (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comments' AND column_name = 'content'
    ) THEN
        ALTER TABLE comments ADD COLUMN content TEXT;
    END IF;
END $$;

-- 4. Create roasts table (generated responses)
CREATE TABLE IF NOT EXISTS roasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    -- Roast content
    generated_roast TEXT NOT NULL,
    tone VARCHAR(50) NOT NULL,

    -- Generation metadata
    model_used VARCHAR(100),
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_organization_id ON posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_posts_platform_post_id ON posts(platform, platform_post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_roasts_organization_id ON roasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_roasts_comment_id ON roasts(comment_id);

-- 6. Enable RLS on new tables
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for organization isolation

-- Posts policy
DROP POLICY IF EXISTS posts_org_isolation ON posts;
CREATE POLICY posts_org_isolation ON posts FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o
        LEFT JOIN organization_members om ON o.id = om.organization_id
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

-- Roasts policy
DROP POLICY IF EXISTS roasts_org_isolation ON roasts;
CREATE POLICY roasts_org_isolation ON roasts FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o
        LEFT JOIN organization_members om ON o.id = om.organization_id
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

-- ============================================================================
-- Verification Queries (run after to confirm)
-- ============================================================================

-- Check that all tables exist
SELECT
    tablename,
    hasindexes,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('posts', 'comments', 'roasts', 'users', 'organizations')
ORDER BY tablename;

-- Check posts columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'posts'
ORDER BY ordinal_position;

-- Check comments columns (should include post_id now)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'comments'
ORDER BY ordinal_position;

-- Check roasts columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'roasts'
ORDER BY ordinal_position;
