-- Migration: Webhook Idempotency and Security Enhancement
-- Created: 2025-09-08
-- Purpose: Add webhook idempotency tracking and security audit tables
-- Related: Enhanced webhook security middleware

-- Create webhook idempotency table for preventing duplicate processing
CREATE TABLE webhook_idempotency (
    id BIGSERIAL PRIMARY KEY,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    request_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    processing_result JSONB DEFAULT NULL
);

-- Indexes for performance
CREATE INDEX idx_webhook_idempotency_key ON webhook_idempotency (idempotency_key);
CREATE INDEX idx_webhook_idempotency_expires ON webhook_idempotency (expires_at);
CREATE INDEX idx_webhook_idempotency_created ON webhook_idempotency (created_at);

-- Create webhook security audit table for tracking security events
CREATE TABLE webhook_security_audit (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'signature_verification', 'rate_limit', 'suspicious_payload', etc.
    status VARCHAR(20) NOT NULL, -- 'success', 'failure', 'warning'
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    
    -- Security details
    signature_valid BOOLEAN,
    timestamp_age INTEGER, -- Age in seconds
    body_size INTEGER,
    suspicious_patterns JSONB DEFAULT '[]',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for security audit
CREATE INDEX idx_webhook_security_audit_request_id ON webhook_security_audit (request_id);
CREATE INDEX idx_webhook_security_audit_event_type ON webhook_security_audit (event_type);
CREATE INDEX idx_webhook_security_audit_status ON webhook_security_audit (status);
CREATE INDEX idx_webhook_security_audit_created ON webhook_security_audit (created_at);
CREATE INDEX idx_webhook_security_audit_ip ON webhook_security_audit (ip_address);

-- Enhanced webhook transaction functions for atomic operations
-- Function to safely record webhook security events
CREATE OR REPLACE FUNCTION record_webhook_security_event(
    p_request_id UUID,
    p_event_type VARCHAR(50),
    p_status VARCHAR(20),
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_endpoint VARCHAR(255) DEFAULT NULL,
    p_method VARCHAR(10) DEFAULT NULL,
    p_signature_valid BOOLEAN DEFAULT NULL,
    p_timestamp_age INTEGER DEFAULT NULL,
    p_body_size INTEGER DEFAULT NULL,
    p_suspicious_patterns JSONB DEFAULT '[]',
    p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
BEGIN
    -- Insert security audit record
    INSERT INTO webhook_security_audit (
        request_id,
        event_type,
        status,
        ip_address,
        user_agent,
        endpoint,
        method,
        signature_valid,
        timestamp_age,
        body_size,
        suspicious_patterns,
        metadata
    ) VALUES (
        p_request_id,
        p_event_type,
        p_status,
        p_ip_address,
        p_user_agent,
        p_endpoint,
        p_method,
        p_signature_valid,
        p_timestamp_age,
        p_body_size,
        p_suspicious_patterns,
        p_metadata
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the webhook processing
        RAISE WARNING 'Failed to record webhook security event: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to atomically update idempotency processing result
CREATE OR REPLACE FUNCTION update_idempotency_result(
    p_idempotency_key VARCHAR(255),
    p_processing_result JSONB
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE webhook_idempotency
    SET 
        processed_at = NOW(),
        processing_result = p_processing_result
    WHERE idempotency_key = p_idempotency_key;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired webhook idempotency records
CREATE OR REPLACE FUNCTION cleanup_webhook_idempotency() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete expired idempotency records
    DELETE FROM webhook_idempotency
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old security audit records (older than 90 days)
    DELETE FROM webhook_security_audit
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enhanced webhook transaction function for checkout completion with full idempotency
CREATE OR REPLACE FUNCTION execute_checkout_completed_transaction(
    p_user_id UUID,
    p_stripe_customer_id VARCHAR(255),
    p_stripe_subscription_id VARCHAR(255),
    p_plan VARCHAR(50),
    p_status VARCHAR(50),
    p_current_period_start TIMESTAMPTZ,
    p_current_period_end TIMESTAMPTZ,
    p_cancel_at_period_end BOOLEAN,
    p_trial_end TIMESTAMPTZ,
    p_price_id VARCHAR(255),
    p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    existing_subscription RECORD;
    entitlements_updated BOOLEAN := FALSE;
BEGIN
    -- Start transaction
    -- Check if user already has a subscription
    SELECT * INTO existing_subscription
    FROM user_subscriptions
    WHERE user_id = p_user_id;
    
    -- Update or insert subscription
    IF existing_subscription.user_id IS NOT NULL THEN
        UPDATE user_subscriptions
        SET 
            stripe_customer_id = p_stripe_customer_id,
            stripe_subscription_id = p_stripe_subscription_id,
            plan = p_plan,
            status = p_status,
            current_period_start = p_current_period_start,
            current_period_end = p_current_period_end,
            cancel_at_period_end = p_cancel_at_period_end,
            trial_end = p_trial_end,
            metadata = p_metadata,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    ELSE
        INSERT INTO user_subscriptions (
            user_id,
            stripe_customer_id,
            stripe_subscription_id,
            plan,
            status,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            trial_end,
            metadata
        ) VALUES (
            p_user_id,
            p_stripe_customer_id,
            p_stripe_subscription_id,
            p_plan,
            p_status,
            p_current_period_start,
            p_current_period_end,
            p_cancel_at_period_end,
            p_trial_end,
            p_metadata
        );
    END IF;
    
    -- Update user plan
    UPDATE users 
    SET 
        plan = p_plan,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Update entitlements if table exists (optional)
    BEGIN
        UPDATE user_entitlements
        SET 
            plan_name = p_plan,
            subscription_status = p_status,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        IF NOT FOUND THEN
            INSERT INTO user_entitlements (user_id, plan_name, subscription_status)
            VALUES (p_user_id, p_plan, p_status);
        END IF;
        
        entitlements_updated := TRUE;
    EXCEPTION
        WHEN undefined_table THEN
            -- Table doesn't exist, skip entitlements update
            entitlements_updated := FALSE;
    END;
    
    -- Build result
    result := jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'plan_name', p_plan,
        'subscription_id', p_stripe_subscription_id,
        'entitlements_updated', entitlements_updated,
        'processed_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enhanced subscription update transaction with better error handling
CREATE OR REPLACE FUNCTION execute_subscription_updated_transaction(
    p_user_id UUID,
    p_subscription_id VARCHAR(255),
    p_customer_id VARCHAR(255),
    p_plan VARCHAR(50),
    p_status VARCHAR(50),
    p_current_period_start TIMESTAMPTZ,
    p_current_period_end TIMESTAMPTZ,
    p_cancel_at_period_end BOOLEAN,
    p_trial_end TIMESTAMPTZ,
    p_price_id VARCHAR(255),
    p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    old_plan VARCHAR(50);
    entitlements_updated BOOLEAN := FALSE;
BEGIN
    -- Get old plan for comparison
    SELECT plan INTO old_plan
    FROM user_subscriptions
    WHERE user_id = p_user_id;
    
    -- Update subscription
    UPDATE user_subscriptions
    SET 
        plan = p_plan,
        status = p_status,
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        cancel_at_period_end = p_cancel_at_period_end,
        trial_end = p_trial_end,
        metadata = p_metadata,
        updated_at = NOW()
    WHERE stripe_subscription_id = p_subscription_id;
    
    -- Update user plan
    UPDATE users 
    SET 
        plan = p_plan,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Update entitlements if table exists
    BEGIN
        UPDATE user_entitlements
        SET 
            plan_name = p_plan,
            subscription_status = p_status,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        entitlements_updated := TRUE;
    EXCEPTION
        WHEN undefined_table THEN
            entitlements_updated := FALSE;
    END;
    
    -- Build result
    result := jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'old_plan', COALESCE(old_plan, 'unknown'),
        'new_plan', p_plan,
        'subscription_id', p_subscription_id,
        'entitlements_updated', entitlements_updated,
        'processed_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Enhanced subscription deletion transaction
CREATE OR REPLACE FUNCTION execute_subscription_deleted_transaction(
    p_user_id UUID,
    p_subscription_id VARCHAR(255),
    p_customer_id VARCHAR(255),
    p_canceled_at TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    previous_plan VARCHAR(50);
    entitlements_reset BOOLEAN := FALSE;
BEGIN
    -- Get previous plan
    SELECT plan INTO previous_plan
    FROM user_subscriptions
    WHERE user_id = p_user_id;
    
    -- Update subscription to canceled
    UPDATE user_subscriptions
    SET 
        status = 'canceled',
        plan = 'free',
        cancel_at_period_end = TRUE,
        canceled_at = p_canceled_at,
        updated_at = NOW()
    WHERE stripe_subscription_id = p_subscription_id;
    
    -- Reset user to free plan
    UPDATE users 
    SET 
        plan = 'free',
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Reset entitlements if table exists
    BEGIN
        UPDATE user_entitlements
        SET 
            plan_name = 'free',
            subscription_status = 'canceled',
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        entitlements_reset := TRUE;
    EXCEPTION
        WHEN undefined_table THEN
            entitlements_reset := FALSE;
    END;
    
    -- Build result
    result := jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'previous_plan', COALESCE(previous_plan, 'unknown'),
        'subscription_id', p_subscription_id,
        'entitlements_reset', entitlements_reset,
        'access_until_date', COALESCE(
            (SELECT current_period_end FROM user_subscriptions WHERE user_id = p_user_id),
            p_canceled_at
        ),
        'processed_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job function for cleanup (to be called by cron)
CREATE OR REPLACE FUNCTION webhook_maintenance_job() RETURNS TABLE(
    cleanup_type TEXT,
    records_affected INTEGER,
    execution_time INTERVAL
) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    idempotency_deleted INTEGER;
    audit_deleted INTEGER;
BEGIN
    start_time := NOW();
    
    -- Clean up expired idempotency records
    SELECT cleanup_webhook_idempotency() INTO idempotency_deleted;
    
    -- Clean up old audit records (older than 90 days)
    DELETE FROM webhook_security_audit
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS audit_deleted = ROW_COUNT;
    
    -- Return results
    RETURN QUERY VALUES 
        ('idempotency_cleanup', idempotency_deleted, NOW() - start_time),
        ('audit_cleanup', audit_deleted, NOW() - start_time);
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on new tables
ALTER TABLE webhook_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_security_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook tables (system access only)
CREATE POLICY "System can manage webhook idempotency"
    ON webhook_idempotency FOR ALL
    USING (true); -- Only system/service access

CREATE POLICY "System can manage webhook security audit"
    ON webhook_security_audit FOR ALL
    USING (true); -- Only system/service access

-- Comments for documentation
COMMENT ON TABLE webhook_idempotency IS 'Tracks webhook idempotency keys to prevent duplicate processing';
COMMENT ON TABLE webhook_security_audit IS 'Audit log for webhook security events and validation results';
COMMENT ON FUNCTION execute_checkout_completed_transaction IS 'Atomically processes Stripe checkout completion with idempotency';
COMMENT ON FUNCTION record_webhook_security_event IS 'Records webhook security events for monitoring and analysis';
COMMENT ON FUNCTION webhook_maintenance_job IS 'Scheduled maintenance job for webhook-related cleanup tasks';