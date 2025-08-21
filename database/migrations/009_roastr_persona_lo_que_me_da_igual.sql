-- Migration 009: Add Roastr Persona "Lo que me da igual" field
-- Issue #150: Implementar campo "Lo que me da igual" en Roastr Persona

-- ============================================================================
-- ADD "LO QUE ME DA IGUAL" FIELDS TO USERS TABLE
-- ============================================================================

-- Add the "lo que me da igual" field (encrypted)
-- This field stores words, themes, or comments the user considers harmless for them personally
-- Reduces false positives by allowing content that others might find offensive but this user doesn't
ALTER TABLE users ADD COLUMN lo_que_me_da_igual_encrypted TEXT;

-- Add privacy setting for the field (always private, but consistent with other fields)
ALTER TABLE users ADD COLUMN lo_que_me_da_igual_visible BOOLEAN DEFAULT FALSE;

-- Add created/updated timestamps for the field
ALTER TABLE users ADD COLUMN lo_que_me_da_igual_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN lo_que_me_da_igual_updated_at TIMESTAMPTZ;

-- Add check constraint for encrypted field length (base64 encoded will be longer than original)
-- Original 300 chars + encryption overhead = approximately 400-500 chars max
ALTER TABLE users ADD CONSTRAINT users_lo_que_me_da_igual_encrypted_length_check 
    CHECK (lo_que_me_da_igual_encrypted IS NULL OR char_length(lo_que_me_da_igual_encrypted) <= 500);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for users who have defined this field (for content filtering analytics)
CREATE INDEX idx_users_lo_que_me_da_igual_exists ON users(id) 
WHERE lo_que_me_da_igual_encrypted IS NOT NULL;

-- Index for performance when checking user tolerance preferences
CREATE INDEX idx_users_lo_que_me_da_igual_active ON users(id, lo_que_me_da_igual_encrypted) 
WHERE lo_que_me_da_igual_encrypted IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- The existing user_isolation policy already covers these new fields
-- Users can only access their own lo_que_me_da_igual data

-- ============================================================================
-- AUDIT TRAIL FOR ROASTR PERSONA CHANGES
-- ============================================================================

-- Function to log changes to lo_que_me_da_igual field
CREATE OR REPLACE FUNCTION log_lo_que_me_da_igual_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the field actually changed
    IF OLD.lo_que_me_da_igual_encrypted IS DISTINCT FROM NEW.lo_que_me_da_igual_encrypted 
       OR OLD.lo_que_me_da_igual_visible IS DISTINCT FROM NEW.lo_que_me_da_igual_visible THEN
        
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
                WHEN OLD.lo_que_me_da_igual_encrypted IS NULL AND NEW.lo_que_me_da_igual_encrypted IS NOT NULL THEN 'roastr_persona_tolerance_created'
                WHEN OLD.lo_que_me_da_igual_encrypted IS NOT NULL AND NEW.lo_que_me_da_igual_encrypted IS NULL THEN 'roastr_persona_tolerance_deleted'
                ELSE 'roastr_persona_tolerance_updated'
            END,
            NEW.id,
            'user',
            'roastr_persona_tolerance',
            NEW.id,
            jsonb_build_object(
                'field_changed', 'lo_que_me_da_igual',
                'visibility_changed', OLD.lo_que_me_da_igual_visible IS DISTINCT FROM NEW.lo_que_me_da_igual_visible,
                'field_had_content', OLD.lo_que_me_da_igual_encrypted IS NOT NULL,
                'field_has_content', NEW.lo_que_me_da_igual_encrypted IS NOT NULL,
                'updated_at', NEW.lo_que_me_da_igual_updated_at,
                'security_impact', 'medium'  -- This field affects content filtering but allows more content through
            ),
            'user_consent_personalization',
            1095  -- 3 years retention for personalization data
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER log_lo_que_me_da_igual_changes_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_lo_que_me_da_igual_changes();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has defined their tolerance preferences
CREATE OR REPLACE FUNCTION user_has_tolerance_preferences(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_uuid 
        AND lo_que_me_da_igual_encrypted IS NOT NULL 
        AND char_length(lo_que_me_da_igual_encrypted) > 0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's tolerance preferences (encrypted, for toxicity worker)
CREATE OR REPLACE FUNCTION get_user_tolerance_preferences(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    tolerance_data TEXT;
BEGIN
    SELECT lo_que_me_da_igual_encrypted INTO tolerance_data
    FROM users
    WHERE id = user_uuid;
    
    RETURN tolerance_data;
END;
$$ LANGUAGE plpgsql;

-- Function to check if comment should be ignored based on user tolerance preferences
-- Note: This returns encrypted data, decryption must be done in application layer
-- IMPORTANT: This function should be checked AFTER intolerance check (lo_que_no_tolero has priority)
CREATE OR REPLACE FUNCTION should_ignore_comment(user_uuid UUID, comment_text TEXT)
RETURNS JSONB AS $$
DECLARE
    user_tolerance TEXT;
    user_intolerance TEXT;
    result JSONB;
BEGIN
    -- Get both tolerance and intolerance preferences
    SELECT lo_que_me_da_igual_encrypted, lo_que_no_tolero_encrypted 
    INTO user_tolerance, user_intolerance
    FROM users
    WHERE id = user_uuid;
    
    -- Return result indicating processing requirements and priority rules
    result := jsonb_build_object(
        'has_tolerance_preferences', user_tolerance IS NOT NULL,
        'has_intolerance_preferences', user_intolerance IS NOT NULL,
        'encrypted_tolerance_preferences', user_tolerance,
        'encrypted_intolerance_preferences', user_intolerance,
        'requires_processing', user_tolerance IS NOT NULL OR user_intolerance IS NOT NULL,
        'priority_rule', 'intolerance_overrides_tolerance',  -- Critical: lo_que_no_tolero always wins
        'ignore_priority', 2  -- Lower priority than auto-block (priority 1)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE EXISTING HELPER FUNCTIONS
-- ============================================================================

-- Update the complete roastr persona function to include tolerance preferences
CREATE OR REPLACE FUNCTION user_has_complete_roastr_persona(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    has_identity BOOLEAN;
    has_intolerance BOOLEAN;
    has_tolerance BOOLEAN;
    total_fields INTEGER := 3;
    completed_fields INTEGER := 0;
BEGIN
    SELECT 
        lo_que_me_define_encrypted IS NOT NULL AND char_length(lo_que_me_define_encrypted) > 0,
        lo_que_no_tolero_encrypted IS NOT NULL AND char_length(lo_que_no_tolero_encrypted) > 0,
        lo_que_me_da_igual_encrypted IS NOT NULL AND char_length(lo_que_me_da_igual_encrypted) > 0
    INTO has_identity, has_intolerance, has_tolerance
    FROM users
    WHERE id = user_uuid;
    
    -- Count completed fields
    IF COALESCE(has_identity, false) THEN completed_fields := completed_fields + 1; END IF;
    IF COALESCE(has_intolerance, false) THEN completed_fields := completed_fields + 1; END IF;
    IF COALESCE(has_tolerance, false) THEN completed_fields := completed_fields + 1; END IF;
    
    RETURN jsonb_build_object(
        'has_identity_definition', COALESCE(has_identity, false),
        'has_intolerance_preferences', COALESCE(has_intolerance, false),
        'has_tolerance_preferences', COALESCE(has_tolerance, false),
        'has_complete_persona', completed_fields = total_fields,
        'has_minimum_persona', completed_fields >= 1,  -- At least one field defined
        'completed_fields', completed_fields,
        'total_fields', total_fields,
        'persona_completion_percentage', ROUND((completed_fields::DECIMAL / total_fields::DECIMAL) * 100)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN users.lo_que_me_da_igual_encrypted IS 'Encrypted list of words/themes user considers harmless to them - prevents false positive blocking (Issue #150)';
COMMENT ON COLUMN users.lo_que_me_da_igual_visible IS 'Privacy setting for lo_que_me_da_igual field - always FALSE for privacy protection';
COMMENT ON COLUMN users.lo_que_me_da_igual_created_at IS 'Timestamp when user first defined their tolerance preferences';
COMMENT ON COLUMN users.lo_que_me_da_igual_updated_at IS 'Timestamp when tolerance preferences were last updated';

COMMENT ON FUNCTION user_has_tolerance_preferences(UUID) IS 'Check if user has defined what they consider harmless to them';
COMMENT ON FUNCTION get_user_tolerance_preferences(UUID) IS 'Get encrypted tolerance preferences for toxicity analysis';
COMMENT ON FUNCTION should_ignore_comment(UUID, TEXT) IS 'Check if comment should be ignored based on user tolerance (returns encrypted data, intolerance overrides tolerance)';
COMMENT ON FUNCTION user_has_complete_roastr_persona(UUID) IS 'Check completeness of user Roastr Persona (identity + intolerance + tolerance)';
COMMENT ON FUNCTION log_lo_que_me_da_igual_changes() IS 'Audit trail function for tolerance preferences changes';

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- IMPORTANT SECURITY CONSIDERATIONS:
-- 1. lo_que_me_da_igual data is ALWAYS encrypted at rest
-- 2. Field is NEVER publicly visible (lo_que_me_da_igual_visible always FALSE)
-- 3. Decryption only happens in application layer for toxicity analysis
-- 4. This field has LOWER priority than lo_que_no_tolero (priority 2 vs priority 1)
-- 5. All changes are audited with medium security impact classification
-- 6. Data is used to REDUCE blocking, not increase it (false positive reduction)
-- 7. CRITICAL RULE: lo_que_no_tolero ALWAYS overrides lo_que_me_da_igual for security
-- 8. This field allows MORE content through, making moderation less restrictive for the user