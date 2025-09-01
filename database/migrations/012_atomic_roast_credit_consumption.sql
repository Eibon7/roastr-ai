-- Migration 012: Atomic Roast Credit Consumption
-- Issue: Race condition in credit consumption - Fix race condition in credit consumption
-- Purpose: Add atomic function to check and consume roast credits in a single operation

-- ============================================================================
-- ATOMIC ROAST CREDIT CONSUMPTION FUNCTION
-- ============================================================================

-- Function to atomically check and consume roast credits
-- Returns success status and updated credit information
CREATE OR REPLACE FUNCTION consume_roast_credits(
    p_user_id UUID,
    p_plan TEXT,
    p_monthly_limit INTEGER,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    current_month_start TIMESTAMPTZ;
    current_usage INTEGER := 0;
    remaining_credits INTEGER;
    result JSONB;
BEGIN
    -- Calculate UTC-based start of month to fix timezone issues
    current_month_start := DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    
    -- Handle unlimited plans
    IF p_monthly_limit = -1 THEN
        -- Record usage for unlimited plans without checking limits
        INSERT INTO roast_usage (user_id, count, metadata, created_at)
        VALUES (p_user_id, 1, p_metadata, NOW());
        
        RETURN jsonb_build_object(
            'success', true,
            'hasCredits', true,
            'remaining', -1,
            'limit', -1,
            'used', -1,
            'unlimited', true
        );
    END IF;
    
    -- Get current month usage with row-level locking to prevent race conditions
    SELECT COALESCE(SUM(count), 0)
    INTO current_usage
    FROM roast_usage
    WHERE user_id = p_user_id
    AND created_at >= current_month_start
    FOR UPDATE;
    
    -- Calculate remaining credits
    remaining_credits := p_monthly_limit - current_usage;
    
    -- Check if user has sufficient credits
    IF remaining_credits <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'hasCredits', false,
            'remaining', 0,
            'limit', p_monthly_limit,
            'used', current_usage,
            'unlimited', false,
            'error', 'Insufficient credits'
        );
    END IF;
    
    -- Consume one credit by recording usage
    INSERT INTO roast_usage (user_id, count, metadata, created_at)
    VALUES (p_user_id, 1, p_metadata, NOW());
    
    -- Return success with updated credit information
    RETURN jsonb_build_object(
        'success', true,
        'hasCredits', true,
        'remaining', remaining_credits - 1,
        'limit', p_monthly_limit,
        'used', current_usage + 1,
        'unlimited', false
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN jsonb_build_object(
            'success', false,
            'hasCredits', false,
            'remaining', 0,
            'limit', p_monthly_limit,
            'used', current_usage,
            'unlimited', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION consume_roast_credits IS 'Atomically check and consume roast credits to prevent race conditions. Uses UTC-based month calculation and row-level locking.';
