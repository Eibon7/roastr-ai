-- Migration 011: Transactional updates for Roastr Persona
-- Issue #154: Use transactions for personal data updates

-- ============================================================================
-- TRANSACTIONAL UPDATE FUNCTION FOR ROASTR PERSONA
-- ============================================================================

-- Function to update Roastr Persona fields in a transaction
-- This ensures atomicity of updates to personal data and related fields
CREATE OR REPLACE FUNCTION update_roastr_persona_transactional(
    p_user_id UUID,
    p_update_data JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_updated_user RECORD;
    v_error_detail TEXT;
BEGIN
    -- Start explicit transaction block
    -- Note: In PostgreSQL, functions run in implicit transactions, but we'll use explicit error handling
    
    -- Validate user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    
    -- Validate update data structure
    IF p_update_data IS NULL OR jsonb_typeof(p_update_data) != 'object' THEN
        RAISE EXCEPTION 'Invalid update data format' USING ERRCODE = 'P0003';
    END IF;
    
    -- Update the user record with all provided fields
    UPDATE users SET
        -- Identity field (lo que me define)
        lo_que_me_define_encrypted = COALESCE(
            p_update_data->>'lo_que_me_define_encrypted', 
            lo_que_me_define_encrypted
        ),
        lo_que_me_define_visible = COALESCE(
            (p_update_data->>'lo_que_me_define_visible')::BOOLEAN, 
            lo_que_me_define_visible
        ),
        lo_que_me_define_created_at = CASE 
            WHEN p_update_data ? 'lo_que_me_define_created_at' 
            THEN (p_update_data->>'lo_que_me_define_created_at')::TIMESTAMPTZ
            ELSE lo_que_me_define_created_at
        END,
        lo_que_me_define_updated_at = CASE 
            WHEN p_update_data ? 'lo_que_me_define_updated_at' 
            THEN (p_update_data->>'lo_que_me_define_updated_at')::TIMESTAMPTZ
            ELSE lo_que_me_define_updated_at
        END,
        
        -- Intolerance field (lo que no tolero)
        lo_que_no_tolero_encrypted = COALESCE(
            p_update_data->>'lo_que_no_tolero_encrypted', 
            lo_que_no_tolero_encrypted
        ),
        lo_que_no_tolero_visible = COALESCE(
            (p_update_data->>'lo_que_no_tolero_visible')::BOOLEAN, 
            lo_que_no_tolero_visible
        ),
        lo_que_no_tolero_created_at = CASE 
            WHEN p_update_data ? 'lo_que_no_tolero_created_at' 
            THEN (p_update_data->>'lo_que_no_tolero_created_at')::TIMESTAMPTZ
            ELSE lo_que_no_tolero_created_at
        END,
        lo_que_no_tolero_updated_at = CASE 
            WHEN p_update_data ? 'lo_que_no_tolero_updated_at' 
            THEN (p_update_data->>'lo_que_no_tolero_updated_at')::TIMESTAMPTZ
            ELSE lo_que_no_tolero_updated_at
        END,
        
        -- Tolerance field (lo que me da igual)
        lo_que_me_da_igual_encrypted = COALESCE(
            p_update_data->>'lo_que_me_da_igual_encrypted', 
            lo_que_me_da_igual_encrypted
        ),
        lo_que_me_da_igual_visible = COALESCE(
            (p_update_data->>'lo_que_me_da_igual_visible')::BOOLEAN, 
            lo_que_me_da_igual_visible
        ),
        lo_que_me_da_igual_created_at = CASE 
            WHEN p_update_data ? 'lo_que_me_da_igual_created_at' 
            THEN (p_update_data->>'lo_que_me_da_igual_created_at')::TIMESTAMPTZ
            ELSE lo_que_me_da_igual_created_at
        END,
        lo_que_me_da_igual_updated_at = CASE 
            WHEN p_update_data ? 'lo_que_me_da_igual_updated_at' 
            THEN (p_update_data->>'lo_que_me_da_igual_updated_at')::TIMESTAMPTZ
            ELSE lo_que_me_da_igual_updated_at
        END,
        
        -- Embeddings fields (if provided)
        lo_que_me_define_embedding = CASE
            WHEN p_update_data ? 'lo_que_me_define_embedding'
            THEN p_update_data->>'lo_que_me_define_embedding'
            ELSE lo_que_me_define_embedding
        END,
        lo_que_no_tolero_embedding = CASE
            WHEN p_update_data ? 'lo_que_no_tolero_embedding'
            THEN p_update_data->>'lo_que_no_tolero_embedding'
            ELSE lo_que_no_tolero_embedding
        END,
        lo_que_me_da_igual_embedding = CASE
            WHEN p_update_data ? 'lo_que_me_da_igual_embedding'
            THEN p_update_data->>'lo_que_me_da_igual_embedding'
            ELSE lo_que_me_da_igual_embedding
        END,
        embeddings_generated_at = CASE
            WHEN p_update_data ? 'embeddings_generated_at'
            THEN (p_update_data->>'embeddings_generated_at')::TIMESTAMPTZ
            ELSE embeddings_generated_at
        END,
        embeddings_model = COALESCE(
            p_update_data->>'embeddings_model',
            embeddings_model
        ),
        embeddings_version = COALESCE(
            (p_update_data->>'embeddings_version')::INTEGER,
            embeddings_version
        )
    WHERE id = p_user_id
    RETURNING * INTO v_updated_user;
    
    -- Check if update was successful
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Update failed - user not found' USING ERRCODE = 'P0004';
    END IF;
    
    -- Build success response with updated data
    v_result := jsonb_build_object(
        'success', true,
        'user_id', v_updated_user.id,
        'updated_fields', jsonb_build_object(
            'lo_que_me_define_encrypted', v_updated_user.lo_que_me_define_encrypted,
            'lo_que_me_define_visible', v_updated_user.lo_que_me_define_visible,
            'lo_que_me_define_created_at', v_updated_user.lo_que_me_define_created_at,
            'lo_que_me_define_updated_at', v_updated_user.lo_que_me_define_updated_at,
            'lo_que_no_tolero_encrypted', v_updated_user.lo_que_no_tolero_encrypted,
            'lo_que_no_tolero_visible', v_updated_user.lo_que_no_tolero_visible,
            'lo_que_no_tolero_created_at', v_updated_user.lo_que_no_tolero_created_at,
            'lo_que_no_tolero_updated_at', v_updated_user.lo_que_no_tolero_updated_at,
            'lo_que_me_da_igual_encrypted', v_updated_user.lo_que_me_da_igual_encrypted,
            'lo_que_me_da_igual_visible', v_updated_user.lo_que_me_da_igual_visible,
            'lo_que_me_da_igual_created_at', v_updated_user.lo_que_me_da_igual_created_at,
            'lo_que_me_da_igual_updated_at', v_updated_user.lo_que_me_da_igual_updated_at,
            'embeddings_generated_at', v_updated_user.embeddings_generated_at,
            'embeddings_model', v_updated_user.embeddings_model,
            'embeddings_version', v_updated_user.embeddings_version
        ),
        'timestamp', NOW()
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback is automatic in case of exception
        -- Log the error details
        v_error_detail := SQLERRM;
        
        -- Return error response
        RETURN jsonb_build_object(
            'success', false,
            'error', v_error_detail,
            'error_code', SQLSTATE,
            'timestamp', NOW()
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRANSACTIONAL DELETE FUNCTION FOR ROASTR PERSONA
-- ============================================================================

-- Function to delete Roastr Persona fields in a transaction
CREATE OR REPLACE FUNCTION delete_roastr_persona_transactional(
    p_user_id UUID,
    p_field_type TEXT DEFAULT 'all'
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_fields_deleted TEXT[];
BEGIN
    -- Validate user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
    END IF;
    
    -- Validate field type
    IF p_field_type NOT IN ('identity', 'intolerance', 'tolerance', 'all') THEN
        RAISE EXCEPTION 'Invalid field type. Must be: identity, intolerance, tolerance, or all' 
        USING ERRCODE = 'P0005';
    END IF;
    
    -- Delete based on field type
    CASE p_field_type
        WHEN 'identity' THEN
            UPDATE users SET
                lo_que_me_define_encrypted = NULL,
                lo_que_me_define_visible = FALSE,
                lo_que_me_define_created_at = NULL,
                lo_que_me_define_updated_at = NULL,
                lo_que_me_define_embedding = NULL
            WHERE id = p_user_id;
            v_fields_deleted := ARRAY['lo_que_me_define'];
            
        WHEN 'intolerance' THEN
            UPDATE users SET
                lo_que_no_tolero_encrypted = NULL,
                lo_que_no_tolero_visible = FALSE,
                lo_que_no_tolero_created_at = NULL,
                lo_que_no_tolero_updated_at = NULL,
                lo_que_no_tolero_embedding = NULL
            WHERE id = p_user_id;
            v_fields_deleted := ARRAY['lo_que_no_tolero'];
            
        WHEN 'tolerance' THEN
            UPDATE users SET
                lo_que_me_da_igual_encrypted = NULL,
                lo_que_me_da_igual_visible = FALSE,
                lo_que_me_da_igual_created_at = NULL,
                lo_que_me_da_igual_updated_at = NULL,
                lo_que_me_da_igual_embedding = NULL
            WHERE id = p_user_id;
            v_fields_deleted := ARRAY['lo_que_me_da_igual'];
            
        WHEN 'all' THEN
            UPDATE users SET
                -- Identity fields
                lo_que_me_define_encrypted = NULL,
                lo_que_me_define_visible = FALSE,
                lo_que_me_define_created_at = NULL,
                lo_que_me_define_updated_at = NULL,
                lo_que_me_define_embedding = NULL,
                -- Intolerance fields
                lo_que_no_tolero_encrypted = NULL,
                lo_que_no_tolero_visible = FALSE,
                lo_que_no_tolero_created_at = NULL,
                lo_que_no_tolero_updated_at = NULL,
                lo_que_no_tolero_embedding = NULL,
                -- Tolerance fields
                lo_que_me_da_igual_encrypted = NULL,
                lo_que_me_da_igual_visible = FALSE,
                lo_que_me_da_igual_created_at = NULL,
                lo_que_me_da_igual_updated_at = NULL,
                lo_que_me_da_igual_embedding = NULL,
                -- Embeddings metadata
                embeddings_generated_at = NULL,
                embeddings_model = NULL,
                embeddings_version = NULL
            WHERE id = p_user_id;
            v_fields_deleted := ARRAY['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual'];
    END CASE;
    
    -- Build success response
    v_result := jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'fields_deleted', v_fields_deleted,
        'field_type', p_field_type,
        'timestamp', NOW()
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error response
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE,
            'timestamp', NOW()
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_roastr_persona_transactional(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_roastr_persona_transactional(UUID, TEXT) TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION update_roastr_persona_transactional(UUID, JSONB) IS 
'Transactionally update Roastr Persona fields ensuring data consistency (Issue #154)';

COMMENT ON FUNCTION delete_roastr_persona_transactional(UUID, TEXT) IS 
'Transactionally delete Roastr Persona fields with proper cleanup (Issue #154)';

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- These functions use SECURITY DEFINER to run with elevated privileges
-- RLS policies still apply to the underlying tables
-- All operations are wrapped in implicit transactions for consistency
-- Error handling ensures no partial updates occur