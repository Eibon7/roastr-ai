-- Migration: Add Portkey metadata to roasts_metadata table (Issue #920)
-- Description: Add mode, provider, fallback_used, and portkey_metadata columns
-- Created: 2025-11-25

ALTER TABLE roasts_metadata
ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'default',
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS portkey_metadata JSONB;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_mode ON roasts_metadata(mode);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_provider ON roasts_metadata(provider);
CREATE INDEX IF NOT EXISTS idx_roasts_metadata_fallback_used ON roasts_metadata(fallback_used);

-- Update comments for documentation
COMMENT ON COLUMN roasts_metadata.mode IS 'AI mode used for roast generation (e.g., default, flanders, balanceado, canalla, nsfw)';
COMMENT ON COLUMN roasts_metadata.provider IS 'LLM provider used for roast generation (e.g., openai, claude, grok)';
COMMENT ON COLUMN roasts_metadata.fallback_used IS 'True if a fallback provider was used for generation';
COMMENT ON COLUMN roasts_metadata.portkey_metadata IS 'Raw metadata from Portkey API response';

