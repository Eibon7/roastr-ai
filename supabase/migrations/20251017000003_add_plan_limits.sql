-- Add plan_limits table for plan configuration
-- Required for Shield validation and cost control

CREATE TABLE IF NOT EXISTS plan_limits (
    plan_id VARCHAR(50) PRIMARY KEY,
    max_roasts INTEGER DEFAULT -1,
    monthly_responses_limit INTEGER DEFAULT -1,
    monthly_analysis_limit INTEGER DEFAULT -1,
    max_platforms INTEGER DEFAULT -1,
    integrations_limit INTEGER DEFAULT -1,
    shield_enabled BOOLEAN DEFAULT FALSE,
    custom_prompts BOOLEAN DEFAULT FALSE,
    priority_support BOOLEAN DEFAULT FALSE,
    api_access BOOLEAN DEFAULT FALSE,
    analytics_enabled BOOLEAN DEFAULT FALSE,
    custom_tones BOOLEAN DEFAULT FALSE,
    dedicated_support BOOLEAN DEFAULT FALSE,
    monthly_tokens_limit INTEGER DEFAULT -1,
    daily_api_calls_limit INTEGER DEFAULT -1,
    settings JSONB DEFAULT '{}',
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert plan limits for all plans
INSERT INTO plan_limits (
    plan_id,
    max_roasts,
    monthly_responses_limit,
    monthly_analysis_limit,
    max_platforms,
    integrations_limit,
    shield_enabled,
    custom_prompts,
    priority_support,
    api_access,
    analytics_enabled,
    custom_tones,
    dedicated_support,
    monthly_tokens_limit,
    daily_api_calls_limit
) VALUES
    -- Free Plan
    ('free', 10, 10, 50, 1, 1, false, false, false, false, false, false, false, 10000, 100),

    -- Starter Plan
    ('starter', 10, 10, 100, 1, 1, true, false, false, false, false, false, false, 50000, 500),

    -- Pro Plan (Shield enabled)
    ('pro', 1000, 1000, 5000, 5, 5, true, true, true, true, true, false, false, 500000, 2000),

    -- Creator Plus Plan
    ('creator_plus', 5000, 5000, 25000, 10, 10, true, true, true, true, true, true, true, 2000000, 10000),

    -- Custom/Enterprise Plan
    ('custom', -1, -1, -1, -1, -1, true, true, true, true, true, true, true, -1, -1)
ON CONFLICT (plan_id) DO UPDATE SET
    max_roasts = EXCLUDED.max_roasts,
    monthly_responses_limit = EXCLUDED.monthly_responses_limit,
    monthly_analysis_limit = EXCLUDED.monthly_analysis_limit,
    max_platforms = EXCLUDED.max_platforms,
    integrations_limit = EXCLUDED.integrations_limit,
    shield_enabled = EXCLUDED.shield_enabled,
    custom_prompts = EXCLUDED.custom_prompts,
    priority_support = EXCLUDED.priority_support,
    api_access = EXCLUDED.api_access,
    analytics_enabled = EXCLUDED.analytics_enabled,
    custom_tones = EXCLUDED.custom_tones,
    dedicated_support = EXCLUDED.dedicated_support,
    monthly_tokens_limit = EXCLUDED.monthly_tokens_limit,
    daily_api_calls_limit = EXCLUDED.daily_api_calls_limit,
    updated_at = NOW();

-- Enable RLS
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

-- Allow public read access to plan limits (needed for signup/pricing pages)
CREATE POLICY plan_limits_public_read ON plan_limits
    FOR SELECT
    TO public
    USING (true);

-- Only admins can modify (would be handled by separate admin API)
CREATE POLICY plan_limits_admin_write ON plan_limits
    FOR ALL
    TO authenticated
    USING (false); -- No one can modify through regular API
