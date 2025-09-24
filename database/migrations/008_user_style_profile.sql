-- Migration: Create user_style_profile table
-- Issue: #369 - SPEC 9 Style Profile Extraction
-- Description: Store encrypted style profiles for Pro/Plus users

-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_style_profile table
CREATE TABLE IF NOT EXISTS user_style_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    encrypted_profile TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL, -- Initialization vector for AES-256-GCM
    auth_tag VARCHAR(32) NOT NULL, -- Authentication tag for AES-256-GCM
    last_refresh TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    comment_count_since_refresh INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one profile per user per platform
    CONSTRAINT unique_user_platform UNIQUE (user_id, platform)
);

-- Create indexes for performance
CREATE INDEX idx_user_style_profile_user_id ON user_style_profile(user_id);
CREATE INDEX idx_user_style_profile_platform ON user_style_profile(platform);
CREATE INDEX idx_user_style_profile_last_refresh ON user_style_profile(last_refresh);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_style_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_style_profile_updated_at_trigger
BEFORE UPDATE ON user_style_profile
FOR EACH ROW
EXECUTE FUNCTION update_user_style_profile_updated_at();

-- Row Level Security (RLS)
ALTER TABLE user_style_profile ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own style profiles
CREATE POLICY "Users can view own style profiles" ON user_style_profile
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can manage all style profiles
CREATE POLICY "Service role can manage style profiles" ON user_style_profile
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE user_style_profile IS 'Stores encrypted style profiles extracted from user comments for Pro/Plus plans';
COMMENT ON COLUMN user_style_profile.encrypted_profile IS 'AES-256-GCM encrypted style profile data';
COMMENT ON COLUMN user_style_profile.iv IS 'Initialization vector for decryption';
COMMENT ON COLUMN user_style_profile.auth_tag IS 'Authentication tag for GCM mode verification';
COMMENT ON COLUMN user_style_profile.comment_count_since_refresh IS 'Number of new comments since last refresh for tracking refresh threshold';