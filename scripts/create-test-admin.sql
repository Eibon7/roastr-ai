-- Script para crear un usuario administrador de prueba
-- Ejecutar en Supabase SQL Editor

-- Crear usuario admin de prueba (Supabase Auth)
-- Nota: Este debe ejecutarse primero en la consola de Supabase Auth
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'admin@roastr.ai', crypt('AdminTest123!', gen_salt('bf')), NOW(), NOW(), NOW(), 'authenticated');

-- Insertar usuario administrador en la tabla users (después de crear en Auth)
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
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@roastr.ai',
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
) ON CONFLICT (id) DO UPDATE SET
    is_admin = TRUE,
    plan = 'creator_plus',
    name = 'Administrador Sistema';

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

-- Crear organizaciones de prueba (se crearán automáticamente por el trigger, pero podemos asegurar que existen)
-- Las organizaciones se crean automáticamente cuando se insertan usuarios debido al trigger create_user_organization_trigger

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