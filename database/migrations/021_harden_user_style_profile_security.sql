-- Migration: Harden user_style_profile table security
-- Issue: Critical Security Fixes - Style Profile Extraction Phase 1
-- Description: Add AAD support and strengthen database constraints for security

-- Add AAD column for Additional Authenticated Data support
ALTER TABLE user_style_profile 
ADD COLUMN IF NOT EXISTS aad TEXT;

-- Add NOT NULL constraints to critical fields (with data validation)
-- First, ensure no existing NULL values
UPDATE user_style_profile 
SET 
    encrypted_profile = '' WHERE encrypted_profile IS NULL,
    iv = '' WHERE iv IS NULL,
    auth_tag = '' WHERE auth_tag IS NULL,
    platform = 'unknown' WHERE platform IS NULL,
    comment_count_since_refresh = 0 WHERE comment_count_since_refresh IS NULL;

-- Add NOT NULL constraints
ALTER TABLE user_style_profile 
ALTER COLUMN user_id SET NOT NULL,
ALTER COLUMN platform SET NOT NULL,
ALTER COLUMN encrypted_profile SET NOT NULL,
ALTER COLUMN iv SET NOT NULL,
ALTER COLUMN auth_tag SET NOT NULL,
ALTER COLUMN comment_count_since_refresh SET NOT NULL;

-- Add length and format constraints
ALTER TABLE user_style_profile 
ADD CONSTRAINT check_platform_length CHECK (char_length(platform) >= 2 AND char_length(platform) <= 50),
ADD CONSTRAINT check_platform_format CHECK (platform ~ '^[a-zA-Z0-9_-]+$'),
ADD CONSTRAINT check_iv_length CHECK (char_length(iv) = 32),
ADD CONSTRAINT check_iv_format CHECK (iv ~ '^[0-9a-fA-F]{32}$'),
ADD CONSTRAINT check_auth_tag_length CHECK (char_length(auth_tag) = 32),
ADD CONSTRAINT check_auth_tag_format CHECK (auth_tag ~ '^[0-9a-fA-F]{32}$'),
ADD CONSTRAINT check_encrypted_profile_not_empty CHECK (char_length(encrypted_profile) > 0),
ADD CONSTRAINT check_comment_count_range CHECK (comment_count_since_refresh >= 0 AND comment_count_since_refresh <= 100000);

-- Add constraint for AAD when present
ALTER TABLE user_style_profile 
ADD CONSTRAINT check_aad_format CHECK (
    aad IS NULL OR (char_length(aad) > 0 AND aad ~ '^[A-Za-z0-9+/=]+$')
);

-- Create index on AAD for performance (sparse index for non-null values)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_style_profile_aad 
ON user_style_profile(aad) 
WHERE aad IS NOT NULL;

-- Update table comment to reflect security improvements
COMMENT ON TABLE user_style_profile IS 'Stores encrypted style profiles with AAD security for Pro/Plus users. Critical security constraints enforced.';
COMMENT ON COLUMN user_style_profile.aad IS 'Additional Authenticated Data for AES-GCM encryption - prevents ciphertext swapping attacks';

-- Add constraint documentation
COMMENT ON CONSTRAINT check_iv_format ON user_style_profile IS 'IV must be exactly 32 hex characters (16 bytes)';
COMMENT ON CONSTRAINT check_auth_tag_format ON user_style_profile IS 'Auth tag must be exactly 32 hex characters (16 bytes)';
COMMENT ON CONSTRAINT check_platform_format ON user_style_profile IS 'Platform names must be alphanumeric with underscores/hyphens only';
COMMENT ON CONSTRAINT check_comment_count_range ON user_style_profile IS 'Comment count must be between 0 and 100,000';