# Plan de Implementación: ROA-396 — Policy Observability & Audit (V2)

**Issue:** ROA-396  
**Fecha:** 2026-01-05  
**Owner:** Back-end Dev  
**Prioridad:** P1

---

## Contexto

Auth Infra v2 está implementado (ROA-407) con:
- ✅ AuditService (admin_audit_logs)
- ✅ RateLimiterService (sliding window)
- ✅ Policy Enforcement Middleware
- ✅ AuthError Taxonomy

**Problema:** Falta observabilidad real de decisiones de policy a nivel de analytics y telemetría.

Las decisiones de policy (feature flags, account status, rate limits) se auditan en `admin_audit_logs` pero:
- ❌ No hay eventos estructurados para analytics
- ❌ No hay telemetría para métricas agregadas
- ❌ No hay visibilidad de "por qué" se bloqueó un request

---

## Objetivo

Hacer visibles y auditables TODAS las decisiones de policy que afectan a Auth, sin cambiar semántica ni lógica de negocio.

**Scope:**
- ✅ Emitir evento `policy_decision_made` en cada decisión de policy
- ✅ Logs estructurados (info/warn) según decisión
- ✅ Integración en auth routes existentes (login, register, password-recovery, magic-link)
- ❌ NO nuevas policies
- ❌ NO cambios en lógica de decisión
- ❌ NO UI
- ❌ NO PII en eventos

---

## Qué Decisiones Se Observan

### 1. Feature Flag Gating

**Policy:** `feature_flag`  
**Decisiones:**
- `allowed` - Feature habilitado
- `blocked` - Feature deshabilitado

**Flows afectados:**
- `login` - `auth_enable_login`
- `register` - `auth_enable_register`
- `magic_link` - `auth_enable_magic_link`
- `password_recovery` - `auth_enable_password_recovery`

**Reasons:**
- `feature_disabled` - Feature flag = false

---

### 2. Account Status Check

**Policy:** `account_status`  
**Decisiones:**
- `allowed` - Cuenta activa
- `blocked` - Cuenta suspendida/baneada/eliminada

**Flows afectados:**
- `login` - Verificar estado de cuenta

**Reasons:**
- `account_suspended`
- `account_banned`
- `account_deleted`

---

### 3. Rate Limit Enforcement

**Policy:** `rate_limit`  
**Decisiones:**
- `allowed` - Dentro del límite
- `blocked` - Límite excedido

**Flows afectados:**
- `login` - 5 intentos / 15 min
- `register` - 3 intentos / 1 hora
- `magic_link` - 3 intentos / 1 hora
- `password_recovery` - 3 intentos / 1 hora

**Reasons:**
- `rate_limit_exceeded`

---

### 4. Auth Policy Gate (ROA-407)

**Policy:** `auth_policy_gate`  
**Decisiones:**
- `allowed` - Policy check pasado
- `blocked` - Policy check fallido

**Flows afectados:**
- Todos los flows de auth

**Reasons:**
- `policy_check_failed`

---

## Dónde Se Emiten

### 1. Auth Entrypoint (Routes)

**Ubicación:** `apps/backend-v2/src/routes/auth.ts`

**Puntos de emisión:**
- Después de `isAuthEndpointEnabled()` (feature flag)
- Después de `rateLimitByType()` (rate limit)
- Después de `checkAuthPolicy()` (auth policy gate)

**Ejemplo:**
```typescript
// En /login
try {
  await isAuthEndpointEnabled('auth_enable_login', 'auth_enable_login')
    .catch((err) => {
      // ✅ EMITIR: policy_decision_made (feature_flag, blocked, feature_disabled)
      throw err;
    });

  // ✅ EMITIR: policy_decision_made (feature_flag, allowed, null)

  const policyResult = await checkAuthPolicy({ action: 'login', ip, userAgent });

  if (!policyResult.allowed) {
    // ✅ EMITIR: policy_decision_made (auth_policy_gate, blocked, policy_check_failed)
    throw new AuthError(AUTH_ERROR_CODES.AUTH_DISABLED);
  }

  // ✅ EMITIR: policy_decision_made (auth_policy_gate, allowed, null)

  const result = await authService.login({ email, password, ip });

  res.json(result);
} catch (error) {
  return sendAuthError(req, res, error);
}
```

---

### 2. Policy Enforcement Middleware

**Ubicación:** `apps/backend-v2/src/middleware/policyEnforcement.ts`

**Punto de emisión:**
- Después de rate limit check

**Ejemplo:**
```typescript
if (!result.allowed) {
  // ✅ EMITIR: policy_decision_made (rate_limit, blocked, rate_limit_exceeded)
  return res.status(429).json({
    success: false,
    error: { slug: 'POLICY_RATE_LIMITED', retryable: true },
    request_id
  });
}

// ✅ EMITIR: policy_decision_made (rate_limit, allowed, null)
```

---

## Qué NO Se Observa

### Payloads

❌ NO loggear:
- Email/password
- Tokens
- Magic links
- Reset tokens

### PII

❌ NO loggear:
- User names
- User emails (solo IP truncado)
- Personal data

### Heurísticas Internas

❌ NO loggear:
- Detalles internos de rate limit (sliding window state)
- Detalles internos de auth policy gate (heurísticas)
- Valores de feature flags (solo si enabled/disabled)

---

## Estructura del Evento

### Evento: `policy_decision_made`

**Payload:**
```typescript
{
  flow: 'login' | 'register' | 'password_recovery' | 'magic_link' | 'token_refresh',
  policy: 'feature_flag' | 'account_status' | 'rate_limit' | 'auth_policy_gate',
  decision: 'allowed' | 'blocked',
  reason?: string,          // slug estable (feature_disabled, rate_limit_exceeded, etc.)
  retryable: boolean,
  request_id: string
}
```

**Reglas:**
- snake_case
- Reason SIEMPRE slug estable (NO mensajes humanos)
- NO PII
- retryable: true si puede reintentar después

---

## Implementación

### Paso 1: Crear `policyObservability.ts`

**Ubicación:** `apps/backend-v2/src/lib/policyObservability.ts`

**Responsabilidad:**
- Emitir evento `policy_decision_made`
- Log estructurado (info/warn)
- Integración con analytics (Amplitude)

**API:**
```typescript
export function emitPolicyDecision(params: {
  flow: string;
  policy: string;
  decision: 'allowed' | 'blocked';
  reason?: string;
  retryable: boolean;
  request_id: string;
}): void {
  // 1. Log estructurado (info si allowed, warn si blocked)
  // 2. Emitir evento a analytics (si inicializado)
  // 3. NO bloquear response (async)
}
```

---

### Paso 2: Integrar en Auth Routes

**Archivos a modificar:**
- `apps/backend-v2/src/routes/auth.ts`

**Puntos de integración:**
- `/login` - feature flag, auth policy gate, rate limit
- `/register` - feature flag, auth policy gate, rate limit
- `/magic-link` - feature flag, auth policy gate, rate limit
- `/password-recovery` - feature flag, auth policy gate, rate limit
- `/update-password` - feature flag, auth policy gate, rate limit

**Ejemplo:**
```typescript
// Después de isAuthEndpointEnabled
await isAuthEndpointEnabled('auth_enable_login', 'auth_enable_login')
  .then(() => {
    emitPolicyDecision({
      flow: 'login',
      policy: 'feature_flag',
      decision: 'allowed',
      retryable: false,
      request_id
    });
  })
  .catch((err) => {
    emitPolicyDecision({
      flow: 'login',
      policy: 'feature_flag',
      decision: 'blocked',
      reason: 'feature_disabled',
      retryable: true,
      request_id
    });
    throw err;
  });
```

---

### Paso 3: Integrar en Policy Enforcement Middleware

**Archivo a modificar:**
- `apps/backend-v2/src/middleware/policyEnforcement.ts`

**Punto de integración:**
- Después de rate limit check

**Ejemplo:**
```typescript
const result = await rateLimiterService.checkLimit(key, config);

if (!result.allowed) {
  emitPolicyDecision({
    flow: req.body.flow || 'unknown',
    policy: 'rate_limit',
    decision: 'blocked',
    reason: 'rate_limit_exceeded',
    retryable: true,
    request_id
  });
  // ... rest of error handling
}

emitPolicyDecision({
  flow: req.body.flow || 'unknown',
  policy: 'rate_limit',
  decision: 'allowed',
  retryable: false,
  request_id
});
```

---

## Tests (Mínimos)

### Contrato de Evento

**Archivo:** `apps/backend-v2/tests/unit/lib/policyObservability.test.ts`

**Tests:**
1. ✅ Evento se emite al permitir (decision: allowed)
2. ✅ Evento se emite al bloquear (decision: blocked)
3. ✅ `reason` es slug estable (NO mensaje humano)
4. ✅ `retryable` es booleano correcto
5. ✅ NO hay PII en payload (email, password, tokens)
6. ✅ Logs estructurados tienen nivel correcto (info/warn)

---

### Integration Tests

**Archivo:** `apps/backend-v2/tests/flow/auth-policy-observability.test.ts`

**Tests:**
1. ✅ Feature flag disabled emite evento blocked
2. ✅ Rate limit excedido emite evento blocked
3. ✅ Auth policy gate blocked emite evento blocked
4. ✅ Flow completo emite eventos allowed

---

## Validación

### Pre-commit

```bash
# Validar estructura de docs v2
node scripts/validate-v2-doc-paths.js --ci

# Validar SSOT health
node scripts/validate-ssot-health.js --ci

# Validar drift de system-map
node scripts/check-system-map-drift.js --ci
```

### Post-implementation

```bash
# Tests unitarios
npm test -- tests/unit/lib/policyObservability.test.ts

# Tests de integración
npm test -- tests/flow/auth-policy-observability.test.ts

# Coverage
npm run test:coverage -- policyObservability
```

---

## Qué Queda para ROA-392

ROA-392 (Analytics v2 Integration) se encargará de:
- Dashboard de métricas de policy
- Agregación de eventos por flow/policy/decision
- Alerting cuando decision: blocked excede threshold
- Retention de eventos según GDPR
- Export de eventos para compliance

**Esta issue (ROA-396) solo emite los eventos. ROA-392 los consume.**

---

## Archivos Afectados

### Nuevos
- `apps/backend-v2/src/lib/policyObservability.ts`
- `apps/backend-v2/tests/unit/lib/policyObservability.test.ts`
- `apps/backend-v2/tests/flow/auth-policy-observability.test.ts`

### Modificados
- `apps/backend-v2/src/routes/auth.ts`
- `apps/backend-v2/src/middleware/policyEnforcement.ts` (opcional, si integrar)

---

## Agentes Relevantes

- **Back-end Dev:** Implementación de observability hooks
- **Test Engineer:** Tests de contrato y flow
- **Guardian:** Validación de no-PII y compliance

---

**Última actualización:** 2026-01-05  
**Estado:** Ready for implementation

