-- Add missing columns to shield_actions table
ALTER TABLE shield_actions ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE shield_actions ADD COLUMN IF NOT EXISTS content_snippet TEXT;
