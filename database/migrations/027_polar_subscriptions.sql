-- Migration: Create polar_subscriptions table
-- Issue: #594 - Polar Payment Integration
-- Created: 2025-11-11
-- Purpose: Track user subscriptions from Polar (replacing Stripe)

-- Create polar_subscriptions table
CREATE TABLE IF NOT EXISTS polar_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  polar_subscription_id TEXT UNIQUE NOT NULL,
  
  -- Plan details
  plan TEXT NOT NULL CHECK (plan IN ('starter_trial', 'pro', 'creator_plus')),
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
  
  -- Billing periods
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_end TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_user_id ON polar_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_status ON polar_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_polar_subscriptions_polar_id ON polar_subscriptions(polar_subscription_id);

-- Enable Row Level Security
ALTER TABLE polar_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own subscriptions
CREATE POLICY polar_subscriptions_user_select
  ON polar_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can manage all subscriptions (for webhook handlers)
CREATE POLICY polar_subscriptions_service_all
  ON polar_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE polar_subscriptions IS 'User subscriptions managed by Polar (Merchant of Record)';
COMMENT ON COLUMN polar_subscriptions.plan IS 'Plan tier: starter_trial (Free with trial), pro, creator_plus';
COMMENT ON COLUMN polar_subscriptions.status IS 'Subscription status: active, trialing, past_due, canceled, unpaid';
COMMENT ON COLUMN polar_subscriptions.cancel_at_period_end IS 'True if subscription will cancel at end of current period';

