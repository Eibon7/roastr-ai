-- Migration: Brand Safety - Sponsors Table for Plus Plan
-- Issue #859: https://github.com/roastr-ai/roastr-ai/issues/859
-- Author: Backend Dev
-- Date: 2025-11-17
--
-- Purpose:
-- Creates the `sponsors` table for Brand Safety feature (Plus plan).
-- Allows Plus users to configure sponsors/brands to protect from negative comments.
--
-- Features:
-- - User-specific sponsors with RLS isolation
-- - Configurable severity levels and response tones
-- - Tag-based detection for flexible matching
-- - Priority system for multiple sponsor matches
-- - Customizable actions (Shield, defensive roast, etc.)

-- Create sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN DEFAULT TRUE NOT NULL,
  severity VARCHAR(50) DEFAULT 'medium' NOT NULL 
    CHECK (severity IN ('low', 'medium', 'high', 'zero_tolerance')),
  tone VARCHAR(50) DEFAULT 'normal' NOT NULL 
    CHECK (tone IN ('normal', 'professional', 'light_humor', 'aggressive_irony')),
  priority INTEGER DEFAULT 3 NOT NULL 
    CHECK (priority BETWEEN 1 AND 5),
  actions TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_sponsor_name UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own sponsors
CREATE POLICY user_sponsors_isolation ON sponsors
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sponsors_user_id_active 
  ON sponsors(user_id, active);

CREATE INDEX IF NOT EXISTS idx_sponsors_priority 
  ON sponsors(priority) WHERE active = TRUE;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_sponsors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sponsors_updated_at
  BEFORE UPDATE ON sponsors
  FOR EACH ROW
  EXECUTE FUNCTION update_sponsors_updated_at();

-- Comments for documentation
COMMENT ON TABLE sponsors IS 'Brand Safety: User-configured sponsors/brands to protect (Plus plan only)';
COMMENT ON COLUMN sponsors.user_id IS 'Owner of the sponsor configuration';
COMMENT ON COLUMN sponsors.name IS 'Sponsor/brand name (e.g., "Nike")';
COMMENT ON COLUMN sponsors.url IS 'Optional sponsor website for tag extraction';
COMMENT ON COLUMN sponsors.tags IS 'Keywords for detection (e.g., ["sportswear", "sneakers"])';
COMMENT ON COLUMN sponsors.active IS 'Whether sponsor protection is active';
COMMENT ON COLUMN sponsors.severity IS 'Protection level: low, medium, high, zero_tolerance';
COMMENT ON COLUMN sponsors.tone IS 'Roast tone override: normal, professional, light_humor, aggressive_irony';
COMMENT ON COLUMN sponsors.priority IS 'Match priority (1=highest, 5=lowest)';
COMMENT ON COLUMN sponsors.actions IS 'Actions to apply: hide_comment, block_user, def_roast, agg_roast, report, sponsor_protection';

