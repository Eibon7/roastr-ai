-- Migration: Enhanced Usage Tracking System
-- Issue: #71 - Add monthly limits and usage tracking
-- Date: 2024-08-20

-- ============================================================================
-- ENHANCED USAGE TRACKING TABLES
-- ============================================================================

-- Enhanced usage_tracking table for granular resource tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Optional user tracking within org
    
    -- Resource tracking
    resource_type VARCHAR(50) NOT NULL, -- roasts, integrations, api_calls, shield_actions
    platform VARCHAR(50), -- twitter, youtube, bluesky, etc.
    
    -- Quantity and time tracking
    quantity INTEGER NOT NULL DEFAULT 1,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL, -- For daily breakdowns
    
    -- Cost tracking
    cost_cents INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    
    -- Metadata for detailed tracking
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for efficient queries
    INDEX (organization_id, resource_type, year, month),
    INDEX (organization_id, year, month, day),
    INDEX (user_id, resource_type, year, month),
    
    -- Constraints
    CONSTRAINT usage_tracking_month_check CHECK (month >= 1 AND month <= 12),
    CONSTRAINT usage_tracking_day_check CHECK (day >= 1 AND day <= 31),
    CONSTRAINT usage_tracking_resource_type_check CHECK (resource_type IN (
        'roasts', 'integrations', 'api_calls', 'shield_actions', 
        'comment_analysis', 'content_moderation', 'webhook_calls'
    ))
);

-- Enhanced monthly usage summaries with more granular tracking
ALTER TABLE monthly_usage 
ADD COLUMN IF NOT EXISTS usage_by_resource JSONB DEFAULT '{}', -- {roasts: 100, api_calls: 50}
ADD COLUMN IF NOT EXISTS usage_by_user JSONB DEFAULT '{}', -- {user_id: quantity}
ADD COLUMN IF NOT EXISTS daily_breakdown JSONB DEFAULT '{}', -- {1: 10, 2: 15, ...}
ADD COLUMN IF NOT EXISTS overage_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS overage_cost_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ; -- When monthly usage was last reset

-- Usage limits per organization and resource type
CREATE TABLE IF NOT EXISTS usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Resource limits
    resource_type VARCHAR(50) NOT NULL,
    monthly_limit INTEGER NOT NULL,
    daily_limit INTEGER DEFAULT NULL, -- Optional daily limits
    
    -- Overage policies
    allow_overage BOOLEAN DEFAULT FALSE,
    overage_rate_cents INTEGER DEFAULT 0, -- Cost per unit over limit
    hard_limit BOOLEAN DEFAULT TRUE, -- Block when limit reached
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, resource_type),
    
    CONSTRAINT usage_limits_resource_type_check CHECK (resource_type IN (
        'roasts', 'integrations', 'api_calls', 'shield_actions', 
        'comment_analysis', 'content_moderation', 'webhook_calls'
    ))
);

-- Usage alerts configuration
CREATE TABLE IF NOT EXISTS usage_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Alert configuration
    resource_type VARCHAR(50) NOT NULL,
    threshold_percentage INTEGER NOT NULL, -- 80, 90, 100, 110 (for overage)
    alert_type VARCHAR(20) NOT NULL, -- email, webhook, in_app
    
    -- Alert details
    is_active BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    sent_count INTEGER DEFAULT 0,
    
    -- Alert frequency limits
    max_alerts_per_day INTEGER DEFAULT 3,
    cooldown_hours INTEGER DEFAULT 4,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, resource_type, threshold_percentage),
    
    CONSTRAINT usage_alerts_threshold_check CHECK (threshold_percentage > 0 AND threshold_percentage <= 200),
    CONSTRAINT usage_alerts_type_check CHECK (alert_type IN ('email', 'webhook', 'in_app'))
);

-- ============================================================================
-- ENHANCED FUNCTIONS
-- ============================================================================

-- Function to record granular usage
CREATE OR REPLACE FUNCTION record_usage(
    org_id UUID,
    resource_type_param VARCHAR(50),
    platform_param VARCHAR(50) DEFAULT NULL,
    user_id_param UUID DEFAULT NULL,
    quantity_param INTEGER DEFAULT 1,
    cost_param INTEGER DEFAULT 0,
    tokens_param INTEGER DEFAULT 0,
    metadata_param JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    current_year INTEGER := EXTRACT(YEAR FROM NOW());
    current_month INTEGER := EXTRACT(MONTH FROM NOW());
    current_day INTEGER := EXTRACT(DAY FROM NOW());
    usage_limit_record RECORD;
    current_usage INTEGER := 0;
    result JSONB;
BEGIN
    -- Insert detailed usage record
    INSERT INTO usage_tracking (
        organization_id, user_id, resource_type, platform,
        quantity, year, month, day, cost_cents, tokens_used, metadata
    ) VALUES (
        org_id, user_id_param, resource_type_param, platform_param,
        quantity_param, current_year, current_month, current_day,
        cost_param, tokens_param, metadata_param
    );
    
    -- Get usage limit for this resource type
    SELECT monthly_limit, allow_overage, overage_rate_cents, hard_limit
    INTO usage_limit_record
    FROM usage_limits
    WHERE organization_id = org_id AND resource_type = resource_type_param AND is_active = TRUE;
    
    -- Get current month usage for this resource type
    SELECT COALESCE(SUM(quantity), 0) INTO current_usage
    FROM usage_tracking
    WHERE organization_id = org_id 
    AND resource_type = resource_type_param
    AND year = current_year 
    AND month = current_month;
    
    -- Update monthly usage summary
    INSERT INTO monthly_usage (
        organization_id, year, month,
        total_responses, responses_by_platform, total_cost_cents,
        responses_limit, usage_by_resource, daily_breakdown
    )
    VALUES (
        org_id, current_year, current_month,
        CASE WHEN resource_type_param = 'roasts' THEN quantity_param ELSE 0 END,
        CASE WHEN platform_param IS NOT NULL THEN jsonb_build_object(platform_param, quantity_param) ELSE '{}' END,
        cost_param,
        COALESCE(usage_limit_record.monthly_limit, 0),
        jsonb_build_object(resource_type_param, quantity_param),
        jsonb_build_object(current_day::TEXT, quantity_param)
    )
    ON CONFLICT (organization_id, year, month)
    DO UPDATE SET
        total_responses = CASE 
            WHEN resource_type_param = 'roasts' THEN monthly_usage.total_responses + quantity_param 
            ELSE monthly_usage.total_responses 
        END,
        responses_by_platform = CASE 
            WHEN platform_param IS NOT NULL THEN 
                monthly_usage.responses_by_platform || 
                jsonb_build_object(platform_param, 
                    COALESCE((monthly_usage.responses_by_platform->>platform_param)::INTEGER, 0) + quantity_param)
            ELSE monthly_usage.responses_by_platform
        END,
        total_cost_cents = monthly_usage.total_cost_cents + cost_param,
        usage_by_resource = monthly_usage.usage_by_resource || 
            jsonb_build_object(resource_type_param, 
                COALESCE((monthly_usage.usage_by_resource->>resource_type_param)::INTEGER, 0) + quantity_param),
        daily_breakdown = monthly_usage.daily_breakdown || 
            jsonb_build_object(current_day::TEXT,
                COALESCE((monthly_usage.daily_breakdown->>current_day::TEXT)::INTEGER, 0) + quantity_param),
        limit_exceeded = CASE 
            WHEN usage_limit_record.monthly_limit IS NOT NULL THEN 
                current_usage >= usage_limit_record.monthly_limit
            ELSE FALSE
        END,
        overage_amount = CASE
            WHEN usage_limit_record.monthly_limit IS NOT NULL AND current_usage > usage_limit_record.monthly_limit THEN
                current_usage - usage_limit_record.monthly_limit
            ELSE 0
        END,
        updated_at = NOW();
    
    -- Build result
    result := jsonb_build_object(
        'recorded', TRUE,
        'resource_type', resource_type_param,
        'quantity', quantity_param,
        'current_usage', current_usage,
        'monthly_limit', COALESCE(usage_limit_record.monthly_limit, 0),
        'limit_exceeded', current_usage >= COALESCE(usage_limit_record.monthly_limit, 999999),
        'overage_allowed', COALESCE(usage_limit_record.allow_overage, FALSE),
        'cost_cents', cost_param,
        'tokens_used', tokens_param
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check if organization can perform operation
CREATE OR REPLACE FUNCTION can_perform_operation(
    org_id UUID,
    resource_type_param VARCHAR(50),
    quantity_param INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    current_year INTEGER := EXTRACT(YEAR FROM NOW());
    current_month INTEGER := EXTRACT(MONTH FROM NOW());
    usage_limit_record RECORD;
    current_usage INTEGER := 0;
    result JSONB;
BEGIN
    -- Get usage limit for this resource type
    SELECT monthly_limit, allow_overage, hard_limit, daily_limit
    INTO usage_limit_record
    FROM usage_limits
    WHERE organization_id = org_id AND resource_type = resource_type_param AND is_active = TRUE;
    
    -- If no limit configured, allow operation
    IF usage_limit_record.monthly_limit IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', TRUE,
            'reason', 'no_limit_configured',
            'current_usage', 0,
            'monthly_limit', NULL
        );
    END IF;
    
    -- Get current month usage
    SELECT COALESCE(SUM(quantity), 0) INTO current_usage
    FROM usage_tracking
    WHERE organization_id = org_id 
    AND resource_type = resource_type_param
    AND year = current_year 
    AND month = current_month;
    
    -- Check if operation would exceed limit
    IF (current_usage + quantity_param) > usage_limit_record.monthly_limit THEN
        IF usage_limit_record.allow_overage AND NOT usage_limit_record.hard_limit THEN
            -- Allow with overage
            result := jsonb_build_object(
                'allowed', TRUE,
                'reason', 'overage_allowed',
                'current_usage', current_usage,
                'monthly_limit', usage_limit_record.monthly_limit,
                'overage_amount', (current_usage + quantity_param) - usage_limit_record.monthly_limit,
                'will_exceed_limit', TRUE
            );
        ELSE
            -- Block operation
            result := jsonb_build_object(
                'allowed', FALSE,
                'reason', 'monthly_limit_exceeded',
                'current_usage', current_usage,
                'monthly_limit', usage_limit_record.monthly_limit,
                'remaining', GREATEST(0, usage_limit_record.monthly_limit - current_usage)
            );
        END IF;
    ELSE
        -- Allow operation
        result := jsonb_build_object(
            'allowed', TRUE,
            'reason', 'within_limit',
            'current_usage', current_usage,
            'monthly_limit', usage_limit_record.monthly_limit,
            'remaining', usage_limit_record.monthly_limit - current_usage - quantity_param,
            'percentage_used', ROUND((current_usage::DECIMAL / usage_limit_record.monthly_limit) * 100, 2)
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly usage (for cron job)
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER := 0;
    org_record RECORD;
BEGIN
    -- Reset monthly usage for all organizations
    FOR org_record IN SELECT id FROM organizations LOOP
        -- Mark current month as reset
        UPDATE monthly_usage 
        SET reset_at = NOW()
        WHERE organization_id = org_record.id 
        AND year = EXTRACT(YEAR FROM NOW()) 
        AND month = EXTRACT(MONTH FROM NOW())
        AND reset_at IS NULL;
        
        -- Reset organization counter
        UPDATE organizations 
        SET monthly_responses_used = 0,
            updated_at = NOW()
        WHERE id = org_record.id;
        
        reset_count := reset_count + 1;
    END LOOP;
    
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get usage summary for admin dashboard
CREATE OR REPLACE FUNCTION get_usage_summary(
    target_year INTEGER,
    target_month INTEGER
)
RETURNS TABLE (
    organization_id UUID,
    organization_name VARCHAR,
    plan_id VARCHAR,
    resource_type VARCHAR,
    total_quantity INTEGER,
    total_cost_cents INTEGER,
    total_tokens INTEGER,
    monthly_limit INTEGER,
    limit_exceeded BOOLEAN,
    percentage_used DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as organization_id,
        o.name as organization_name,
        o.plan_id,
        ut.resource_type,
        COALESCE(SUM(ut.quantity), 0)::INTEGER as total_quantity,
        COALESCE(SUM(ut.cost_cents), 0)::INTEGER as total_cost_cents,
        COALESCE(SUM(ut.tokens_used), 0)::INTEGER as total_tokens,
        COALESCE(ul.monthly_limit, 0)::INTEGER as monthly_limit,
        CASE 
            WHEN ul.monthly_limit IS NOT NULL AND COALESCE(SUM(ut.quantity), 0) >= ul.monthly_limit 
            THEN TRUE 
            ELSE FALSE 
        END as limit_exceeded,
        CASE 
            WHEN ul.monthly_limit IS NOT NULL AND ul.monthly_limit > 0 
            THEN ROUND((COALESCE(SUM(ut.quantity), 0)::DECIMAL / ul.monthly_limit) * 100, 2)
            ELSE 0.00
        END as percentage_used
    FROM organizations o
    LEFT JOIN usage_tracking ut ON (
        o.id = ut.organization_id 
        AND ut.year = target_year 
        AND ut.month = target_month
    )
    LEFT JOIN usage_limits ul ON (
        o.id = ul.organization_id 
        AND ut.resource_type = ul.resource_type
        AND ul.is_active = TRUE
    )
    GROUP BY 
        o.id, o.name, o.plan_id, ut.resource_type, ul.monthly_limit
    ORDER BY 
        o.name, ut.resource_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ADDITIONAL HELPER FUNCTIONS
-- ============================================================================

-- Function to get top resource consumers
CREATE OR REPLACE FUNCTION get_top_resource_consumers(
    resource_type_param VARCHAR(50),
    limit_count INTEGER DEFAULT 10,
    target_year INTEGER DEFAULT NULL,
    target_month INTEGER DEFAULT NULL
)
RETURNS TABLE (
    organization_id UUID,
    organization_name VARCHAR,
    plan_id VARCHAR,
    total_quantity INTEGER,
    total_cost_cents INTEGER,
    percentage_of_limit DECIMAL
) AS $$
DECLARE
    use_year INTEGER := COALESCE(target_year, EXTRACT(YEAR FROM NOW())::INTEGER);
    use_month INTEGER := COALESCE(target_month, EXTRACT(MONTH FROM NOW())::INTEGER);
BEGIN
    RETURN QUERY
    SELECT 
        o.id as organization_id,
        o.name as organization_name,
        o.plan_id,
        COALESCE(SUM(ut.quantity), 0)::INTEGER as total_quantity,
        COALESCE(SUM(ut.cost_cents), 0)::INTEGER as total_cost_cents,
        CASE 
            WHEN ul.monthly_limit IS NOT NULL AND ul.monthly_limit > 0 
            THEN ROUND((COALESCE(SUM(ut.quantity), 0)::DECIMAL / ul.monthly_limit) * 100, 2)
            ELSE 0.00
        END as percentage_of_limit
    FROM organizations o
    LEFT JOIN usage_tracking ut ON (
        o.id = ut.organization_id 
        AND ut.resource_type = resource_type_param
        AND ut.year = use_year 
        AND ut.month = use_month
    )
    LEFT JOIN usage_limits ul ON (
        o.id = ul.organization_id 
        AND ul.resource_type = resource_type_param
        AND ul.is_active = TRUE
    )
    GROUP BY 
        o.id, o.name, o.plan_id, ul.monthly_limit
    ORDER BY 
        total_quantity DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get usage trends over time
CREATE OR REPLACE FUNCTION get_usage_trends(
    organization_id_param UUID,
    resource_type_param VARCHAR(50),
    months_back INTEGER DEFAULT 6
)
RETURNS TABLE (
    year INTEGER,
    month INTEGER,
    total_quantity INTEGER,
    total_cost_cents INTEGER,
    monthly_limit INTEGER,
    days_in_month INTEGER,
    avg_daily_usage DECIMAL
) AS $$
DECLARE
    start_date DATE := (NOW() - INTERVAL '1 month' * months_back);
BEGIN
    RETURN QUERY
    SELECT 
        ut.year,
        ut.month,
        COALESCE(SUM(ut.quantity), 0)::INTEGER as total_quantity,
        COALESCE(SUM(ut.cost_cents), 0)::INTEGER as total_cost_cents,
        COALESCE(MAX(ul.monthly_limit), 0)::INTEGER as monthly_limit,
        EXTRACT(DAY FROM DATE_TRUNC('month', DATE(ut.year || '-' || ut.month || '-01')) + INTERVAL '1 month - 1 day')::INTEGER as days_in_month,
        CASE 
            WHEN COUNT(DISTINCT ut.day) > 0 
            THEN ROUND(COALESCE(SUM(ut.quantity), 0)::DECIMAL / COUNT(DISTINCT ut.day), 2)
            ELSE 0.00
        END as avg_daily_usage
    FROM usage_tracking ut
    LEFT JOIN usage_limits ul ON (
        ut.organization_id = ul.organization_id 
        AND ut.resource_type = ul.resource_type
        AND ul.is_active = TRUE
    )
    WHERE 
        ut.organization_id = organization_id_param
        AND ut.resource_type = resource_type_param
        AND DATE(ut.year || '-' || ut.month || '-01') >= start_date
    GROUP BY 
        ut.year, ut.month
    ORDER BY 
        ut.year DESC, ut.month DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DEFAULT USAGE LIMITS FOR EXISTING ORGANIZATIONS
-- ============================================================================

-- Insert default usage limits for existing organizations
INSERT INTO usage_limits (organization_id, resource_type, monthly_limit, allow_overage, hard_limit)
SELECT 
    o.id as organization_id,
    'roasts' as resource_type,
    o.monthly_responses_limit as monthly_limit,
    CASE 
        WHEN o.plan_id = 'free' THEN FALSE 
        ELSE TRUE 
    END as allow_overage,
    CASE 
        WHEN o.plan_id = 'free' THEN TRUE 
        ELSE FALSE 
    END as hard_limit
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM usage_limits ul 
    WHERE ul.organization_id = o.id AND ul.resource_type = 'roasts'
);

-- Insert additional resource limits based on plan
INSERT INTO usage_limits (organization_id, resource_type, monthly_limit, allow_overage, hard_limit)
SELECT o.id, unnest(limits.resource_types), unnest(limits.monthly_limits), 
       CASE WHEN o.plan_id = 'free' THEN FALSE ELSE TRUE END,
       CASE WHEN o.plan_id = 'free' THEN TRUE ELSE FALSE END
FROM organizations o
CROSS JOIN (
    SELECT 
        ARRAY['integrations', 'api_calls', 'shield_actions'] as resource_types,
        CASE o.plan_id
            WHEN 'free' THEN ARRAY[2, 100, 0]
            WHEN 'pro' THEN ARRAY[5, 1000, 500]
            WHEN 'creator_plus' THEN ARRAY[999, 5000, 2000]
            ELSE ARRAY[999, 99999, 99999]
        END as monthly_limits
    FROM organizations o
) as limits
WHERE NOT EXISTS (
    SELECT 1 FROM usage_limits ul 
    WHERE ul.organization_id = o.id AND ul.resource_type = ANY(limits.resource_types)
);

-- ============================================================================
-- DEFAULT USAGE ALERTS
-- ============================================================================

-- Insert default usage alerts for all organizations
INSERT INTO usage_alerts (organization_id, resource_type, threshold_percentage, alert_type)
SELECT o.id, unnest(ARRAY['roasts', 'integrations', 'api_calls']), unnest(ARRAY[80, 90, 100]), 'email'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM usage_alerts ua 
    WHERE ua.organization_id = o.id
);

-- ============================================================================
-- INDEXES AND OPTIMIZATIONS
-- ============================================================================

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_tracking_org_resource_time ON usage_tracking(organization_id, resource_type, year, month, day);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_resource_time ON usage_tracking(user_id, resource_type, year, month) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_limits_org_resource ON usage_limits(organization_id, resource_type, is_active);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_org_resource ON usage_alerts(organization_id, resource_type, is_active);

-- ============================================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for organization isolation
CREATE POLICY org_isolation ON usage_tracking FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON usage_limits FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);

CREATE POLICY org_isolation ON usage_alerts FOR ALL USING (
    organization_id IN (
        SELECT o.id FROM organizations o 
        LEFT JOIN organization_members om ON o.id = om.organization_id 
        WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
    )
);