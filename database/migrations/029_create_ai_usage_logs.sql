-- Migration: Create AI Usage Logs Table
-- Issue #858: Prompt caching con GPT-5.1
-- Purpose: Track AI usage metrics including cached tokens for cost analysis

-- Create ai_usage_logs table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  input_cached_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hit_ratio NUMERIC(5, 4) GENERATED ALWAYS AS (
    CASE 
      WHEN (input_tokens + input_cached_tokens) > 0 
      THEN input_cached_tokens::NUMERIC / (input_tokens + input_cached_tokens)::NUMERIC
      ELSE 0
    END
  ) STORED,
  plan TEXT,
  endpoint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_id ON ai_usage_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON ai_usage_logs(model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_endpoint ON ai_usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_plan ON ai_usage_logs(plan);

-- Composite index for user + date range queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created ON ai_usage_logs(user_id, created_at DESC);

-- Composite index for org + date range queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_created ON ai_usage_logs(org_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own usage logs
CREATE POLICY "Users can view own ai_usage_logs"
  ON ai_usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can insert (for logging)
CREATE POLICY "Service role can insert ai_usage_logs"
  ON ai_usage_logs
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- RLS Policy: Service role can view all (for analytics)
CREATE POLICY "Service role can view all ai_usage_logs"
  ON ai_usage_logs
  FOR SELECT
  USING (true); -- Service role bypasses RLS

-- Add comment for documentation
COMMENT ON TABLE ai_usage_logs IS 'Tracks AI usage metrics including cached tokens for prompt caching cost analysis (Issue #858)';
COMMENT ON COLUMN ai_usage_logs.input_cached_tokens IS 'Number of input tokens that were served from cache (prompt caching)';
COMMENT ON COLUMN ai_usage_logs.cache_hit_ratio IS 'Computed ratio of cached tokens to total input tokens (0-1)';
COMMENT ON COLUMN ai_usage_logs.endpoint IS 'Endpoint/operation type (e.g., roast, shield, roast_initial)';

