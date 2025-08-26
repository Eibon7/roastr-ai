-- Setup script for Issue #237: Admin and Test Users Creation
-- Purpose: Create admin user and test users for backoffice development
-- Created: 2025-08-26

-- ============================================================================
-- SETUP ADMIN USER
-- ============================================================================

-- Create or update admin user
INSERT INTO users (
    id,
    email,
    name,
    plan,
    is_admin,
    active,
    is_test,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'emiliopostigo@gmail.com',
    'Emilio Postigo',
    'creator_plus',
    true,
    true,
    false,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    is_admin = true,
    active = true,
    plan = 'creator_plus',
    updated_at = NOW();

-- ============================================================================
-- SETUP TEST USERS
-- ============================================================================

-- Clean up existing test users first (for re-running the script)
DELETE FROM users WHERE is_test = true;

-- 1. Free User
INSERT INTO users (
    id,
    email,
    name,
    plan,
    is_admin,
    active,
    is_test,
    total_messages_sent,
    monthly_messages_sent,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'test.free@roastr.ai',
    'Free Test User',
    'free',
    false,
    true,
    true,
    0,
    0,
    NOW() - INTERVAL '30 days',
    NOW()
);

-- 2. Starter User (using pro plan with lower usage)
INSERT INTO users (
    id,
    email,
    name,
    plan,
    is_admin,
    active,
    is_test,
    total_messages_sent,
    monthly_messages_sent,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'test.starter@roastr.ai',
    'Starter Test User',
    'pro',
    false,
    true,
    true,
    45,
    30,
    NOW() - INTERVAL '25 days',
    NOW()
);

-- 3. Pro User (80% usage)
INSERT INTO users (
    id,
    email,
    name,
    plan,
    is_admin,
    active,
    is_test,
    total_messages_sent,
    monthly_messages_sent,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'test.pro@roastr.ai',
    'Pro Test User',
    'pro',
    false,
    true,
    true,
    320,
    800,
    NOW() - INTERVAL '20 days',
    NOW()
);

-- 4. Plus User (50% usage)
INSERT INTO users (
    id,
    email,
    name,
    plan,
    is_admin,
    active,
    is_test,
    total_messages_sent,
    monthly_messages_sent,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'test.plus@roastr.ai',
    'Plus Test User',
    'creator_plus',
    false,
    true,
    true,
    1250,
    2500,
    NOW() - INTERVAL '15 days',
    NOW()
);

-- 5. Heavy User (100% usage - at limit)
INSERT INTO users (
    id,
    email,
    name,
    plan,
    is_admin,
    active,
    is_test,
    total_messages_sent,
    monthly_messages_sent,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'test.heavy@roastr.ai',
    'Heavy Test User',
    'creator_plus',
    false,
    true,
    true,
    5000,
    5000,
    NOW() - INTERVAL '10 days',
    NOW()
);

-- 6. Empty User (no activity)
INSERT INTO users (
    id,
    email,
    name,
    plan,
    is_admin,
    active,
    is_test,
    total_messages_sent,
    monthly_messages_sent,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'test.empty@roastr.ai',
    'Empty Test User',
    'free',
    false,
    true,
    true,
    0,
    0,
    NOW() - INTERVAL '5 days',
    NOW()
);

-- ============================================================================
-- SETUP REALISTIC SOCIAL HANDLES FOR PAID PLAN USERS
-- ============================================================================

-- Wait, let me get the user IDs for the integration configs
-- We need to do this after the organizations are created by the trigger

-- Create a temporary function to setup integrations after organizations are created
CREATE OR REPLACE FUNCTION setup_test_user_integrations()
RETURNS VOID AS $$
DECLARE
    starter_user_id UUID;
    starter_org_id UUID;
    pro_user_id UUID;
    pro_org_id UUID;
    plus_user_id UUID;
    plus_org_id UUID;
    heavy_user_id UUID;
    heavy_org_id UUID;
BEGIN
    -- Get user IDs and their organization IDs
    SELECT u.id, o.id INTO starter_user_id, starter_org_id
    FROM users u
    JOIN organizations o ON o.owner_id = u.id
    WHERE u.email = 'test.starter@roastr.ai' AND u.is_test = true;
    
    SELECT u.id, o.id INTO pro_user_id, pro_org_id
    FROM users u
    JOIN organizations o ON o.owner_id = u.id
    WHERE u.email = 'test.pro@roastr.ai' AND u.is_test = true;
    
    SELECT u.id, o.id INTO plus_user_id, plus_org_id
    FROM users u
    JOIN organizations o ON o.owner_id = u.id
    WHERE u.email = 'test.plus@roastr.ai' AND u.is_test = true;
    
    SELECT u.id, o.id INTO heavy_user_id, heavy_org_id
    FROM users u
    JOIN organizations o ON o.owner_id = u.id
    WHERE u.email = 'test.heavy@roastr.ai' AND u.is_test = true;
    
    -- Setup integration configs for paid users
    
    -- Starter user: 1 Twitter handle
    IF starter_org_id IS NOT NULL THEN
        INSERT INTO integration_configs (
            organization_id,
            platform,
            enabled,
            config,
            tone,
            humor_type,
            response_frequency,
            shield_enabled
        ) VALUES (
            starter_org_id,
            'twitter',
            true,
            '{"handle": "@test_starter", "webhook_url": "https://api.roastr.ai/webhooks/twitter"}',
            'sarcastic',
            'witty',
            0.8,
            true
        );
    END IF;
    
    -- Pro user: 2 handles (Twitter + YouTube)
    IF pro_org_id IS NOT NULL THEN
        INSERT INTO integration_configs (
            organization_id,
            platform,
            enabled,
            config,
            tone,
            humor_type,
            response_frequency,
            shield_enabled
        ) VALUES 
        (
            pro_org_id,
            'twitter',
            true,
            '{"handle": "@test_pro_user", "webhook_url": "https://api.roastr.ai/webhooks/twitter"}',
            'ironic',
            'clever',
            0.9,
            true
        ),
        (
            pro_org_id,
            'youtube',
            true,
            '{"channel_id": "UCTestProChannel", "webhook_url": "https://api.roastr.ai/webhooks/youtube"}',
            'ironic',
            'clever',
            0.7,
            true
        );
    END IF;
    
    -- Plus user: 2 handles (Twitter + Instagram)
    IF plus_org_id IS NOT NULL THEN
        INSERT INTO integration_configs (
            organization_id,
            platform,
            enabled,
            config,
            tone,
            humor_type,
            response_frequency,
            shield_enabled
        ) VALUES 
        (
            plus_org_id,
            'twitter',
            true,
            '{"handle": "@test_plus_creator", "webhook_url": "https://api.roastr.ai/webhooks/twitter"}',
            'absurd',
            'playful',
            1.0,
            true
        ),
        (
            plus_org_id,
            'instagram',
            true,
            '{"username": "test_plus_creator", "webhook_url": "https://api.roastr.ai/webhooks/instagram"}',
            'absurd',
            'playful',
            0.8,
            true
        );
    END IF;
    
    -- Heavy user: 4 handles (Twitter, YouTube, Instagram, Discord)
    IF heavy_org_id IS NOT NULL THEN
        INSERT INTO integration_configs (
            organization_id,
            platform,
            enabled,
            config,
            tone,
            humor_type,
            response_frequency,
            shield_enabled
        ) VALUES 
        (
            heavy_org_id,
            'twitter',
            true,
            '{"handle": "@test_heavy_user", "webhook_url": "https://api.roastr.ai/webhooks/twitter"}',
            'sarcastic',
            'witty',
            1.0,
            true
        ),
        (
            heavy_org_id,
            'youtube',
            true,
            '{"channel_id": "UCTestHeavyChannel", "webhook_url": "https://api.roastr.ai/webhooks/youtube"}',
            'sarcastic',
            'witty',
            0.9,
            true
        ),
        (
            heavy_org_id,
            'instagram',
            true,
            '{"username": "test_heavy_creator", "webhook_url": "https://api.roastr.ai/webhooks/instagram"}',
            'sarcastic',
            'witty',
            0.8,
            true
        ),
        (
            heavy_org_id,
            'discord',
            true,
            '{"server_id": "123456789", "bot_token": "test_token", "webhook_url": "https://api.roastr.ai/webhooks/discord"}',
            'sarcastic',
            'witty',
            0.7,
            true
        );
    END IF;
    
END;
$$ LANGUAGE plpgsql;

-- Execute the integration setup (this will run after organizations are created by trigger)
SELECT setup_test_user_integrations();

-- Clean up the temporary function
DROP FUNCTION setup_test_user_integrations();

-- ============================================================================
-- SETUP USER SUBSCRIPTIONS
-- ============================================================================

-- Create user subscriptions for test users to match their plans
INSERT INTO user_subscriptions (user_id, plan, status, created_at, updated_at)
SELECT 
    u.id,
    u.plan,
    'active',
    u.created_at,
    NOW()
FROM users u
WHERE u.is_test = true
ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = 'active',
    updated_at = NOW();

-- ============================================================================
-- SETUP MONTHLY USAGE DATA
-- ============================================================================

-- Create monthly usage records for test users to show realistic usage patterns
DO $$
DECLARE
    current_month INTEGER := EXTRACT(MONTH FROM NOW());
    current_year INTEGER := EXTRACT(YEAR FROM NOW());
    user_record RECORD;
    org_record RECORD;
BEGIN
    -- Loop through test users and their organizations
    FOR user_record IN 
        SELECT u.id as user_id, u.email, u.monthly_messages_sent, o.id as org_id, o.monthly_responses_limit
        FROM users u
        JOIN organizations o ON o.owner_id = u.id
        WHERE u.is_test = true AND u.monthly_messages_sent > 0
    LOOP
        -- Create monthly usage record
        INSERT INTO monthly_usage (
            organization_id,
            year,
            month,
            total_responses,
            responses_by_platform,
            total_cost_cents,
            responses_limit,
            limit_exceeded
        ) VALUES (
            user_record.org_id,
            current_year,
            current_month,
            user_record.monthly_messages_sent,
            CASE 
                WHEN user_record.email LIKE '%starter%' THEN '{"twitter": 30}'::jsonb
                WHEN user_record.email LIKE '%pro%' THEN '{"twitter": 500, "youtube": 300}'::jsonb
                WHEN user_record.email LIKE '%plus%' THEN '{"twitter": 1500, "instagram": 1000}'::jsonb
                WHEN user_record.email LIKE '%heavy%' THEN '{"twitter": 2000, "youtube": 1500, "instagram": 1000, "discord": 500}'::jsonb
                ELSE '{}'::jsonb
            END,
            user_record.monthly_messages_sent * 15, -- Assume 15 cents per response
            user_record.org_id,
            user_record.monthly_messages_sent >= user_record.org_id
        )
        ON CONFLICT (organization_id, year, month) DO UPDATE SET
            total_responses = EXCLUDED.total_responses,
            responses_by_platform = EXCLUDED.responses_by_platform,
            total_cost_cents = EXCLUDED.total_cost_cents,
            limit_exceeded = EXCLUDED.limit_exceeded,
            updated_at = NOW();
        
        -- Update organization usage counter
        UPDATE organizations 
        SET monthly_responses_used = user_record.monthly_messages_sent,
            updated_at = NOW()
        WHERE id = user_record.org_id;
    END LOOP;
END $$;

-- ============================================================================
-- LOG ACTIVITY FOR TEST USERS
-- ============================================================================

-- Add some user activities for testing backoffice navigation
INSERT INTO user_activities (user_id, organization_id, activity_type, platform, tokens_used, metadata, created_at)
SELECT 
    u.id,
    o.id,
    'message_sent',
    'twitter',
    100,
    '{"test_data": true, "comment": "Test roast generation"}'::jsonb,
    NOW() - INTERVAL '1 day'
FROM users u
JOIN organizations o ON o.owner_id = u.id
WHERE u.is_test = true AND u.monthly_messages_sent > 0;

-- Add login activities
INSERT INTO user_activities (user_id, organization_id, activity_type, metadata, created_at)
SELECT 
    u.id,
    o.id,
    'login',
    '{"test_data": true, "ip": "192.168.1.100"}'::jsonb,
    NOW() - INTERVAL '2 hours'
FROM users u
JOIN organizations o ON o.owner_id = u.id
WHERE u.is_test = true;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show created admin user
SELECT 
    'Admin User' as type,
    email, 
    name, 
    plan, 
    is_admin, 
    active,
    is_test,
    created_at
FROM users 
WHERE email = 'emiliopostigo@gmail.com';

-- Show created test users
SELECT 
    'Test Users' as type,
    email, 
    name, 
    plan, 
    is_admin, 
    active,
    is_test,
    total_messages_sent,
    monthly_messages_sent,
    created_at
FROM users 
WHERE is_test = true
ORDER BY email;

-- Show organizations created for test users
SELECT 
    'Test Organizations' as type,
    o.name,
    o.slug,
    o.plan_id,
    o.monthly_responses_limit,
    o.monthly_responses_used,
    u.email as owner_email
FROM organizations o
JOIN users u ON u.id = o.owner_id
WHERE u.is_test = true
ORDER BY u.email;

-- Show integration configs for test users
SELECT 
    'Test Integrations' as type,
    u.email as user_email,
    ic.platform,
    ic.enabled,
    ic.tone,
    ic.humor_type,
    ic.config->>'handle' as handle,
    ic.config->>'username' as username,
    ic.config->>'channel_id' as channel_id
FROM integration_configs ic
JOIN organizations o ON o.id = ic.organization_id
JOIN users u ON u.id = o.owner_id
WHERE u.is_test = true
ORDER BY u.email, ic.platform;

-- Show usage data for test users
SELECT 
    'Test Usage' as type,
    u.email as user_email,
    mu.total_responses,
    mu.responses_limit,
    mu.limit_exceeded,
    mu.responses_by_platform
FROM monthly_usage mu
JOIN organizations o ON o.id = mu.organization_id
JOIN users u ON u.id = o.owner_id
WHERE u.is_test = true
ORDER BY u.email;