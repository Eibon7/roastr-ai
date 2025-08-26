-- Migration: Add test flag to users table for Issue #237
-- Purpose: Add test flag to identify test users for backoffice development
-- Created: 2025-08-26

-- ============================================================================
-- ADD TEST FLAG TO USERS TABLE
-- ============================================================================

-- Add test flag column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;

-- Create index for efficient queries on test users
CREATE INDEX IF NOT EXISTS idx_users_is_test ON users(is_test) WHERE is_test = true;

-- Add comment for documentation
COMMENT ON COLUMN users.is_test IS 'Flag to identify test users for backoffice development and easy cleanup';

-- ============================================================================
-- ROW LEVEL SECURITY UPDATES
-- ============================================================================

-- Allow admins to see test users for backoffice management
CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_id 
        AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Comment for documentation
COMMENT ON FUNCTION is_admin_user IS 'Helper function to check if a user has admin privileges';