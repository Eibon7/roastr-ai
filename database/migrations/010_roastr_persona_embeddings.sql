-- Migration 010: Add embeddings support for Roastr Persona semantic matching
-- Issue #151: Enriquecimiento semántico con embeddings

-- ============================================================================
-- ADD EMBEDDING FIELDS TO USERS TABLE
-- ============================================================================

-- Add embedding field for "lo que me define" (identity definition)
-- Stores vector embeddings for semantic matching of identity-related terms
ALTER TABLE users ADD COLUMN lo_que_me_define_embedding VECTOR(1536);

-- Add embedding field for "lo que no tolero" (intolerance preferences)
-- Stores vector embeddings for semantic auto-blocking detection
ALTER TABLE users ADD COLUMN lo_que_no_tolero_embedding VECTOR(1536);

-- Add embedding field for "lo que me da igual" (tolerance preferences)
-- Stores vector embeddings for semantic false positive reduction
ALTER TABLE users ADD COLUMN lo_que_me_da_igual_embedding VECTOR(1536);

-- Add metadata fields for embedding generation tracking
ALTER TABLE users ADD COLUMN embeddings_generated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN embeddings_model VARCHAR(100) DEFAULT 'text-embedding-3-small';
ALTER TABLE users ADD COLUMN embeddings_version INTEGER DEFAULT 1;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for users who have generated embeddings (for analytics and maintenance)
CREATE INDEX idx_users_embeddings_generated ON users(id, embeddings_generated_at) 
WHERE embeddings_generated_at IS NOT NULL;

-- Index for embedding model tracking (for future model migrations)
CREATE INDEX idx_users_embeddings_model ON users(embeddings_model, embeddings_version)
WHERE embeddings_generated_at IS NOT NULL;

-- Index for efficient lookup of users with specific embedding types
CREATE INDEX idx_users_identity_embedding_exists ON users(id) 
WHERE lo_que_me_define_embedding IS NOT NULL;

CREATE INDEX idx_users_intolerance_embedding_exists ON users(id) 
WHERE lo_que_no_tolero_embedding IS NOT NULL;

CREATE INDEX idx_users_tolerance_embedding_exists ON users(id) 
WHERE lo_que_me_da_igual_embedding IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS FOR EMBEDDINGS
-- ============================================================================

-- Function to check if user has any embeddings generated
CREATE OR REPLACE FUNCTION user_has_embeddings(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE id = user_uuid 
        AND (
            lo_que_me_define_embedding IS NOT NULL OR 
            lo_que_no_tolero_embedding IS NOT NULL OR 
            lo_que_me_da_igual_embedding IS NOT NULL
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's embedding metadata
CREATE OR REPLACE FUNCTION get_user_embeddings_metadata(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'has_identity_embedding', lo_que_me_define_embedding IS NOT NULL,
        'has_intolerance_embedding', lo_que_no_tolero_embedding IS NOT NULL,
        'has_tolerance_embedding', lo_que_me_da_igual_embedding IS NOT NULL,
        'embeddings_generated_at', embeddings_generated_at,
        'embeddings_model', embeddings_model,
        'embeddings_version', embeddings_version,
        'total_embeddings', 
            CASE WHEN lo_que_me_define_embedding IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN lo_que_no_tolero_embedding IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN lo_que_me_da_igual_embedding IS NOT NULL THEN 1 ELSE 0 END
    ) INTO result
    FROM users
    WHERE id = user_uuid;
    
    RETURN COALESCE(result, jsonb_build_object('error', 'user_not_found'));
END;
$$ LANGUAGE plpgsql;

-- Function to check if embeddings need regeneration (model/version mismatch)
CREATE OR REPLACE FUNCTION embeddings_need_regeneration(user_uuid UUID, target_model VARCHAR(100) DEFAULT 'text-embedding-3-small', target_version INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    user_model VARCHAR(100);
    user_version INTEGER;
BEGIN
    SELECT embeddings_model, embeddings_version 
    INTO user_model, user_version
    FROM users
    WHERE id = user_uuid;
    
    -- No embeddings exist, so regeneration needed if user has persona data
    IF user_model IS NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM users 
            WHERE id = user_uuid 
            AND (
                lo_que_me_define_encrypted IS NOT NULL OR 
                lo_que_no_tolero_encrypted IS NOT NULL OR 
                lo_que_me_da_igual_encrypted IS NOT NULL
            )
        );
    END IF;
    
    -- Check if model or version is outdated
    RETURN user_model != target_model OR user_version < target_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SIMILARITY SEARCH FUNCTIONS
-- ============================================================================

-- Function to find users with similar identity embeddings (for research/analytics)
-- Note: This function is for analytics only, not for user-facing features
CREATE OR REPLACE FUNCTION find_similar_identity_embeddings(target_embedding VECTOR(1536), similarity_threshold FLOAT DEFAULT 0.8, max_results INTEGER DEFAULT 10)
RETURNS TABLE(user_id UUID, similarity_score FLOAT, embeddings_model VARCHAR(100)) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        1 - (u.lo_que_me_define_embedding <=> target_embedding) as similarity,
        u.embeddings_model
    FROM users u
    WHERE u.lo_que_me_define_embedding IS NOT NULL
    AND 1 - (u.lo_que_me_define_embedding <=> target_embedding) >= similarity_threshold
    ORDER BY u.lo_que_me_define_embedding <=> target_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT TRAIL FOR EMBEDDINGS
-- ============================================================================

-- Function to log embedding generation/updates
CREATE OR REPLACE FUNCTION log_embeddings_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if embeddings or metadata changed
    IF (
        OLD.lo_que_me_define_embedding IS DISTINCT FROM NEW.lo_que_me_define_embedding OR
        OLD.lo_que_no_tolero_embedding IS DISTINCT FROM NEW.lo_que_no_tolero_embedding OR
        OLD.lo_que_me_da_igual_embedding IS DISTINCT FROM NEW.lo_que_me_da_igual_embedding OR
        OLD.embeddings_generated_at IS DISTINCT FROM NEW.embeddings_generated_at OR
        OLD.embeddings_model IS DISTINCT FROM NEW.embeddings_model OR
        OLD.embeddings_version IS DISTINCT FROM NEW.embeddings_version
    ) THEN
        
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
                WHEN OLD.embeddings_generated_at IS NULL AND NEW.embeddings_generated_at IS NOT NULL THEN 'embeddings_generated'
                WHEN OLD.embeddings_model IS DISTINCT FROM NEW.embeddings_model OR OLD.embeddings_version IS DISTINCT FROM NEW.embeddings_version THEN 'embeddings_updated'
                ELSE 'embeddings_modified'
            END,
            NEW.id,
            'user',
            'roastr_persona_embeddings',
            NEW.id,
            jsonb_build_object(
                'identity_embedding_changed', OLD.lo_que_me_define_embedding IS DISTINCT FROM NEW.lo_que_me_define_embedding,
                'intolerance_embedding_changed', OLD.lo_que_no_tolero_embedding IS DISTINCT FROM NEW.lo_que_no_tolero_embedding,
                'tolerance_embedding_changed', OLD.lo_que_me_da_igual_embedding IS DISTINCT FROM NEW.lo_que_me_da_igual_embedding,
                'model_changed', OLD.embeddings_model IS DISTINCT FROM NEW.embeddings_model,
                'version_changed', OLD.embeddings_version IS DISTINCT FROM NEW.embeddings_version,
                'old_model', OLD.embeddings_model,
                'new_model', NEW.embeddings_model,
                'old_version', OLD.embeddings_version,
                'new_version', NEW.embeddings_version,
                'generated_at', NEW.embeddings_generated_at
            ),
            'user_consent_personalization',
            1095  -- 3 years retention for personalization data
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for embedding audit logging
CREATE TRIGGER log_embeddings_changes_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_embeddings_changes();

-- ============================================================================
-- PERFORMANCE CONFIGURATION
-- ============================================================================

-- Set optimal work_mem for vector operations (adjust based on system resources)
-- This is a session-level setting and should be configured at the database level
-- ALTER SYSTEM SET work_mem = '256MB';  -- Uncomment and adjust as needed

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN users.lo_que_me_define_embedding IS 'Vector embedding for identity terms - enables semantic matching for personal attack detection (Issue #151)';
COMMENT ON COLUMN users.lo_que_no_tolero_embedding IS 'Vector embedding for intolerance terms - enables semantic auto-blocking with improved accuracy (Issue #151)';
COMMENT ON COLUMN users.lo_que_me_da_igual_embedding IS 'Vector embedding for tolerance terms - enables semantic false positive reduction (Issue #151)';
COMMENT ON COLUMN users.embeddings_generated_at IS 'Timestamp when embeddings were last generated';
COMMENT ON COLUMN users.embeddings_model IS 'Model used for embedding generation (e.g., text-embedding-3-small)';
COMMENT ON COLUMN users.embeddings_version IS 'Version of embedding generation logic for future migrations';

COMMENT ON FUNCTION user_has_embeddings(UUID) IS 'Check if user has any embeddings generated for semantic matching';
COMMENT ON FUNCTION get_user_embeddings_metadata(UUID) IS 'Get comprehensive metadata about user embeddings';
COMMENT ON FUNCTION embeddings_need_regeneration(UUID, VARCHAR, INTEGER) IS 'Check if user embeddings need regeneration due to model/version updates';
COMMENT ON FUNCTION find_similar_identity_embeddings(VECTOR, FLOAT, INTEGER) IS 'Find users with similar identity embeddings (analytics only)';
COMMENT ON FUNCTION log_embeddings_changes() IS 'Audit trail function for embeddings changes';

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- IMPORTANT SECURITY CONSIDERATIONS:
-- 1. Embeddings are vector representations and do not expose original text directly
-- 2. However, they should still be considered sensitive data as they can reveal semantic information
-- 3. All embedding operations are logged for audit trails
-- 4. Similarity search functions are designed for analytics, not user-facing features
-- 5. Vector operations can be computationally expensive - monitor performance
-- 6. Embedding generation requires API calls to OpenAI - monitor costs and usage
-- 7. Consider implementing rate limiting for embedding generation endpoints
-- 8. Regular embedding regeneration may be needed for model updates

-- ============================================================================
-- COST OPTIMIZATION NOTES
-- ============================================================================

-- IMPORTANT COST CONSIDERATIONS:
-- 1. Each embedding generation costs tokens via OpenAI API
-- 2. text-embedding-3-small is cost-effective but still has API costs
-- 3. Cache embeddings aggressively to minimize regeneration
-- 4. Consider batch processing for bulk embedding generation
-- 5. Monitor usage patterns and optimize for frequently accessed embeddings
-- 6. Implement smart regeneration logic to avoid unnecessary API calls