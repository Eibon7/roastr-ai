-- Migration: Optimize index for cursor-based pagination in notifications
-- Created: 2025-08-27
-- Purpose: Issue #275 - Ensure optimal index for cursor-based pagination queries

-- Create optimal composite index for cursor-based queries
-- This index supports the pattern: WHERE user_id = ? AND created_at < cursor ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_user_notifications_cursor_pagination ON user_notifications(user_id, created_at DESC);

-- Add comment for documentation
COMMENT ON INDEX idx_user_notifications_cursor_pagination IS 'Optimal index for cursor-based pagination queries on notifications (Issue #275)';

-- Analyze table for better query planning
ANALYZE user_notifications;