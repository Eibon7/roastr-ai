-- Migration: Add admin_settings table for V2 Infrastructure
-- Issue: ROA-369 - Auditoría y completar infraestructura común V2
-- Created: 2025-12-19
--
-- This table stores dynamic configuration for SettingsLoader v2
-- Key-value pairs with dot-separated keys (e.g., "gatekeeper.mode", "feature_flags.autopost_enabled")
-- Values are stored as JSONB to support strings, numbers, booleans, and nested objects

-- Create admin_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL, -- Dot-separated key path
    value JSONB NOT NULL, -- Value can be string, number, boolean, or nested object
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id), -- Admin user who last updated this setting
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(key);
CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at ON admin_settings(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view and modify admin settings
CREATE POLICY admin_settings_admin_only ON admin_settings
    FOR ALL
    USING (
        auth.jwt() ->> 'role' = 'authenticated' AND 
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_settings_updated_at
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_settings_timestamp();

