-- Update Free plan connection limits (Issue #366)
-- CodeRabbit requirement: Free=1, Pro+=2

-- Update Free plan to have only 1 connection
UPDATE plans 
SET integrations_limit = 1 
WHERE id = 'free';

-- Ensure Pro plans have at least 2 connections (already set correctly)
-- Pro: 5 connections (>= 2) ✓
-- Creator Plus: 999 connections (>= 2) ✓
-- Custom: 999 connections (>= 2) ✓

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_plans_integrations_limit ON plans(integrations_limit);

-- Add comment for clarity
COMMENT ON COLUMN plans.integrations_limit IS 'Maximum number of platform integrations allowed for this plan (Issue #366: Free=1, Pro+=2+)';