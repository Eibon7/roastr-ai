-- Migration: Add user_subscriptions table for Stripe billing integration
-- Created: 2025-08-07
-- Purpose: Track user subscription plans, Stripe customer/subscription IDs, and billing status

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id text UNIQUE,
    stripe_subscription_id text UNIQUE,
    plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'creator_plus')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'incomplete')),
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean DEFAULT false,
    trial_end timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Enable Row Level Security (RLS)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
    ON user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Only service role can insert/update subscriptions (webhooks)
CREATE POLICY "Service role can manage subscriptions"
    ON user_subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
    ON user_subscriptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_user_subscriptions_updated_at_trigger
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_subscriptions_updated_at();

-- Insert default free subscription for existing users
INSERT INTO user_subscriptions (user_id, plan, status)
SELECT id, 'free', 'active'
FROM users
WHERE id NOT IN (SELECT user_id FROM user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE user_subscriptions IS 'Stores user subscription information and Stripe billing data';
COMMENT ON COLUMN user_subscriptions.user_id IS 'Reference to users table';
COMMENT ON COLUMN user_subscriptions.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN user_subscriptions.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN user_subscriptions.plan IS 'Current subscription plan: free, pro, creator_plus';
COMMENT ON COLUMN user_subscriptions.status IS 'Subscription status from Stripe';
COMMENT ON COLUMN user_subscriptions.current_period_start IS 'Current billing period start';
COMMENT ON COLUMN user_subscriptions.current_period_end IS 'Current billing period end';
COMMENT ON COLUMN user_subscriptions.cancel_at_period_end IS 'Whether subscription will cancel at period end';
COMMENT ON COLUMN user_subscriptions.trial_end IS 'Trial period end date if applicable';