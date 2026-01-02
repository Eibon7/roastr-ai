# Plan: ROA-371 - Email Password Recovery Complete Implementation

**Issue:** ROA-371  
**Título:** Email Password Recovery  
**Prioridad:** P1  
**Owner:** Back-end Dev + Frontend Dev  
**Fecha:** 2026-01-02

---

## Estado Actual (Assessment)

### ✅ Lo que YA EXISTÍA

**Backend v2:**
1. ✅ Endpoint `POST /api/v2/auth/password-recovery` implementado (routes/auth.ts:389-455)
2. ✅ Servicio `authService.requestPasswordRecovery()` implementado (authService.ts:675-778)
3. ✅ Email service `authEmailService.sendPasswordRecoveryEmailAfterPreflight()` (authEmailService.ts:163-238)
4. ✅ Tests unitarios: `authService-passwordRecovery.privacy.test.ts` (privacy/anti-enumeration)
5. ✅ Tests de email service: `authEmailService.test.ts`
6. ✅ Feature flags: `auth_enable_password_recovery` configurado
7. ✅ Rate limiting: 3 intentos / 1 hora
8. ✅ Anti-enumeration: Respuesta homogénea independientemente de si el email existe
9. ✅ Fail-closed: Si infra de email está deshabilitada, falla (no simula éxito)

**Scripts de prueba:**
- ✅ `apps/backend-v2/scripts/test-password-recovery.ts` (script manual de prueba)

### ❌ Lo que FALTABA

1. ❌ **Frontend API Integration**
   - `recover.tsx` tenía TODO comentado
   - No había método `authApi.recoverPassword()` en `lib/api.ts`
   - No había método `authApi.updatePassword()` en `lib/api.ts`

2. ❌ **Frontend Reset Password Page**
   - No existía página para manejar token del email
   - No había formulario para establecer nueva contraseña

3. ❌ **Backend Update Password Endpoint**
   - No existía endpoint `POST /api/v2/auth/update-password`
   - No había método `authService.updatePassword()` para actualizar contraseña con token

4. ❌ **Documentación Completa**
   - No había sección dedicada para Password Recovery en `docs/nodes-v2/auth/login-flows.md`
   - Faltaba diagrama de flujo completo
   - Faltaba documentación de request/response
   - Faltaba documentación de rate limiting específico
   - Faltaba documentación de feature flags
   - Faltaba documentación de observability

5. ⚠️ **Tests de Integración HTTP**
   - No había tests HTTP endpoints para password-recovery
   - No había tests de integración completos para el flujo completo

---

## Objetivo

Completar la implementación del flujo de recuperación de contraseña por email con:

- **Frontend completo**: Integración API + página de reset de contraseña
- **Backend completo**: Endpoint para actualizar contraseña con token
- **Tests completos**: HTTP endpoints + integración end-to-end
- **Documentación completa**: Flujo completo documentado en GDD nodes

---

## Acceptance Criteria

### AC1: Frontend API Integration
- ✅ Método `authApi.recoverPassword(email)` implementado
- ✅ Método `authApi.updatePassword(accessToken, password)` implementado
- ✅ `recover.tsx` integrado con API real (TODO removido)
- ✅ Manejo de errores mejorado (403, 429, anti-enumeration)

### AC2: Frontend Reset Password Page
- ✅ Página `reset-password.tsx` creada
- ✅ Extracción de token de URL query parameters
- ✅ Validación de token antes de mostrar formulario
- ✅ Formulario de nueva contraseña con confirmación
- ✅ Validación de contraseña (mínimo 8 caracteres)
- ✅ Integración con `authApi.updatePassword()`
- ✅ Manejo de errores (token inválido, expirado, validación)
- ✅ Estado de éxito con redirección automática a login
- ✅ Ruta `/reset-password` configurada en App.tsx

### AC3: Backend Update Password Endpoint
- ✅ Endpoint `POST /api/v2/auth/update-password` implementado
- ✅ Rate limiting: 5 intentos en 1 hora
- ✅ Validación de payload (access_token, password requeridos)
- ✅ Validación de password (mínimo 8 caracteres, máximo 128)
- ✅ Policy gate integration (A3)
- ✅ Error handling con AuthError taxonomy

### AC4: Backend Update Password Service
- ✅ Método `authService.updatePassword(accessToken, newPassword)` implementado
- ✅ Validación de token usando `supabase.auth.getUser()`
- ✅ Actualización de contraseña usando `supabase.auth.admin.updateUserById()`
- ✅ Manejo de errores (token inválido, expirado)
- ✅ Logging con PII truncation

### AC5: HTTP Endpoint Tests
- ✅ Test: Validación de payload (400 INVALID_REQUEST)
- ✅ Test: Respuesta exitosa con anti-enumeration (200)
- ✅ Test: Mapeo de errores (AuthError)

### AC6: Integration Tests
- ✅ Tests de integración completos (8 tests)
- ✅ Envío de email de recuperación
- ✅ Validación de payload
- ✅ Actualización de contraseña con token válido
- ✅ Validación de password (muy corta)
- ✅ Validación de campos requeridos
- ✅ Manejo de token inválido
- ✅ Manejo de token expirado
- ✅ Fail-closed cuando email infra está deshabilitada

### AC7: Documentación
- ✅ Sección completa "Password Recovery" en `docs/nodes-v2/auth/login-flows.md`
  - Endpoint y contrato request/response
  - Diagrama de flujo completo (mermaid)
  - Rate limiting configuration (3 intentos / 1 hora)
  - Feature flags requeridos (`auth_enable_password_recovery`, `auth_enable_emails`)
  - Restricciones (admin/superadmin no pueden usar)
  - Redirect URL configuration
  - Observability events
  - Security patterns (anti-enumeration, fail-closed)
- ✅ Actualizado `docs/nodes-v2/auth/overview.md` para incluir Password Recovery
- ✅ `docs/test-evidence/ROA-371/SUMMARY.md` creado
- ✅ `CHANGELOG-ROA-371.md` creado

---

## Pasos de Implementación

### Fase 1: Frontend API Integration (30 min)

**Archivos modificados:**
- `frontend/src/lib/api.ts` - Añadir métodos `recoverPassword()` y `updatePassword()`
- `frontend/src/pages/auth/recover.tsx` - Remover TODO, integrar con API

**Tareas:**
1. Añadir `authApi.recoverPassword(email)` método
2. Añadir `authApi.updatePassword(accessToken, password)` método
3. Actualizar `recover.tsx` para usar `authApi.recoverPassword()`
4. Mejorar manejo de errores (403, 429, anti-enumeration)

### Fase 2: Frontend Reset Password Page (45 min)

**Archivos creados:**
- `frontend/src/pages/auth/reset-password.tsx` (nuevo)

**Archivos modificados:**
- `frontend/src/App.tsx` - Añadir ruta `/reset-password`

**Tareas:**
1. Crear página `reset-password.tsx` con:
   - Extracción de token de URL query parameters
   - Validación de token
   - Formulario de nueva contraseña
   - Validación de contraseña
   - Integración con `authApi.updatePassword()`
   - Manejo de errores
   - Estado de éxito con redirección
2. Añadir ruta en `App.tsx`

### Fase 3: Backend Update Password (45 min)

**Archivos modificados:**
- `apps/backend-v2/src/routes/auth.ts` - Añadir endpoint `/update-password`
- `apps/backend-v2/src/services/authService.ts` - Añadir método `updatePassword()`

**Tareas:**
1. Crear endpoint `POST /api/v2/auth/update-password`:
   - Rate limiting (5 intentos / 1 hora)
   - Validación de payload
   - Policy gate integration
   - Error handling
2. Crear método `authService.updatePassword()`:
   - Validación de token
   - Actualización de contraseña con Supabase Admin API
   - Manejo de errores
   - Logging

### Fase 4: Tests (60 min)

**Archivos creados:**
- `apps/backend-v2/tests/integration/auth/password-recovery.test.ts` (nuevo)

**Archivos modificados:**
- `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts` - Añadir 3 tests HTTP

**Tareas:**
1. Añadir tests HTTP endpoints (3 tests)
2. Crear tests de integración (8 tests)
3. Mockear correctamente todos los servicios necesarios
4. Verificar que todos los tests pasan

### Fase 5: Documentación (45 min)

**Archivos modificados:**
- `docs/nodes-v2/auth/login-flows.md` - Añadir sección Password Recovery
- `docs/nodes-v2/auth/overview.md` - Actualizar lista de flujos

**Archivos creados:**
- `docs/test-evidence/ROA-371/SUMMARY.md` (nuevo)
- `CHANGELOG-ROA-371.md` (nuevo)
- `docs/plan/issue-ROA-371.md` (este archivo)

**Tareas:**
1. Añadir sección completa en `login-flows.md`
2. Actualizar `overview.md`
3. Crear test evidence document
4. Crear CHANGELOG
5. Crear plan document (este archivo)

---

## Resultados Finales

### Archivos Modificados

**Backend:**
- `apps/backend-v2/src/routes/auth.ts` (+90 líneas)
- `apps/backend-v2/src/services/authService.ts` (+60 líneas)
- `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts` (+30 líneas)
- `apps/backend-v2/tests/integration/auth/password-recovery.test.ts` (nuevo, 270 líneas)

**Frontend:**
- `frontend/src/lib/api.ts` (+30 líneas)
- `frontend/src/pages/auth/recover.tsx` (modificado, TODO removido)
- `frontend/src/pages/auth/reset-password.tsx` (nuevo, 280 líneas)
- `frontend/src/App.tsx` (+2 líneas)

**Documentación:**
- `docs/nodes-v2/auth/login-flows.md` (+200 líneas)
- `docs/nodes-v2/auth/overview.md` (+5 líneas)
- `docs/test-evidence/ROA-371/SUMMARY.md` (nuevo, 250 líneas)
- `CHANGELOG-ROA-371.md` (nuevo, 300 líneas)
- `docs/plan/issue-ROA-371.md` (este archivo, nuevo)

### Tests

- ✅ HTTP Endpoint Tests: 3/3 pasando
- ✅ Integration Tests: 8/8 pasando
- ✅ Total: 11 nuevos tests, todos pasando

### CI/CD Status

- ✅ Build Check: SUCCESS
- ✅ Security Audit: SUCCESS
- ✅ Lint and Test: SUCCESS
- ✅ GDD Validation: SUCCESS
- ✅ Guardian Check: SUCCESS
- ✅ SSOT Validation: SUCCESS
- ✅ System Map Consistency: SUCCESS

---

## Criterios de Éxito

- ✅ Frontend completamente funcional (request + reset)
- ✅ Backend completamente funcional (recovery + update)
- ✅ Tests completos (HTTP + integration)
- ✅ Documentación completa (GDD nodes + test evidence + changelog)
- ✅ CI/CD pasando (todos los checks)
- ✅ Plan document creado (este archivo)

---

## Referencias

- **Endpoint Recovery:** `apps/backend-v2/src/routes/auth.ts:389-455`
- **Endpoint Update:** `apps/backend-v2/src/routes/auth.ts:541-595`
- **Service Recovery:** `apps/backend-v2/src/services/authService.ts:675-778`
- **Service Update:** `apps/backend-v2/src/services/authService.ts:948-1010`
- **Email Service:** `apps/backend-v2/src/services/authEmailService.ts:163-238`
- **Tests Integration:** `apps/backend-v2/tests/integration/auth/password-recovery.test.ts`
- **Tests HTTP:** `apps/backend-v2/tests/flow/auth-http.endpoints.test.ts:322-352`
- **Documentación:** `docs/nodes-v2/auth/login-flows.md` (sección Password Recovery)
- **Test Evidence:** `docs/test-evidence/ROA-371/SUMMARY.md`
- **CHANGELOG:** `CHANGELOG-ROA-371.md`

---

**Última actualización:** 2026-01-02  
**Status:** ✅ COMPLETO
