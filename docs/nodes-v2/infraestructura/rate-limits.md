# GDD Subnode — Rate Limits v2

---

**Parent Node:** infraestructura  
**Node ID:** infraestructura/rate-limits  
**Version:** 2.0  
**Status:** ✅ Active (ROA-392)  
**Last Updated:** 2025-01-07  
**Owner:** Backend Dev

---

## 1. Resumen

Sistema unificado de rate limiting para todos los endpoints y servicios de Roastr v2.

**Propósito:**
- Prevenir abuse patterns
- Proteger infraestructura de ataques de fuerza bruta
- Garantizar fair use entre usuarios
- Cumplir con requisitos de seguridad (fail-safe, fail-closed)

**SSOT Reference:** Section 12.6 (Rate Limiting Global v2)

---

## 2. Arquitectura

### 2.1 Componentes

```
RateLimitPolicyGlobal (servicio central)
    ↓
SettingsLoader v2 (carga configuración)
    ↓
Redis/Upstash (sliding window storage)
    ↓
Middleware/Policies (consumers)
```

### 2.2 Scopes Soportados

| Scope | Descripción | Default Max | Default Window |
|-------|-------------|-------------|----------------|
| `global` | Rate limit global (todos los requests) | 10,000 | 1 hora |
| `auth.password` | Login con password | 5 | 15 min |
| `auth.magic_link` | Login con magic link | 3 | 1 hora |
| `auth.oauth` | Login con OAuth | 10 | 15 min |
| `auth.password_reset` | Reset de password | 3 | 1 hora |
| `ingestion.global` | Ingestion global | 1,000 | 1 hora |
| `ingestion.perUser` | Ingestion por usuario | 100 | 1 hora |
| `ingestion.perAccount` | Ingestion por cuenta | 50 | 1 hora |
| **roast scope** | Generación de roasts | 10 | 1 min |
| **persona scope** | Updates de persona | 3 | 1 hora |
| `notifications` | Envío de notificaciones | 10 | 1 min |
| `gdpr` | Requests GDPR (export, delete) | 5 | 1 hora |
| `admin` | Admin panel API | 100 | 1 min |

### 2.3 Feature Flags

Cada scope tiene su propio feature flag para habilitar/deshabilitar:

```typescript
type RateLimitFeatureFlags = 
  | 'enable_rate_limit_global'
  | 'enable_rate_limit_auth'
  | 'enable_rate_limit_ingestion'
  | 'enable_rate_limit_roast'
  | 'enable_rate_limit_persona'
  | 'enable_rate_limit_notifications'
  | 'enable_rate_limit_gdpr'
  | 'enable_rate_limit_admin';
```

**Default:** Todos en `true` (fail-closed para seguridad).

---

## 3. Algoritmo

### 3.1 Sliding Window

**Implementación:**
- Redis sorted sets con timestamps como scores
- Cada request añade un entry con timestamp actual
- Se eliminan entries fuera de la ventana antes de contar
- Si count >= max → bloquear
- TTL automático según `windowMs`

**Ventajas vs Fixed Window:**
- No hay "burst spikes" al inicio de ventana
- Distribución más uniforme de requests
- Mejor protección contra abuse patterns

### 3.2 Progressive Blocking

**Escalación de bloqueo por infracciones:**

| Infracción | Duración de Bloqueo |
|-----------|---------------------|
| 1ª | 15 minutos |
| 2ª | 1 hora |
| 3ª | 24 horas |
| 4ª+ | Permanente (requiere intervención manual) |

**Storage:**
- Redis key: `ratelimit:infractions:${scope}:${key}`
- Sorted set con timestamps de infracciones
- Auto-expiry después de 7 días

---

## 4. Almacenamiento

### 4.1 Redis Keys

**Formato:** `ratelimit:${scope}:${key}`

**Ejemplos:**
- `ratelimit:global` - Rate limit global
- `ratelimit:auth.password:ip:192.168.1.1` - Auth password por IP
- `ratelimit:auth.password:email:hash123` - Auth password por email hash
- `ratelimit:ingestion:user:uuid-123` - Ingestion por usuario
- `ratelimit:roast-scope:user:uuid-456` - Rate limit scope roast por usuario

### 4.2 TTL

**Automático según `windowMs` de cada scope:**
- Keys de rate limit se auto-expiran después de `windowMs`
- No requiere cleanup manual
- Infraction keys se expiran después de 7 días

### 4.3 Fallback

**Producción:** Redis/Upstash (preferido)
**Desarrollo/Testing:** Memoria (solo para tests locales)

**⚠️ CRÍTICO:** NUNCA usar memoria en producción. Fail-safe debe bloquear si Redis falla.

---

## 5. Configuración

### 5.1 Carga Desde SSOT

**Flujo:**
1. `RateLimitPolicyGlobal._reloadConfig()`
2. `SettingsLoader v2.loadRateLimitPolicy()`
3. Merged config (`admin_settings` > `admin-controlled.yaml`)
4. Fallback a SSOT defaults si no existe

**Cache:** 1 minuto TTL (hot-reload automático)

### 5.2 Admin Panel

**Endpoints:**
- `GET /api/v2/admin/settings/rate-limit` - Ver configuración actual
- `PATCH /api/v2/admin/settings/rate-limit` - Actualizar configuración por scope
- `GET /api/v2/admin/rate-limit/status/:scope/:key` - Ver estado de un key
- `DELETE /api/v2/admin/rate-limit/:scope/:key` - Clear rate limit (intervención manual)

### 5.3 Validación

**Reglas:**
- `max` debe ser > 0
- `windowMs` debe ser > 0
- `blockDurationMs` debe ser >= `windowMs` (si existe)
- `enabled` debe ser boolean
- Scope debe ser válido según SSOT

---

## 6. Fail-Safe Behavior

### 6.1 Reglas Críticas (SSOT 12.6.6)

1. **NUNCA** bypass rate limiting en errores de Redis → **BLOCK**
2. **SIEMPRE** cargar configuración desde SSOT (no hardcodear)
3. **SIEMPRE** respetar feature flags por scope
4. **SIEMPRE** usar sliding window (no fixed window)
5. **SIEMPRE** aplicar progressive blocking para abuse patterns
6. **NUNCA** exponer detalles internos de rate limiting en respuestas API

### 6.2 Manejo de Errores

**Redis error:**
- Bloquear request (fail-safe)
- Log error con contexto
- Retry después de 60 segundos (default)
- Alert si errors > 10 en 5 minutos

**Config error:**
- Usar SSOT defaults
- Log warning
- Continuar operación con defaults

**Validation error:**
- Bloquear request (invalid scope/config)
- Log error
- Return error claro al caller

---

## 7. Seguridad

### 7.1 Masking de Keys

**Implementación:** `_maskKey(key)`

**Reglas:**
- Emails: `em***@domain.com`
- IPs: `192.168.***.***`
- UUIDs: `uuid-***-456`
- Generic: `abcd***efgh`

**⚠️ NUNCA** loggear keys completos con PII.

### 7.2 Abuse Detection

**Patterns detectados:**
- Multi-IP: Mismo email desde múltiples IPs
- Multi-Email: Múltiples emails desde misma IP
- Burst Attack: >10 requests en 1 minuto
- Slow Attack: >20 requests en 1 hora

**Acción:**
- Incrementar infraction counter
- Aplicar progressive blocking
- Alert a admin
- Log con contexto completo

---

## 8. Observabilidad

### 8.1 Logs Estructurados

**Eventos:**
- `rate_limit_exceeded` - Cuando se bloquea un request
- `rate_limit_config_reloaded` - Cuando se recarga configuración
- `rate_limit_error` - Cuando ocurre un error
- `rate_limit_cleared` - Cuando admin clear un key
- `rate_limit_infraction` - Cuando se detecta infracción

**Campos obligatorios:**
- `scope` - Scope del rate limit
- `key` (masked) - Key del entity (sin PII)
- `timestamp` - Timestamp del evento
- `result` - `allowed` o `blocked`
- `metadata` - Contexto adicional

**Analytics Events (Phase 2):**
- 🔄 `rate_limit_blocked` - Emitido cuando request es bloqueado
- 🔄 `rate_limit_progressive_block` - Emitido cuando escalación ocurre
- 🔄 `rate_limit_cleared` - Emitido cuando admin limpia rate limit

> **Note:** Analytics events deferred to Phase 2 (when integrating with existing auth/ingestion flows)

### 8.2 Métricas

**Prometheus metrics:**
- `rate_limit_requests_total{scope, result}` - Counter
- `rate_limit_exceeded_total{scope}` - Counter
- `rate_limit_config_reloads_total{source}` - Counter
- `rate_limit_errors_total{scope, error_type}` - Counter
- `rate_limit_redis_latency_seconds{operation}` - Histogram

### 8.3 Alertas

**Triggers:**
- Rate limit exceeded > 100/min en cualquier scope → Alert media
- Redis errors > 10 en 5 min → Alert alta
- Progressive blocking level 3+ → Alert alta
- Config reload failed > 3 consecutivos → Alert crítica

---

## 9. Testing

### 9.1 Unit Tests

**Coverage:** >=90%

**Tests:**
- ✅ `checkRateLimit()` - sliding window correcto
- ✅ `checkRateLimit()` - feature flag disabled → allow
- ✅ `checkRateLimit()` - invalid scope → block
- ✅ `checkRateLimit()` - Redis error → block (fail-safe)
- ✅ `incrementRateLimit()` - añade entry correctamente
- ✅ `getRateLimitStatus()` - devuelve estado correcto
- ✅ `clearRateLimit()` - borra key correctamente
- ✅ `_getConfig()` - cache funciona correctamente
- ✅ `_reloadConfig()` - carga desde SettingsLoader v2
- ✅ `_reloadConfig()` - fallback a defaults en error
- ✅ `_getScopeConfig()` - scope simple (e.g., roast-generation scope)
- ✅ `_getScopeConfig()` - scope nested (e.g., 'auth.password')
- ✅ `_checkSlidingWindow()` - sliding window con Redis
- ✅ `_checkSlidingWindow()` - retry_after_seconds correcto
- ✅ `_maskKey()` - masking de emails, IPs, UUIDs

### 9.2 Integration Tests

**Tests:**
- ✅ Auth rate limiting end-to-end
- ✅ Ingestion rate limiting end-to-end
- ✅ Feature flag disabled → allow
- ✅ Redis sliding window correctamente
- ✅ Cache invalidation tras cambio SSOT
- ✅ Progressive blocking aplica escalación correcta
- ✅ Admin clear rate limit funciona

### 9.3 E2E Tests (Playwright)

**Tests:**
- ✅ Admin edita rate limit → sistema responde
- ✅ Rate limit excedido → retry_after correcto
- ✅ Feature flag disabled → rate limiting OFF
- ✅ Redis error → fail-safe blocks requests

---

## 10. Migration Path

### 10.1 Legacy Implementations

**A migrar:**
- `src/middleware/authRateLimiterV2.js` → usar `RateLimitPolicyGlobal` con scope `auth`
- `src/services/ingestion/policies/RateLimitPolicy.js` → usar `RateLimitPolicyGlobal` con scope `ingestion`

**A evaluar (deprecar o migrar):**
- `src/middleware/roastRateLimiter.js`
- `src/middleware/roastrPersonaRateLimiter.js`
- `src/middleware/notificationRateLimiter.js`
- `src/middleware/gdprRateLimiter.js`
- `src/middleware/adminRateLimiter.js`
- `src/middleware/passwordChangeRateLimiter.js`
- `src/middleware/rateLimiter.js` (genérico)

### 10.2 Timeline

**Phase 1 (ROA-392):** Core implementation
- ✅ `RateLimitPolicyGlobal` service
- ✅ SettingsLoader v2 integration
- ✅ SSOT v2 updated
- ✅ Documentation

**Phase 2 (TBD):** Migrations
- Auth rate limiting migration
- Ingestion rate limiting migration
- Evaluation of legacy rate limiters

**Phase 3 (TBD):** Cleanup
- Deprecate legacy implementations
- Remove redundant code
- Final documentation update

---

## 11. Dependencies

**Upstream (depende de):**
- `SettingsLoader v2` - Carga configuración
- `Redis/Upstash` - Storage del sliding window
- `SSOT v2` - Source of truth de configuración
- `Feature Flags` - Control granular por scope

**Downstream (requerido por):**
- `authRateLimiterV2` (middleware)
- `ingestion/RateLimitPolicy` (policy)
- Admin Panel endpoints
- Todos los endpoints públicos (via middleware)

---

## 12. Edge Cases

1. **Redis down durante rate limit check:**
   - Bloquear request (fail-safe)
   - Retry después de 60 segundos
   - Alert si persiste >5 min

2. **Config corrupta en admin_settings:**
   - Usar SSOT defaults
   - Log warning con detalles
   - Alert a admin

3. **Feature flag disabled mid-request:**
   - Respetar flag al momento del check
   - No afecta requests ya procesados

4. **Admin clear rate limit durante infraction:**
   - Clear exitoso
   - Infraction counter NO se borra (separado)
   - Log de intervención manual

5. **Multiple scopes aplicando a mismo request:**
   - Cada scope evalúa independientemente
   - Si alguno bloquea → request bloqueado
   - Return el scope más restrictivo

6. **Cache expire mid-request:**
   - Reload automático
   - Request continúa con nueva config
   - No hay inconsistencia (config es inmutable durante check)

7. **Progressive blocking level 4 (permanent):**
   - Requiere intervención manual de admin
   - No se auto-expira
   - Admin debe clear explícitamente

8. **Rate limit por IP + Email simultáneamente:**
   - Ambos checks deben pasar
   - Si alguno falla → request bloqueado
   - Log indica qué check falló

---

## 13. Related Nodes

**Parent:**
- `14-infraestructura.md`

**Siblings:**
- `queue-management`
- `database-rls`
- `staging-production-isolation`

**Dependencies:**
- `15-ssot-integration.md`
- `observabilidad.md`

---

## 14. Acceptance Criteria

- [x] SSOT v2 actualizado con configuración global unificada (sección 12.6)
- [x] `RateLimitPolicyGlobal` service implementado
- [x] SettingsLoader v2 cargando configuración de rate limits
- [ ] Auth rate limiting migrado a `RateLimitPolicyGlobal`
- [ ] Ingestion rate limiting migrado a `RateLimitPolicyGlobal`
- [ ] Legacy rate limiters evaluados (migrados o deprecated)
- [ ] Tests unitarios >=90% coverage
- [ ] Tests de integración con Redis
- [ ] Tests E2E con Admin Panel
- [ ] CI validando configuración de rate limits
- [ ] Feature flags funcionando por scope
- [ ] Fail-safe verificado (Redis error → block)
- [ ] Hot-reload verificado (admin edita → sistema responde)
- [ ] Progressive blocking implementado y verificado
- [ ] Abuse detection implementado
- [ ] Observabilidad (logs, métricas, alerts)
- [ ] Documentación completa (este subnodo)

---

## 15. References

- **SSOT v2:** Section 12.6 (Rate Limiting Global v2)
- **Implementation:** `src/services/rateLimitPolicyGlobal.js`
- **SettingsLoader:** `src/services/settingsLoaderV2.js`
- **Plan:** `docs/plan/issue-ROA-392.md`
- **Tests:** `tests/unit/services/rateLimitPolicyGlobal.test.js`

---

**Last Updated:** 2025-01-07  
**Status:** ✅ Active (ROA-392 in progress)

