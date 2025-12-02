-- Migration: Create admin_settings table for SSOT v2
-- Issue: #1090
-- Date: 2025-01-27
-- Description: Creates admin_settings table for dynamic runtime configuration
--              This is part of the Single Source of Truth (SSOT) infrastructure for v2

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on updated_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at ON admin_settings(updated_at);

-- Add comment to table
COMMENT ON TABLE admin_settings IS 'Dynamic runtime configuration for SSOT v2. Values here override admin-controlled.yaml.';

-- Add comment to columns
COMMENT ON COLUMN admin_settings.key IS 'Dot-separated key path (e.g., shield.default_aggressiveness)';
COMMENT ON COLUMN admin_settings.value IS 'JSONB value for the setting';
COMMENT ON COLUMN admin_settings.updated_at IS 'Timestamp of last update';
COMMENT ON COLUMN admin_settings.created_at IS 'Timestamp of creation';

-- Enable RLS (Row Level Security) - Only service role can access
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can read
CREATE POLICY "Service role can read admin_settings"
  ON admin_settings
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Only service role can insert
CREATE POLICY "Service role can insert admin_settings"
  ON admin_settings
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Only service role can update
CREATE POLICY "Service role can update admin_settings"
  ON admin_settings
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Only service role can delete
CREATE POLICY "Service role can delete admin_settings"
  ON admin_settings
  FOR DELETE
  TO service_role
  USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on UPDATE
CREATE TRIGGER update_admin_settings_timestamp
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_settings_updated_at();

