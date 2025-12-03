-- Migration 057: Enable RLS on Missing Tables
-- Issue: Supabase security alert - RLS disabled on public schema tables
-- Tables affected: plans, user_activities, roast_tones
-- Created: 2025-12-02

-- ============================================================================
-- ENABLE RLS ON MISSING TABLES
-- ============================================================================

-- Enable RLS on plans table
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_activities table
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Enable RLS on roast_tones table
ALTER TABLE roast_tones ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: plans
-- ============================================================================

-- Policy: Everyone can read plans (public data for plan selection)
CREATE POLICY "plans_read_policy" ON plans
    FOR SELECT
    USING (true);

-- Policy: Only admins can insert plans
CREATE POLICY "plans_insert_policy" ON plans
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- Policy: Only admins can update plans
CREATE POLICY "plans_update_policy" ON plans
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- Policy: Only admins can delete plans
CREATE POLICY "plans_delete_policy" ON plans
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- ============================================================================
-- RLS POLICIES: user_activities
-- ============================================================================

-- Policy: Only admins can read user activities (sensitive audit data)
CREATE POLICY "user_activities_read_policy" ON user_activities
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- Policy: Service role can insert user activities (system logging)
-- Note: This allows authenticated users to insert their own activities
CREATE POLICY "user_activities_insert_policy" ON user_activities
    FOR INSERT
    WITH CHECK (
        -- Either it's the user's own activity OR it's an admin
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- Policy: Only admins can update user activities
CREATE POLICY "user_activities_update_policy" ON user_activities
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- Policy: Only admins can delete user activities
CREATE POLICY "user_activities_delete_policy" ON user_activities
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- ============================================================================
-- RLS POLICIES: roast_tones
-- ============================================================================

-- Policy: Everyone can read active roast tones (needed for tone selection)
CREATE POLICY "roast_tones_read_policy" ON roast_tones
    FOR SELECT
    USING (true);

-- Policy: Only admins can insert roast tones
CREATE POLICY "roast_tones_insert_policy" ON roast_tones
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- Policy: Only admins can update roast tones
CREATE POLICY "roast_tones_update_policy" ON roast_tones
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- Policy: Only admins can delete roast tones
CREATE POLICY "roast_tones_delete_policy" ON roast_tones
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND is_admin = true
            AND active = true
        )
    );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated role
GRANT SELECT ON plans TO authenticated;
GRANT SELECT ON roast_tones TO authenticated;
GRANT SELECT, INSERT ON user_activities TO authenticated;

-- Admins get full access (controlled by RLS policies)
GRANT ALL ON plans TO authenticated;
GRANT ALL ON user_activities TO authenticated;
GRANT ALL ON roast_tones TO authenticated;

-- Service role gets full access (bypasses RLS)
GRANT ALL ON plans TO service_role;
GRANT ALL ON user_activities TO service_role;
GRANT ALL ON roast_tones TO service_role;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "plans_read_policy" ON plans IS 
    'Allow all authenticated users to read plans for plan selection UI';

COMMENT ON POLICY "user_activities_read_policy" ON user_activities IS 
    'Restrict user activity logs to admin access only (sensitive audit data)';

COMMENT ON POLICY "user_activities_insert_policy" ON user_activities IS 
    'Allow users to log their own activities, admins can log any activity';

COMMENT ON POLICY "roast_tones_read_policy" ON roast_tones IS 
    'Allow all users to read roast tones for tone selection in roast generation';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    plans_rls BOOLEAN;
    activities_rls BOOLEAN;
    tones_rls BOOLEAN;
    plans_policies INTEGER;
    activities_policies INTEGER;
    tones_policies INTEGER;
BEGIN
    -- Check if RLS is enabled
    SELECT relrowsecurity INTO plans_rls 
    FROM pg_class WHERE relname = 'plans';
    
    SELECT relrowsecurity INTO activities_rls 
    FROM pg_class WHERE relname = 'user_activities';
    
    SELECT relrowsecurity INTO tones_rls 
    FROM pg_class WHERE relname = 'roast_tones';
    
    -- Count policies
    SELECT COUNT(*) INTO plans_policies 
    FROM pg_policies WHERE tablename = 'plans';
    
    SELECT COUNT(*) INTO activities_policies 
    FROM pg_policies WHERE tablename = 'user_activities';
    
    SELECT COUNT(*) INTO tones_policies 
    FROM pg_policies WHERE tablename = 'roast_tones';
    
    -- Verify RLS is enabled
    IF NOT plans_rls THEN
        RAISE EXCEPTION 'RLS not enabled on plans table';
    END IF;
    
    IF NOT activities_rls THEN
        RAISE EXCEPTION 'RLS not enabled on user_activities table';
    END IF;
    
    IF NOT tones_rls THEN
        RAISE EXCEPTION 'RLS not enabled on roast_tones table';
    END IF;
    
    -- Verify policies exist
    IF plans_policies < 4 THEN
        RAISE EXCEPTION 'Expected at least 4 policies on plans, found %', plans_policies;
    END IF;
    
    IF activities_policies < 4 THEN
        RAISE EXCEPTION 'Expected at least 4 policies on user_activities, found %', activities_policies;
    END IF;
    
    IF tones_policies < 4 THEN
        RAISE EXCEPTION 'Expected at least 4 policies on roast_tones, found %', tones_policies;
    END IF;
    
    RAISE NOTICE '✅ Migration 057 completed successfully:';
    RAISE NOTICE '  - plans: RLS enabled, % policies', plans_policies;
    RAISE NOTICE '  - user_activities: RLS enabled, % policies', activities_policies;
    RAISE NOTICE '  - roast_tones: RLS enabled, % policies', tones_policies;
END $$;

