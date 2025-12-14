# GDD Node — Autenticación y Gestión de Usuarios v2

---

version: "2.0"
node_id: auth
status: production
priority: critical
owner: Back-end Dev
last_updated: 2025-12-05
coverage: 0
coverage_source: auto
ssot_references:

- connection_status
- feature_flags
- oauth_pkce_flow
- oauth_scopes
- oauth_tokens
- plan_ids
- subscription_states
- token_refresh_rules

---

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Dependencies

Este nodo depende de los siguientes nodos:

- Ninguna dependencia directa

---

### Servicios Externos:

- **Supabase Auth**: Sistema de autenticación principal
- **Resend**: Email de verificación, magic links, notificaciones

### Tablas Database:

- `users`: id, email, role, created_at
- `profiles`: user_id, username, language_preference, roastr_persona_encrypted (string AES-GCM), onboarding_state

### SSOT:

- Estados de onboarding permitidos
- Duraciones de sesión por rol

### Nodos Relacionados:

- `03-billing-polar.md` (Validación método de pago, trials)
- `05-motor-analisis.md` (Uso de Roastr Persona)
- `09-panel-usuario.md` (User App)
- `10-panel-administracion.md` (Admin Panel)

---

## 7. Edge Cases

1. **Email ya registrado**:
   - Error genérico (anti enumeration)
   - No revela si email existe

2. **Magic link expirado**:
   - Error claro: "Link expirado"
   - Permite solicitar nuevo link

3. **Admin intenta usar magic link**:
   - Rechazado
   - Fuerza login con password

4. **Sesión admin > 4h inactivo**:
   - Logout automático
   - Requiere re-login

5. **Cambio de contraseña**:
   - Invalida todas las sesiones activas
   - Requiere re-login en todos los dispositivos

6. **Degradación de rol admin → user**:
   - Logout en cascada
   - Pierde acceso a Admin Panel

7. **Usuario elimina cuenta**:
   - Roastr Persona borrado inmediatamente
   - Retención 90 días para otros datos
   - Purga total después

8. **Cancelación durante trial**:
   - Trial se corta inmediatamente
   - Estado → `paused`
   - Workers OFF
   - Sin servicio

---

## 8. Acceptance Criteria

### Signup:

- [ ] Signup requiere email + password + plan
- [ ] Usuario creado en `users` table
- [ ] Perfil creado en `profiles` table
- [ ] Onboarding wizard iniciado
- [ ] Método de pago se valida en checkout (no en signup)

### Login:

- [ ] Login con email + password funciona
- [ ] Magic link solo para role=user (si habilitado)
- [ ] Admin y superadmin NUNCA pueden usar magic link
- [ ] Sesión user persiste 7 días
- [ ] Sesión admin/superadmin expira tras 24h
- [ ] Inactividad > 4h → logout automático (admin/superadmin)

### Roles:

- [ ] role=user → redirect a User App
- [ ] role=admin → redirect a Admin Panel
- [ ] role=superadmin → redirect a Admin Panel (con permisos extra)
- [ ] Admin NO tiene sesión persistente
- [ ] Superadmin requiere password + confirmación para acciones críticas

### Roastr Persona:

- [ ] Campos: identidades, líneas rojas, tolerancias (máx 200 chars c/u)
- [ ] Cifrado AES-256-GCM
- [ ] NO visible en Admin Panel
- [ ] Borrado inmediato al eliminar cuenta

### Onboarding:

- [ ] Wizard con 6 estados
- [ ] Se reanuda donde se quedó
- [ ] Paso "persona_setup" es obligatorio
- [ ] Estado final: "done" → dashboard

### Cancelación Trial:

- [ ] Cancelación durante trial → corte inmediato
- [ ] Estado → `paused`
- [ ] Sin servicio (Shield OFF, Roasts OFF, Ingestión OFF)
- [ ] No hay cobro

---

## 9. Test Matrix

### Unit Tests (Vitest):

- ✅ Validación de email (case-insensitive, formato)
- ✅ Validación de password (≥ 8 chars)
- ✅ Validación de formato del objeto cifrado y correcta recuperación (encrypt → decrypt → same object)
- ✅ Lógica de onboarding state transitions
- ❌ NO testear: Supabase Auth directamente

### Integration Tests (Supabase Test):

- ✅ Signup completo (user + profile creados)
- ✅ Login con credenciales válidas
- ✅ Login con credenciales inválidas (error genérico)
- ✅ Magic link generation (si habilitado)
- ✅ Sesión expira según rol
- ✅ Cambio de contraseña invalida sesiones
- ✅ Roastr Persona cifrado/descifrado
- ✅ Onboarding state transitions

### E2E Tests (Playwright):

- ✅ Signup flow completo (email + password + plan)
- ✅ Login flow (email+password)
- ✅ Magic link flow (si habilitado)
- ✅ Onboarding wizard (6 pasos)
- ✅ Logout manual
- ✅ Logout automático por inactividad (admin)
- ✅ Redirect según rol (user vs admin)

---

## 10. Implementation Notes

### Supabase Auth Setup:

```typescript
// apps/backend-v2/src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### Cifrado de Roastr Persona:

```typescript
// apps/backend-v2/src/services/personaEncryption.ts
import crypto from 'crypto';

export function encryptPersona(persona: PersonaProfile): string {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.PERSONA_ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(persona), 'utf8'), cipher.final()]);

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted: encrypted.toString('hex'),
    authTag: authTag.toString('hex')
  });
}
```

### Onboarding State Machine:

```typescript
// apps/backend-v2/src/services/onboardingService.ts
export function transitionOnboardingState(
  current: OnboardingState,
  action: 'next' | 'back'
): OnboardingState {
  const states: OnboardingState[] = [
    'welcome',
    'select_plan',
    'payment',
    'persona_setup',
    'connect_accounts',
    'done'
  ];

  const currentIndex = states.indexOf(current);
  if (action === 'next' && currentIndex < states.length - 1) {
    return states[currentIndex + 1];
  }
  if (action === 'back' && currentIndex > 0) {
    return states[currentIndex - 1];
  }
  return current;
}
```

### Magic Links:

```typescript
// Pueden habilitarse opcionalmente para role=user
// NUNCA para admin o superadmin
// Expiran en 5 minutos
```

### Referencias:

- Spec v2: `docs/spec/roastr-spec-v2.md` (sección 2)
- SSOT: `docs/SSOT/roastr-ssot-v2.md` (secciones 1.9, 2.3, 2.4)

## 11. SSOT References

Este nodo usa los siguientes valores del SSOT:

- `connection_status` - Estados de conexión OAuth
- `feature_flags` - Feature flags de autenticación
- `oauth_pkce_flow` - Flujo PKCE de OAuth
- `oauth_scopes` - Scopes OAuth requeridos
- `oauth_tokens` - Estructura de tokens OAuth
- `plan_ids` - IDs de planes para asignación inicial
- `subscription_states` - Estados de suscripción
- `token_refresh_rules` - Reglas de refresh de tokens

---

## 12. Related Nodes

- TBD — No documented relationships in SSOT/Spec

---
