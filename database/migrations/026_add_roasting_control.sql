-- Migration: Add Roasting Control Feature (Issue #596)
-- Description: Adds roasting enable/disable toggle with audit trail
-- Date: 2025-11-05

-- Add roasting_enabled column to users table (default TRUE for backward compatibility)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS roasting_enabled BOOLEAN DEFAULT TRUE NOT NULL;

-- Add audit trail columns for roasting control
ALTER TABLE users
ADD COLUMN IF NOT EXISTS roasting_disabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS roasting_disabled_reason TEXT;

-- Create index for fast roasting_enabled lookups
CREATE INDEX IF NOT EXISTS idx_users_roasting_enabled
ON users(roasting_enabled) WHERE roasting_enabled = FALSE;

-- Add comment for documentation
COMMENT ON COLUMN users.roasting_enabled IS 'Global toggle for roasting feature. When FALSE, all roast generation is disabled for this user.';
COMMENT ON COLUMN users.roasting_disabled_at IS 'Timestamp when roasting was disabled. Used for audit trail.';
COMMENT ON COLUMN users.roasting_disabled_reason IS 'Optional reason for disabling roasting (e.g., user_request, abuse, etc.)';

-- Update existing users to have roasting enabled by default
UPDATE users
SET roasting_enabled = TRUE
WHERE roasting_enabled IS NULL;
