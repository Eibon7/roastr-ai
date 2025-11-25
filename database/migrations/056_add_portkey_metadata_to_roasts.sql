-- Migration: Add Portkey AI Gateway metadata to roasts_metadata
-- Issue #920: Portkey AI Gateway integration
-- Description: Add fields to track AI mode, provider, fallback usage, and Portkey metadata
-- Created: 2025-01-27

-- Add Portkey metadata columns to roasts_metadata table
ALTER TABLE roasts_metadata
  ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS portkey_metadata JSONB DEFAULT NULL;

-- Add constraint for mode values (flanders, balanceado, canalla, nsfw, default)
ALTER TABLE roasts_metadata
  DROP CONSTRAINT IF EXISTS roasts_metadata_mode_check;

ALTER TABLE roasts_metadata
  ADD CONSTRAINT roasts_metadata_mode_check
  CHECK (mode IN ('flanders', 'balanceado', 'canalla', 'nsfw', 'default'));

-- Add constraint for provider values
ALTER TABLE roasts_metadata
  DROP CONSTRAINT IF EXISTS roasts_metadata_provider_check;

ALTER TABLE roasts_metadata
  ADD CONSTRAINT roasts_metadata_provider_check
  CHECK (provider IN ('openai', 'grok', 'claude', 'mistral', 'portkey'));

-- Create index for mode queries (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_mode ON roasts_metadata(mode);

-- Create index for provider queries (useful for cost tracking)
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_provider ON roasts_metadata(provider);

-- Create index for fallback tracking
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_fallback ON roasts_metadata(fallback_used);

-- Add comments for documentation
COMMENT ON COLUMN roasts_metadata.mode IS 'AI mode used (flanders, balanceado, canalla, nsfw, default) - Issue #920';
COMMENT ON COLUMN roasts_metadata.provider IS 'AI provider used (openai, grok, claude, mistral, portkey) - Issue #920';
COMMENT ON COLUMN roasts_metadata.fallback_used IS 'Whether fallback provider was used (e.g., NSFW without Grok → OpenAI) - Issue #920';
COMMENT ON COLUMN roasts_metadata.portkey_metadata IS 'Additional Portkey-specific metadata (JSONB) - Issue #920';


