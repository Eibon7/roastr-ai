-- Update Free plan connection limits (Issue #366)
-- Enforced limits: Free=1, Pro=5, Creator Plus=999, Custom=999

-- Update Free plan to have only 1 connection
UPDATE plans 
SET integrations_limit = 1 
WHERE id = 'free';

-- Current plan limits (verified correct):
-- Free: 1 connection (updated above) ✓
-- Pro: 5 connections (already set correctly) ✓
-- Creator Plus: 999 connections (already set correctly) ✓
-- Custom: 999 connections (already set correctly) ✓

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_plans_integrations_limit ON plans(integrations_limit);

-- Add comment for clarity
COMMENT ON COLUMN plans.integrations_limit IS 'Maximum number of platform integrations allowed for this plan (Issue #366: Free=1, Pro+=2+)';