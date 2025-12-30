# Plan: ROA-409 - Auth Email Infrastructure v2

**Issue:** ROA-409  
**Título:** Auth email infrastructure v2  
**Prioridad:** P1  
**Owner:** Back-end Dev  
**Fecha:** 2025-12-30

---

## Estado Actual

El sistema backend-v2 tiene implementados los componentes base de autenticación:

### ✅ Implementado

1. **Authentication (A1)**
   - `authService.ts` - Servicio de autenticación con Supabase
   - `auth.ts` middleware - `requireAuth`, `requireRole`, `optionalAuth`
   - `authErrorTaxonomy.ts` - Sistema de errores estructurado con slugs
   - `authErrorResponse.ts` - Response handler estandarizado

2. **Authorization (A2)**
   - Feature flags integrados (`authFlags.ts`)
   - Middleware `requireRole` para validación de roles
   - RLS policies en Supabase para multi-tenancy

3. **Policy Wiring (A3)**
   - `authPolicyGate.ts` - Policy enforcement antes de auth logic
   - Rate limiting y abuse detection integrados

### ❌ Falta Implementar

1. **Email Infrastructure**
   - No hay servicio centralizado para envío de emails de auth
   - No hay validación de feature flags para emails
   - No hay protección de PII en logs de emails
   - No hay manejo de errores específicos de email
   - No hay observabilidad de eventos de email

2. **Email Flows**
   - Register: No hay validación de infraestructura antes de signup
   - Password Recovery: No hay validación antes de resetPasswordForEmail
   - No hay fail-closed cuando emails están deshabilitados

---

## Objetivo

Implementar infraestructura de emails de autenticación con:

- **Fail-closed**: Si está deshabilitado/mal configurado, las requests fallan (no simulan éxito)
- **No HTML generation**: Supabase templates / provider-managed
- **No PII en logs**: Emails truncados (foo***@)
- **Stable error slugs**: Integrado con Auth Error Handling v2
- **Observability**: Eventos en snake_case, sin PII

---

## Acceptance Criteria

### AC1: Feature Flag Integration
- ✅ Validar `auth_enable_emails` antes de cualquier operación de email
- ✅ Validar `auth_enable_register` para flow de registro
- ✅ Validar `auth_enable_password_recovery` para flow de recovery
- ✅ Fail-closed si flag está deshabilitado

### AC2: Environment Validation
- ✅ Validar `RESEND_API_KEY` presente
- ✅ Validar `AUTH_EMAIL_FROM` presente
- ✅ Validar `SUPABASE_REDIRECT_URL` presente y válido
- ✅ Validar HTTPS en producción para redirect URL
- ✅ Fail-closed si falta configuración

### AC3: PII Protection
- ✅ Emails truncados en logs: `foo***@` (primeros 3 chars)
- ✅ No PII en eventos de analytics
- ✅ `truncateEmailForLog` implementado y usado consistentemente

### AC4: Error Taxonomy
- ✅ `AUTH_EMAIL_DISABLED` - Feature flag deshabilitado
- ✅ `AUTH_EMAIL_SEND_FAILED` - Error genérico de envío
- ✅ `AUTH_EMAIL_RATE_LIMITED` - Rate limit del provider
- ✅ `AUTH_EMAIL_PROVIDER_ERROR` - Error del provider
- ✅ Todos mapeados a `AuthError` con slugs estables

### AC5: Email Flows
- ✅ `assertAuthEmailInfrastructureEnabled` para register
- ✅ `assertAuthEmailInfrastructureEnabled` para recovery
- ✅ Integración con `authService.register` y `authService.requestPasswordRecovery`
- ✅ Provider detection: `resend` (via Supabase SMTP)

### AC6: Observability
- ✅ Evento `auth_email_blocked` cuando email es bloqueado
- ✅ Evento `auth_email_sent` cuando email se envía exitosamente
- ✅ Logs con `warn` level para bloqueos
- ✅ Contexto: `{ flow, email: truncated, request_id, reason }`

### AC7: Tests
- ✅ Tests unitarios para `authEmailService`
- ✅ Tests de integración para register flow
- ✅ Tests de integración para password recovery flow
- ✅ Tests de privacy (PII truncation)
- ✅ Tests de feature flags (disabled → fail-closed)
- ✅ Tests de environment validation

---

## Implementation Plan

### Paso 1: PII Protection Utility
- Crear `utils/pii.ts` con `truncateEmailForLog`
- Formato: primeros 3 caracteres + `***@`
- Tests unitarios

### Paso 2: Error Taxonomy Extension
- Añadir 4 nuevos error slugs a `authErrorTaxonomy.ts`:
  - `AUTH_EMAIL_DISABLED` (403, retryable: false)
  - `AUTH_EMAIL_SEND_FAILED` (500, retryable: true)
  - `AUTH_EMAIL_RATE_LIMITED` (429, retryable: true)
  - `AUTH_EMAIL_PROVIDER_ERROR` (502, retryable: true)
- Actualizar `AUTH_ERROR_CODES` export

### Paso 3: Auth Email Service
- Crear `services/authEmailService.ts`
- Implementar `assertAuthEmailInfrastructureEnabled`
- Validaciones:
  - Feature flags (via `loadAuthFlags`)
  - Environment variables (RESEND_API_KEY, AUTH_EMAIL_FROM, SUPABASE_REDIRECT_URL)
  - HTTPS validation en producción
- Provider detection: `resend`
- Error mapping: `mapProviderError`
- Observability: `trackSafe`, `logContext`

### Paso 4: Integration con Auth Service
- Actualizar `authService.register`:
  - Llamar `assertAuthEmailInfrastructureEnabled('register')` antes de signup
- Actualizar `authService.requestPasswordRecovery`:
  - Llamar `assertAuthEmailInfrastructureEnabled('recovery')` antes de resetPasswordForEmail
- Manejo de errores: propagar `AuthError` con slugs correctos

### Paso 5: Feature Flags
- Actualizar `lib/authFlags.ts`:
  - Añadir `auth_enable_emails` (default: false)
  - Añadir `auth_enable_register` (default: true)
  - Añadir `auth_enable_password_recovery` (default: true)
- Tests para flags

### Paso 6: Tests
- Tests unitarios: `tests/unit/services/authEmailService.test.ts`
- Tests de integración: `tests/unit/services/authService-register.test.ts`
- Tests de privacy: `tests/unit/services/authService-passwordRecovery.privacy.test.ts`
- Tests de feature flags: `tests/unit/lib/authFlags.test.ts`

### Paso 7: Documentation
- Actualizar `docs/SSOT-V2.md` con feature flags de email
- Actualizar `docs/nodes-v2/auth/overview.md`
- Actualizar `docs/nodes-v2/auth/error-taxonomy.md`

---

## Archivos Afectados

### Nuevos
- `apps/backend-v2/src/services/authEmailService.ts`
- `apps/backend-v2/src/utils/pii.ts`
- `apps/backend-v2/tests/unit/services/authEmailService.test.ts`
- `apps/backend-v2/tests/unit/services/authService-passwordRecovery.privacy.test.ts`

### Modificados
- `apps/backend-v2/src/services/authService.ts`
- `apps/backend-v2/src/utils/authErrorTaxonomy.ts`
- `apps/backend-v2/src/lib/authFlags.ts`
- `apps/backend-v2/src/routes/auth.ts`
- `apps/backend-v2/tests/unit/services/authService-register.test.ts`
- `apps/backend-v2/tests/flow/auth-register.endpoint.test.ts`

---

## Validación

### Pre-merge Checklist
- [ ] Todos los tests pasando (197/197)
- [ ] Coverage >= 80% en archivos nuevos
- [ ] No PII en logs (verificado con grep)
- [ ] Feature flags funcionando (enabled/disabled)
- [ ] Error slugs estables y documentados
- [ ] Observability events funcionando
- [ ] SSOT actualizado
- [ ] Nodos GDD actualizados

### Post-merge
- [ ] Verificar que emails se envían en staging
- [ ] Verificar que feature flags funcionan en producción
- [ ] Monitorear eventos de analytics

---

## Referencias

- **ROA-407**: A3 Auth Policy Wiring v2
- **ROA-408**: A4 Auth Rate Limiting & Abuse Wiring v2
- **SSOT-V2**: `docs/SSOT-V2.md`
- **Auth Error Taxonomy**: `apps/backend-v2/src/utils/authErrorTaxonomy.ts`

