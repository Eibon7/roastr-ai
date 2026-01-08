# ROA-523: Auth → Rate Limiting v2 Migration (Auth Wiring)

**Tipo:** Infra / Policy Wiring  
**Prioridad:** Alta — Bloquea cierre de Auth v2  
**Issue:** [ROA-523](https://linear.app/roastrai/issue/ROA-523/rate-limiting-v2-migration-auth-wiring)

## 🎯 Objetivo

Migrar todos los flujos de Auth v2 para usar `RateLimitPolicyGlobal` como único decision-maker, evaluándose **ANTES** de la lógica de negocio.

**Al finalizar:** "Si una request de Auth llega a la lógica de negocio, ya pasó rate limiting."

## 📌 Scope Implementado

### 1️⃣ Archivos Nuevos

- ✅ `src/constants/authActions.js` — Constantes para actions y types de Auth
- ✅ `src/errors/authErrors.js` — Taxonomía de errores v2 + factory para rate limit errors
- ✅ `src/middleware/authPolicyGate.js` — Policy Gate centralizado para Auth
- ✅ `tests/unit/middleware/authPolicyGate.test.js` — Tests de wiring

### 2️⃣ Archivos Modificados

- ✅ `src/routes/auth.js` — Wiring de endpoints a Policy Gate
  - Login (`/login`) → `authPolicyGate({ action: AUTH_ACTIONS.LOGIN, authType: AUTH_TYPES.PASSWORD })`
  - Register (`/register`, `/signup`) → `authPolicyGate({ action: AUTH_ACTIONS.REGISTER, authType: AUTH_TYPES.PASSWORD })`
  - Password recovery (`/reset-password`) → `authPolicyGate({ action: AUTH_ACTIONS.PASSWORD_RECOVERY, authType: AUTH_TYPES.PASSWORD_RESET })`
  - Magic link (`/magic-link`, `/login/magic-link`, `/signup/magic-link`) → `authPolicyGate({ action: AUTH_ACTIONS.MAGIC_LINK, authType: AUTH_TYPES.MAGIC_LINK })`

### 3️⃣ Legacy Removido

- ❌ Eliminadas referencias a `loginRateLimiter` (comentadas)
- ❌ Eliminadas referencias a `authRateLimiterV2` (reemplazadas por Policy Gate per-endpoint)
- ✅ Rate limiting ahora se aplica **por endpoint específico**, no global

## 🔄 Pipeline

```
HTTP Request
  → Auth Feature Flags (A2)
    → Auth Policy Gate (A3)
      → RateLimitPolicyGlobal
        → (allowed) continuar
        → (blocked) cortar
  → Auth Business Logic
```

## 📊 Contrato

### Input al Policy

```javascript
{
  scope: 'auth',
  action: 'password' | 'magic_link' | 'password_reset',
  key: {
    ip: string,
    email?: string
  },
  metadata: {
    auth_type: 'password' | 'magic_link' | 'password_reset'
  }
}
```

### Output del Policy

```javascript
{
  allowed: boolean,
  reason?: 'rate_limited',
  retry_after_seconds?: number,
  block_type: 'temporary' | 'permanent'
}
```

### Traducción a AuthError v2

| Policy Result                    | Auth Error Code         | Retryable |
| -------------------------------- | ----------------------- | --------- |
| `rate_limited` + `temporary`     | `AUTH_RATE_LIMITED`     | `true`    |
| `rate_limited` + `permanent`     | `AUTH_ACCOUNT_BLOCKED`  | `false`   |

## 📡 Observabilidad

### Evento Emitido

```javascript
event: 'auth_rate_limited'
payload: {
  flow: 'auth',
  auth_action: 'login' | 'register' | 'password_recovery' | 'magic_link',
  retryable: true,
  policy: 'rate_limit',
  scope: 'auth'
}
```

### Logs Backend

```javascript
logger.warn('auth_policy_gate_blocked', {
  action,
  auth_type,
  block_type,
  retry_after_seconds,
  ip,
  request_id
});
```

❌ **No PII en eventos/logs** (sin email, sin user_id si no autenticado)

## 🧪 Tests

### Cobertura

- ✅ Login bloqueado (temporary + permanent)
- ✅ Register bloqueado
- ✅ Password recovery bloqueado
- ✅ Feature flag OFF → bypass rate limiting
- ✅ Policy permite → continuar a business logic
- ✅ Fail-open behavior (error interno del policy)
- ✅ Input contract validation (IP, email)
- ✅ Observability (evento emitido)

**Ejecutar tests:**

```bash
npm test -- tests/unit/middleware/authPolicyGate.test.js
```

## 🚫 Fuera de Scope

❌ **NO implementa** rate limiting nuevo  
❌ **NO toca** Redis / Upstash  
❌ **NO cambia** algoritmos ni semántica de `RateLimitPolicyGlobal`  
❌ **NO migra** otras áreas (ingestion, roast, admin)  

## ✅ Definition of DONE

- [x] Auth usa `RateLimitPolicyGlobal` como único rate limiter
- [x] Todos los flujos Auth migrados (login, register, recovery, magic link)
- [x] Evaluación **antes** de lógica de negocio
- [x] Traducción correcta a `AuthError v2`
- [x] Feature flags respetados (`enable_rate_limit_auth`)
- [x] Evento `auth_rate_limited` emitido
- [x] Logs estructurados (sin PII)
- [x] Tests pasando (wiring + outcomes)
- [x] ❌ Sin referencias a rate limiters legacy

## 📚 Referencias

- **SSOT:** Section 12.4 (Auth Rate Limiting), 12.6 (Rate Limiting Global v2)
- **Issue Original:** [ROA-523](https://linear.app/roastrai/issue/ROA-523/rate-limiting-v2-migration-auth-wiring)
- **Policy Global:** `src/services/rateLimitPolicyGlobal.js` (ROA-392 — Phase 1: Core Infrastructure)

## 🔍 Reviewers Notes

**Clear flow para reviewers:**

1. Endpoint Auth recibe request
2. `authPolicyGate` se ejecuta **ANTES** de business logic
3. `RateLimitPolicyGlobal.evaluate()` decide allow/block
4. Si block → `AuthError` + HTTP 429
5. Si allow → continúa a `authService`

**No más rate limiters duplicados. Un solo policy, decisiones consistentes.**

---

**CI Status:** ⏳ Pending (tests de integración pueden requerir ajustes de ESM)  
**Merge:** Ready cuando CI pase + 0 CodeRabbit comments
