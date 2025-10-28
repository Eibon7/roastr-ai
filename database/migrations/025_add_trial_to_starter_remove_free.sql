-- Migration 025: Add Trial to Starter, Remove Free Plan
-- Issue: #678 - Free → Starter Trial Migration
-- Created: 2025-10-28

BEGIN;

-- ============================================================================
-- STEP 1: Add trial fields to organizations table
-- ============================================================================

-- Add trial timestamp fields
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Note: is_in_trial is computed in application layer via:
-- WHERE trial_ends_at IS NOT NULL AND trial_ends_at > NOW()
-- Postgres generated columns cannot use volatile functions like NOW()

-- Remove Stripe subscription field (no longer needed for Polar)
ALTER TABLE organizations
DROP COLUMN IF EXISTS stripe_subscription_id;

-- Add index for efficient trial expiration queries
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at 
ON organizations(trial_ends_at) 
WHERE trial_ends_at IS NOT NULL;

-- ============================================================================
-- STEP 2: Update plan constraint to remove 'free' and add new plans
-- ============================================================================

-- Drop the old constraint
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_plan_check;

-- Add new constraint with updated plan names
ALTER TABLE organizations
ADD CONSTRAINT organizations_plan_check 
CHECK (plan_id IN ('starter_trial', 'starter', 'pro', 'plus', 'custom'));

-- ============================================================================
-- STEP 3: Update existing 'free' organizations to 'starter_trial'
-- ============================================================================

-- Convert existing free and basic users to starter_trial with 30-day trial
-- MUST do this BEFORE adding the CHECK constraint
UPDATE organizations
SET 
  plan_id = 'starter_trial',
  trial_starts_at = NOW(),
  trial_ends_at = NOW() + INTERVAL '30 days'
WHERE plan_id IN ('free', 'basic');

-- Safety check: fail if any unexpected plan_ids remain
DO $$
DECLARE
  unexpected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unexpected_count
  FROM organizations
  WHERE plan_id NOT IN ('starter_trial', 'starter', 'pro', 'plus', 'custom');
  
  IF unexpected_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % organizations have unexpected plan_ids. Expected: starter_trial, starter, pro, plus, custom', unexpected_count;
  END IF;
END $$;

-- Update default plan_id from 'free' to 'starter_trial'
ALTER TABLE organizations
ALTER COLUMN plan_id SET DEFAULT 'starter_trial';

-- ============================================================================
-- STEP 4: Update plans table (if exists)
-- ============================================================================

-- Remove 'free' plan from plans table if it exists
DELETE FROM plans WHERE id = 'free';

-- Insert starter_trial plan if it doesn't exist
INSERT INTO plans (
  id, name, description, monthly_price_cents, yearly_price_cents,
  monthly_responses_limit, integrations_limit, shield_enabled, features
)
VALUES (
  'starter_trial', 
  'Starter Trial', 
  '30-day trial (card required)', 
  0, 
  0, 
  1000,  -- same limits as starter
  2, 
  TRUE,  -- Shield enabled during trial
  '["gpt5_roasts", "shield_basic", "basic_integrations", "trial"]'
)
ON CONFLICT (id) DO NOTHING;

-- Update starter plan if it exists (only non-trial starter)
UPDATE plans
SET 
  name = 'Starter',
  description = 'Entry plan with GPT-5 and Shield'
WHERE id = 'starter';

-- ============================================================================
-- STEP 5: Create helper function for trial conversion
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_trial_to_starter()
RETURNS TABLE(
  organization_id UUID,
  plan_id_before VARCHAR,
  plan_id_after VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  UPDATE organizations
  SET 
    plan_id = 'starter',
    trial_starts_at = NULL,
    trial_ends_at = NULL
  WHERE plan_id = 'starter_trial' 
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW()
  RETURNING 
    organizations.id,
    'starter_trial'::VARCHAR,
    'starter'::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: Comments for documentation
-- ============================================================================

COMMENT ON COLUMN organizations.trial_starts_at IS 'When the trial period started';
COMMENT ON COLUMN organizations.trial_ends_at IS 'When the trial period expires. User auto-converts to paid Starter if not cancelled';
COMMENT ON COLUMN organizations.is_in_trial IS 'Computed: TRUE if trial_ends_at exists and is in the future';

COMMENT ON FUNCTION convert_trial_to_starter() IS 
'Converts all expired trials to paid starter plan. Run this periodically via cron job';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Check organizations without free plan
-- SELECT plan_id, COUNT(*) FROM organizations GROUP BY plan_id;

-- Check trial status
-- SELECT is_in_trial, COUNT(*) FROM organizations WHERE trial_ends_at IS NOT NULL GROUP BY is_in_trial;

-- Check trial expiration dates
-- SELECT plan_id, COUNT(*), MIN(trial_ends_at), MAX(trial_ends_at) 
-- FROM organizations 
-- WHERE trial_ends_at IS NOT NULL 
-- GROUP BY plan_id;

