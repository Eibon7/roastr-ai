-- Roastr.ai Multi-Tenant Database Schema
-- Compatible with Supabase PostgreSQL + Row Level Security (RLS)

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector; -- For persona embeddings (Issue #595)

-- ============================================================================
-- USERS & TENANTS
-- ============================================================================

-- Users table (integrates with Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    plan VARCHAR(50) NOT NULL DEFAULT 'basic',
    is_admin BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    suspended BOOLEAN DEFAULT FALSE,
    suspended_reason TEXT,
    suspended_at TIMESTAMPTZ,
    suspended_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    stripe_customer_id VARCHAR(255),
    
    -- Profile settings
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Usage tracking
    total_messages_sent INTEGER DEFAULT 0,
    total_tokens_consumed INTEGER DEFAULT 0,
    monthly_messages_sent INTEGER DEFAULT 0,
    monthly_tokens_consumed INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),

    -- Persona fields (Issue #595)
    -- Identity ("Lo que me define")
    lo_que_me_define_encrypted TEXT,
    lo_que_me_define_visible BOOLEAN DEFAULT FALSE,
    lo_que_me_define_embedding VECTOR(1536),
    lo_que_me_define_created_at TIMESTAMPTZ,
    lo_que_me_define_updated_at TIMESTAMPTZ,

    -- Intolerance ("Lo que no tolero")
    lo_que_no_tolero_encrypted TEXT,
    lo_que_no_tolero_visible BOOLEAN DEFAULT FALSE,
    lo_que_no_tolero_embedding VECTOR(1536),
    lo_que_no_tolero_created_at TIMESTAMPTZ,
    lo_que_no_tolero_updated_at TIMESTAMPTZ,

    -- Tolerance ("Lo que me da igual")
    lo_que_me_da_igual_encrypted TEXT,
    lo_que_me_da_igual_visible BOOLEAN DEFAULT FALSE,
    lo_que_me_da_igual_embedding VECTOR(1536),
    lo_que_me_da_igual_created_at TIMESTAMPTZ,
    lo_que_me_da_igual_updated_at TIMESTAMPTZ,

    -- Embeddings metadata
    embeddings_generated_at TIMESTAMPTZ,
    embeddings_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    embeddings_version INTEGER DEFAULT 1,

    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_plan_check CHECK (plan IN ('basic', 'pro', 'creator_plus')),
    CONSTRAINT users_lo_que_me_define_encrypted_length_check CHECK (lo_que_me_define_encrypted IS NULL OR char_length(lo_que_me_define_encrypted) <= 500),
    CONSTRAINT users_lo_que_no_tolero_encrypted_length_check CHECK (lo_que_no_tolero_encrypted IS NULL OR char_length(lo_que_no_tolero_encrypted) <= 500),
    CONSTRAINT users_lo_que_me_da_igual_encrypted_length_check CHECK (lo_que_me_da_igual_encrypted IS NULL OR char_length(lo_que_me_da_igual_encrypted) <= 500)
);

-- Indexes for users table (Issue #261: Performance optimization for admin panel)
-- Admin performance indices (Issue #261 via PR #739 - M3 fix)
-- Applied via migration: database/migrations/026_add_admin_performance_indices.sql
-- Do NOT run these CREATE INDEX statements manually on production - use the migration
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_active_plan ON users(active, plan) WHERE active = TRUE;
-- Note: email already has UNIQUE constraint which creates an index automatically

-- ============================================================================
-- POLAR SUBSCRIPTIONS (Issue #594)
-- ============================================================================

-- Polar subscriptions table
-- Stores subscription information synced from Polar
CREATE TABLE polar_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    polar_subscription_id TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('free', 'starter', 'pro', 'plus')),
    status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    trial_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for polar_subscriptions
CREATE INDEX idx_polar_subscriptions_user_id ON polar_subscriptions(user_id);
CREATE INDEX idx_polar_subscriptions_status ON polar_subscriptions(status);
CREATE INDEX idx_polar_subscriptions_plan ON polar_subscriptions(plan);

-- Polar webhook events table
-- Stores webhook events for idempotency and audit trail
CREATE TABLE polar_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    polar_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for polar_webhook_events
CREATE INDEX idx_polar_webhook_events_processed ON polar_webhook_events(processed);
CREATE INDEX idx_polar_webhook_events_type ON polar_webhook_events(event_type);
CREATE INDEX idx_polar_webhook_events_created_at ON polar_webhook_events(created_at DESC);

-- ============================================================================
-- ORGANIZATIONS & TENANTS
-- ============================================================================

-- Organizations/Tenants table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Plan & billing
    plan_id VARCHAR(50) NOT NULL DEFAULT 'free',
    subscription_status VARCHAR(20) DEFAULT 'active',
    stripe_subscription_id VARCHAR(255),
    
    -- Usage limits
    monthly_responses_limit INTEGER NOT NULL DEFAULT 100,
    monthly_responses_used INTEGER DEFAULT 0,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT organizations_slug_check CHECK (slug ~* '^[a-z0-9-]+$'),
    CONSTRAINT organizations_plan_check CHECK (plan_id IN ('free', 'pro', 'creator_plus', 'custom'))
);

-- Organization members
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, user_id),
    CONSTRAINT organization_members_role_check CHECK (role IN ('owner', 'admin', 'member'))
);

-- ============================================================================
-- PLANS & BILLING
-- ============================================================================

-- Subscription plans
CREATE TABLE plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Pricing
    monthly_price_cents INTEGER NOT NULL DEFAULT 0,
    yearly_price_cents INTEGER NOT NULL DEFAULT 0,
    
    -- Limits
    monthly_responses_limit INTEGER NOT NULL,
    integrations_limit INTEGER NOT NULL DEFAULT 999,
    shield_enabled BOOLEAN DEFAULT FALSE,
    
    -- Features
    features JSONB DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (id, name, description, monthly_price_cents, yearly_price_cents, monthly_responses_limit, integrations_limit, shield_enabled, features) VALUES
('free', 'Free', 'Basic plan for individuals', 0, 0, 100, 2, FALSE, '["basic_integrations", "community_support"]'),
('pro', 'Pro', 'Professional plan for creators', 2900, 29000, 1000, 5, TRUE, '["all_integrations", "shield_mode", "priority_support", "analytics"]'),
('creator_plus', 'Creator Plus', 'Advanced plan for power users', 9900, 99000, 5000, 999, TRUE, '["unlimited_integrations", "shield_mode", "custom_tones", "api_access", "dedicated_support"]'),
('custom', 'Custom', 'Enterprise plan', 0, 0, 999999, 999, TRUE, '["everything", "custom_integrations", "sla", "dedicated_manager"]');

-- User activity log table for admin panel
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'message_sent', 'response_generated', 'login', etc.
    platform VARCHAR(50), -- 'twitter', 'youtube', 'bluesky', etc.
    tokens_used INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}', -- Additional activity data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT user_activities_type_check CHECK (activity_type IN (
        'message_sent', 'response_generated', 'login', 'logout', 
        'plan_changed', 'account_suspended', 'account_activated',
        'account_reactivated'
    ))
);

-- Index for efficient queries
CREATE INDEX idx_user_activities_user_id_created_at ON user_activities(user_id, created_at DESC);
CREATE INDEX idx_user_activities_organization_id ON user_activities(organization_id);

-- ============================================================================
-- INTEGRATIONS
-- ============================================================================

-- Integration configurations per organization
CREATE TABLE integration_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Integration details
    platform VARCHAR(50) NOT NULL, -- twitter, youtube, discord, etc.
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{}', -- platform-specific config
    credentials JSONB DEFAULT '{}', -- encrypted credentials
    
    -- Personalization
    tone VARCHAR(50) DEFAULT 'sarcastic', -- sarcastic, ironic, absurd
    humor_type VARCHAR(50) DEFAULT 'witty', -- witty, clever, playful
    response_frequency DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0
    trigger_words TEXT[] DEFAULT ARRAY['roast', 'burn', 'insult'],
    
    -- Shield settings
    shield_enabled BOOLEAN DEFAULT FALSE,
    shield_config JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, platform),
    CONSTRAINT integration_configs_platform_check CHECK (platform IN ('twitter', 'youtube', 'bluesky', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok')),
    CONSTRAINT integration_configs_tone_check CHECK (tone IN ('sarcastic', 'ironic', 'absurd')),
    CONSTRAINT integration_configs_humor_check CHECK (humor_type IN ('witty', 'clever', 'playful')),
    CONSTRAINT integration_configs_frequency_check CHECK (response_frequency >= 0.0 AND response_frequency <= 1.0)
);

-- ============================================================================
-- USAGE TRACKING & BILLING
-- ============================================================================

-- Usage tracking per organization
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Usage details
    platform VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- fetch_comment, analyze_toxicity, generate_reply
    
    -- Billing
    tokens_used INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX (organization_id, created_at),
    INDEX (organization_id, platform, created_at)
);

-- Monthly usage summaries
CREATE TABLE monthly_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    
    -- Usage counters
    total_responses INTEGER DEFAULT 0,
    responses_by_platform JSONB DEFAULT '{}', -- {twitter: 10, youtube: 5}
    
    -- Costs
    total_cost_cents INTEGER DEFAULT 0,
    cost_breakdown JSONB DEFAULT '{}',
    
    -- Limits
    responses_limit INTEGER NOT NULL,
    limit_exceeded BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, year, month),
    CONSTRAINT monthly_usage_month_check CHECK (month >= 1 AND month <= 12)
);

-- ============================================================================
-- COMMENTS & RESPONSES
-- ============================================================================

-- Comments received from integrations
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    integration_config_id UUID REFERENCES integration_configs(id) ON DELETE CASCADE,
    
    -- Platform details
    platform VARCHAR(50) NOT NULL,
    platform_comment_id VARCHAR(255) NOT NULL,
    platform_user_id VARCHAR(255),
    platform_username VARCHAR(255),
    
    -- Content
    original_text TEXT NOT NULL,
    language VARCHAR(10),
    
    -- Analysis
    toxicity_score DECIMAL(4,3), -- 0.000 to 1.000
    severity_level VARCHAR(20), -- low, medium, high, critical
    categories TEXT[], -- hate, threat, insult, etc.
    
    -- Processing status
    status VARCHAR(20) DEFAULT 'pending', -- pending, processed, skipped, error
    processed_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, platform, platform_comment_id),
    CONSTRAINT comments_status_check CHECK (status IN ('pending', 'processed', 'skipped', 'error')),
    CONSTRAINT comments_severity_check CHECK (severity_level IN ('low', 'medium', 'high', 'critical'))
);

-- Generated responses
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    
    -- Response details
    response_text TEXT NOT NULL,
    tone VARCHAR(50) NOT NULL,
    humor_type VARCHAR(50) NOT NULL,
    
    -- Platform posting
    platform_response_id VARCHAR(255), -- ID after posting to platform
    posted_at TIMESTAMPTZ,
    post_status VARCHAR(20) DEFAULT 'pending', -- pending, posted, failed
    
    -- Shield mode
    is_shield_mode BOOLEAN DEFAULT FALSE,
    shield_action VARCHAR(50), -- mute, block, report, remove
    shield_reason TEXT,
    
    -- Generation metadata
    generation_time_ms INTEGER,
    tokens_used INTEGER,
    cost_cents INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT responses_post_status_check CHECK (post_status IN ('pending', 'posted', 'failed'))
);

-- ============================================================================
-- USER BEHAVIOR & REINCIDENCE
-- ============================================================================

-- User behavior tracking for Shield
CREATE TABLE user_behaviors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- User identification
    platform VARCHAR(50) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    platform_username VARCHAR(255),
    
    -- Behavior tracking
    total_comments INTEGER DEFAULT 0,
    total_violations INTEGER DEFAULT 0,
    severity_counts JSONB DEFAULT '{"low": 0, "medium": 0, "high": 0, "critical": 0}',
    
    -- Actions taken
    actions_taken JSONB DEFAULT '[]', -- [{action: "mute", date: "...", reason: "..."}]
    is_blocked BOOLEAN DEFAULT FALSE,
    
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, platform, platform_user_id)
);

-- ============================================================================
-- JOBS & QUEUES
-- ============================================================================

-- Job queue for workers
CREATE TABLE job_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Job details
    job_type VARCHAR(50) NOT NULL, -- fetch_comments, analyze_toxicity, generate_reply
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest), Shield gets priority 1-2
    
    -- Payload
    payload JSONB NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed, retrying
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Timing
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX (status, priority, scheduled_at),
    INDEX (organization_id, job_type, status),
    CONSTRAINT job_queue_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
    CONSTRAINT job_queue_priority_check CHECK (priority >= 1 AND priority <= 10)
);

-- ============================================================================
-- GDPR & ACCOUNT DELETION
-- ============================================================================

-- Account deletion requests table
CREATE TABLE account_deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Request details
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_deletion_at TIMESTAMPTZ NOT NULL,
    grace_period_days INTEGER DEFAULT 30,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, cancelled, processing, completed
    
    -- User info at time of request (for audit trail)
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    
    -- Processing details
    data_exported_at TIMESTAMPTZ,
    data_export_url TEXT,
    data_export_expires_at TIMESTAMPTZ,
    
    -- Completion
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT account_deletion_status_check CHECK (status IN ('pending', 'cancelled', 'processing', 'completed'))
);

-- Index for efficient queries
CREATE INDEX idx_account_deletion_user_id ON account_deletion_requests(user_id);
CREATE INDEX idx_account_deletion_status_scheduled ON account_deletion_requests(status, scheduled_deletion_at);

-- Audit log for GDPR compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Subject details
    user_id UUID, -- Can be null after user deletion
    organization_id UUID, -- Can be null after user deletion
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- account_deletion_requested, data_exported, account_deleted, etc.
    actor_id UUID REFERENCES users(id), -- Who performed the action
    actor_type VARCHAR(20) DEFAULT 'user', -- user, system, admin
    
    -- Context
    resource_type VARCHAR(50), -- user, organization, data_export, etc.
    resource_id UUID,
    
    -- Details
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    
    -- Legal compliance
    legal_basis VARCHAR(100), -- gdpr_article_17, user_request, etc.
    retention_period_days INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX (user_id, created_at),
    INDEX (organization_id, created_at),
    INDEX (action, created_at),
    CONSTRAINT audit_logs_actor_type_check CHECK (actor_type IN ('user', 'system', 'admin'))
);

-- ============================================================================
-- LOGS & MONITORING
-- ============================================================================

-- Application logs
CREATE TABLE app_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Log details
    level VARCHAR(10) NOT NULL, -- debug, info, warn, error
    category VARCHAR(50) NOT NULL, -- integration, shield, billing, etc.
    message TEXT NOT NULL,
    
    -- Context
    platform VARCHAR(50),
    user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX (organization_id, level, created_at),
    INDEX (organization_id, category, created_at),
    CONSTRAINT app_logs_level_check CHECK (level IN ('debug', 'info', 'warn', 'error'))
);

-- API keys for external access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Key details
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- hashed API key
    key_preview VARCHAR(20) NOT NULL, -- first few characters for display
    
    -- Permissions
    scopes TEXT[] DEFAULT ARRAY['read'], -- read, write, admin
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    INDEX (key_hash),
    INDEX (organization_id, is_active)
);

-- Password history for security (Issue #133)
-- Tracks password hashes to prevent reuse
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Reference to auth.users table in Supabase
    
    -- Password details
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hash of the password
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for efficient queries
    INDEX (user_id, created_at DESC)
);

-- ============================================================================
-- ADMIN SETTINGS (V2 Infrastructure)
-- ============================================================================

-- Admin settings table for dynamic configuration via SettingsLoader v2
-- Issue: ROA-369 - Infraestructura común V2
-- Stores key-value pairs for dynamic configuration (gatekeeper, feature flags, etc.)
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL, -- Dot-separated key path (e.g., "gatekeeper.mode", "feature_flags.autopost_enabled")
    value JSONB NOT NULL, -- Value can be string, number, boolean, or nested object
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id), -- Admin user who last updated this setting
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for admin_settings
CREATE INDEX idx_admin_settings_key ON admin_settings(key);
CREATE INDEX idx_admin_settings_updated_at ON admin_settings(updated_at DESC);

-- Add RLS to password history
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE polar_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polar_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behaviors ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their organization's data)
-- Users can only see their own user record
CREATE POLICY user_isolation ON users FOR ALL USING (id = auth.uid());

-- Polar subscriptions: users can only see their own subscriptions
CREATE POLICY user_isolation ON polar_subscriptions FOR ALL USING (user_id = auth.uid());

-- Polar webhook events: only service role can access (no user access)
-- This prevents users from seeing raw webhook data which may contain sensitive information
CREATE POLICY service_role_only ON polar_webhook_events FOR ALL USING (false);

CREATE POLICY org_isolation ON organizations FOR ALL USING (
    owner_id = auth.uid() OR 
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
);

CREATE POLICY org_isolation ON organization_members FOR ALL USING (
    organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()) OR
    user_id = auth.uid()
);

-- Apply similar policies to other tables
CREATE POLICY org_isolation ON integration_configs FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON usage_records FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON monthly_usage FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON comments FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON responses FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON user_behaviors FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON job_queue FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON app_logs FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON api_keys FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

-- Account deletion requests - users can only see their own
CREATE POLICY user_deletion_isolation ON account_deletion_requests FOR ALL USING (user_id = auth.uid());

-- Audit logs - users can see their own and organization-level logs
CREATE POLICY audit_logs_isolation ON audit_logs FOR ALL USING (
    user_id = auth.uid() OR
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

-- Password history - users can only see their own, service role can manage all
CREATE POLICY password_history_isolation ON password_history FOR ALL USING (user_id = auth.uid());
CREATE POLICY password_history_service_access ON password_history FOR ALL 
    USING (auth.role() = 'service_role');

-- Admin settings - only admins can view and modify
CREATE POLICY admin_settings_admin_only ON admin_settings FOR ALL
    USING (
        auth.jwt() ->> 'role' = 'authenticated' AND 
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
    );

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON integration_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_usage_updated_at BEFORE UPDATE ON monthly_usage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_month INTEGER := EXTRACT(MONTH FROM NOW());
    current_year INTEGER := EXTRACT(YEAR FROM NOW());
    usage_record RECORD;
    org_record RECORD;
BEGIN
    -- Get organization details
    SELECT monthly_responses_limit INTO org_record FROM organizations WHERE id = org_id;
    
    -- Get current month usage
    SELECT total_responses INTO usage_record 
    FROM monthly_usage 
    WHERE organization_id = org_id AND year = current_year AND month = current_month;
    
    -- Return true if under limit
    IF usage_record.total_responses IS NULL THEN
        RETURN TRUE; -- No usage yet
    END IF;
    
    RETURN usage_record.total_responses < org_record.monthly_responses_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(org_id UUID, platform_name VARCHAR, cost INTEGER DEFAULT 0)
RETURNS VOID AS $$
DECLARE
    current_month INTEGER := EXTRACT(MONTH FROM NOW());
    current_year INTEGER := EXTRACT(YEAR FROM NOW());
    org_limit INTEGER;
BEGIN
    -- Get org limit
    SELECT monthly_responses_limit INTO org_limit FROM organizations WHERE id = org_id;
    
    -- Insert or update monthly usage
    INSERT INTO monthly_usage (organization_id, year, month, total_responses, responses_by_platform, total_cost_cents, responses_limit)
    VALUES (
        org_id, 
        current_year, 
        current_month, 
        1, 
        jsonb_build_object(platform_name, 1),
        cost,
        org_limit
    )
    ON CONFLICT (organization_id, year, month) 
    DO UPDATE SET 
        total_responses = monthly_usage.total_responses + 1,
        responses_by_platform = monthly_usage.responses_by_platform || 
            jsonb_build_object(platform_name, COALESCE((monthly_usage.responses_by_platform->>platform_name)::INTEGER, 0) + 1),
        total_cost_cents = monthly_usage.total_cost_cents + cost,
        limit_exceeded = (monthly_usage.total_responses + 1) >= org_limit,
        updated_at = NOW();
        
    -- Also update organization counter
    UPDATE organizations 
    SET monthly_responses_used = monthly_responses_used + 1,
        updated_at = NOW()
    WHERE id = org_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create organization for new users
CREATE OR REPLACE FUNCTION create_user_organization()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    user_email_prefix VARCHAR;
BEGIN
    -- Extract prefix from email for slug
    user_email_prefix := split_part(NEW.email, '@', 1);
    user_email_prefix := regexp_replace(user_email_prefix, '[^a-z0-9]', '-', 'g');
    user_email_prefix := trim(both '-' from user_email_prefix);
    
    -- Create organization for the user
    INSERT INTO organizations (name, slug, owner_id, plan_id, monthly_responses_limit)
    VALUES (
        COALESCE(NEW.name, NEW.email) || '''s Organization',
        user_email_prefix || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER::TEXT,
        NEW.id,
        NEW.plan,
        CASE NEW.plan 
            WHEN 'free' THEN 100
            WHEN 'pro' THEN 1000
            WHEN 'creator_plus' THEN 5000
            ELSE 999999
        END
    )
    RETURNING id INTO org_id;
    
    -- Add user as organization member
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (org_id, NEW.id, 'owner');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create organization for new users
CREATE TRIGGER create_user_organization_trigger
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_organization();