-- Migration: Remove Free plan and migrate users to starter_trial (Issue #868 + #678)
-- Date: 2025-11-18
-- Description: Removes deprecated "free" plan, migrates existing free users to "starter_trial"
-- Part of broader Free plan elimination strategy

-- Step 1: Migrate existing organizations from 'free' to 'starter_trial'
UPDATE organizations
SET 
  plan_id = 'starter_trial',
  updated_at = NOW()
WHERE plan_id = 'free';

-- Step 2: Update subscription_history for tracking
INSERT INTO subscription_history (organization_id, from_plan, to_plan, changed_at, reason)
SELECT 
  id as organization_id,
  'free' as from_plan,
  'starter_trial' as to_plan,
  NOW() as changed_at,
  'Automatic migration: Free plan deprecated (Issue #868)' as reason
FROM organizations
WHERE plan_id = 'starter_trial' 
AND id IN (
  SELECT organization_id FROM subscription_history 
  WHERE from_plan = 'free' 
  GROUP BY organization_id
);

-- Step 3: Remove 'free' plan from plans table (if exists)
DELETE FROM plans WHERE plan_id = 'free';

-- Step 4: Add CHECK constraint to prevent 'free' plan in future
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_plan_id_check;

ALTER TABLE organizations
ADD CONSTRAINT organizations_plan_id_check
CHECK (plan_id IN ('starter_trial', 'starter', 'pro', 'plus'));

-- Step 5: Add migration metadata
INSERT INTO migration_log (migration_name, executed_at, status, affected_rows)
VALUES (
  '20251118193202_remove_free_plan', 
  NOW(), 
  'completed',
  (SELECT COUNT(*) FROM organizations WHERE plan_id = 'starter_trial')
)
ON CONFLICT (migration_name) DO NOTHING;

-- Rollback (if needed):
-- ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_id_check;
-- INSERT INTO plans (plan_id, name, price_cents, features) VALUES ('free', 'Free', 0, '{"roasts_per_day": 10}');

