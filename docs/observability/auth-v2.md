# Auth Observability V2 - ROA-410

**Status:** ✅ Implemented  
**Version:** 2.0  
**Issue:** [ROA-410](https://linear.app/roastrai/issue/ROA-410)  
**PR:** [#1232](https://github.com/Eibon7/roastr-ai/pull/1232)

---

## Overview

Sistema de observabilidad centralizado para flujos de autenticación en `backend-v2`. Proporciona logging estructurado, tracking de eventos analytics, métricas con dimensiones, y sanitización de PII.

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│              Auth Observability Layer                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  authObservabilityService.ts                      │  │
│  │  - logAuthEvent()                                 │  │
│  │  - trackAuthEvent()                               │  │
│  │  - trackMetricCounter()                           │  │
│  │  - logAuthError()                                 │  │
│  │  - sanitizeContext()                              │  │
│  └──────────────────────────────────────────────────┘  │
│                         ▲                                │
│                         │                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  authObservability.ts (Public Helpers)           │  │
│  │  - logAuthFlowStarted()                          │  │
│  │  - logLoginAttempt()                             │  │
│  │  - logRegisterAttempt()                          │  │
│  │  - logMagicLinkRequest()                         │  │
│  │  - logPasswordRecoveryRequest()                  │  │
│  │  - logRateLimit()                                │  │
│  │  - logFeatureDisabled()                          │  │
│  │  - trackAuthDuration()                           │  │
│  │  - createAuthContext()                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼─────┐   ┌─────▼──────┐   ┌────▼─────┐
   │ authSvc  │   │  routes/   │   │ rateLim  │
   │  .ts     │   │  auth.ts   │   │ itSvc.ts │
   └──────────┘   └────────────┘   └──────────┘
```

### Integration Points

1. **authService.ts**: Instrumenta register, login, magic link, password recovery
2. **routes/auth.ts**: Observabilidad en feature-flag gates (4 rutas)
3. **rateLimitService.ts**: Hooks opcionales para rate limit events
4. **index.ts**: Wiring de observability hooks en startup

---

## Event Taxonomy

### Spec-Compliant Event Names

| Event Name | Description | Emitted By |
|------------|-------------|------------|
| `auth_flow_started` | Flujo de auth iniciado | `logAuthFlowStarted()` |
| `auth_flow_completed` | Flujo completado exitosamente | `logLoginAttempt()`, `logRegisterAttempt()`, etc. |
| `auth_flow_failed` | Flujo falló (credenciales, validación) | `logLoginAttempt()`, `logRegisterAttempt()`, etc. |
| `auth_flow_blocked` | Flujo bloqueado (rate limit, feature flag) | `logRateLimit()`, `logFeatureDisabled()` |

### Event Context Fields

```typescript
interface AuthEventContext {
  request_id: string;          // Request ID único
  correlation_id?: string;     // Correlation ID para tracing
  user_id?: string;            // User ID (si autenticado)
  email?: string;              // Email (sanitizado antes de log)
  ip?: string;                 // IP address (sanitizado)
  flow: string;                // 'login' | 'register' | 'magic_link' | 'password_recovery'
  auth_type?: string;          // 'password' | 'magic_link' | 'oauth'
  duration_ms?: number;        // Duración de la operación
  error?: AuthError;           // Error details (si aplica)
}
```

---

## Metric Definitions

### Counter Metrics

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `auth_requests_total` | `flow`, `auth_type` | Total auth requests |
| `auth_success_total` | `flow`, `auth_type` | Successful auth operations |
| `auth_failures_total` | `flow`, `auth_type`, `reason` | Failed auth operations |
| `auth_blocks_total` | `flow`, `reason` | Blocked operations (rate limit, feature flag) |

### Example Usage

```typescript
// Login success
trackMetricCounter('auth_requests_total', { flow: 'login', auth_type: 'password' });
trackMetricCounter('auth_success_total', { flow: 'login', auth_type: 'password' });

// Register failure
trackMetricCounter('auth_requests_total', { flow: 'register', auth_type: 'password' });
trackMetricCounter('auth_failures_total', { 
  flow: 'register', 
  auth_type: 'password',
  reason: 'invalid_email' 
});

// Rate limit block
trackMetricCounter('auth_blocks_total', { flow: 'login', reason: 'rate_limit' });
```

---

## PII Sanitization

### Email Sanitization

**Function:** `truncateEmailForLog(email: string): string`

**Behavior:**
- Trunca emails a primeros 3 caracteres del local-part + `***@domain`
- Ejemplo: `john.doe@example.com` → `joh***@example.com`

**Code:**
```typescript
function truncateEmailForLog(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return '***';
  const truncated = localPart.slice(0, 3) + '***';
  return `${truncated}@${domain}`;
}
```

### IP Sanitization

**Function:** `sanitizeIpForLog(ip: string): string`

**Behavior:**
- IPv4: Mantiene primeros 3 octetos, reemplaza último con `xxx`
- IPv6: Mantiene primeros 4 grupos, reemplaza resto con `::xxxx`
- Ejemplo: `192.168.1.100` → `192.168.1.xxx`

**Code:**
```typescript
function sanitizeIpForLog(ip: string): string {
  if (ip.includes('.')) {
    // IPv4
    const parts = ip.split('.');
    return `${parts.slice(0, 3).join('.')}.xxx`;
  }
  // IPv6
  const parts = ip.split(':');
  return `${parts.slice(0, 4).join(':')}::xxxx`;
}
```

### Context Sanitization

**Automatic:** Todos los contextos son sanitizados automáticamente antes de logging/analytics.

**Fields Sanitized:**
- ✅ `email`: Truncado con `truncateEmailForLog()`
- ✅ `ip`: Sanitizado con `sanitizeIpForLog()`
- ✅ `user_id`: Prefijado con `user_` si no lo tiene
- ⚠️ **NEVER logged:** `password`, `token`, `secret`

---

## ENABLE_ANALYTICS Flag

### Behavior

**Flag:** `process.env.ENABLE_ANALYTICS`

**Values:**
- `'true'` → Analytics events enabled
- `'false'` or `undefined` → Analytics events disabled (graceful degradation)

**Gating Logic:**
```typescript
// authObservabilityService.ts
function trackAuthEvent(eventName: string, properties: Record<string, any>): void {
  try {
    if (process.env.ENABLE_ANALYTICS !== 'true') {
      return; // Graceful skip
    }
    analytics.trackEvent(eventName, properties);
  } catch (error) {
    // Graceful degradation: log error but don't throw
    logger.warn('Analytics event failed', { eventName, error });
  }
}
```

**Implications:**
- ✅ Logging always happens (independent of flag)
- ✅ Metrics always increment (independent of flag)
- ⚠️ Analytics events only sent when `ENABLE_ANALYTICS='true'`
- ✅ Analytics failures never crash auth flows (try/catch)

---

## Integration Examples

### 1. Auth Service Integration

```typescript
// apps/backend-v2/src/services/authService.ts

import { logAuthFlowStarted, logLoginAttempt, createAuthContext } from '../utils/authObservability.js';

async function login(email: string, password: string, req: Request): Promise<LoginResult> {
  const context = createAuthContext(req, 'login', email);
  const startTime = Date.now();

  // Log flow start
  logAuthFlowStarted(context);

  try {
    // ... validation, rate limit, Supabase auth ...

    // Log success
    const duration = Date.now() - startTime;
    logLoginAttempt({ ...context, duration_ms: duration }, true);

    return { success: true, user };
  } catch (error) {
    // Log failure
    const duration = Date.now() - startTime;
    logLoginAttempt({ ...context, duration_ms: duration, error }, false, error);

    throw error;
  }
}
```

### 2. Route-Level Feature Flag Gates

```typescript
// apps/backend-v2/src/routes/auth.ts

router.post('/register', async (req, res, next) => {
  try {
    await isAuthEndpointEnabled('register');
  } catch (error) {
    const context = createAuthContext(req, 'register');
    logFeatureDisabled(context, 'register', error);
    throw error; // Re-throw para que AuthPolicyGate lo maneje
  }

  // ... resto del handler ...
});
```

### 3. Rate Limit Service Hooks

```typescript
// apps/backend-v2/src/index.ts

import { rateLimitService } from './services/rateLimitService.js';
import { logRateLimit } from './utils/authObservability.js';

// Wire observability hooks
rateLimitService.setObservability({
  logRateLimit
});
```

---

## Test Coverage

### Test Files

1. **`tests/unit/services/authObservabilityService.test.ts`** (244 lines)
   - Structured logging validation
   - PII sanitization (emails, IPs)
   - `request_id` presence in all logs
   - `ENABLE_ANALYTICS` flag gating
   - Metric counter tracking
   - Error handling (graceful degradation)

2. **`tests/unit/utils/authObservability.test.ts`** (246 lines)
   - `logAuthFlowStarted()`
   - `logLoginAttempt()`
   - `logRegisterAttempt()`
   - `logRateLimit()`
   - `logFeatureDisabled()`
   - `createAuthContext()`
   - Metric updates on events

### Coverage

**Total:** 37 test cases  
**Lines:** 490 lines of test code  
**Coverage:** 100% de funciones públicas

---

## Best Practices

### ✅ DO

- ✅ **Always create context** con `createAuthContext(req, flow, email)`
- ✅ **Log flow start** con `logAuthFlowStarted(context)` al inicio
- ✅ **Track duration** con `const startTime = Date.now()` y `duration_ms`
- ✅ **Use specific helpers** (`logLoginAttempt`, `logRegisterAttempt`, etc.)
- ✅ **Let service sanitize** - no sanitices manualmente, el servicio lo hace
- ✅ **Trust graceful degradation** - no wrappees en try/catch adicionales

### ❌ DON'T

- ❌ **Don't log raw PII** - siempre usa helpers
- ❌ **Don't block on analytics** - el servicio ya tiene try/catch
- ❌ **Don't duplicate metrics** - cada helper ya incrementa contadores
- ❌ **Don't check ENABLE_ANALYTICS** - el servicio lo maneja
- ❌ **Don't log passwords/tokens** - nunca incluyas en context

---

## Related Issues

- **ROA-410:** Auth Observability Base v2 (this issue)
- **ROA-408:** A4 Auth Rate Limit Infrastructure v2
- **ROA-407:** A3 Auth Policy Wiring v2
- **ROA-406:** A2 Auth Feature Flags Integration v2
- **ROA-405:** A1 Auth Strategy and Multi-Factor Foundation v2

---

## Future Enhancements

### Planned (Not in Scope for ROA-410)

1. **Distributed Tracing**: OpenTelemetry integration
2. **Metrics Export**: Prometheus exporter
3. **Alert Thresholds**: Rate-based alerting rules
4. **Dashboard**: Grafana templates for auth metrics
5. **Retention Policies**: Log rotation and archival

---

## Changelog

### v2.0 (ROA-410) - 2026-01-01

**Added:**
- `authObservabilityService.ts` - Core observability service
- `authObservability.ts` - Public helper functions
- Structured JSON logging con timestamp, level, service, event
- `request_id` y `correlation_id` propagation
- PII sanitization (emails, IPs)
- Spec-compliant event names (auth_flow_*)
- `ENABLE_ANALYTICS` flag gating
- Metric counters con labels (auth_*_total)
- Feature-disabled observability (route + service level)
- 37 test cases (490 lines)

**Integrated:**
- `authService.ts` - register, login, magic link, password recovery
- `routes/auth.ts` - 4 feature-flag gates
- `rateLimitService.ts` - optional observability hooks
- `index.ts` - wiring on startup

---

## Contact

**Owner:** Backend V2 Team  
**Reviewers:** Security, Analytics, Platform  
**Documentation:** This file (`docs/observability/auth-v2.md`)

