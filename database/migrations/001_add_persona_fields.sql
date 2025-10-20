-- Migration: Add Persona Fields to Users Table
-- Issue: #595
-- Date: 2025-10-19
-- Description: Adds encrypted persona fields, embeddings, and metadata to users table

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ADD PERSONA FIELDS TO USERS TABLE
-- ============================================================================

-- Identity field ("Lo que me define")
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_embedding VECTOR(1536);
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_define_updated_at TIMESTAMPTZ;

-- Intolerance field ("Lo que no tolero")
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_embedding VECTOR(1536);
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_no_tolero_updated_at TIMESTAMPTZ;

-- Tolerance field ("Lo que me da igual")
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_visible BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_embedding VECTOR(1536);
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lo_que_me_da_igual_updated_at TIMESTAMPTZ;

-- Embeddings metadata
ALTER TABLE users ADD COLUMN IF NOT EXISTS embeddings_generated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS embeddings_model VARCHAR(100) DEFAULT 'text-embedding-3-small';
ALTER TABLE users ADD COLUMN IF NOT EXISTS embeddings_version INTEGER DEFAULT 1;

-- ============================================================================
-- ADD CONSTRAINTS
-- ============================================================================

-- Length constraints (max 500 chars encrypted = ~300 chars plaintext + IV + tag)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_lo_que_me_define_encrypted_length_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_lo_que_me_define_encrypted_length_check
          CHECK (lo_que_me_define_encrypted IS NULL OR char_length(lo_que_me_define_encrypted) <= 500);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_lo_que_no_tolero_encrypted_length_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_lo_que_no_tolero_encrypted_length_check
          CHECK (lo_que_no_tolero_encrypted IS NULL OR char_length(lo_que_no_tolero_encrypted) <= 500);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_lo_que_me_da_igual_encrypted_length_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_lo_que_me_da_igual_encrypted_length_check
          CHECK (lo_que_me_da_igual_encrypted IS NULL OR char_length(lo_que_me_da_igual_encrypted) <= 500);
    END IF;
END $$;

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Embeddings tracking indexes
CREATE INDEX IF NOT EXISTS idx_users_embeddings_generated
ON users(id, embeddings_generated_at)
WHERE embeddings_generated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_embeddings_model
ON users(embeddings_model, embeddings_version)
WHERE embeddings_generated_at IS NOT NULL;

-- Field existence indexes (for analytics)
CREATE INDEX IF NOT EXISTS idx_users_identity_embedding_exists
ON users(id)
WHERE lo_que_me_define_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_intolerance_embedding_exists
ON users(id)
WHERE lo_que_no_tolero_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_tolerance_embedding_exists
ON users(id)
WHERE lo_que_me_da_igual_embedding IS NOT NULL;

-- Active personas indexes (for queries)
CREATE INDEX IF NOT EXISTS idx_users_lo_que_me_define_active
ON users(id, lo_que_me_define_encrypted)
WHERE lo_que_me_define_encrypted IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_lo_que_no_tolero_active
ON users(id, lo_que_no_tolero_encrypted)
WHERE lo_que_no_tolero_encrypted IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_lo_que_me_da_igual_active
ON users(id, lo_que_me_da_igual_encrypted)
WHERE lo_que_me_da_igual_encrypted IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user has any embeddings
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get embeddings metadata for a user
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if embeddings need regeneration (model/version mismatch)
CREATE OR REPLACE FUNCTION embeddings_need_regeneration(
  user_uuid UUID,
  target_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  target_version INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    user_model VARCHAR(100);
    user_version INTEGER;
BEGIN
    SELECT embeddings_model, embeddings_version
    INTO user_model, user_version
    FROM users
    WHERE id = user_uuid
      AND embeddings_generated_at IS NOT NULL;

    -- Regenerate if model or version mismatch, or if no embeddings exist
    IF user_model IS NULL OR user_version IS NULL THEN
        RETURN TRUE;
    END IF;

    RETURN (user_model != target_model OR user_version != target_version);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify migration completed successfully
DO $$
DECLARE
    column_count INTEGER;
    constraint_count INTEGER;
    index_count INTEGER;
BEGIN
    -- Count persona columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name LIKE '%lo_que%';

    -- Count constraints
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conname LIKE '%lo_que%encrypted_length_check';

    -- Count indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename = 'users'
    AND indexname LIKE '%lo_que%';

    RAISE NOTICE 'Migration verification:';
    RAISE NOTICE '- Persona columns added: %', column_count;
    RAISE NOTICE '- Length constraints added: %', constraint_count;
    RAISE NOTICE '- Indexes created: %', index_count;

    IF column_count < 15 THEN
        RAISE WARNING 'Expected at least 15 persona columns, found %', column_count;
    END IF;

    IF constraint_count < 3 THEN
        RAISE WARNING 'Expected 3 length constraints, found %', constraint_count;
    END IF;

    IF index_count < 8 THEN
        RAISE WARNING 'Expected at least 8 indexes, found %', index_count;
    END IF;
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- ALTER TABLE users DROP COLUMN IF EXISTS lo_que_me_define_encrypted CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS lo_que_me_define_visible CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS lo_que_me_define_embedding CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS lo_que_me_define_created_at CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS lo_que_me_define_updated_at CASCADE;
-- (repeat for lo_que_no_tolero and lo_que_me_da_igual fields)
-- ALTER TABLE users DROP COLUMN IF EXISTS embeddings_generated_at CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS embeddings_model CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS embeddings_version CASCADE;
-- DROP FUNCTION IF EXISTS user_has_embeddings(UUID);
-- DROP FUNCTION IF EXISTS get_user_embeddings_metadata(UUID);
-- DROP FUNCTION IF EXISTS embeddings_need_regeneration(UUID, VARCHAR, INTEGER);
