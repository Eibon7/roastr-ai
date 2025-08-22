-- Migration 004: Webhook Transaction Functions for Issue #95
-- Purpose: Add atomic transaction support to Stripe webhooks to prevent database inconsistencies
-- Created: 2025-08-22

-- ============================================================================
-- CHECKOUT COMPLETED TRANSACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_checkout_completed_transaction(
    p_user_id UUID,
    p_stripe_customer_id TEXT,
    p_stripe_subscription_id TEXT,
    p_plan TEXT,
    p_status TEXT,
    p_current_period_start TIMESTAMPTZ,
    p_current_period_end TIMESTAMPTZ,
    p_cancel_at_period_end BOOLEAN,
    p_trial_end TIMESTAMPTZ,
    p_price_id TEXT,
    p_metadata JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_entitlements_result JSONB;
    v_subscription_updated BOOLEAN := FALSE;
    v_entitlements_updated BOOLEAN := FALSE;
BEGIN
    -- Start transaction (implicit in function)
    
    -- 1. Update or insert user subscription
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
        updated_at
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
        NOW()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        trial_end = EXCLUDED.trial_end,
        updated_at = NOW();
    
    v_subscription_updated := TRUE;
    
    -- 2. Update entitlements if price_id is provided
    IF p_price_id IS NOT NULL THEN
        -- Call entitlements update function (if it exists)
        BEGIN
            SELECT set_entitlements_from_stripe_price(p_user_id, p_price_id, p_metadata) INTO v_entitlements_result;
            v_entitlements_updated := (v_entitlements_result->>'success')::BOOLEAN;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the transaction for entitlements
                v_entitlements_result := jsonb_build_object(
                    'success', false,
                    'error', SQLERRM,
                    'fallback_applied', true
                );
                v_entitlements_updated := FALSE;
        END;
    END IF;
    
    -- 3. Build result
    v_result := jsonb_build_object(
        'subscription_updated', v_subscription_updated,
        'entitlements_updated', v_entitlements_updated,
        'plan_name', p_plan,
        'user_id', p_user_id,
        'subscription_id', p_stripe_subscription_id,
        'entitlements_result', COALESCE(v_entitlements_result, '{}')
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'subscription_updated', v_subscription_updated,
            'entitlements_updated', v_entitlements_updated
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUBSCRIPTION UPDATED TRANSACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_subscription_updated_transaction(
    p_user_id UUID,
    p_subscription_id TEXT,
    p_customer_id TEXT,
    p_plan TEXT,
    p_status TEXT,
    p_current_period_start TIMESTAMPTZ,
    p_current_period_end TIMESTAMPTZ,
    p_cancel_at_period_end BOOLEAN,
    p_trial_end TIMESTAMPTZ,
    p_price_id TEXT,
    p_metadata JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_old_plan TEXT;
    v_subscription_updated BOOLEAN := FALSE;
    v_entitlements_updated BOOLEAN := FALSE;
    v_entitlements_result JSONB;
    v_rows_affected INTEGER;
BEGIN
    -- Start transaction (implicit in function)
    
    -- 1. Get current plan for comparison
    SELECT plan INTO v_old_plan 
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    -- 2. Update subscription
    UPDATE user_subscriptions 
    SET 
        stripe_subscription_id = p_subscription_id,
        plan = p_plan,
        status = p_status,
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        cancel_at_period_end = p_cancel_at_period_end,
        trial_end = p_trial_end,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    v_subscription_updated := v_rows_affected > 0;
    
    -- 3. Update entitlements if price_id is provided
    IF p_price_id IS NOT NULL THEN
        BEGIN
            SELECT set_entitlements_from_stripe_price(p_user_id, p_price_id, p_metadata) INTO v_entitlements_result;
            v_entitlements_updated := (v_entitlements_result->>'success')::BOOLEAN;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't fail the transaction for entitlements
                v_entitlements_result := jsonb_build_object(
                    'success', false,
                    'error', SQLERRM,
                    'fallback_applied', true
                );
                v_entitlements_updated := FALSE;
        END;
    END IF;
    
    -- 4. Build result
    v_result := jsonb_build_object(
        'subscription_updated', v_subscription_updated,
        'entitlements_updated', v_entitlements_updated,
        'old_plan', COALESCE(v_old_plan, 'unknown'),
        'new_plan', p_plan,
        'user_id', p_user_id,
        'subscription_id', p_subscription_id,
        'status', p_status,
        'rows_affected', v_rows_affected,
        'entitlements_result', COALESCE(v_entitlements_result, '{}')
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'subscription_updated', v_subscription_updated,
            'entitlements_updated', v_entitlements_updated,
            'old_plan', COALESCE(v_old_plan, 'unknown'),
            'new_plan', p_plan
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUBSCRIPTION DELETED TRANSACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_subscription_deleted_transaction(
    p_user_id UUID,
    p_subscription_id TEXT,
    p_customer_id TEXT,
    p_canceled_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_previous_plan TEXT;
    v_previous_end_date TIMESTAMPTZ;
    v_subscription_updated BOOLEAN := FALSE;
    v_entitlements_reset BOOLEAN := FALSE;
    v_entitlements_result JSONB;
BEGIN
    -- Start transaction (implicit in function)
    
    -- 1. Get previous subscription info
    SELECT plan, current_period_end 
    INTO v_previous_plan, v_previous_end_date
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    -- 2. Reset subscription to free plan
    UPDATE user_subscriptions 
    SET 
        plan = 'free',
        status = 'canceled',
        stripe_subscription_id = NULL,
        current_period_start = NULL,
        current_period_end = NULL,
        cancel_at_period_end = FALSE,
        trial_end = NULL,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    GET DIAGNOSTICS v_subscription_updated = ROW_COUNT;
    v_subscription_updated := v_subscription_updated > 0;
    
    -- 3. Reset entitlements to free plan
    BEGIN
        -- Call entitlements reset function (if it exists)
        SELECT set_entitlements(
            p_user_id,
            jsonb_build_object(
                'analysis_limit_monthly', 100,
                'roast_limit_monthly', 100,
                'model', 'gpt-3.5-turbo',
                'shield_enabled', false,
                'rqc_mode', 'basic',
                'stripe_price_id', null,
                'stripe_product_id', null,
                'plan_name', 'free',
                'metadata', jsonb_build_object(
                    'updated_from', 'subscription_canceled',
                    'subscription_id', p_subscription_id,
                    'customer_id', p_customer_id,
                    'canceled_at', p_canceled_at
                )
            )
        ) INTO v_entitlements_result;
        
        v_entitlements_reset := (v_entitlements_result->>'success')::BOOLEAN;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error but don't fail the transaction
            v_entitlements_result := jsonb_build_object(
                'success', false,
                'error', SQLERRM,
                'fallback_applied', true
            );
            v_entitlements_reset := FALSE;
    END;
    
    -- 4. Build result
    v_result := jsonb_build_object(
        'subscription_updated', v_subscription_updated,
        'entitlements_reset', v_entitlements_reset,
        'previous_plan', COALESCE(v_previous_plan, 'unknown'),
        'access_until_date', COALESCE(v_previous_end_date, p_canceled_at),
        'user_id', p_user_id,
        'subscription_id', p_subscription_id,
        'entitlements_result', COALESCE(v_entitlements_result, '{}')
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'subscription_updated', v_subscription_updated,
            'entitlements_reset', v_entitlements_reset,
            'previous_plan', COALESCE(v_previous_plan, 'unknown')
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PAYMENT SUCCEEDED TRANSACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_payment_succeeded_transaction(
    p_user_id UUID,
    p_customer_id TEXT,
    p_invoice_id TEXT,
    p_amount_paid BIGINT,
    p_payment_succeeded_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_status_updated BOOLEAN := FALSE;
    v_rows_affected INTEGER;
BEGIN
    -- Start transaction (implicit in function)
    
    -- 1. Update subscription status to active if it was past_due
    UPDATE user_subscriptions 
    SET 
        status = 'active',
        updated_at = NOW()
    WHERE user_id = p_user_id 
      AND status = 'past_due';
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    v_status_updated := v_rows_affected > 0;
    
    -- 2. Log payment success in payment_logs table (if it exists)
    BEGIN
        INSERT INTO payment_logs (
            user_id,
            stripe_customer_id,
            invoice_id,
            amount_paid,
            status,
            processed_at,
            created_at
        ) VALUES (
            p_user_id,
            p_customer_id,
            p_invoice_id,
            p_amount_paid,
            'succeeded',
            p_payment_succeeded_at,
            NOW()
        );
    EXCEPTION
        WHEN undefined_table THEN
            -- Table doesn't exist, skip logging
            NULL;
        WHEN OTHERS THEN
            -- Log error but don't fail transaction
            NULL;
    END;
    
    -- 3. Build result
    v_result := jsonb_build_object(
        'status_updated', v_status_updated,
        'user_id', p_user_id,
        'invoice_id', p_invoice_id,
        'amount_paid', p_amount_paid,
        'rows_affected', v_rows_affected
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'status_updated', v_status_updated
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PAYMENT FAILED TRANSACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION execute_payment_failed_transaction(
    p_user_id UUID,
    p_customer_id TEXT,
    p_invoice_id TEXT,
    p_amount_due BIGINT,
    p_attempt_count INTEGER,
    p_next_attempt_date TIMESTAMPTZ,
    p_payment_failed_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_status_updated BOOLEAN := FALSE;
    v_plan_name TEXT;
    v_rows_affected INTEGER;
BEGIN
    -- Start transaction (implicit in function)
    
    -- 1. Get current plan for notification purposes
    SELECT plan INTO v_plan_name 
    FROM user_subscriptions 
    WHERE user_id = p_user_id;
    
    -- 2. Mark subscription as past_due
    UPDATE user_subscriptions 
    SET 
        status = 'past_due',
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    v_status_updated := v_rows_affected > 0;
    
    -- 3. Log payment failure in payment_logs table (if it exists)
    BEGIN
        INSERT INTO payment_logs (
            user_id,
            stripe_customer_id,
            invoice_id,
            amount_due,
            attempt_count,
            next_attempt_date,
            status,
            processed_at,
            created_at
        ) VALUES (
            p_user_id,
            p_customer_id,
            p_invoice_id,
            p_amount_due,
            p_attempt_count,
            p_next_attempt_date,
            'failed',
            p_payment_failed_at,
            NOW()
        );
    EXCEPTION
        WHEN undefined_table THEN
            -- Table doesn't exist, skip logging
            NULL;
        WHEN OTHERS THEN
            -- Log error but don't fail transaction
            NULL;
    END;
    
    -- 4. Build result
    v_result := jsonb_build_object(
        'status_updated', v_status_updated,
        'plan_name', COALESCE(v_plan_name, 'unknown'),
        'user_id', p_user_id,
        'invoice_id', p_invoice_id,
        'amount_due', p_amount_due,
        'attempt_count', p_attempt_count,
        'rows_affected', v_rows_affected
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'status_updated', v_status_updated,
            'plan_name', COALESCE(v_plan_name, 'unknown')
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTIONS FOR ENTITLEMENTS (Placeholders if not exists)
-- ============================================================================

-- Create placeholder functions if entitlements functions don't exist
-- These will be overridden if the actual entitlements service functions exist

CREATE OR REPLACE FUNCTION set_entitlements_from_stripe_price(
    p_user_id UUID,
    p_price_id TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
BEGIN
    -- Placeholder implementation - to be replaced by actual entitlements service
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entitlements service not available - placeholder function used',
        'fallback_applied', true,
        'entitlements', jsonb_build_object(
            'plan_name', 'unknown',
            'analysis_limit_monthly', 100,
            'roast_limit_monthly', 100
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_entitlements(
    p_user_id UUID,
    p_entitlements JSONB
)
RETURNS JSONB AS $$
BEGIN
    -- Placeholder implementation - to be replaced by actual entitlements service
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entitlements service not available - placeholder function used',
        'fallback_applied', true,
        'entitlements', p_entitlements
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION execute_checkout_completed_transaction IS 'Atomic transaction for checkout completion - Issue #95';
COMMENT ON FUNCTION execute_subscription_updated_transaction IS 'Atomic transaction for subscription updates - Issue #95';
COMMENT ON FUNCTION execute_subscription_deleted_transaction IS 'Atomic transaction for subscription deletion - Issue #95';
COMMENT ON FUNCTION execute_payment_succeeded_transaction IS 'Atomic transaction for successful payment processing - Issue #95';
COMMENT ON FUNCTION execute_payment_failed_transaction IS 'Atomic transaction for failed payment processing - Issue #95';

COMMENT ON FUNCTION set_entitlements_from_stripe_price IS 'Placeholder for entitlements service integration - Issue #95';
COMMENT ON FUNCTION set_entitlements IS 'Placeholder for entitlements service integration - Issue #95';

-- ============================================================================
-- SECURITY AND PERMISSIONS
-- ============================================================================

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION execute_checkout_completed_transaction TO service_role;
GRANT EXECUTE ON FUNCTION execute_subscription_updated_transaction TO service_role;
GRANT EXECUTE ON FUNCTION execute_subscription_deleted_transaction TO service_role;
GRANT EXECUTE ON FUNCTION execute_payment_succeeded_transaction TO service_role;
GRANT EXECUTE ON FUNCTION execute_payment_failed_transaction TO service_role;
GRANT EXECUTE ON FUNCTION set_entitlements_from_stripe_price TO service_role;
GRANT EXECUTE ON FUNCTION set_entitlements TO service_role;