-- Migration: Remove intensity_level column (Issue #868)
-- Date: 2025-11-18
-- Description: Removes deprecated intensity_level column from responses and user configs
-- Tone now controls aggressiveness (Flanders = 2, Balanceado = 3, Canalla = 4)

-- Step 1: Remove intensity_level from responses table (if exists)
ALTER TABLE responses
DROP COLUMN IF EXISTS intensity_level;

-- Step 2: Remove from user_style_settings if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_style_settings' 
    AND column_name = 'intensity_level'
  ) THEN
    ALTER TABLE user_style_settings DROP COLUMN intensity_level;
  END IF;
END $$;

-- Step 3: Add migration metadata
INSERT INTO migration_log (migration_name, executed_at, status)
VALUES ('20251118193201_remove_intensity_level_column', NOW(), 'completed')
ON CONFLICT (migration_name) DO NOTHING;

-- Rollback (if needed):
-- ALTER TABLE responses ADD COLUMN intensity_level INTEGER DEFAULT 3 CHECK (intensity_level >= 1 AND intensity_level <= 5);

