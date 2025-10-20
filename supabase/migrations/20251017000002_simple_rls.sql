-- Ultra-simple RLS policies - NO circular dependencies

-- Drop all existing policies
DROP POLICY IF EXISTS organizations_owner_access ON organizations;
DROP POLICY IF EXISTS organizations_member_access ON organizations;
DROP POLICY IF EXISTS org_members_self_access ON organization_members;
DROP POLICY IF EXISTS org_members_owner_access ON organization_members;
DROP POLICY IF EXISTS posts_access ON posts;
DROP POLICY IF EXISTS comments_access ON comments;
DROP POLICY IF EXISTS roasts_access ON roasts;

-- Organizations: ONLY owner can see (simplest, no recursion)
CREATE POLICY organizations_simple_access ON organizations
    FOR ALL
    TO authenticated
    USING (owner_id = auth.uid());

-- Organization members: owner or self
CREATE POLICY org_members_simple_access ON organization_members
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Posts: owner only (via organizations)
CREATE POLICY posts_simple_access ON posts
    FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Comments: owner only (via organizations)
CREATE POLICY comments_simple_access ON comments
    FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Roasts: owner only (via organizations)
CREATE POLICY roasts_simple_access ON roasts
    FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );
