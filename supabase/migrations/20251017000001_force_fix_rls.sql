-- Force fix RLS policies - remove ALL existing policies and recreate cleanly

-- Drop ALL policies on target tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE tablename IN ('organizations', 'organization_members', 'posts', 'comments', 'roasts')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
        RAISE NOTICE 'Dropped policy % on %', r.policyname, r.tablename;
    END LOOP;
END $$;

-- Create simple, non-recursive policies for organizations
-- Split into two policies to avoid circular dependency

CREATE POLICY organizations_owner_access ON organizations
    FOR ALL
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY organizations_member_access ON organizations
    FOR ALL
    TO authenticated
    USING (
        id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Organization members policy (no recursion)
CREATE POLICY org_members_self_access ON organization_members
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY org_members_owner_access ON organization_members
    FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
        )
    );

-- Posts policy (direct check, no recursion)
CREATE POLICY posts_access ON posts
    FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Comments policy (direct check, no recursion)
CREATE POLICY comments_access ON comments
    FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );

-- Roasts policy (direct check, no recursion)
CREATE POLICY roasts_access ON roasts
    FOR ALL
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM organizations WHERE owner_id = auth.uid()
            UNION
            SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
    );
