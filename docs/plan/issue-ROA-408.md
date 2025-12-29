# Implementation Plan: Issue ROA-408 - Auth Rate Limiting and Abuse V2

**Issue:** ROA-408  
**Title:** A4-Auth-Rate-Limiting-and-Abuse-v2  
**Type:** Backend / Security  
**Priority:** P0  
**Area:** Authentication  
**Status:** Planning  
**Created:** 2025-12-29

## Objective

Implementar rate limiting y protección contra abuse para todos los endpoints de autenticación en backend-v2, utilizando el sistema de errores ya existente en `authErrorTaxonomy.ts`.

## Context (GDD Nodes Loaded)

**Primary nodes:**
- `workers` (líneas 1-422) - Sistema de workers y rate limiting
- `infraestructura` (líneas 1-293) - Rate limits y políticas

**Total context:** ~715 líneas

## Current State

Actualmente existe:
- ✅ `apps/backend-v2/src/utils/authErrorTaxonomy.ts` - Taxonomía completa de errores auth
- ✅ `AUTH_ERROR_CODES.RATE_LIMITED` y `POLICY_RATE_LIMITED` - Slugs ya definidos
- ✅ `mapPolicyResultToAuthError()` - Mapper de políticas a errores
- ❌ NO existe rate limiting middleware para auth v2
- ❌ NO existe sistema de tracking de intentos fallidos
- ❌ NO existe protección contra credential stuffing
- ❌ NO existe protección contra brute force

## Acceptance Criteria

### AC1: Rate Limiting Middleware
- [ ] Middleware de rate limiting para auth endpoints v2
- [ ] Configuración por endpoint (login, registro, refresh, magic link)
- [ ] Almacenamiento en Redis/Upstash con TTL
- [ ] Headers estándar (`X-RateLimit-*`, `Retry-After`)
- [ ] Integración con `POLICY_RATE_LIMITED` slug

### AC2: Abuse Detection
- [ ] Tracking de intentos fallidos por IP
- [ ] Tracking de intentos fallidos por email (anti-enumeration safe)
- [ ] Lockout temporal progresivo (5→15→60 min)
- [ ] Logs estructurados sin PII
- [ ] Integración con `AUTH_ACCOUNT_LOCKED` slug

### AC3: Credential Stuffing Protection
- [ ] Detección de patrones de credential stuffing
- [ ] Bloqueo temporal de IP tras N intentos fallidos
- [ ] Whitelist de IPs conocidas (opcional)
- [ ] CAPTCHA challenge tras intentos sospechosos (feature flag)

### AC4: Rate Limits por Endpoint
| Endpoint | Autenticado | Anónimo | Window | Lockout |
|----------|-------------|---------|--------|---------|
| `/auth/login` | 10/5min | 5/5min | 5min | Progressive |
| `/auth/register` | N/A | 3/15min | 15min | 15min |
| `/auth/refresh` | 30/15min | N/A | 15min | No lockout |
| `/auth/magic-link` | N/A | 5/hour | 1hour | 1hour |
| `/auth/password-reset` | N/A | 3/hour | 1hour | 1hour |

### AC5: Observability
- [ ] Métricas de rate limiting (intentos, blocks, lockouts)
- [ ] Logs estructurados con `request_id`, `ip_hash`, `endpoint`
- [ ] Dashboard en Admin Panel (issue futura)
- [ ] Alertas para patrones sospechosos (>100 blocks/min)

### AC6: Testing
- [ ] Unit tests para middleware de rate limiting
- [ ] Unit tests para abuse detection
- [ ] Integration tests para cada endpoint con rate limits
- [ ] E2E tests para flujos de lockout y recovery
- [ ] Performance tests (mínimo 100 req/s sin degradación)

### AC7: Documentation
- [ ] Actualizar nodo GDD `workers.md` con rate limiting policies
- [ ] Actualizar nodo GDD `infraestructura.md` con rate limits
- [ ] API documentation con ejemplos de headers y errores
- [ ] Runbook para operadores (desbloqueo manual, whitelist)

## Architecture Overview

### Rate Limiting Flow

```
Request → RateLimitMiddleware
    ↓
[Check Redis Cache] → Key: `rl:auth:{endpoint}:{identifier}`
    ↓
    Hits < Limit? → YES → Increment + Continue
    ↓
    Hits >= Limit? → NO → Return 429 + Headers
    ↓
[Abuse Detection] → Parallel check for patterns
    ↓
    Suspicious? → Log + Optional CAPTCHA challenge
```

### Abuse Detection Flow

```
Failed Login Attempt
    ↓
[Increment Counters] → Redis keys:
    - `abuse:ip:{ip_hash}` (TTL: 1 hour)
    - `abuse:email:{email_hash}` (TTL: 1 hour)
    ↓
[Check Thresholds]
    - IP: 5 failed → 5min lockout
    - IP: 10 failed → 15min lockout
    - IP: 20 failed → 60min lockout
    - Email: 3 failed → progressive lockout
    ↓
[Apply Lockout] → Return AUTH_ACCOUNT_LOCKED
    ↓
[Log Event] → Structured log (no PII)
```

### Key Components to Implement

| Component | Path | Responsibility |
|-----------|------|----------------|
| **RateLimitMiddleware** | `apps/backend-v2/src/middleware/rateLimitMiddleware.ts` | Rate limiting enforcement |
| **AbuseDetector** | `apps/backend-v2/src/services/abuseDetector.ts` | Pattern detection + lockout |
| **RateLimitService** | `apps/backend-v2/src/services/rateLimitService.ts` | Redis interaction + metrics |
| **RateLimitConfig** | `apps/backend-v2/src/config/rateLimitConfig.ts` | Limits por endpoint |
| **Tests** | `apps/backend-v2/tests/unit/middleware/rateLimitMiddleware.test.ts` | Unit tests |
| **Integration Tests** | `apps/backend-v2/tests/integration/auth/rateLimitAuth.test.ts` | Integration tests |

## Implementation Steps

### Step 1: Rate Limit Service (Base)
```typescript
// apps/backend-v2/src/services/rateLimitService.ts
export class RateLimitService {
  async checkLimit(key: string, limit: number, window: number): Promise<RateLimitResult>;
  async increment(key: string, ttl: number): Promise<number>;
  async reset(key: string): Promise<void>;
  async getRemainingHits(key: string, limit: number): Promise<number>;
}
```

### Step 2: Rate Limit Middleware
```typescript
// apps/backend-v2/src/middleware/rateLimitMiddleware.ts
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (req, res, next) => {
    const identifier = getIdentifier(req, config);
    const result = await rateLimitService.checkLimit(identifier, config.limit, config.window);
    
    if (result.blocked) {
      res.set('X-RateLimit-Limit', config.limit);
      res.set('X-RateLimit-Remaining', 0);
      res.set('X-RateLimit-Reset', result.resetAt);
      res.set('Retry-After', result.retryAfter);
      
      throw new AuthError(AUTH_ERROR_CODES.RATE_LIMITED);
    }
    
    res.set('X-RateLimit-Limit', config.limit);
    res.set('X-RateLimit-Remaining', result.remaining);
    next();
  };
}
```

### Step 3: Abuse Detector
```typescript
// apps/backend-v2/src/services/abuseDetector.ts
export class AbuseDetector {
  async recordFailedAttempt(ip: string, email?: string): Promise<AbuseResult>;
  async checkLockout(ip: string, email?: string): Promise<LockoutStatus>;
  async clearLockout(ip: string, email?: string): Promise<void>;
  async getAbuseMetrics(): Promise<AbuseMetrics>;
}
```

### Step 4: Integration con Auth Endpoints
```typescript
// apps/backend-v2/src/routes/auth.ts
router.post('/login',
  createRateLimitMiddleware(rateLimitConfig.login),
  abuseProtectionMiddleware,
  loginController
);

router.post('/register',
  createRateLimitMiddleware(rateLimitConfig.register),
  registerController
);

router.post('/refresh',
  createRateLimitMiddleware(rateLimitConfig.refresh),
  refreshController
);
```

### Step 5: Tests
- Unit tests para `RateLimitService` (mock Redis)
- Unit tests para `AbuseDetector` (mock Redis)
- Unit tests para middleware (mock service)
- Integration tests para cada endpoint
- E2E tests para flujos completos

### Step 6: Documentation
- Actualizar nodos GDD con nuevas políticas
- Documentar API contracts
- Crear runbook operacional

## Testing Strategy

### Unit Tests (Vitest)
- ✅ Rate limit logic (increment, check, reset)
- ✅ Abuse detection thresholds
- ✅ Lockout progression (5→15→60 min)
- ✅ Header generation
- ❌ NO testear: Redis real, timers reales

### Integration Tests (Supabase Test)
- ✅ `/auth/login` con rate limit respetado
- ✅ `/auth/login` con rate limit excedido → 429
- ✅ Failed attempts → lockout progresivo
- ✅ Lockout expired → access restored
- ✅ Refresh token NO afectado por abuse detection
- ✅ Headers correctos en todas las respuestas

### E2E Tests (Playwright)
- ✅ Login fallido 5 veces → lockout 5min
- ✅ Esperar lockout → login exitoso
- ✅ Rate limit excedido → 429 visible en UI
- ✅ Refresh automático NO bloqueado

## SSOT References

Del nodo `infraestructura.md`:
- `rate_limits` - Rate limits por servicio
- `queue_configuration` - Configuración de workers

Del nodo `workers.md`:
- `worker_routing` - Routing de workers a colas

## Edge Cases

1. **Redis down**: Fail-open con log crítico (NO bloquear auth)
2. **IP shared (NAT)**: Rate limit por IP + email combined key
3. **IPv6 compression**: Normalizar IPv6 antes de hash
4. **Clock skew**: Usar Redis TTL, no timestamps locales
5. **Distributed requests**: Redis garantiza atomicidad
6. **Lockout durante password reset**: Allow password reset endpoint
7. **Admin override**: Endpoint manual para clear lockouts

## Security Considerations

- ❌ NO exponer contadores exactos (anti-enumeration)
- ❌ NO logear passwords ni emails en plaintext
- ✅ Hash IPs antes de almacenar
- ✅ Hash emails antes de usar como key
- ✅ TTL automático en Redis (no cleanup manual)
- ✅ Fail-open si Redis falla (con alerta crítica)
- ✅ Rate limit también en refresh (más permisivo)

## Dependencies

**Bloqueantes:**
- Ninguna (issue independiente)

**Desbloqueadas por esta issue:**
- Admin Dashboard - Métricas de abuse
- Security Monitoring - Alertas de patrones

## Definition of Done

Esta issue se considera **100% completa** cuando:

1. ✅ Rate limiting middleware implementado y testeado
2. ✅ Abuse detector implementado y testeado
3. ✅ Todos los auth endpoints protegidos
4. ✅ Headers estándar en todas las respuestas
5. ✅ **TODOS los tests pasando al 100%** (unit + integration + E2E)
6. ✅ Logs estructurados sin PII
7. ✅ Nodos GDD actualizados con cobertura
8. ✅ Documentation completa (API + Runbook)
9. ✅ Pre-Flight Checklist ejecutado sin issues
10. ✅ CodeRabbit review con 0 comentarios

---

**Created:** 2025-12-29  
**Agent:** Cursor Orchestrator  
**Worktree:** `/Users/emiliopostigo/roastr-ai/roastr-ai-worktrees/ROA-408`  
**Branch:** `feature/ROA-408-auto`

