# GDD Node — Autenticación y Gestión de Usuarios v2

**Version:** 2.0  
**Status:** ✅ Active  
**Last Updated:** 2025-12-04

---

## 1. Summary

Sistema de autenticación basado en Supabase Auth que gestiona signup, login, roles (user/admin/superadmin), sesiones, perfil de usuario, Roastr Persona cifrado, y onboarding wizard. Determina acceso a Admin Panel o User App según rol.

---

## 2. Responsibilities

### Funcionales:

- Signup (email, password, plan)
- Login con email+password o magic link (opcional)
- Gestión de roles: `user`, `admin`, `superadmin`
- Perfil de usuario con Roastr Persona cifrado (AES-256-GCM)
- Onboarding wizard multi-paso
- Expiración de sesiones según rol
- Cancelación de trial con corte inmediato

### No Funcionales:

- Seguridad: JWT firmados y rotados
- Rate limiting por IP/usuario
- Anti enumeration en login
- Passwords hasheadas con bcrypt
- Tokens OAuth cifrados

---

## 3. Inputs

- **Signup**: email, password, plan seleccionado (Starter/Pro/Plus)
- **Login**: email + password OR magic link
- **Perfil**: username, idioma, Roastr Persona
- **Onboarding**: estado del wizard (welcome → select_plan → payment → persona_setup → connect_accounts → done)

---

## 4. Outputs

- Usuario creado en `users` table
- Perfil creado en `profiles` table
- JWT token (access + refresh)
- Estado de onboarding (`onboarding_state`)
- Redirect según rol:
  - `admin`/`superadmin` → Admin Panel
  - `user` → User App

---

## 5. Rules

### Roles y Permisos:

**El rol se determina exclusivamente en Supabase Auth (`auth.users.role`).**

1. **user**:
   - Acceso a User App
   - Sesión persistente: 7 días
   - Inactividad > 14 días → login requerido

2. **admin**:
   - Acceso a Admin Panel
   - Sesión: 24h
   - Inactividad > 4h → logout automático
   - ❌ NO magic link
   - ❌ NO sesión persistente

3. **superadmin**:
   - Todo lo de admin
   - Permisos extra: degradar admins, flags críticos, kill switches
   - Sesión: 24h
   - Inactividad > 4h → logout automático
   - Acciones críticas → requieren password + confirmación doble

**Nota**: La expiración por inactividad la aplica el sistema backend, no Supabase directamente.

### Signup:

1. Crea usuario en `users`
2. Crea perfil en `profiles`
3. Inicia onboarding wizard
4. El método de pago se valida en checkout antes de activar el trial (no durante signup)

### Login:

- Email case-insensitive
- Contraseña ≥ 8 chars
- Magic links:
  - Pueden habilitarse opcionalmente para `role=user`
  - ❌ NUNCA `admin` o `superadmin`
  - Expiran a los 5 minutos
  - Requieren email verificado

### Roastr Persona:

- Cifrado AES-256-GCM (con soporte para rotación de claves en backend)
- 3 campos (máx 200 chars cada uno):
  - Lo que me define (identidades)
  - Lo que no tolero (líneas rojas)
  - Lo que me da igual (tolerancias)
- ❌ NO visible para admins
- Borrado inmediato al eliminar cuenta

### Onboarding States:

```typescript
type OnboardingState =
  | 'welcome'
  | 'select_plan'
  | 'payment'
  | 'persona_setup'
  | 'connect_accounts'
  | 'done';
```

Flujo:

1. welcome → Introducción breve
2. select_plan → Elección Starter/Pro/Plus
3. payment → Inicia checkout (validación método de pago vía Polar)
4. persona_setup → Configura Roastr Persona (obligatorio)
5. connect_accounts → Conecta X o YouTube
6. done → Dashboard

**Nota**: El paso `payment` se activa cuando el usuario inicia checkout para activar su trial. No forma parte del signup inicial.

### Cancelación de Trial:

**⚠️ CRÍTICO**: Si usuario cancela durante trial → **trial termina INMEDIATAMENTE**

- Estado → `paused`
- Servicio cortado (sin Shield, sin Roasts, sin ingestión)
- No hay cobro
- Workers OFF para esa cuenta

**Nota**: Este comportamiento reemplaza el comportamiento por defecto de Polar. La cancelación NO continúa hasta fin de trial. Es un override explícito del producto.

---

## 6. Dependencies

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
