-- Migration 008: Add Roastr Persona "Lo que no tolero" field  
-- Issue #149: Implementar campo "Lo que no tolero" en Roastr Persona

-- ============================================================================
-- ADD "LO QUE NO TOLERO" FIELDS TO USERS TABLE
-- ============================================================================

-- Add the "lo que no tolero" field (encrypted)
-- This field stores words, themes, or attacks the user never wants to see
ALTER TABLE users ADD COLUMN lo_que_no_tolero_encrypted TEXT;

-- Add privacy setting for the field (always private, but consistent with other fields)
ALTER TABLE users ADD COLUMN lo_que_no_tolero_visible BOOLEAN DEFAULT FALSE;

-- Add created/updated timestamps for the field
ALTER TABLE users ADD COLUMN lo_que_no_tolero_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN lo_que_no_tolero_updated_at TIMESTAMPTZ;

-- Add check constraint for encrypted field length (base64 encoded will be longer than original)
-- Original 300 chars + encryption overhead = approximately 400-500 chars max
ALTER TABLE users ADD CONSTRAINT users_lo_que_no_tolero_encrypted_length_check 
    CHECK (lo_que_no_tolero_encrypted IS NULL OR char_length(lo_que_no_tolero_encrypted) <= 500);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for users who have defined this field (for content filtering analytics)
CREATE INDEX idx_users_lo_que_no_tolero_exists ON users(id) 
WHERE lo_que_no_tolero_encrypted IS NOT NULL;

-- Index for performance when checking user blocking preferences
CREATE INDEX idx_users_lo_que_no_tolero_active ON users(id, lo_que_no_tolero_encrypted) 
WHERE lo_que_no_tolero_encrypted IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- The existing user_isolation policy already covers these new fields
-- Users can only access their own lo_que_no_tolero data

-- ============================================================================
-- AUDIT TRAIL FOR ROASTR PERSONA CHANGES
-- ============================================================================

-- Function to log changes to lo_que_no_tolero field
CREATE OR REPLACE FUNCTION log_lo_que_no_tolero_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the field actually changed
    IF OLD.lo_que_no_tolero_encrypted IS DISTINCT FROM NEW.lo_que_no_tolero_encrypted 
       OR OLD.lo_que_no_tolero_visible IS DISTINCT FROM NEW.lo_que_no_tolero_visible THEN
        
        INSERT INTO audit_logs (
            user_id,
            action,
            actor_id,
            actor_type,
            resource_type,
            resource_id,
            details,
            legal_basis,
            retention_period_days
        ) VALUES (
            NEW.id,
            CASE 
                WHEN OLD.lo_que_no_tolero_encrypted IS NULL AND NEW.lo_que_no_tolero_encrypted IS NOT NULL THEN 'roastr_persona_intolerance_created'
                WHEN OLD.lo_que_no_tolero_encrypted IS NOT NULL AND NEW.lo_que_no_tolero_encrypted IS NULL THEN 'roastr_persona_intolerance_deleted'
                ELSE 'roastr_persona_intolerance_updated'
            END,
            NEW.id,
            'user',
            'roastr_persona_intolerance',
            NEW.id,
            jsonb_build_object(
                'field_changed', 'lo_que_no_tolero',
                'visibility_changed', OLD.lo_que_no_tolero_visible IS DISTINCT FROM NEW.lo_que_no_tolero_visible,
                'field_had_content', OLD.lo_que_no_tolero_encrypted IS NOT NULL,
                'field_has_content', NEW.lo_que_no_tolero_encrypted IS NOT NULL,
                'updated_at', NEW.lo_que_no_tolero_updated_at,
                'security_impact', 'high'  -- This field affects automatic blocking
            ),
            'user_consent_safety_preferences',
            1095  -- 3 years retention for safety preferences
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER log_lo_que_no_tolero_changes_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_lo_que_no_tolero_changes();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has defined their intolerance preferences
CREATE OR REPLACE FUNCTION user_has_intolerance_preferences(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_uuid 
        AND lo_que_no_tolero_encrypted IS NOT NULL 
        AND char_length(lo_que_no_tolero_encrypted) > 0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's intolerance preferences (encrypted, for toxicity worker)
CREATE OR REPLACE FUNCTION get_user_intolerance_preferences(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    intolerance_data TEXT;
BEGIN
    SELECT lo_que_no_tolero_encrypted INTO intolerance_data
    FROM users
    WHERE id = user_uuid;
    
    RETURN intolerance_data;
END;
$$ LANGUAGE plpgsql;

-- Function to check if comment should be auto-blocked based on user preferences
-- Note: This returns encrypted data, decryption must be done in application layer
CREATE OR REPLACE FUNCTION should_auto_block_comment(user_uuid UUID, comment_text TEXT)
RETURNS JSONB AS $$
DECLARE
    user_intolerance TEXT;
    result JSONB;
BEGIN
    -- Get user's intolerance preferences
    SELECT lo_que_no_tolero_encrypted INTO user_intolerance
    FROM users
    WHERE id = user_uuid;
    
    -- Return result indicating if user has preferences and the encrypted data
    result := jsonb_build_object(
        'has_preferences', user_intolerance IS NOT NULL,
        'encrypted_preferences', user_intolerance,
        'requires_processing', user_intolerance IS NOT NULL,
        'auto_block_priority', 1  -- Highest priority for user-defined intolerances
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE EXISTING HELPER FUNCTIONS
-- ============================================================================

-- Update the existing roastr persona function to include intolerance check
CREATE OR REPLACE FUNCTION user_has_complete_roastr_persona(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    has_identity BOOLEAN;
    has_intolerance BOOLEAN;
BEGIN
    SELECT 
        lo_que_me_define_encrypted IS NOT NULL AND char_length(lo_que_me_define_encrypted) > 0,
        lo_que_no_tolero_encrypted IS NOT NULL AND char_length(lo_que_no_tolero_encrypted) > 0
    INTO has_identity, has_intolerance
    FROM users
    WHERE id = user_uuid;
    
    RETURN jsonb_build_object(
        'has_identity_definition', COALESCE(has_identity, false),
        'has_intolerance_preferences', COALESCE(has_intolerance, false),
        'has_complete_persona', COALESCE(has_identity, false) AND COALESCE(has_intolerance, false),
        'persona_completion_percentage', 
            CASE 
                WHEN COALESCE(has_identity, false) AND COALESCE(has_intolerance, false) THEN 100
                WHEN COALESCE(has_identity, false) OR COALESCE(has_intolerance, false) THEN 50
                ELSE 0
            END
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN users.lo_que_no_tolero_encrypted IS 'Encrypted list of words/themes/attacks user never wants to see - triggers auto-block (Issue #149)';
COMMENT ON COLUMN users.lo_que_no_tolero_visible IS 'Privacy setting for lo_que_no_tolero field - always FALSE for maximum security';
COMMENT ON COLUMN users.lo_que_no_tolero_created_at IS 'Timestamp when user first defined their intolerance preferences';
COMMENT ON COLUMN users.lo_que_no_tolero_updated_at IS 'Timestamp when intolerance preferences were last updated';

COMMENT ON FUNCTION user_has_intolerance_preferences(UUID) IS 'Check if user has defined what they do not tolerate';
COMMENT ON FUNCTION get_user_intolerance_preferences(UUID) IS 'Get encrypted intolerance preferences for toxicity analysis';
COMMENT ON FUNCTION should_auto_block_comment(UUID, TEXT) IS 'Check if comment should be auto-blocked based on user intolerance (returns encrypted data)';
COMMENT ON FUNCTION user_has_complete_roastr_persona(UUID) IS 'Check completeness of user Roastr Persona (identity + intolerance)';
COMMENT ON FUNCTION log_lo_que_no_tolero_changes() IS 'Audit trail function for intolerance preferences changes';

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- IMPORTANT SECURITY CONSIDERATIONS:
-- 1. lo_que_no_tolero data is ALWAYS encrypted at rest
-- 2. Field is NEVER publicly visible (lo_que_no_tolero_visible always FALSE)
-- 3. Decryption only happens in application layer for toxicity analysis
-- 4. Auto-blocking based on this field has HIGHEST priority (priority 1)
-- 5. All changes are audited with high security impact classification
-- 6. Data is used for immediate content filtering without user roasting logic