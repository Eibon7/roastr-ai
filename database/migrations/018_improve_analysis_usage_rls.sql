-- Migration: Improve Analysis Usage RLS Policies
-- This migration enhances the Row Level Security (RLS) policies for analysis_usage table
-- as suggested in CodeRabbit review for better security and granular access control

-- ============================================================================
-- DROP EXISTING BROAD RLS POLICY
-- ============================================================================

-- Remove the existing broad policy that covers all operations
DROP POLICY IF EXISTS analysis_usage_user_policy ON analysis_usage;

-- ============================================================================
-- CREATE GRANULAR RLS POLICIES
-- ============================================================================

-- Policy for SELECT operations - users can only read their own data
CREATE POLICY analysis_usage_select_policy ON analysis_usage
    FOR SELECT 
    USING (user_id = auth.uid());

-- Policy for INSERT operations - users can only insert their own data
CREATE POLICY analysis_usage_insert_policy ON analysis_usage
    FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- Policy for UPDATE operations - users can only update their own data
-- (though updates are rare for usage tracking, this prevents accidental manipulation)
CREATE POLICY analysis_usage_update_policy ON analysis_usage
    FOR UPDATE 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy for DELETE operations - users can only delete their own data
-- (though deletes should be rare for audit purposes)
CREATE POLICY analysis_usage_delete_policy ON analysis_usage
    FOR DELETE 
    USING (user_id = auth.uid());

-- ============================================================================
-- IMPROVE CREDIT CONSUMPTION FUNCTION WITH ADVISORY LOCKS
-- ============================================================================

-- Enhanced function to consume analysis credits with advisory locks to prevent race conditions
CREATE OR REPLACE FUNCTION consume_analysis_credits_safe(
    p_user_id UUID,
    p_plan VARCHAR(50),
    p_monthly_limit INTEGER,
    p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    v_current_usage INTEGER;
    v_remaining INTEGER;
    v_result JSONB;
    v_lock_id BIGINT;
BEGIN
    -- Create a unique lock ID based on user_id for this operation
    -- Convert UUID to bigint for advisory lock (use hash to ensure uniqueness)
    v_lock_id := ('x' || substr(md5(p_user_id::text), 1, 15))::bit(60)::bigint;
    
    -- Acquire advisory lock for this user to prevent concurrent credit consumption
    IF NOT pg_try_advisory_lock(v_lock_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'hasCredits', false,
            'remaining', 0,
            'limit', p_monthly_limit,
            'used', 0,
            'unlimited', false,
            'error', 'Credit consumption in progress, please try again'
        );
    END IF;
    
    BEGIN
        -- Get current usage within the lock
        v_current_usage := get_monthly_analysis_usage(p_user_id);
        
        -- Check if unlimited (-1)
        IF p_monthly_limit = -1 THEN
            -- Insert usage record
            INSERT INTO analysis_usage (user_id, count, metadata)
            VALUES (p_user_id, 1, p_metadata);
            
            v_result := jsonb_build_object(
                'success', true,
                'hasCredits', true,
                'remaining', -1,
                'limit', -1,
                'used', v_current_usage + 1,
                'unlimited', true
            );
        ELSE
            -- Calculate remaining
            v_remaining := p_monthly_limit - v_current_usage;
            
            -- Check if user has credits
            IF v_remaining <= 0 THEN
                v_result := jsonb_build_object(
                    'success', false,
                    'hasCredits', false,
                    'remaining', 0,
                    'limit', p_monthly_limit,
                    'used', v_current_usage,
                    'unlimited', false,
                    'error', 'Monthly analysis limit exceeded'
                );
            ELSE
                -- Consume 1 credit
                INSERT INTO analysis_usage (user_id, count, metadata)
                VALUES (p_user_id, 1, p_metadata);
                
                v_result := jsonb_build_object(
                    'success', true,
                    'hasCredits', true,
                    'remaining', v_remaining - 1,
                    'limit', p_monthly_limit,
                    'used', v_current_usage + 1,
                    'unlimited', false
                );
            END IF;
        END IF;
        
        -- Release the advisory lock
        PERFORM pg_advisory_unlock(v_lock_id);
        
        RETURN v_result;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Ensure lock is released even on error
            PERFORM pg_advisory_unlock(v_lock_id);
            RETURN jsonb_build_object(
                'success', false,
                'hasCredits', false,
                'remaining', COALESCE(v_remaining, 0),
                'limit', p_monthly_limit,
                'used', COALESCE(v_current_usage, 0),
                'unlimited', false,
                'error', SQLERRM
            );
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE PERMISSIONS FOR NEW FUNCTION
-- ============================================================================

-- Grant execute permission on the new safe function
GRANT EXECUTE ON FUNCTION consume_analysis_credits_safe(UUID, VARCHAR, INTEGER, JSONB) TO authenticated;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY analysis_usage_select_policy ON analysis_usage IS 'Users can only read their own analysis usage data';
COMMENT ON POLICY analysis_usage_insert_policy ON analysis_usage IS 'Users can only insert their own analysis usage records';
COMMENT ON POLICY analysis_usage_update_policy ON analysis_usage IS 'Users can only update their own analysis usage records';
COMMENT ON POLICY analysis_usage_delete_policy ON analysis_usage IS 'Users can only delete their own analysis usage records';

COMMENT ON FUNCTION consume_analysis_credits_safe(UUID, VARCHAR, INTEGER, JSONB) IS 'Safely consumes analysis credits with advisory locks to prevent race conditions (CodeRabbit suggested improvement)';

-- ============================================================================
-- MIGRATION COMPLETION
-- ============================================================================

-- Add migration completion log
INSERT INTO schema_migrations (version, applied_at) VALUES (18, NOW())
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();