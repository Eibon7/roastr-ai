-- Script para crear un usuario administrador de prueba
-- Ejecutar en Supabase SQL Editor

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Start transaction to ensure atomicity
BEGIN;

-- Check if admin user exists in auth.users and get the ID
-- This script will fail fast if the admin user doesn't exist in auth.users
DO $$
DECLARE
    admin_uuid UUID;
BEGIN
    -- Look up the admin user ID from auth.users
    SELECT id INTO admin_uuid
    FROM auth.users
    WHERE email = 'admin@roastr.ai';

    -- Fail fast if admin user doesn't exist in auth.users
    IF admin_uuid IS NULL THEN
        RAISE EXCEPTION 'Admin user admin@roastr.ai does not exist in auth.users. Please create the user through Supabase Auth first.';
    END IF;

    -- Store the admin UUID for use in subsequent statements
    -- We'll use this UUID in the INSERT statements below
    RAISE NOTICE 'Found admin user with ID: %', admin_uuid;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback transaction on any error
        ROLLBACK;
        RAISE;
END $$;

-- SECURITY GUIDANCE FOR ADMIN USER CREATION
-- ========================================
--
-- CRITICAL: Never hardcode passwords in SQL scripts or commit them to version control!
--
-- SECURE PASSWORD GENERATION (MANDATORY):
-- 1. Use cryptographically secure generators producing >=32 bytes:
--    - openssl rand -base64 32
--    - python3 -c "import secrets; print(secrets.token_urlsafe(32))"
--    - node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
--
-- SECURE STORAGE (MANDATORY):
-- 2. Store credentials in dedicated secrets managers:
--    - AWS Secrets Manager
--    - HashiCorp Vault
--    - GCP Secret Manager
--    - Azure Key Vault
--    - Or environment variables injected at deployment (not in .env files)
--
-- SECURE REFERENCE (MANDATORY):
-- 3. Reference secrets safely in deployment:
--    - CI/CD secret injection: psql -v password="$ADMIN_PASSWORD" -f script.sql
--    - Environment variable substitution: \set password `echo $ADMIN_PASSWORD`
--    - Never paste plaintext passwords into SQL editors
--
-- PREFERRED APPROACH (RECOMMENDED):
-- 4. Create users through application/auth service which handles secure hashing
--    - Use Supabase Auth API or admin SDK
--    - Leverage built-in security features and audit trails
--
-- DATABASE CREATION (IF REQUIRED):
-- 5. If creating directly in database, use modern KDF:
--    - bcrypt: crypt(password, gen_salt('bf', 12))
--    - argon2: Use application layer for argon2 support
--    - Never store plaintext passwords
--
-- LIFECYCLE MANAGEMENT (MANDATORY):
-- 6. Implement credential rotation and auditing:
--    - Rotate admin credentials every 90 days
--    - Log all admin access and privilege escalations
--    - Regular security audits of admin accounts
--    - Implement break-glass procedures for emergency access
--    - Monitor for unusual admin activity patterns
--
-- EXAMPLE SECURE USAGE:
-- # Generate password securely
-- ADMIN_PASSWORD=$(openssl rand -base64 32)
--
-- # Store in secrets manager
-- aws secretsmanager create-secret --name "roastr-admin-password" --secret-string "$ADMIN_PASSWORD"
--
-- # Use in deployment with variable substitution
-- psql -v admin_password="$ADMIN_PASSWORD" -c "
--   INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role)
--   VALUES ('00000000-0000-0000-0000-000000000001', 'admin@roastr.ai',
--           crypt(:'admin_password', gen_salt('bf', 12)), NOW(), NOW(), NOW(), 'authenticated')
--   ON CONFLICT (email) DO UPDATE SET
--       encrypted_password = EXCLUDED.encrypted_password,
--       updated_at = NOW();
-- "
--
-- Uncomment and modify the following ONLY after implementing secure password handling:
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'admin@roastr.ai',
--         crypt(:'admin_password', gen_salt('bf', 12)), NOW(), NOW(), NOW(), 'authenticated')
-- ON CONFLICT (email) DO UPDATE SET
--     encrypted_password = EXCLUDED.encrypted_password,
--     updated_at = NOW();

-- Execute all operations within the transaction
DO $$
BEGIN
    -- Insertar usuario administrador en la tabla users (using the existing auth user)
    -- This will fail if the admin user doesn't exist in auth.users
    INSERT INTO users (
        id,
        email,
        name,
        plan,
        is_admin,
        active,
        total_messages_sent,
        total_tokens_consumed,
        monthly_messages_sent,
        monthly_tokens_consumed,
        created_at,
        last_activity_at
    )
    SELECT
        au.id,
        au.email,
        'Administrador Sistema',
        'creator_plus',
        TRUE,
        TRUE,
        0,
        0,
        0,
        0,
        NOW(),
        NOW()
    FROM auth.users au
    WHERE au.email = 'admin@roastr.ai'
    ON CONFLICT (id) DO UPDATE SET
        is_admin = TRUE,
        plan = 'creator_plus',
        name = 'Administrador Sistema';

    RAISE NOTICE 'Admin user successfully created/updated in users table';

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback transaction on any error
        ROLLBACK;
        RAISE EXCEPTION 'Failed to create admin user in users table: %', SQLERRM;
END $$;

-- Create test users within the same transaction
DO $$
BEGIN
    -- Crear algunos usuarios de prueba
    INSERT INTO users (
        id,
        email,
        name,
        plan,
        is_admin,
        active,
        suspended,
        suspended_reason,
        total_messages_sent,
        total_tokens_consumed,
        monthly_messages_sent,
        monthly_tokens_consumed,
        created_at,
        last_activity_at
    ) VALUES
    -- Usuario básico activo
    ('11111111-1111-1111-1111-111111111111', 'usuario1@test.com', 'Juan Pérez', 'basic', FALSE, TRUE, FALSE, NULL, 45, 12000, 25, 6500, NOW() - INTERVAL '30 days', NOW() - INTERVAL '2 hours'),

    -- Usuario pro con uso alto
    ('22222222-2222-2222-2222-222222222222', 'usuario2@test.com', 'María González', 'pro', FALSE, TRUE, FALSE, NULL, 850, 85000, 850, 85000, NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day'),

    -- Usuario suspendido
    ('33333333-3333-3333-3333-333333333333', 'usuario3@test.com', 'Carlos López', 'basic', FALSE, TRUE, TRUE, 'Violación de términos de servicio', 120, 15000, 45, 8000, NOW() - INTERVAL '60 days', NOW() - INTERVAL '7 days'),

    -- Usuario inactivo
    ('44444444-4444-4444-4444-444444444444', 'usuario4@test.com', 'Ana Martín', 'pro', FALSE, FALSE, FALSE, NULL, 200, 25000, 0, 0, NOW() - INTERVAL '90 days', NOW() - INTERVAL '30 days'),

    -- Usuario creator plus con límite excedido
    ('55555555-5555-5555-5555-555555555555', 'usuario5@test.com', 'Diego Rodríguez', 'creator_plus', FALSE, TRUE, FALSE, NULL, 6200, 520000, 5200, 520000, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 hour')

    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        plan = EXCLUDED.plan,
        active = EXCLUDED.active,
        suspended = EXCLUDED.suspended,
        suspended_reason = EXCLUDED.suspended_reason,
        total_messages_sent = EXCLUDED.total_messages_sent,
        total_tokens_consumed = EXCLUDED.total_tokens_consumed,
        monthly_messages_sent = EXCLUDED.monthly_messages_sent,
        monthly_tokens_consumed = EXCLUDED.monthly_tokens_consumed;

    RAISE NOTICE 'Test users successfully created/updated';

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback transaction on any error
        ROLLBACK;
        RAISE EXCEPTION 'Failed to create test users: %', SQLERRM;
END $$;

-- Create user activities within the same transaction
DO $$
BEGIN
    -- Insertar actividades de prueba para algunos usuarios
    INSERT INTO user_activities (
        user_id,
        organization_id,
        activity_type,
        platform,
        tokens_used,
        metadata,
        created_at
    ) VALUES
    -- Actividades para usuario1
    ('11111111-1111-1111-1111-111111111111', (SELECT id FROM organizations WHERE owner_id = '11111111-1111-1111-1111-111111111111' LIMIT 1), 'message_sent', 'twitter', 150, '{"response_generated": true}', NOW() - INTERVAL '2 hours'),
    ('11111111-1111-1111-1111-111111111111', (SELECT id FROM organizations WHERE owner_id = '11111111-1111-1111-1111-111111111111' LIMIT 1), 'response_generated', 'youtube', 200, '{"toxicity_score": 0.8}', NOW() - INTERVAL '5 hours'),
    ('11111111-1111-1111-1111-111111111111', (SELECT id FROM organizations WHERE owner_id = '11111111-1111-1111-1111-111111111111' LIMIT 1), 'login', NULL, 0, '{"ip_address": "192.168.1.100"}', NOW() - INTERVAL '1 day'),

    -- Actividades para usuario2 (alto uso)
    ('22222222-2222-2222-2222-222222222222', (SELECT id FROM organizations WHERE owner_id = '22222222-2222-2222-2222-222222222222' LIMIT 1), 'message_sent', 'twitter', 180, '{"response_generated": true}', NOW() - INTERVAL '1 hour'),
    ('22222222-2222-2222-2222-222222222222', (SELECT id FROM organizations WHERE owner_id = '22222222-2222-2222-2222-222222222222' LIMIT 1), 'message_sent', 'bluesky', 220, '{"response_generated": true}', NOW() - INTERVAL '3 hours'),
    ('22222222-2222-2222-2222-222222222222', (SELECT id FROM organizations WHERE owner_id = '22222222-2222-2222-2222-222222222222' LIMIT 1), 'response_generated', 'instagram', 250, '{"toxicity_score": 0.9}', NOW() - INTERVAL '6 hours'),

    -- Actividades para usuario5 (creator plus con alto uso)
    ('55555555-5555-5555-5555-555555555555', (SELECT id FROM organizations WHERE owner_id = '55555555-5555-5555-5555-555555555555' LIMIT 1), 'message_sent', 'twitter', 300, '{"response_generated": true}', NOW() - INTERVAL '30 minutes'),
    ('55555555-5555-5555-5555-555555555555', (SELECT id FROM organizations WHERE owner_id = '55555555-5555-5555-5555-555555555555' LIMIT 1), 'message_sent', 'youtube', 280, '{"response_generated": true}', NOW() - INTERVAL '2 hours'),
    ('55555555-5555-5555-5555-555555555555', (SELECT id FROM organizations WHERE owner_id = '55555555-5555-5555-5555-555555555555' LIMIT 1), 'response_generated', 'bluesky', 320, '{"toxicity_score": 0.75}', NOW() - INTERVAL '4 hours')

    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'User activities successfully created';

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback transaction on any error
        ROLLBACK;
        RAISE EXCEPTION 'Failed to create user activities: %', SQLERRM;
END $$;

-- Crear organizaciones de prueba (se crearán automáticamente por el trigger, pero podemos asegurar que existen)
-- Las organizaciones se crean automáticamente cuando se insertan usuarios debido al trigger create_user_organization_trigger

-- Commit the transaction if all operations succeeded
COMMIT;

-- Verificar que todo se creó correctamente
SELECT
    u.id,
    u.email,
    u.name,
    u.plan,
    u.is_admin,
    u.active,
    u.suspended,
    u.monthly_messages_sent,
    u.monthly_tokens_consumed,
    o.name as organization_name
FROM users u
LEFT JOIN organizations o ON o.owner_id = u.id
WHERE u.email IN ('admin@roastr.ai', 'usuario1@test.com', 'usuario2@test.com', 'usuario3@test.com', 'usuario4@test.com', 'usuario5@test.com')
ORDER BY u.is_admin DESC, u.email;