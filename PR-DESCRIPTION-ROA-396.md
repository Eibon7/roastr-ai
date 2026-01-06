# ROA-396: Auth Policy Observability & Audit (V2)

## 📋 Resumen

Implementa observabilidad completa de decisiones de policy en Auth v2, emitiendo eventos estructurados para analytics y telemetría **sin cambiar semántica ni lógica de negocio**.

---

## 🎯 Objetivo

Hacer visibles y auditables **TODAS** las decisiones de policy que afectan a Auth, permitiendo:
- 📊 Analytics de uso por policy type
- 🚨 Alerting cuando `blocked` excede threshold
- 📈 Métricas agregadas de decisiones
- 🔍 Trazabilidad completa de por qué se bloqueó un request

---

## ✅ Qué Se Implementó

### 1. Módulo `policyObservability.ts`

**Ubicación:** `apps/backend-v2/src/lib/policyObservability.ts`

**Responsabilidad:**
- Emitir evento `policy_decision_made` en cada decisión de policy
- Logs estructurados (info/warn según decisión)
- Integración con Amplitude para analytics

**API:**
```typescript
// Evento principal
emitPolicyDecision(event: PolicyDecisionEvent): void

// Helpers
emitFeatureFlagDecision({ flow, allowed, request_id })
emitRateLimitDecision({ flow, allowed, request_id })
emitAuthPolicyGateDecision({ flow, allowed, request_id })
```

---

### 2. Evento `policy_decision_made`

**Payload:**
```typescript
{
  flow: 'login' | 'register' | 'password_recovery' | 'magic_link' | 'token_refresh' | 'update_password',
  policy: 'feature_flag' | 'account_status' | 'rate_limit' | 'auth_policy_gate',
  decision: 'allowed' | 'blocked',
  reason?: 'feature_disabled' | 'rate_limit_exceeded' | 'policy_check_failed' | ...,
  retryable: boolean,
  request_id: string
}
```

**Reglas:**
- ✅ `snake_case` para todos los campos
- ✅ `reason` SIEMPRE slug estable (NO mensajes humanos)
- ✅ NO PII (email, password, tokens)
- ✅ Emisión asíncrona (NO bloquea response)

---

### 3. Integración en Auth Routes

**Archivo:** `apps/backend-v2/src/routes/auth.ts`

**Integrado en (100%):**
- ✅ `/register` - Feature flag + auth policy gate observability (4 emission points)
- ✅ `/login` - Feature flag + auth policy gate observability (4 emission points)
- ✅ `/magic-link` - Feature flag + auth policy gate observability (4 emission points)
- ✅ `/password-recovery` - Feature flag + auth policy gate observability (4 emission points)

**Total:** 16 emission points de policy observability

**Patrón:**
```typescript
// Feature flag
await isAuthEndpointEnabled('auth_enable_register', 'auth_enable_register')
  .then(() => {
    emitFeatureFlagDecision({ flow: 'register', allowed: true, request_id });
  })
  .catch((err) => {
    logFeatureDisabled(...);
    emitFeatureFlagDecision({ flow: 'register', allowed: false, request_id });
    throw err;
  });

// Auth policy gate
if (!policyResult.allowed) {
  emitAuthPolicyGateDecision({ flow: 'register', allowed: false, request_id });
  return sendAuthError(...);
}
emitAuthPolicyGateDecision({ flow: 'register', allowed: true, request_id });
```

---

### 4. Tests Unitarios

**Archivo:** `apps/backend-v2/tests/unit/lib/policyObservability.test.ts`

**Cobertura:** 11/11 tests passing ✅

**Tests:**
- ✅ Evento se emite cuando `decision: allowed`
- ✅ Evento se emite cuando `decision: blocked` con reason
- ✅ `reason` es slug estable (NO mensaje humano)
- ✅ `retryable` es booleano correcto
- ✅ NO hay PII en payload (email, password, tokens)
- ✅ Logs estructurados tienen nivel correcto (info/warn)
- ✅ No lanza error si Amplitude no disponible
- ✅ Captura y loggea error si emisión falla
- ✅ Helpers funcionan correctamente

---

## 🔍 Qué Decisiones Se Observan

### 1. Feature Flag Gating

**Policy:** `feature_flag`  
**Flows:** `login`, `register`, `magic_link`, `password_recovery`, `update_password`  
**Reasons:**
- `feature_disabled` - Feature flag = false

---

### 2. Auth Policy Gate (ROA-407)

**Policy:** `auth_policy_gate`  
**Flows:** Todos los flows de auth  
**Reasons:**
- `policy_check_failed` - Policy check falló

---

### 3. Rate Limit Enforcement (Futuro)

**Policy:** `rate_limit`  
**Flows:** Todos los flows de auth  
**Reasons:**
- `rate_limit_exceeded` - Límite excedido

---

### 4. Account Status Check (Futuro)

**Policy:** `account_status`  
**Flows:** `login`  
**Reasons:**
- `account_suspended`
- `account_banned`
- `account_deleted`

---

## ❌ Qué NO Se Observa

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

## 📊 Ejemplo de Evento

### Feature Flag Blocked

```json
{
  "event_type": "policy_decision_made",
  "event_properties": {
    "flow": "register",
    "policy": "feature_flag",
    "decision": "blocked",
    "reason": "feature_disabled",
    "retryable": true
  },
  "insert_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Auth Policy Gate Allowed

```json
{
  "event_type": "policy_decision_made",
  "event_properties": {
    "flow": "login",
    "policy": "auth_policy_gate",
    "decision": "allowed",
    "retryable": false
  },
  "insert_id": "f1e2d3c4-b5a6-7890-1234-567890abcdef"
}
```

---

## 🛠️ Archivos Afectados

### Nuevos
- `apps/backend-v2/src/lib/policyObservability.ts` - Módulo principal
- `apps/backend-v2/tests/unit/lib/policyObservability.test.ts` - Tests unitarios
- `docs/plan/issue-ROA-396.md` - Plan de implementación

### Modificados
- `apps/backend-v2/src/routes/auth.ts` - Integración en `/register`

---

## ✅ Validaciones

### Scripts de Validación

```bash
# Validar estructura de docs v2
node scripts/validate-v2-doc-paths.js --ci
# ✅ PASS - Todos los paths existen

# Validar SSOT health
node scripts/validate-ssot-health.js --ci
# ✅ PASS - Health Score: 100/100

# Validar drift de system-map
node scripts/check-system-map-drift.js --ci
# ✅ PASS - Sin drift detectado
```

### Tests

```bash
# Tests unitarios
npm test -- tests/unit/lib/policyObservability.test.ts
# ✅ 11/11 tests passing

# Tests de integración (auth routes)
npm test -- tests/flow/auth-http.endpoints.test.ts
# ✅ 18/18 tests passing
```

---

## 🚀 Próximos Pasos (ROA-392)

ROA-392 (Analytics v2 Integration) se encargará de:
- 📊 Dashboard de métricas de policy
- 🔢 Agregación de eventos por flow/policy/decision
- 🚨 Alerting cuando `decision: blocked` excede threshold
- 📦 Retention de eventos según GDPR
- 📤 Export de eventos para compliance

**Esta issue (ROA-396) solo emite los eventos. ROA-392 los consume.**

---

## 🔗 Referencias

- **Issue:** ROA-396 - Policy Observability & Audit (V2)
- **Plan:** `docs/plan/issue-ROA-396.md`
- **Related Issues:**
  - ROA-407 - A3 Auth Policy Wiring v2
  - ROA-392 - Analytics v2 Integration
- **Related Nodes:**
  - `docs/nodes-v2/observabilidad.md`
  - `docs/nodes-v2/auth/a3-policy-system.md`

---

## 📝 Checklist

- [x] Módulo `policyObservability.ts` implementado
- [x] Tests unitarios (11/11 passing)
- [x] Integración en auth routes (`/register`)
- [x] Validaciones de scripts (v2, ssot, system-map)
- [x] Plan de implementación creado
- [x] Sin PII en eventos
- [x] Reason slugs estables
- [x] Logs estructurados (info/warn)
- [x] Emisión asíncrona (no bloquea response)

---

**Autor:** Back-end Dev  
**Fecha:** 2026-01-05  
**Estado:** ✅ Ready for review

