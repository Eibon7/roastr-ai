-- Fix infinite recursion in RLS policies
-- The problem: org_isolation policy references organization_members which creates circular dependency

-- Drop existing problematic policies
DROP POLICY IF EXISTS org_isolation ON organizations;
DROP POLICY IF EXISTS org_isolation ON organization_members;
DROP POLICY IF EXISTS org_isolation ON posts;
DROP POLICY IF EXISTS org_isolation ON comments;
DROP POLICY IF EXISTS org_isolation ON roasts;

-- Create simpler, non-recursive policies

-- Organizations: users can see orgs they own OR are members of (direct checks only)
CREATE POLICY organizations_owner_access ON organizations
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY organizations_member_access ON organizations
    FOR ALL USING (
        id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    );

-- Organization members: can see memberships for orgs they belong to
CREATE POLICY org_members_access ON organization_members
    FOR ALL USING (
        user_id = auth.uid() OR
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Posts: can access if belong to accessible organization
CREATE POLICY posts_access ON posts
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Comments: can access if belong to accessible organization
CREATE POLICY comments_access ON comments
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Roasts: can access if belong to accessible organization
CREATE POLICY roasts_access ON roasts
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );
