-- Add missing tables for multi-tenant RLS tests
-- Safe migration that checks for existence before creating

-- 1. Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_post_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_username VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, platform, platform_post_id)
);

-- 2. Add post_id to comments (only if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comments' AND column_name = 'post_id'
    ) THEN
        ALTER TABLE comments ADD COLUMN post_id UUID REFERENCES posts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Add content to comments (only if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comments' AND column_name = 'content'
    ) THEN
        ALTER TABLE comments ADD COLUMN content TEXT;
    END IF;
END $$;

-- 4. Add platform_username to comments (only if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comments' AND column_name = 'platform_username'
    ) THEN
        ALTER TABLE comments ADD COLUMN platform_username VARCHAR(255);
    END IF;
END $$;

-- 5. Create roasts table
CREATE TABLE IF NOT EXISTS roasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    generated_roast TEXT NOT NULL,
    tone VARCHAR(50) NOT NULL,
    model_used VARCHAR(100),
    tokens_used INTEGER,
    cost_usd DECIMAL(10, 6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_posts_organization_id ON posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_posts_platform_post_id ON posts(platform, platform_post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_roasts_organization_id ON roasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_roasts_comment_id ON roasts(comment_id);

-- 7. Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies (safe with IF NOT EXISTS equivalent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'posts_org_isolation'
    ) THEN
        CREATE POLICY posts_org_isolation ON posts FOR ALL USING (
            organization_id IN (
                SELECT o.id FROM organizations o
                LEFT JOIN organization_members om ON o.id = om.organization_id
                WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
            )
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'roasts' AND policyname = 'roasts_org_isolation'
    ) THEN
        CREATE POLICY roasts_org_isolation ON roasts FOR ALL USING (
            organization_id IN (
                SELECT o.id FROM organizations o
                LEFT JOIN organization_members om ON o.id = om.organization_id
                WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
            )
        );
    END IF;
END $$;
