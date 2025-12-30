# Issue ROA-408: A4 Auth Rate Limiting & Abuse Wiring v2

## 🎯 Objetivo

Conectar las policies de **Rate Limit & Abuse** (ROA-359) con el **Auth Policy Gate** (A3), asegurando que:

> **"Si llego a ejecutar lógica de Auth, entonces rate limit y abuse ya fueron evaluados y resueltos."**

**⚠️ SCOPE:** Esta issue **NO implementa** rate limiting ni abuse detection. Es **exclusivamente wiring y traducción semántica** dentro del dominio Auth.

---

## 📋 Acceptance Criteria

### AC1: Integración sin Reimplementar Lógica
- ✅ Usar servicios de ROA-359 (rateLimitService, abuseDetectionService)
- ✅ Crear adaptador si interfaz no es compatible
- ✅ NO duplicar lógica de rate limiting
- ✅ NO duplicar lógica de abuse detection

### AC2: Timing y Orden de Evaluación
- ✅ Evaluar políticas DENTRO del Auth Policy Gate (A3)
- ✅ Orden: Feature Flags → Account Status → Rate Limit → Abuse → Auth Logic
- ✅ ANTES de ejecutar lógica de auth (login/register/recovery)

### AC3: Mapeo a Auth Errors (A1)
- ✅ `rate_limited + temporary` → `POLICY_RATE_LIMITED` (retryable: true)
- ✅ `rate_limited + permanent` → `ACCOUNT_BLOCKED` (retryable: false)
- ✅ `abuse_detected` → `POLICY_ABUSE_DETECTED` (retryable: false)

### AC4: Mapping de Acciones
- ✅ Mapeo declarativo Auth Action → rate_limit.action
  - `login` → `auth_login`
  - `register` → `auth_register`
  - `magic_link` → `auth_magic_link`

### AC5: Contexto Mínimo
- ✅ Policy recibe SOLO: `{ action, ip, email?, user_id?, auth_type }`
- ✅ NO tokens
- ✅ NO payload sensible

### AC6: Feature Flags
- ✅ Respetar `ENABLE_RATE_LIMIT` y `ENABLE_ABUSE_DETECTION`
- ✅ Flag OFF → policy se omite explícitamente
- ✅ Error interno con flag ON → fail-closed

### AC7: Fail Semantics
- ✅ Fail-closed por defecto (Redis/Upstash error, timeout, exception)
- ✅ ÚNICA excepción: Feature flag OFF
- ✅ NO fail-open silencioso

### AC8: Observabilidad
- ✅ Logs con `warn` level
- ✅ Sin PII en logs
- ✅ `request_id` obligatorio
- ✅ Contexto: `{ auth_action, auth_type, retryable }`

### AC9: Tests de Integración
- ✅ Login bloqueado por rate limit
- ✅ Recovery bloqueado por abuse
- ✅ Feature flag OFF → no bloquea
- ✅ `retry_after_seconds` se preserva
- ✅ `allowed: true` → Auth continúa
- ✅ Policy order enforcement
- ✅ Fail-closed en cada policy

---

## 🚀 Implementation Plan

### Paso 1: Auth Error Taxonomy (A1)
- Añadir 3 nuevos error slugs:
  - `POLICY_RATE_LIMITED` (429, retryable: true)
  - `POLICY_ABUSE_DETECTED` (403, retryable: false)
  - `ACCOUNT_BLOCKED` (403, retryable: false)
- Actualizar `AUTH_ERROR_CODES` export

### Paso 2: Adaptador de Abuse Detection
- Crear `abuseDetectionServiceAdapter.ts`
- Adaptar `recordAttempt` + `isAbusive` → `checkRequest`
- Interface compatible con authPolicyGate
- Solo traducción, NO lógica

### Paso 3: Wiring en Auth Policy Gate (A3)
- Modificar `checkRateLimit()`:
  - Verificar `ENABLE_RATE_LIMIT` flag
  - Usar `rateLimitService` de ROA-359
  - Fail-closed si error
- Modificar `checkAbuse()`:
  - Verificar `ENABLE_ABUSE_DETECTION` flag
  - Usar `abuseDetectionServiceAdapter`
  - Fail-closed si error

### Paso 4: Tests de Integración
- Actualizar mocks en `authPolicyGate.test.ts`
- Añadir tests de feature flags:
  - Flag OFF → permite acción
  - Flag ON + rate limit exceeded → bloquea
  - Flag ON + abuse detected → bloquea
- Verificar fail-closed scenarios

### Paso 5: Documentación
- Crear `docs/A4-AUTH-RATE-LIMIT-ABUSE-WIRING.md`
- Documentar:
  - Arquitectura del wiring
  - Pipeline de evaluación
  - Contratos de entrada/salida
  - Fail semantics
  - Testing scope

---

## 🛡️ Constraints

### PROHIBIDO (Blocker si se hace)
- ❌ Implementar rate limiting desde cero
- ❌ Implementar abuse detection desde cero
- ❌ Añadir middlewares fuera del A3 gate
- ❌ Introducir fail-open silencioso
- ❌ Cambiar contratos de ROA-359
- ❌ Añadir lógica de UI, admin o dashboards

### PERMITIDO
- ✅ Crear adaptadores de interfaz
- ✅ Añadir error slugs a taxonomy
- ✅ Modificar authPolicyGate (solo wiring)
- ✅ Tests de integración Auth ↔ Policy
- ✅ Documentación de wiring

---

## 📦 Entregables

1. ✅ `authErrorTaxonomy.ts` - 3 nuevos error slugs
2. ✅ `abuseDetectionServiceAdapter.ts` - Adaptador de interfaz
3. ✅ `authPolicyGate.ts` - Wiring de rate limit & abuse
4. ✅ `authPolicyGate.test.ts` - Tests de integración actualizados
5. ✅ `docs/A4-AUTH-RATE-LIMIT-ABUSE-WIRING.md` - Documentación

---

## 🔗 Dependencies

- ✅ **ROA-359:** Rate Limiting & Abuse Detection (mergeada en main)
- ✅ **ROA-407:** A3 Auth Policy Gate (mergeada en main)
- ✅ **ROA-405:** Auth Error Taxonomy v2 (mergeada en main)

---

## ✅ Definition of Done

- [ ] Feature flag checks implementados (`ENABLE_RATE_LIMIT`, `ENABLE_ABUSE_DETECTION`)
- [ ] Wiring correcto en A3 (después de Feature Flags y Account Status)
- [ ] Traducción clara a Auth errors (3 nuevos slugs)
- [ ] Tests de integración pasando (25/25)
- [ ] Fail-closed enforcement validado
- [ ] Sin fail-open silencioso
- [ ] Documentación completa
- [ ] CI/CD passing (todos los checks)
- [ ] CodeRabbit: 0 comentarios
- [ ] No hardcoded values
- [ ] No legacy v1 references

---

**Issue ROA-408 - Wiring y Traducción Semántica SOLO**
