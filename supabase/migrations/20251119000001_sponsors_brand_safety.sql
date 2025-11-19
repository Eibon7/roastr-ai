-- Brand Safety: Sponsors table (Issue #859)
-- Allows Plus plan users to configure sponsors/brands to protect
-- from offensive comments with automated moderation actions

CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT,
  tags TEXT[],
  active BOOLEAN DEFAULT TRUE NOT NULL,
  
  -- Severity configuration
  -- low: Monitoring only
  -- medium: Moderate protection (-0.1 threshold adjustment)
  -- high: Strong protection (-0.2 threshold adjustment)
  -- zero_tolerance: Immediate block + hide
  severity VARCHAR(50) DEFAULT 'medium' NOT NULL
    CHECK (severity IN ('low', 'medium', 'high', 'zero_tolerance')),
  
  -- Tone override for roast generation
  -- normal: User's default tone
  -- professional: Measured, no aggressive humor
  -- light_humor: Lighthearted, desenfadado
  -- aggressive_irony: Marked irony, direct sarcasm
  tone VARCHAR(50) DEFAULT 'normal' NOT NULL
    CHECK (tone IN ('normal', 'professional', 'light_humor', 'aggressive_irony')),
  
  -- Priority for conflict resolution (1=highest, 5=lowest)
  priority INTEGER DEFAULT 3 NOT NULL
    CHECK (priority BETWEEN 1 AND 5),
  
  -- Actions to take when sponsor is mentioned in toxic comment
  -- hide_comment, block_user, def_roast, agg_roast, report, sponsor_protection
  actions TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  CONSTRAINT sponsors_actions_valid
    CHECK (
      actions <@ ARRAY['hide_comment','block_user','def_roast','agg_roast','report','sponsor_protection']::text[]
    ),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one sponsor name per user
  UNIQUE(user_id, name)
);

-- RLS Policy for sponsors table (multi-tenant isolation)
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_sponsors_isolation ON sponsors
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for efficient lookup
CREATE INDEX idx_sponsors_user_id_active ON sponsors(user_id, active);
CREATE INDEX idx_sponsors_priority ON sponsors(priority);

-- Trigger for automatic updated_at timestamp
CREATE TRIGGER update_sponsors_updated_at
  BEFORE UPDATE ON sponsors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (least privilege: only CRUD operations)
GRANT SELECT, INSERT, UPDATE, DELETE ON sponsors TO authenticated;

COMMENT ON TABLE sponsors IS 'Brand Safety configuration for Plan Plus users (Issue #859)';
COMMENT ON COLUMN sponsors.severity IS 'Protection level: low, medium, high, zero_tolerance';
COMMENT ON COLUMN sponsors.tone IS 'Roast tone override: normal, professional, light_humor, aggressive_irony';
COMMENT ON COLUMN sponsors.priority IS 'Conflict resolution priority (1=highest, 5=lowest)';
COMMENT ON COLUMN sponsors.actions IS 'Actions: hide_comment, block_user, def_roast, agg_roast, report, sponsor_protection';
