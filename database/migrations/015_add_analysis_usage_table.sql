-- Migration: Add Analysis Usage Tracking Table for Issue #326
-- This migration creates the analysis_usage table to track analysis credit consumption
-- separate from roast generation credits

-- ============================================================================
-- CREATE ANALYSIS_USAGE TABLE
-- ============================================================================

-- Create analysis_usage table to track analysis operations (separate from roast generation)
CREATE TABLE IF NOT EXISTS analysis_usage (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    count INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_usage_user_id ON analysis_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_usage_created_at ON analysis_usage(created_at);
-- Supports WHERE user_id = ? AND created_at >= ?
CREATE INDEX IF NOT EXISTS idx_analysis_usage_user_created_at ON analysis_usage(user_id, created_at);

-- Add Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE analysis_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY analysis_usage_user_policy ON analysis_usage 
    FOR ALL USING (user_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER analysis_usage_updated_at
    BEFORE UPDATE ON analysis_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get current month analysis usage for a user
CREATE OR REPLACE FUNCTION get_monthly_analysis_usage(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_usage INTEGER;
    v_start_of_month TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate start of current month in UTC
    v_start_of_month := date_trunc('month', NOW() AT TIME ZONE 'UTC');
    
    SELECT COALESCE(SUM(count), 0) INTO v_usage
    FROM analysis_usage 
    WHERE user_id = p_user_id 
    AND created_at >= v_start_of_month;
    
    RETURN v_usage;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to consume analysis credits atomically
CREATE OR REPLACE FUNCTION consume_analysis_credits(
    p_user_id UUID,
    p_plan VARCHAR(50),
    p_monthly_limit INTEGER,
    p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    v_current_usage INTEGER;
    v_remaining INTEGER;
    v_result JSONB;
BEGIN
    -- Get current usage
    v_current_usage := get_monthly_analysis_usage(p_user_id);
    
    -- Check if unlimited (-1)
    IF p_monthly_limit = -1 THEN
        -- Insert usage record
        INSERT INTO analysis_usage (user_id, count, metadata)
        VALUES (p_user_id, 1, p_metadata);
        
        RETURN jsonb_build_object(
            'success', true,
            'hasCredits', true,
            'remaining', -1,
            'limit', -1,
            'used', v_current_usage + 1,
            'unlimited', true
        );
    END IF;
    
    -- Calculate remaining
    v_remaining := p_monthly_limit - v_current_usage;
    
    -- Check if user has credits
    IF v_remaining <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'hasCredits', false,
            'remaining', 0,
            'limit', p_monthly_limit,
            'used', v_current_usage,
            'unlimited', false,
            'error', 'Monthly analysis limit exceeded'
        );
    END IF;
    
    -- Consume 1 credit
    INSERT INTO analysis_usage (user_id, count, metadata)
    VALUES (p_user_id, 1, p_metadata);
    
    -- Return success result
    RETURN jsonb_build_object(
        'success', true,
        'hasCredits', true,
        'remaining', v_remaining - 1,
        'limit', p_monthly_limit,
        'used', v_current_usage + 1,
        'unlimited', false
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'hasCredits', false,
            'remaining', v_remaining,
            'limit', p_monthly_limit,
            'used', v_current_usage,
            'unlimited', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE analysis_usage IS 'Tracks analysis credit consumption for toxicity analysis operations (Issue #326)';
COMMENT ON COLUMN analysis_usage.user_id IS 'Reference to the user who performed the analysis';
COMMENT ON COLUMN analysis_usage.count IS 'Number of analysis credits consumed (usually 1)';
COMMENT ON COLUMN analysis_usage.metadata IS 'Additional metadata about the analysis operation (endpoint, platform, etc.)';

COMMENT ON FUNCTION get_monthly_analysis_usage(UUID) IS 'Gets current month analysis usage for a user';
COMMENT ON FUNCTION consume_analysis_credits(UUID, VARCHAR, INTEGER, JSONB) IS 'Atomically consumes analysis credits with limit checking';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions for the application
GRANT SELECT, INSERT ON analysis_usage TO authenticated;
GRANT USAGE ON SEQUENCE analysis_usage_id_seq TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_analysis_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_analysis_credits(UUID, VARCHAR, INTEGER, JSONB) TO authenticated;

-- Add migration completion log
INSERT INTO schema_migrations (version, applied_at) VALUES (15, NOW())
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();