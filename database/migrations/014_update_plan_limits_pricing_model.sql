-- Migration: Update Plan Limits for New Pricing Model
-- Issue #194: Update plan limits configuration in database
-- Implements the validated pricing model with new Starter plan

-- ============================================================================
-- UPDATE PLANS TABLE
-- ============================================================================

-- Add new 'starter' plan
INSERT INTO plans (id, name, description, monthly_price_cents, yearly_price_cents, monthly_responses_limit, integrations_limit, shield_enabled, features) VALUES
('starter', 'Starter', 'Entry plan with GPT-5 and Shield', 999, 9990, 10, 2, TRUE, '["gpt5_roasts", "shield_mode", "basic_integrations", "email_support"]')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    yearly_price_cents = EXCLUDED.yearly_price_cents,
    monthly_responses_limit = EXCLUDED.monthly_responses_limit,
    shield_enabled = EXCLUDED.shield_enabled,
    features = EXCLUDED.features;

-- Update existing plans to match new pricing model
UPDATE plans SET
    name = 'Plus',
    description = 'Advanced plan with RQC embedded and personal tone',
    monthly_price_cents = 9900,
    yearly_price_cents = 99000,
    monthly_responses_limit = 5000,
    features = '["gpt5_roasts", "shield_mode", "personal_tone", "rqc_embedded", "all_integrations", "priority_support", "analytics"]'
WHERE id = 'creator_plus';

-- Update Pro plan
UPDATE plans SET
    description = 'Professional plan with GPT-5 and personal tone',
    monthly_price_cents = 2900,
    yearly_price_cents = 29000,
    monthly_responses_limit = 1000,
    features = '["gpt5_roasts", "shield_mode", "personal_tone", "all_integrations", "priority_support", "analytics"]'
WHERE id = 'pro';

-- Update Free plan
UPDATE plans SET
    description = 'Free plan with GPT-3.5 roasts',
    monthly_responses_limit = 10,
    features = '["gpt35_roasts", "basic_integrations", "community_support"]'
WHERE id = 'free';

-- ============================================================================
-- ADD ANALYSIS LIMITS COLUMN TO PLAN_LIMITS
-- ============================================================================

-- Add monthly_analysis_limit column for tracking analysis operations
ALTER TABLE plan_limits 
ADD COLUMN IF NOT EXISTS monthly_analysis_limit INTEGER NOT NULL DEFAULT 1000;

-- ============================================================================
-- UPDATE PLAN_LIMITS TABLE WITH NEW VALUES
-- ============================================================================

-- Update Free plan limits (1000 análisis/mes, 10 roasts GPT-3.5, Shield disabled)
UPDATE plan_limits SET
    max_roasts = 10,
    monthly_responses_limit = 10,
    monthly_analysis_limit = 1000,
    max_platforms = 2,
    integrations_limit = 2,
    shield_enabled = FALSE,
    custom_prompts = FALSE,
    priority_support = FALSE,
    api_access = FALSE,
    analytics_enabled = FALSE,
    custom_tones = FALSE,
    dedicated_support = FALSE,
    monthly_tokens_limit = 50000,
    daily_api_calls_limit = 100,
    settings = jsonb_build_object('ai_model', 'gpt-3.5-turbo', 'analysis_enabled', true)
WHERE plan_id = 'free';

-- Insert/Update Starter plan limits (1000 análisis/mes, 10 roasts GPT-5, Shield enabled)
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
    daily_api_calls_limit,
    settings
) VALUES (
    'starter',
    10,                    -- 10 roasts
    10,                    -- 10 monthly responses
    1000,                  -- 1000 análisis/mes
    2,                     -- 2 platforms max
    2,                     -- 2 integrations
    TRUE,                  -- Shield enabled
    FALSE,                 -- Custom prompts disabled
    FALSE,                 -- Basic support only
    FALSE,                 -- No API access
    FALSE,                 -- No analytics
    FALSE,                 -- No custom tones
    FALSE,                 -- No dedicated support
    100000,                -- Monthly token limit
    500,                   -- Daily API calls
    jsonb_build_object('ai_model', 'gpt-4o', 'analysis_enabled', true, 'shield_enabled', true)
)
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
    settings = EXCLUDED.settings,
    updated_at = NOW();

-- Update Pro plan limits (10,000 análisis/mes, 1000 roasts GPT-5, Shield + Personal tone enabled)
UPDATE plan_limits SET
    max_roasts = 1000,
    monthly_responses_limit = 1000,
    monthly_analysis_limit = 10000,
    max_platforms = 5,
    integrations_limit = 5,
    shield_enabled = TRUE,
    custom_prompts = FALSE,
    priority_support = TRUE,
    api_access = FALSE,
    analytics_enabled = TRUE,
    custom_tones = TRUE,                -- Personal tone enabled
    dedicated_support = FALSE,
    monthly_tokens_limit = 500000,
    daily_api_calls_limit = 5000,
    settings = jsonb_build_object('ai_model', 'gpt-4o', 'analysis_enabled', true, 'shield_enabled', true, 'personal_tone', true)
WHERE plan_id = 'pro';

-- Update Creator Plus to Plus plan limits (100,000 análisis/mes, 5000 roasts GPT-5, All features)
UPDATE plan_limits SET
    max_roasts = 5000,
    monthly_responses_limit = 5000,
    monthly_analysis_limit = 100000,
    max_platforms = 10,
    integrations_limit = 10,
    shield_enabled = TRUE,
    custom_prompts = TRUE,
    priority_support = TRUE,
    api_access = TRUE,
    analytics_enabled = TRUE,
    custom_tones = TRUE,                -- Personal tone enabled
    dedicated_support = TRUE,
    monthly_tokens_limit = 2000000,
    daily_api_calls_limit = 20000,
    settings = jsonb_build_object('ai_model', 'gpt-4o', 'analysis_enabled', true, 'shield_enabled', true, 'personal_tone', true, 'rqc_embedded', true)
WHERE plan_id = 'creator_plus';

-- Update Custom/Enterprise plan limits (configurable, defaults to unlimited)
UPDATE plan_limits SET
    max_roasts = -1,                    -- Unlimited
    monthly_responses_limit = -1,       -- Unlimited
    monthly_analysis_limit = -1,        -- Unlimited
    max_platforms = -1,
    integrations_limit = -1,
    shield_enabled = TRUE,
    custom_prompts = TRUE,
    priority_support = TRUE,
    api_access = TRUE,
    analytics_enabled = TRUE,
    custom_tones = TRUE,
    dedicated_support = TRUE,
    monthly_tokens_limit = -1,
    daily_api_calls_limit = -1,
    settings = jsonb_build_object('ai_model', 'gpt-4o', 'analysis_enabled', true, 'shield_enabled', true, 'personal_tone', true, 'rqc_embedded', true, 'enterprise', true)
WHERE plan_id = 'custom';

-- ============================================================================
-- RENAME CREATOR_PLUS TO PLUS
-- ============================================================================

-- First, update the plan ID in plans table
UPDATE plans SET id = 'plus' WHERE id = 'creator_plus';

-- Update plan_limits table to use 'plus' instead of 'creator_plus'
UPDATE plan_limits SET plan_id = 'plus' WHERE plan_id = 'creator_plus';

-- Update any existing user records (if they reference plan directly)
-- Note: This depends on your user table structure
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'plan') THEN
        UPDATE users SET plan = 'plus' WHERE plan = 'creator_plus';
    END IF;
END $$;

-- Update organizations table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'plan_id') THEN
        UPDATE organizations SET plan_id = 'plus' WHERE plan_id = 'creator_plus';
    END IF;
END $$;

-- ============================================================================
-- UPDATE DATABASE FUNCTIONS
-- ============================================================================

-- Update the get_plan_limits function to handle the new analysis limits
CREATE OR REPLACE FUNCTION get_plan_limits(p_plan_id VARCHAR(50))
RETURNS JSONB AS $$
DECLARE
    v_limits JSONB;
BEGIN
    SELECT jsonb_build_object(
        'plan_id', pl.plan_id,
        'max_roasts', pl.max_roasts,
        'monthly_responses_limit', pl.monthly_responses_limit,
        'monthly_analysis_limit', pl.monthly_analysis_limit,
        'max_platforms', pl.max_platforms,
        'integrations_limit', pl.integrations_limit,
        'shield_enabled', pl.shield_enabled,
        'custom_prompts', pl.custom_prompts,
        'priority_support', pl.priority_support,
        'api_access', pl.api_access,
        'analytics_enabled', pl.analytics_enabled,
        'custom_tones', pl.custom_tones,
        'dedicated_support', pl.dedicated_support,
        'monthly_tokens_limit', pl.monthly_tokens_limit,
        'daily_api_calls_limit', pl.daily_api_calls_limit,
        'settings', pl.settings,
        'created_at', pl.created_at,
        'updated_at', pl.updated_at
    ) INTO v_limits
    FROM plan_limits pl
    WHERE pl.plan_id = p_plan_id;
    
    -- Return free plan limits as default if not found
    IF v_limits IS NULL THEN
        SELECT jsonb_build_object(
            'plan_id', pl.plan_id,
            'max_roasts', pl.max_roasts,
            'monthly_responses_limit', pl.monthly_responses_limit,
            'monthly_analysis_limit', pl.monthly_analysis_limit,
            'max_platforms', pl.max_platforms,
            'integrations_limit', pl.integrations_limit,
            'shield_enabled', pl.shield_enabled,
            'custom_prompts', pl.custom_prompts,
            'priority_support', pl.priority_support,
            'api_access', pl.api_access,
            'analytics_enabled', pl.analytics_enabled,
            'custom_tones', pl.custom_tones,
            'dedicated_support', pl.dedicated_support,
            'monthly_tokens_limit', pl.monthly_tokens_limit,
            'daily_api_calls_limit', pl.daily_api_calls_limit,
            'settings', pl.settings,
            'created_at', pl.created_at,
            'updated_at', pl.updated_at
        ) INTO v_limits
        FROM plan_limits pl
        WHERE pl.plan_id = 'free';
    END IF;
    
    RETURN v_limits;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update the check_plan_limit function to include analysis limits
CREATE OR REPLACE FUNCTION check_plan_limit(
    p_plan_id VARCHAR(50),
    p_limit_type VARCHAR(50),
    p_current_usage INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
BEGIN
    -- Get the specific limit value
    CASE p_limit_type
        WHEN 'roasts' THEN
            SELECT max_roasts INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'platforms' THEN
            SELECT max_platforms INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'monthly_responses' THEN
            SELECT monthly_responses_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'monthly_analysis' THEN
            SELECT monthly_analysis_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'integrations' THEN
            SELECT integrations_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'monthly_tokens' THEN
            SELECT monthly_tokens_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        WHEN 'daily_api_calls' THEN
            SELECT daily_api_calls_limit INTO v_limit FROM plan_limits WHERE plan_id = p_plan_id;
        ELSE
            RETURN FALSE; -- Unknown limit type
    END CASE;
    
    -- -1 means unlimited
    IF v_limit = -1 THEN
        RETURN FALSE; -- Not exceeded
    END IF;
    
    -- Check if current usage exceeds limit
    RETURN p_current_usage >= v_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- UPDATE CONSTRAINTS
-- ============================================================================

-- Update check constraints to include new plans
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'starter', 'pro', 'plus', 'custom'));

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check CHECK (plan_id IN ('free', 'starter', 'pro', 'plus', 'custom'));

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN plan_limits.monthly_analysis_limit IS 'Maximum number of toxicity analysis operations per month (-1 for unlimited)';
COMMENT ON TABLE plans IS 'Available subscription plans with pricing and basic features';

-- Add migration completion log
INSERT INTO plan_limits_audit (
    plan_id,
    action,
    change_reason,
    new_values
) VALUES (
    'system',
    'update',
    'Migration 014: Updated plan limits for new pricing model (Issue #194)',
    jsonb_build_object(
        'migration', '014_update_plan_limits_pricing_model.sql',
        'changes', jsonb_build_array(
            'Added starter plan',
            'Renamed creator_plus to plus',
            'Updated limits according to new pricing model',
            'Added monthly_analysis_limit column',
            'Updated AI models (GPT-3.5 for free, GPT-5/4o for paid plans)'
        )
    )
);