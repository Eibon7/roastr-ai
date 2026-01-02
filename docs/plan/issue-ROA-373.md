# Plan de Implementación — ROA-373: Register Email Verification V2 (Phase 1: Backend)

**Fecha:** 2025-01-02  
**Issue:** https://linear.app/roastrai/issue/ROA-373/register-email-verification-v2  
**Worktree:** `/Users/emiliopostigo/roastr-ai/roastr-ai-worktrees/feature-ROA-373-auto`  
**Rama:** `feature/ROA-373-clean`

**⚠️ IMPORTANTE: Este plan cubre SOLO Phase 1 (Backend)**  
**Phase 2 (Frontend) será implementada en issue de seguimiento: ROA-373-frontend**

---

## Estado Actual

El sistema ya tiene:

✅ Endpoint `/api/v2/auth/register` que crea usuarios con Supabase Auth  
✅ Supabase Auth envía email de verificación automáticamente  
✅ Taxonomía de errores con slug `AUTH_EMAIL_NOT_CONFIRMED`  
✅ Sistema de observabilidad para auth flows  

**Falta:**

❌ Endpoint para confirmar el email cuando el usuario hace clic en el link  
❌ Validación de email confirmado antes de permitir login  
❌ Tests para el flujo completo de verificación  

---

## Acceptance Criteria

### AC1: Endpoint de Verificación de Email

- [ ] Crear endpoint `POST /api/v2/auth/verify-email` o `GET /api/v2/auth/verify-email?token=...`
- [ ] Validar token de verificación con Supabase Auth
- [ ] Retornar respuesta contractual: `{ success: boolean, message: string }`
- [ ] Rate limit: 10 intentos por hora por IP
- [ ] Feature flag: `auth_enable_email_verification` (fail-closed)
- [ ] Observabilidad: logs estructurados con `auth_email_verified`

### AC2: Validación en Login

- [ ] Modificar `/api/v2/auth/login` para rechazar usuarios con email no verificado
- [ ] Retornar error `AUTH_EMAIL_NOT_CONFIRMED` con slug apropiado
- [ ] No revelar si el email existe (anti-enumeration)
- [ ] Observabilidad: log `login_blocked_email_unverified`

### AC3: Tests

- [ ] Test unitario: verify-email con token válido → success
- [ ] Test unitario: verify-email con token inválido → error
- [ ] Test integración: register → verify → login → success
- [ ] Test integración: register → login (sin verify) → error
- [ ] Coverage ≥90% en nuevos archivos

### AC4: Documentación

- [ ] Actualizar `docs/nodes-v2/08-workers.md` (si aplica)
- [ ] Generar test evidence en `docs/test-evidence/issue-ROA-373/`
- [ ] Actualizar CHANGELOG.md

---

## Pasos de Implementación

### 1. Crear Endpoint de Verificación (30 min)

**Archivos:**
- `apps/backend-v2/src/routes/auth.ts` (añadir endpoint)
- `apps/backend-v2/src/services/authService.ts` (añadir método `verifyEmail`)
- `apps/backend-v2/src/utils/authErrorTaxonomy.ts` (verificar slugs existentes)

**Tareas:**
1. Añadir método `verifyEmail(token: string)` en `authService.ts`
2. Llamar a `supabase.auth.verifyOtp()` con el token
3. Mapear errores de Supabase a slugs contractuales
4. Añadir observabilidad: `logEmailVerification(context, success, error?)`
5. Añadir endpoint `POST /api/v2/auth/verify-email` en `auth.ts`
6. Rate limit con `rateLimitByType('email_verification')`
7. Feature flag con `isAuthEndpointEnabled('auth_enable_email_verification')`
8. Policy gate con `checkAuthPolicy({ action: 'verify_email', ... })`

### 2. Validar Email en Login (20 min)

**Archivos:**
- `apps/backend-v2/src/services/authService.ts` (modificar `login`)

**Tareas:**
1. Después de `supabase.auth.signInWithPassword`, verificar `data.user.email_confirmed_at`
2. Si es `null` o `undefined`, lanzar `new AuthError(AUTH_ERROR_CODES.EMAIL_NOT_CONFIRMED)`
3. Log `login_blocked_email_unverified` con observabilidad
4. Trackear evento `auth_login_blocked` con reason `email_not_confirmed`

### 3. Tests Unitarios (40 min)

**Archivos:**
- `apps/backend-v2/tests/unit/services/authService.test.ts` (añadir suite)
- `apps/backend-v2/tests/unit/routes/auth.verify-email.test.ts` (nuevo)

**Tareas:**
1. Mock de Supabase Auth con `vi.mock('../lib/supabaseClient')`
2. Test: `verifyEmail()` con token válido → no error
3. Test: `verifyEmail()` con token inválido → error `TOKEN_INVALID`
4. Test: `login()` con email no verificado → error `EMAIL_NOT_CONFIRMED`
5. Test: endpoint `/verify-email` con rate limit excedido → 429

### 4. Tests de Integración (40 min)

**Archivos:**
- `apps/backend-v2/tests/integration/auth-email-verification.test.ts` (nuevo)

**Tareas:**
1. Test E2E: register → verify → login → success
2. Test E2E: register → login sin verify → error
3. Test E2E: verify con token expirado → error
4. Usar Supabase Test database
5. Verificar observabilidad: logs emitidos correctamente

### 5. Documentación y Evidencia (20 min)

**Archivos:**
- `docs/test-evidence/issue-ROA-373/summary.md`
- `docs/test-evidence/issue-ROA-373/screenshots/` (si aplica UI)
- `CHANGELOG.md`

**Tareas:**
1. Ejecutar tests con coverage: `npm run test:coverage`
2. Capturar output de tests en `summary.md`
3. Documentar decisiones técnicas (e.g., usar `verifyOtp` vs otro método)
4. Añadir entrada en CHANGELOG.md con formato estándar

---

## Agentes Relevantes

- **TestEngineer**: Genera tests unitarios e integración
- **Guardian**: Valida que no se expongan secrets ni PII
- **FrontendDev**: (opcional) si se añade UI para verificación

---

## Validación

Antes de cerrar la issue, ejecutar:

```bash
# 1. Tests pasando
npm test

# 2. Coverage ≥90%
npm run test:coverage

# 3. Validaciones GDD
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci

# 4. No errores de lint
npm run lint

# 5. CodeRabbit = 0 comentarios
npm run coderabbit:review
```

---

## Notas Técnicas

### Decisión: Usar `verifyOtp()` vs Callback

**Opción elegida:** `verifyOtp()`  
**Razón:** Supabase Auth v2 usa OTP para verificación de email. El token viene en el link enviado.

**Alternativa descartada:** Callback URL que Supabase redirecciona.  
**Razón:** Queremos control total del flujo desde el backend, sin depender de frontend para confirmar.

### Seguridad

- ✅ No revelar si el email existe (anti-enumeration)
- ✅ Rate limit en verify endpoint para prevenir brute force
- ✅ Token único y temporal (manejado por Supabase)
- ✅ HTTPS requerido en producción (ya configurado)

### Observabilidad

Eventos a trackear:

- `auth_email_verify_requested` - Usuario solicita verificación
- `auth_email_verified` - Email verificado exitosamente
- `auth_email_verify_failed` - Verificación falló
- `login_blocked_email_unverified` - Login bloqueado por email no verificado

---

## Archivos Modificados (Estimado)

```
apps/backend-v2/src/
  ├── routes/auth.ts (+ endpoint verify-email)
  ├── services/authService.ts (+ verifyEmail, modificar login)
  └── utils/authObservability.ts (+ logEmailVerification)

apps/backend-v2/tests/
  ├── unit/services/authService.test.ts (+ suite verify)
  ├── unit/routes/auth.verify-email.test.ts (nuevo)
  └── integration/auth-email-verification.test.ts (nuevo)

docs/
  ├── test-evidence/issue-ROA-373/
  │   └── summary.md
  └── plan/issue-ROA-373.md (este archivo)

CHANGELOG.md
```

---

## Tiempo Estimado

- **Implementación:** 2 horas
- **Tests:** 1.5 horas
- **Documentación:** 0.5 horas
- **Total:** 4 horas

---

## 📋 Phased Delivery Strategy

### Phase 1: Backend (Esta PR)

**Scope:**
- ✅ Endpoint `/api/v2/auth/verify-email`
- ✅ Método `authService.verifyEmail()`
- ✅ Login enforcement (email confirmado)
- ✅ Rate limiting
- ✅ Tests unitarios + flow
- ✅ Documentación completa

**Status:** ✅ COMPLETADO

### Phase 2: Frontend (Issue de Seguimiento)

**Scope:**
- ⏳ Register UI con estados
- ⏳ Email Verification Page
- ⏳ Login Form updates
- ⏳ Resend verification endpoint
- ⏳ Tests E2E

**Status:** ⏳ PENDIENTE

**Documentación:** `FRONTEND-PHASE-2.md`  
**Issue tracking:** ROA-373-frontend (a crear)

**Razón de separación:**
1. Backend funcional permite testing independiente
2. Frontend puede iterar diseño sin bloquear funcionalidad
3. Permite despliegue gradual con feature flag
4. Reduce scope de PR inicial

---

**Estado:** ✅ Phase 1 Completa  
**Última actualización:** 2025-01-02

