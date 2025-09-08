-- Migration 013: Add Unique Constraint for Purchase History
-- Issue: Duplicate Purchase History Prevention - Fix duplicate purchase history prevention
-- Purpose: Add unique constraint on stripe_checkout_session_id to prevent duplicate pending rows

-- ============================================================================
-- ADD UNIQUE CONSTRAINT ON STRIPE CHECKOUT SESSION ID
-- ============================================================================

-- Add unique constraint to prevent duplicate purchase history entries
-- for the same Stripe checkout session
ALTER TABLE addon_purchase_history 
ADD CONSTRAINT addon_purchase_history_stripe_session_unique 
UNIQUE (stripe_checkout_session_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT addon_purchase_history_stripe_session_unique 
ON addon_purchase_history IS 'Ensures each Stripe checkout session can only have one purchase history record, preventing duplicates during concurrent requests';
