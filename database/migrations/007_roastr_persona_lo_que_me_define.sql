-- Migration 007: Add Roastr Persona "Lo que me define" field
-- Issue #148: Implementar campo "Lo que me define" en Roastr Persona

-- ============================================================================
-- ADD ROASTR PERSONA FIELDS TO USERS TABLE
-- ============================================================================

-- Add the "lo que me define" field (encrypted)
-- This field stores what defines the user's identity for personalized toxicity detection
ALTER TABLE users ADD COLUMN lo_que_me_define_encrypted TEXT;

-- Add privacy setting for the field (default: private)
ALTER TABLE users ADD COLUMN lo_que_me_define_visible BOOLEAN DEFAULT FALSE;

-- Add created/updated timestamps for the field
ALTER TABLE users ADD COLUMN lo_que_me_define_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN lo_que_me_define_updated_at TIMESTAMPTZ;

-- Add check constraint for encrypted field length (base64 encoded will be longer than original)
-- Original 300 chars + encryption overhead = approximately 400-500 chars max
ALTER TABLE users ADD CONSTRAINT users_lo_que_me_define_encrypted_length_check 
    CHECK (lo_que_me_define_encrypted IS NULL OR char_length(lo_que_me_define_encrypted) <= 500);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for users who have defined this field (for analytics)
CREATE INDEX idx_users_lo_que_me_define_exists ON users(id) 
WHERE lo_que_me_define_encrypted IS NOT NULL;

-- Index for privacy settings
CREATE INDEX idx_users_lo_que_me_define_visibility ON users(lo_que_me_define_visible) 
WHERE lo_que_me_define_encrypted IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- The existing user_isolation policy already covers these new fields
-- Users can only access their own lo_que_me_define data

-- ============================================================================
-- AUDIT TRAIL FOR ROASTR PERSONA CHANGES
-- ============================================================================

-- Function to log changes to lo_que_me_define field
CREATE OR REPLACE FUNCTION log_lo_que_me_define_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the field actually changed
    IF OLD.lo_que_me_define_encrypted IS DISTINCT FROM NEW.lo_que_me_define_encrypted 
       OR OLD.lo_que_me_define_visible IS DISTINCT FROM NEW.lo_que_me_define_visible THEN
        
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
                WHEN OLD.lo_que_me_define_encrypted IS NULL AND NEW.lo_que_me_define_encrypted IS NOT NULL THEN 'roastr_persona_created'
                WHEN OLD.lo_que_me_define_encrypted IS NOT NULL AND NEW.lo_que_me_define_encrypted IS NULL THEN 'roastr_persona_deleted'
                ELSE 'roastr_persona_updated'
            END,
            NEW.id,
            'user',
            'roastr_persona',
            NEW.id,
            jsonb_build_object(
                'field_changed', 'lo_que_me_define',
                'visibility_changed', OLD.lo_que_me_define_visible IS DISTINCT FROM NEW.lo_que_me_define_visible,
                'field_had_content', OLD.lo_que_me_define_encrypted IS NOT NULL,
                'field_has_content', NEW.lo_que_me_define_encrypted IS NOT NULL,
                'updated_at', NEW.lo_que_me_define_updated_at
            ),
            'user_consent_personalization',
            1095  -- 3 years retention for personalization data
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER log_lo_que_me_define_changes_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_lo_que_me_define_changes();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has defined their Roastr Persona
CREATE OR REPLACE FUNCTION user_has_roastr_persona(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_uuid 
        AND lo_que_me_define_encrypted IS NOT NULL 
        AND char_length(lo_que_me_define_encrypted) > 0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get Roastr Persona visibility setting
CREATE OR REPLACE FUNCTION get_roastr_persona_visibility(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    visibility BOOLEAN;
BEGIN
    SELECT lo_que_me_define_visible INTO visibility
    FROM users
    WHERE id = user_uuid;
    
    RETURN COALESCE(visibility, FALSE);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN users.lo_que_me_define_encrypted IS 'Encrypted personal identity definition for enhanced toxicity detection (Issue #148)';
COMMENT ON COLUMN users.lo_que_me_define_visible IS 'Privacy setting for lo_que_me_define field - always FALSE for this sensitive data';
COMMENT ON COLUMN users.lo_que_me_define_created_at IS 'Timestamp when user first defined their Roastr Persona';
COMMENT ON COLUMN users.lo_que_me_define_updated_at IS 'Timestamp when Roastr Persona was last updated';

COMMENT ON FUNCTION user_has_roastr_persona(UUID) IS 'Check if user has defined their Roastr Persona identity field';
COMMENT ON FUNCTION get_roastr_persona_visibility(UUID) IS 'Get privacy setting for user Roastr Persona (always private for this field)';
COMMENT ON FUNCTION log_lo_que_me_define_changes() IS 'Audit trail function for Roastr Persona changes';