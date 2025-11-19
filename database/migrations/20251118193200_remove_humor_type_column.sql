-- Migration: Remove humor_type column (Issue #868)
-- Date: 2025-11-18
-- Description: Removes deprecated humor_type column from responses and integration_configs tables
-- Tone is now the sole selector for roast style

-- Step 1: Remove humor_type from responses table
ALTER TABLE responses
DROP COLUMN IF EXISTS humor_type;

-- Step 2: Remove humor_type from integration_configs.settings (JSONB field)
-- Note: JSONB columns cannot be altered directly, this is handled at application level

-- Step 3: Add migration metadata
INSERT INTO migration_log (migration_name, executed_at, status)
VALUES ('20251118193200_remove_humor_type_column', NOW(), 'completed')
ON CONFLICT (migration_name) DO NOTHING;

-- Rollback (if needed):
-- ALTER TABLE responses ADD COLUMN humor_type VARCHAR(50) DEFAULT 'witty';

