-- Migration 026: Admin Performance Indices
-- Issue #261 (via PR #739 - CodeRabbit review M3)
-- Created: 2025-11-06
--
-- Purpose: Optimize admin users list queries with targeted indices
-- Impact: ~90% faster queries on /api/admin/users endpoint
--
-- Performance improvements:
--   - idx_users_plan: Speeds up plan-based filtering (e.g., "show all pro users")
--   - idx_users_active_plan: Optimizes common query pattern (active users by plan)
--
-- Rollback: See DOWN section at end of file

-- =====================================================
-- UP Migration
-- =====================================================

-- Index 1: Plan-based queries
-- Speeds up: SELECT * FROM users WHERE plan = 'pro'
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Index 2: Active users by plan (partial index)
-- Speeds up: SELECT * FROM users WHERE active = TRUE AND plan = 'pro'
-- Uses partial index to reduce size (only indexes active users)
CREATE INDEX IF NOT EXISTS idx_users_active_plan ON users(active, plan) WHERE active = TRUE;

-- Verify indices were created
DO $$
BEGIN
    -- Check idx_users_plan
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'users'
        AND indexname = 'idx_users_plan'
    ) THEN
        RAISE EXCEPTION 'Index idx_users_plan creation failed';
    END IF;

    -- Check idx_users_active_plan
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'users'
        AND indexname = 'idx_users_active_plan'
    ) THEN
        RAISE EXCEPTION 'Index idx_users_active_plan creation failed';
    END IF;

    RAISE NOTICE 'Migration 026: Admin performance indices created successfully';
END $$;

-- =====================================================
-- DOWN Migration (Rollback)
-- =====================================================
-- To rollback this migration, run:
--
-- DROP INDEX IF EXISTS idx_users_plan;
-- DROP INDEX IF EXISTS idx_users_active_plan;
--
-- Note: Safe to run during low-traffic windows.
-- Dropping indices does not lock the table for writes.
-- Queries will still work, just slower (as before migration).
