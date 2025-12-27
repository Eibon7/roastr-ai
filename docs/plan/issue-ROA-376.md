# Plan de Implementación: ROA-376 - B3 Register Analytics Implementation

**Issue:** ROA-376  
**Título:** B3-register-analytics-implementation  
**Prioridad:** P2  
**Tipo:** backend, analytics, observability  
**Fecha:** 2025-12-27

---

## Estado Actual

- ✅ Amplitude Analytics ya está integrado en backend-v2 (`src/lib/analytics.ts`)
- ✅ Analytics ya implementado para LOGIN (referencia: auth-login.flow.test.ts)
- ✅ Endpoint `/register` existe y funciona (`src/routes/auth.ts:34-125`)
- ✅ `authService.register()` existe y funciona (`src/services/authService.ts:65-126`)
- ❌ NO hay trackEvent en el flujo de registro
- ❌ NO hay tests que validen analytics para registro

## Objetivo

Implementar analytics (Amplitude) para el flujo de **registro** (`POST /api/v2/auth/register`), tracking eventos de éxito y fallo según el patrón ya establecido en login.

---

## Pasos de Implementación

### Paso 1: Integrar `trackEvent` en `authService.register()`

**Archivo:** `apps/backend-v2/src/services/authService.ts`

**Cambios:**
1. Importar `trackEvent` desde `../lib/analytics.js`
2. Añadir eventos de analytics:
   - **auth_register_success**: Cuando el registro es exitoso (después de crear perfil)
   - **auth_register_failed**: Cuando hay error (en el catch)

**Propiedades de eventos:**
- `flow`: 'auth'
- `method`: 'email_password'
- `error_code`: (solo en failed)
- `error_message`: (solo en failed, sin PII)

**Ejemplo:**
```typescript
// En success path (línea ~119)
trackEvent({
  userId: data.user.id,
  event: 'auth_register_success',
  properties: {
    method: 'email_password'
  },
  context: {
    flow: 'auth'
  }
});

// En error path (catch block, línea ~120-124)
trackEvent({
  event: 'auth_register_failed',
  properties: {
    error_code: error instanceof AuthError ? error.code : 'UNKNOWN',
    method: 'email_password'
  },
  context: {
    flow: 'auth'
  }
});
```

---

### Paso 2: Integrar `trackEvent` en route `/api/v2/auth/register`

**Archivo:** `apps/backend-v2/src/routes/auth.ts`

**Cambios:**
1. Importar `trackEvent` desde `../lib/analytics.js`
2. Añadir evento adicional en success path (línea ~113):
   - **auth_register_endpoint_success**
3. Añadir evento en error path (línea ~117-123):
   - **auth_register_endpoint_failed**

**Propiedades de eventos:**
- `flow`: 'auth'
- `endpoint`: '/api/v2/auth/register'
- `status_code`: HTTP status code
- `error_type`: (solo en failed)

---

### Paso 3: Tests Unitarios para Analytics

**Archivo:** `apps/backend-v2/tests/unit/services/authService-register.test.ts`

**Tests a añadir:**
1. ✅ `trackEvent` se llama con `auth_register_success` en registro exitoso
2. ✅ `trackEvent` se llama con `auth_register_failed` en error
3. ✅ Evento incluye `userId` en success
4. ✅ Evento incluye `error_code` en failed
5. ✅ NO se trackea PII (email, password)

**Estrategia:**
- Mock `@amplitude/analytics-node`
- Verificar que `amplitude.track()` se llama con parámetros correctos
- Asegurar que NO se envía información sensible

---

### Paso 4: Test de Flujo End-to-End

**Archivo:** `apps/backend-v2/tests/flow/auth-register.endpoint.test.ts`

**Tests a añadir:**
1. ✅ Registro exitoso trackea evento `auth_register_success`
2. ✅ Registro con email duplicado trackea evento `auth_register_failed`
3. ✅ Validación de formato trackea evento con error_code correcto
4. ✅ Analytics NO crashea el flujo si falla (graceful degradation)

**Principios (según auth-login.flow.test.ts):**
- Validar resultados observables (estado, eventos)
- Mock mínimo de dependencias externas
- NO asserts de logs o payloads internos
- Si cambiar implementación rompe el test sin romper el flujo, el test está mal

---

### Paso 5: Validación

**Scripts a ejecutar:**
```bash
# 1. Tests unitarios
npm test -- authService-register.test.ts

# 2. Tests de flujo
npm test -- auth-register.endpoint.test.ts

# 3. Validación v2
node scripts/validate-v2-doc-paths.js --ci
node scripts/validate-ssot-health.js --ci
node scripts/check-system-map-drift.js --ci
node scripts/validate-strong-concepts.js --ci

# 4. Coverage
npm run test:coverage -- --testPathPattern=register
```

**Criterios de éxito:**
- ✅ Tests passing al 100%
- ✅ Coverage ≥90% en archivos modificados
- ✅ NO hay llamadas con PII
- ✅ Eventos siguen naming convention (snake_case)
- ✅ Validadores v2 passing

---

## Archivos Afectados

**Implementación:**
- `apps/backend-v2/src/services/authService.ts` (añadir trackEvent)
- `apps/backend-v2/src/routes/auth.ts` (añadir trackEvent)

**Tests:**
- `apps/backend-v2/tests/unit/services/authService-register.test.ts` (ampliar)
- `apps/backend-v2/tests/flow/auth-register.endpoint.test.ts` (ampliar)

**Documentación:**
- `docs/agents/receipts/cursor-test-engineer-[timestamp].md` (receipt)
- `docs/plan/issue-ROA-376.md` (este archivo)

---

## Agentes Relevantes

- **TestEngineer**: Generación de tests + validación de coverage
- **Guardian**: Validación de que NO se trackea PII

---

## Referencias

- **Issue:** https://linear.app/roastrai/issue/ROA-376
- **Analytics module:** `apps/backend-v2/src/lib/analytics.ts`
- **Test pattern:** `apps/backend-v2/tests/flow/auth-login.flow.test.ts`
- **Amplitude conventions:** `apps/backend-v2/README.md` (Analytics section)
- **SSOT v2:** `docs/SSOT-V2.md` (section 15: Observability)

---

## Notas

- Seguir el mismo patrón que login (auth-login.flow.test.ts)
- NUNCA trackear PII (email, password, IP)
- Eventos en snake_case: `auth_register_success`, `auth_register_failed`
- Context flow: 'auth'
- Graceful degradation: analytics failures NO deben crashear el registro

