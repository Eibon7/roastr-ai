-- Migration: Add Model Availability Tracking for GPT-5 Auto-Detection
-- Issue #326: Automatic GPT-5 availability detection with daily checks

-- ============================================================================
-- CREATE MODEL_AVAILABILITY TABLE
-- ============================================================================

-- Create table to track OpenAI model availability
CREATE TABLE IF NOT EXISTS model_availability (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(100) NOT NULL UNIQUE,
    is_available BOOLEAN NOT NULL DEFAULT false,
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    api_version VARCHAR(20) DEFAULT 'v1',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_availability_model_id ON model_availability(model_id);
CREATE INDEX IF NOT EXISTS idx_model_availability_last_checked ON model_availability(last_checked_at);
CREATE INDEX IF NOT EXISTS idx_model_availability_available ON model_availability(is_available);

-- Add updated_at trigger
CREATE TRIGGER model_availability_updated_at
    BEFORE UPDATE ON model_availability
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT MODEL RECORDS
-- ============================================================================

-- Insert known models with initial availability status
INSERT INTO model_availability (model_id, is_available, api_version, metadata) VALUES
('gpt-3.5-turbo', true, 'v1', jsonb_build_object('stable', true, 'plan_support', jsonb_build_array('free', 'starter', 'pro', 'plus', 'custom'))),
('gpt-4o', true, 'v1', jsonb_build_object('stable', true, 'plan_support', jsonb_build_array('starter', 'pro', 'plus', 'custom'))),
('gpt-4o-mini', true, 'v1', jsonb_build_object('stable', true, 'plan_support', jsonb_build_array('starter', 'pro', 'plus', 'custom'))),
('gpt-5', false, 'v1', jsonb_build_object('stable', false, 'plan_support', jsonb_build_array('starter', 'pro', 'plus', 'custom'), 'target_model', true))
ON CONFLICT (model_id) DO UPDATE SET
    updated_at = NOW(),
    metadata = EXCLUDED.metadata;

-- ============================================================================
-- CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a model is available
CREATE OR REPLACE FUNCTION is_model_available(p_model_id VARCHAR(100))
RETURNS BOOLEAN AS $$
DECLARE
    v_available BOOLEAN;
BEGIN
    SELECT is_available INTO v_available
    FROM model_availability
    WHERE model_id = p_model_id;
    
    -- Return false if model not found
    RETURN COALESCE(v_available, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get the best available model for a plan
CREATE OR REPLACE FUNCTION get_best_model_for_plan(p_plan_id VARCHAR(50))
RETURNS VARCHAR(100) AS $$
DECLARE
    v_model VARCHAR(100);
    v_preferences VARCHAR(100)[];
BEGIN
    -- Define model preferences per plan
    CASE p_plan_id
        WHEN 'free' THEN
            v_preferences := ARRAY['gpt-3.5-turbo'];
        WHEN 'starter', 'pro', 'plus', 'custom' THEN
            v_preferences := ARRAY['gpt-5', 'gpt-4o', 'gpt-3.5-turbo'];
        ELSE
            v_preferences := ARRAY['gpt-4o', 'gpt-3.5-turbo'];
    END CASE;
    
    -- Find first available model from preferences
    FOR i IN 1 .. array_length(v_preferences, 1) LOOP
        IF is_model_available(v_preferences[i]) THEN
            RETURN v_preferences[i];
        END IF;
    END LOOP;
    
    -- Ultimate fallback
    RETURN 'gpt-3.5-turbo';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update model availability (for service use)
CREATE OR REPLACE FUNCTION update_model_availability(
    p_model_id VARCHAR(100),
    p_is_available BOOLEAN,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO model_availability (model_id, is_available, error_message, last_checked_at)
    VALUES (p_model_id, p_is_available, p_error_message, NOW())
    ON CONFLICT (model_id) DO UPDATE SET
        is_available = EXCLUDED.is_available,
        error_message = EXCLUDED.error_message,
        last_checked_at = EXCLUDED.last_checked_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get model availability status
CREATE OR REPLACE FUNCTION get_model_availability_status()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_object_agg(model_id, jsonb_build_object(
        'available', is_available,
        'lastChecked', last_checked_at,
        'errorMessage', error_message,
        'metadata', metadata
    )) INTO v_result
    FROM model_availability;
    
    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- CREATE SCHEDULED JOB SUPPORT (Optional - for future use)
-- ============================================================================

-- Function to be called by cron job or scheduler
CREATE OR REPLACE FUNCTION check_model_availability_job()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_last_check TIMESTAMP WITH TIME ZONE;
    v_models_checked INTEGER := 0;
BEGIN
    -- Get last check time
    SELECT MAX(last_checked_at) INTO v_last_check FROM model_availability;
    
    -- Log the job run
    INSERT INTO system_logs (event_type, message, metadata, created_at)
    VALUES (
        'model_availability_check', 
        'Scheduled model availability check started',
        jsonb_build_object('last_check', v_last_check),
        NOW()
    );
    
    -- Count models that need checking (older than 24 hours)
    SELECT COUNT(*) INTO v_models_checked
    FROM model_availability
    WHERE last_checked_at < NOW() - INTERVAL '24 hours'
       OR last_checked_at IS NULL;
    
    -- Return status for logging
    RETURN jsonb_build_object(
        'job_started_at', NOW(),
        'last_check', v_last_check,
        'models_to_check', v_models_checked,
        'status', 'scheduled'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE model_availability IS 'Tracks OpenAI model availability for automatic GPT-5 detection (Issue #326)';
COMMENT ON COLUMN model_availability.model_id IS 'OpenAI model identifier (e.g., gpt-5, gpt-4o)';
COMMENT ON COLUMN model_availability.is_available IS 'Whether the model is currently available via OpenAI API';
COMMENT ON COLUMN model_availability.last_checked_at IS 'Timestamp of last availability check';
COMMENT ON COLUMN model_availability.error_message IS 'Error message if availability check failed';
COMMENT ON COLUMN model_availability.metadata IS 'Additional model information (stability, plan support, etc.)';

COMMENT ON FUNCTION is_model_available(VARCHAR) IS 'Check if a specific model is available';
COMMENT ON FUNCTION get_best_model_for_plan(VARCHAR) IS 'Get the best available model for a plan with fallback logic';
COMMENT ON FUNCTION update_model_availability(VARCHAR, BOOLEAN, TEXT) IS 'Update model availability status';
COMMENT ON FUNCTION get_model_availability_status() IS 'Get complete model availability status as JSON';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions for the application
GRANT SELECT, INSERT, UPDATE ON model_availability TO authenticated;
GRANT USAGE ON SEQUENCE model_availability_id_seq TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION is_model_available(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_model_for_plan(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION update_model_availability(VARCHAR, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_model_availability_status() TO authenticated;

-- System functions (for service use)
GRANT EXECUTE ON FUNCTION check_model_availability_job() TO service_role;

-- ============================================================================
-- INITIAL STATUS LOG
-- ============================================================================

-- Log the migration completion
INSERT INTO model_availability (model_id, is_available, metadata, last_checked_at) VALUES
('migration_016', true, jsonb_build_object(
    'migration', '016_add_model_availability_table.sql',
    'purpose', 'GPT-5 auto-detection system for Issue #326',
    'features', jsonb_build_array(
        'Daily model availability checks',
        'Intelligent fallback system',
        'Database caching for performance',
        'Plan-specific model preferences'
    )
), NOW())
ON CONFLICT (model_id) DO UPDATE SET updated_at = NOW();

-- Add to schema migrations
INSERT INTO schema_migrations (version, applied_at) VALUES (16, NOW())
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();