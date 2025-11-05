-- Migration: Add Level Configuration Feature (Issue #597)
-- Description: Adds roast_level (1-5) and shield_level (1-5) with plan-based restrictions
-- Date: 2025-11-05

-- Add roast_level column to integration_configs table
ALTER TABLE integration_configs
ADD COLUMN IF NOT EXISTS roast_level INTEGER DEFAULT 3
  CHECK (roast_level BETWEEN 1 AND 5);

-- Add shield_level column to integration_configs table
ALTER TABLE integration_configs
ADD COLUMN IF NOT EXISTS shield_level INTEGER DEFAULT 3
  CHECK (shield_level BETWEEN 1 AND 5);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_integration_configs_roast_level
ON integration_configs(roast_level);

CREATE INDEX IF NOT EXISTS idx_integration_configs_shield_level
ON integration_configs(shield_level);

-- Add comments for documentation
COMMENT ON COLUMN integration_configs.roast_level IS 'Roast intensity level (1=Mild, 2=Neutral, 3=Moderate, 4=Aggressive, 5=Caustic). Affects temperature, profanity, and sarcasm level.';
COMMENT ON COLUMN integration_configs.shield_level IS 'Shield toxicity threshold level (1=Tolerant τ=0.85, 2=Balanced-Tolerant τ=0.78, 3=Balanced τ=0.70, 4=Balanced-Strict τ=0.60, 5=Strict τ=0.50).';

-- Update existing integration_configs to have default level 3 (balanced)
UPDATE integration_configs
SET roast_level = 3
WHERE roast_level IS NULL;

UPDATE integration_configs
SET shield_level = 3
WHERE shield_level IS NULL;

-- Add level tracking to responses table for analytics
ALTER TABLE responses
ADD COLUMN IF NOT EXISTS roast_level_used INTEGER
  CHECK (roast_level_used BETWEEN 1 AND 5);

ALTER TABLE responses
ADD COLUMN IF NOT EXISTS shield_level_used INTEGER
  CHECK (shield_level_used BETWEEN 1 AND 5);

-- Create index for level analytics
CREATE INDEX IF NOT EXISTS idx_responses_roast_level
ON responses(roast_level_used) WHERE roast_level_used IS NOT NULL;

-- Add comments
COMMENT ON COLUMN responses.roast_level_used IS 'Roast level used for this response generation (for analytics and auditing).';
COMMENT ON COLUMN responses.shield_level_used IS 'Shield level active at the time of generation (for analytics).';
