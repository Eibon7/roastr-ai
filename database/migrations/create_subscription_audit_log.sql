-- Create subscription audit log table for tracking plan changes
CREATE TABLE IF NOT EXISTS subscription_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- plan_change, status_change, payment_failed, etc.
    old_plan VARCHAR(50),
    new_plan VARCHAR(50),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_event_id VARCHAR(255),
    change_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system',
    
    -- Indexes for common queries
    INDEX idx_audit_user_id (user_id),
    INDEX idx_audit_created_at (created_at),
    INDEX idx_audit_event_type (event_type),
    INDEX idx_audit_stripe_customer (stripe_customer_id)
);

-- Create plan change history table for detailed tracking
CREATE TABLE IF NOT EXISTS plan_change_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    from_plan VARCHAR(50) NOT NULL,
    to_plan VARCHAR(50) NOT NULL,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('upgrade', 'downgrade', 'lateral')),
    change_status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (change_status IN ('pending', 'completed', 'failed', 'blocked')),
    blocked_reason TEXT,
    
    -- Usage at time of change
    usage_snapshot JSONB DEFAULT '{}', -- roasts_count, comments_count, integrations_count, etc.
    
    -- Billing details
    proration_amount INTEGER, -- Amount in cents
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    
    -- Timestamps
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    stripe_subscription_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    initiated_by VARCHAR(50) DEFAULT 'user', -- user, admin, system, stripe_webhook
    metadata JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_history_user_id (user_id),
    INDEX idx_history_org_id (organization_id),
    INDEX idx_history_initiated_at (initiated_at),
    INDEX idx_history_change_type (change_type)
);

-- Create function to automatically log plan changes
CREATE OR REPLACE FUNCTION log_plan_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if plan actually changed
    IF OLD.plan IS DISTINCT FROM NEW.plan THEN
        INSERT INTO plan_change_history (
            user_id,
            from_plan,
            to_plan,
            change_type,
            stripe_subscription_id,
            initiated_by,
            usage_snapshot
        )
        VALUES (
            NEW.user_id,
            COALESCE(OLD.plan, 'free'),
            NEW.plan,
            CASE 
                WHEN OLD.plan = 'free' AND NEW.plan = 'pro' THEN 'upgrade'
                WHEN OLD.plan = 'free' AND NEW.plan = 'creator_plus' THEN 'upgrade'
                WHEN OLD.plan = 'pro' AND NEW.plan = 'creator_plus' THEN 'upgrade'
                WHEN OLD.plan = 'pro' AND NEW.plan = 'free' THEN 'downgrade'
                WHEN OLD.plan = 'creator_plus' AND NEW.plan = 'pro' THEN 'downgrade'
                WHEN OLD.plan = 'creator_plus' AND NEW.plan = 'free' THEN 'downgrade'
                ELSE 'lateral'
            END,
            NEW.stripe_subscription_id,
            'system',
            jsonb_build_object(
                'timestamp', NOW(),
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_subscriptions table
DROP TRIGGER IF EXISTS trigger_log_plan_change ON user_subscriptions;
CREATE TRIGGER trigger_log_plan_change
    AFTER UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION log_plan_change();

-- Create view for plan change analytics
CREATE OR REPLACE VIEW plan_change_analytics AS
SELECT 
    DATE_TRUNC('month', initiated_at) as month,
    change_type,
    from_plan,
    to_plan,
    COUNT(*) as change_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(EXTRACT(EPOCH FROM (completed_at - initiated_at))/60)::INTEGER as avg_completion_minutes,
    COUNT(CASE WHEN change_status = 'blocked' THEN 1 END) as blocked_count,
    COUNT(CASE WHEN change_status = 'failed' THEN 1 END) as failed_count
FROM plan_change_history
WHERE initiated_at >= NOW() - INTERVAL '12 months'
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, 2, 3, 4;

-- Add RLS policies
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_change_history ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own audit logs
CREATE POLICY "Users can view own audit logs" ON subscription_audit_log
    FOR SELECT USING (user_id = auth.uid());

-- Policy for users to view their own plan change history
CREATE POLICY "Users can view own plan history" ON plan_change_history
    FOR SELECT USING (user_id = auth.uid());

-- Policy for service role to manage all records
CREATE POLICY "Service role full access audit" ON subscription_audit_log
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access history" ON plan_change_history
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON subscription_audit_log TO authenticated;
GRANT SELECT ON plan_change_history TO authenticated;
GRANT SELECT ON plan_change_analytics TO authenticated;
GRANT ALL ON subscription_audit_log TO service_role;
GRANT ALL ON plan_change_history TO service_role;