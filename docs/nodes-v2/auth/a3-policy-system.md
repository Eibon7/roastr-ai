# A3 Auth Policy System - Backend v2

**Issue:** ROA-407  
**Versión:** 2.0  
**Fecha:** 2025-12-29  
**Estado:** ✅ Implementado

---

## Descripción

El sistema A3 (Authentication, Authorization, Audit) es la infraestructura de seguridad central de backend-v2. Proporciona:

1. **Authentication (A1)** - Verificación de identidad
2. **Authorization (A2)** - Control de acceso y permisos
3. **Audit (A3)** - Registro de eventos de seguridad

---

## Arquitectura

### Componentes Principales

```
┌──────────────────────────────────────────────────────────────┐
│                      Client Request                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│         Middleware Stack (Express)                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  1. Policy Enforcement (enforcePolicy)                 │  │
│  │     - Rate Limiting (rateLimiterService)               │  │
│  │     - Email Verification Check                         │  │
│  │     - Subscription Check                               │  │
│  │     - Audit Logging (auditService)                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  2. Authentication (requireAuth)                       │  │
│  │     - JWT Token Verification                           │  │
│  │     - Supabase Auth Integration                        │  │
│  │     - User Context Injection                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  3. Authorization (requireRole)                        │  │
│  │     - Role Verification                                │  │
│  │     - Permission Checks                                │  │
│  │     - Audit Permission Denied                          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      Route Handler
                              │
                              ▼
              ┌───────────────────────────┐
              │    Audit Service          │
              │  - Log Success/Failure    │
              │  - Persist to DB          │
              └───────────────────────────┘
```

---

## Servicios

### 1. AuditService

**Ubicación:** `apps/backend-v2/src/services/auditService.ts`

**Responsabilidad:** Registrar eventos de seguridad en `admin_audit_logs` table.

**Eventos auditados:**
- `auth.login.success` / `auth.login.failed`
- `auth.logout`
- `auth.register.success` / `auth.register.failed`
- `auth.token.refresh`
- `auth.magic_link.request`
- `authz.role.changed`
- `authz.permission.denied`
- `policy.rate_limit.hit`
- `policy.blocked`
- `policy.invalid_request`

**Ejemplo de uso:**
```typescript
import { auditService } from '@/services/auditService';

// Log login success
await auditService.logLoginSuccess(userId, ip, userAgent);

// Log permission denied
await auditService.logPermissionDenied(userId, resource, action, ip);
```

**Severidades:**
- `low` - Operaciones normales (login success, logout)
- `medium` - Eventos que requieren atención (login failed, rate limit)
- `high` - Violaciones de seguridad (permission denied)
- `critical` - Cambios críticos (role changes, policy blocked)

---

### 2. RateLimiterService

**Ubicación:** `apps/backend-v2/src/services/rateLimiterService.ts`

**Responsabilidad:** Implementar rate limiting con sliding window counter.

**Características:**
- Sliding window algorithm
- In-memory store (production: Redis planned)
- Cleanup automático de entradas expiradas
- Presets comunes (login, register, magic link, etc.)

**Ejemplo de uso:**
```typescript
import { rateLimiterService } from '@/services/rateLimiterService';

const result = await rateLimiterService.checkLimit('user-123', {
  max: 5,
  windowMs: 15 * 60 * 1000 // 15 minutos
});

if (!result.allowed) {
  // Rate limit excedido
  console.log(`Retry after: ${result.retryAfter} seconds`);
}
```

**Presets:**
```typescript
RATE_LIMIT_PRESETS = {
  login: { max: 5, windowMs: 15 * 60 * 1000 },
  register: { max: 3, windowMs: 60 * 60 * 1000 },
  magicLink: { max: 3, windowMs: 60 * 60 * 1000 },
  tokenRefresh: { max: 20, windowMs: 60 * 60 * 1000 },
  api: { max: 100, windowMs: 60 * 1000 }
}
```

---

### 3. Policy Enforcement Middleware

**Ubicación:** `apps/backend-v2/src/middleware/policyEnforcement.ts`

**Responsabilidad:** Aplicar políticas de forma declarativa en routes.

**Opciones:**
- `rateLimit` - Configuración de rate limiting
- `requireVerifiedEmail` - Require email verification
- `requireSubscription` - Require active subscription
- `auditLevel` - Severity level del audit log
- `rateLimitKeyFn` - Custom key function

**Ejemplo de uso:**
```typescript
import { enforcePolicy, RATE_LIMIT_PRESETS } from '@/middleware/policyEnforcement';

router.post('/login',
  enforcePolicy({
    rateLimit: RATE_LIMIT_PRESETS.login,
    auditLevel: 'high'
  }),
  loginHandler
);

router.post('/admin/users',
  requireAuth,
  requireRole('admin'),
  enforcePolicy({
    requireVerifiedEmail: true,
    auditLevel: 'critical'
  }),
  adminHandler
);
```

---

## Middleware Stack

### Orden de Ejecución

**Para endpoints protegidos:**

1. **Policy Enforcement** (opcional)
   - Rate limiting check
   - Email verification check
   - Subscription check
   - Audit logging (async)

2. **Authentication** (`requireAuth`)
   - JWT token verification
   - User context injection
   - Audit if token missing/invalid

3. **Authorization** (`requireRole`)
   - Role verification
   - Audit if permission denied

4. **Route Handler**
   - Business logic
   - Audit success/failure

**Ejemplo completo:**
```typescript
router.post('/api/v2/auth/login',
  enforcePolicy({
    rateLimit: RATE_LIMIT_PRESETS.login,
    auditLevel: 'high'
  }),
  async (req, res) => {
    try {
      const session = await authService.login(req.body);
      await auditService.logLoginSuccess(session.user.id, req.ip, req.headers['user-agent']);
      res.json({ session });
    } catch (error) {
      await auditService.logLoginFailed(req.body.email, error.slug, req.ip, req.headers['user-agent']);
      throw error;
    }
  }
);
```

---

## Error Handling

### AuthError Taxonomy

**Ubicación:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`

**Categorías:**
- `auth` - Authentication errors (invalid credentials, email not confirmed)
- `authz` - Authorization errors (insufficient permissions, role not allowed)
- `session` - Session errors (expired, invalid, revoked)
- `token` - Token errors (expired, invalid, missing, revoked)
- `account` - Account errors (not found, suspended, banned, deleted)
- `policy` - Policy errors (rate limited, blocked, invalid request)

**Ejemplo de error response:**
```json
{
  "success": false,
  "error": {
    "slug": "POLICY_RATE_LIMITED",
    "retryable": true
  },
  "request_id": "uuid-here"
}
```

**Headers de rate limit:**
- `X-RateLimit-Limit` - Máximo de requests permitidos
- `X-RateLimit-Remaining` - Requests restantes en la ventana
- `X-RateLimit-Reset` - Timestamp cuando resetea el contador
- `Retry-After` - Segundos hasta que puede reintentar (solo cuando bloqueado)

---

## Base de Datos

### admin_audit_logs Table

**Schema:**
```sql
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID REFERENCES users(id),
    action_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_value JSONB,
    new_value JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_audit_logs_admin_user ON admin_audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON admin_audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource_type ON admin_audit_logs(resource_type);
```

---

## Testing

### Unit Tests

- ✅ `tests/unit/services/auditService.test.ts` - Audit service unit tests
- ✅ `tests/unit/services/rateLimiterService.test.ts` - Rate limiter unit tests

### Integration Tests

- ✅ `tests/integration/auth-policies.test.ts` - Full A3 wiring tests

**Coverage:**
- Audit trail on auth events
- Rate limiting enforcement
- Authorization checks
- Error handling and response format

---

## Seguridad

### Principios

1. **Fail-Closed** - Si una policy check falla, denegar acceso
2. **Anti-Enumeration** - No revelar información sobre existencia de usuarios
3. **Audit Everything** - Registrar todos los eventos críticos
4. **No PII in Logs** - Solo user_id, nunca email/password en audit logs

### Protecciones

- **Rate Limiting** - Prevenir brute-force attacks
- **JWT Verification** - Tokens validados contra Supabase Auth
- **RLS Policies** - Row Level Security en DB
- **Audit Logging** - Trazabilidad completa de eventos

---

## Performance

### Optimizaciones

1. **Audit Logging Asíncrono**
   - No bloquea response
   - Se ejecuta con `setImmediate()`

2. **Rate Limiter Cleanup**
   - Limpieza periódica (60s) de entradas expiradas
   - Evita memory leaks

3. **Memory Store**
   - In-memory para desarrollo/test
   - Redis para production (planned)

---

## Roadmap

### Fase 1 (✅ Completado)
- [x] AuditService implementado
- [x] RateLimiterService implementado
- [x] Policy enforcement middleware
- [x] Integration con auth routes
- [x] Unit + integration tests

### Fase 2 (🔄 Próximo)
- [ ] Redis integration para rate limiting
- [ ] Admin dashboard para audit logs
- [ ] Alerting para eventos críticos
- [ ] Métricas de seguridad en tiempo real

### Fase 3 (📋 Futuro)
- [ ] Anomaly detection con ML
- [ ] Automated response a amenazas
- [ ] Compliance reports (GDPR, SOC2)

---

## Referencias

- **Issue:** ROA-407 - A3 Auth Policy Wiring v2
- **Plan:** `docs/plan/issue-ROA-407.md`
- **Related Nodes:**
  - `docs/nodes-v2/14-infraestructura.md` - RLS policies, admin_settings
  - `docs/nodes-v2/08-workers.md` - Queue system
- **SSOT:** Section 7.4 (Rate Limits), Section 15 (Auth Policies)

---

**Última actualización:** 2025-12-29  
**Owner:** Back-end Dev  
**Status:** ✅ Production Ready

