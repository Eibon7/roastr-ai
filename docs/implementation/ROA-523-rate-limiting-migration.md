# ROA-523: Rate Limiting v2 Migration & Auth Wiring

**Issue:** https://linear.app/roastrai/issue/ROA-523/rate-limiting-v2-migration-auth-wiring  
**Status:** ✅ Completed  
**Date:** 2026-01-07

---

## 📋 Resumen

Completada la migración de rate limiting v2 a Redis/Upstash persistente. El sistema ahora utiliza Redis en producción con fallback automático a memoria en desarrollo/testing.

---

## 🎯 Cambios Realizados

### 1. Cliente Redis Compartido

**Archivo:** `apps/backend-v2/src/lib/redisClient.ts`

- ✅ Cliente Redis/Upstash compartido para backend-v2
- ✅ Inicialización con manejo de errores
- ✅ Fallback automático a memoria si Redis no disponible
- ✅ Logging estructurado de estado de conexión

### 2. Rate Limit Service Actualizado

**Archivo:** `apps/backend-v2/src/services/rateLimitService.ts`

**Cambios principales:**
- ✅ Soporte Redis/Upstash con fallback a memoria
- ✅ Métodos async para operaciones de Redis
- ✅ TTL automático en Redis (no memory leaks)
- ✅ Keys alineadas con SSOT: `auth:ratelimit:ip:${authType}:${ip}`
- ✅ Logging mejorado con contexto de storage

**Storage:**
- **Producción:** Redis/Upstash (persistente, multi-instance)
- **Development/Testing:** In-memory Map (fallback automático)

### 3. Middleware Actualizado

**Archivo:** `apps/backend-v2/src/middleware/rateLimit.ts`

- ✅ Middleware async para manejar operaciones Redis
- ✅ Sin cambios en la API pública

### 4. Inicialización en Bootstrap

**Archivo:** `apps/backend-v2/src/index.ts`

- ✅ Inicialización de Redis al arranque
- ✅ Fallback silencioso si Redis no disponible

### 5. Tests Completos

**Archivo:** `apps/backend-v2/tests/unit/services/rateLimitService.test.ts`

- ✅ 13 tests pasando
- ✅ Coverage de todos los auth types (login, magic_link, oauth, password_reset, signup)
- ✅ Tests de bloqueo progresivo
- ✅ Tests de observability hooks

### 6. Dependencia Añadida

**Archivo:** `apps/backend-v2/package.json`

- ✅ `@upstash/redis@^1.34.3`

---

## 🔄 Alineación con SSOT v2

**SSOT v2 - Sección 12.4: Rate Limiting de Autenticación**

| Auth Type | Window | Max Attempts | Block Duration | ✅ Status |
|-----------|--------|--------------|----------------|-----------|
| password (login) | 15 min | 5 | 15 min | ✅ Aligned |
| magic_link | 1 hora | 3 | 1 hora | ✅ Aligned |
| oauth | 15 min | 10 | 15 min | ✅ Aligned |
| password_reset | 1 hora | 3 | 1 hora | ✅ Aligned |
| signup | 1 hora | 5 | 1 hora | ✅ Aligned |

**Bloqueo progresivo:**
- 1ra infracción → 15 min ✅
- 2da infracción → 1 hora ✅
- 3ra infracción → 24 horas ✅
- 4ta+ infracción → Permanente ✅

**Storage keys:**
- ✅ `auth:ratelimit:ip:${authType}:${ip}` (aligned with SSOT)

---

## 🛡️ Verificación de Endpoints

Todos los endpoints de auth tienen `rateLimitByType` middleware:

| Endpoint | Middleware | Auth Type | ✅ Status |
|----------|-----------|-----------|-----------|
| POST /api/v2/auth/register | ✅ | login | ✅ |
| POST /api/v2/auth/signup | ✅ | signup | ✅ |
| POST /api/v2/auth/login | ✅ | login | ✅ |
| POST /api/v2/auth/magic-link | ✅ | magic_link | ✅ |
| POST /api/v2/auth/password-recovery | ✅ | password_recovery | ✅ |
| POST /api/v2/auth/reset-password | ✅ | password_recovery | ✅ |

---

## 🧪 Validación

### Tests

```bash
cd apps/backend-v2
npm test -- tests/unit/services/rateLimitService.test.ts
```

**Resultado:** ✅ 13/13 tests passing

### Coverage

- ✅ Rate limiting por auth type
- ✅ Bloqueo temporal y permanente
- ✅ Cálculo de tiempo restante
- ✅ Reset manual (admin/tests)
- ✅ Observability hooks

---

## 🚀 Despliegue

### Variables de Entorno Requeridas

```bash
# Redis/Upstash (producción)
UPSTASH_REDIS_REST_URL=https://your-upstash.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Opcional: Redis legacy URL
REDIS_URL=redis://localhost:6379
```

### Fallback Automático

Si Redis no está disponible:
1. ⚠️  Log warning: `rate_limit_backend_selected` (backend: memory)
2. ✅ Sistema continúa funcionando con storage in-memory
3. ⚠️  Rate limiting NO persiste entre restarts

**⚠️ IMPORTANTE:** En producción, asegurar que Redis/Upstash está configurado correctamente.

---

## 🔄 Redis (Upstash) Lifecycle en Development vs Staging

### Expected Behavior por Entorno

**Development / CI:**
- ✅ Fallback a memoria es **EXPECTED**
- ✅ Upstash puede marcar DB como inactive sin tráfico regular
- ✅ No es necesario mantener conexión Redis activa
- ✅ Tests funcionan con fallback in-memory

**Staging / Production:**
- ✅ Redis (Upstash) se valida con tráfico real
- ✅ Rate limiting persiste entre restarts de servidor
- ✅ Multi-instance safe (varios pods/workers comparten estado)

### ⚠️ Nota sobre Upstash Free Tier

Upstash puede marcar databases como "inactive" después de períodos sin tráfico. Esto es **normal y esperado** en entornos de desarrollo/CI.

**Esto NO es un bug:**
- El fallback automático a memoria garantiza que el sistema funcione
- La primera request real en staging/prod "despertará" la DB
- No se requiere mantener tráfico artificial para validación

**Logging Claro:**
```json
{
  "level": "info",
  "event": "rate_limit_backend_selected",
  "rate_limit_backend": "memory",
  "expected_in": ["development", "CI"]
}
```

---

## 📊 Observability

### Logs Estructurados

**Redis inicializado:**
```json
{
  "level": "info",
  "event": "redis_initialized",
  "url": "https://<REDACTED>",
  "provider": "upstash"
}
```

**Fallback a memoria:**
```json
{
  "level": "warn",
  "event": "rate_limit_fallback_memory",
  "reason": "Redis not available, using in-memory storage",
  "warning": "Rate limiting will not persist across server restarts"
}
```

**Rate limit excedido:**
```json
{
  "level": "warn",
  "event": "auth_rate_limit_blocked",
  "ip": "192.168.1.1",
  "auth_type": "login",
  "blocked_until": 1672531200,
  "block_type": "temporary"
}
```

### Métricas

- ✅ Rate limit attempts tracked per auth type
- ✅ Block events logged with context
- ✅ Storage mode (redis/memory) visible en logs

---

## 🔗 Referencias

- **SSOT v2:** `docs/SSOT-V2.md` - Sección 12.4
- **Auth Node:** `docs/nodes-v2/auth/rate-limiting.md`
- **Implementación:** `apps/backend-v2/src/services/rateLimitService.ts`
- **Tests:** `apps/backend-v2/tests/unit/services/rateLimitService.test.ts`

---

## ✅ Checklist de Implementación

- [x] Cliente Redis compartido creado
- [x] Rate limit service migrado a Redis/Upstash
- [x] Middleware actualizado (async)
- [x] Inicialización en bootstrap
- [x] Tests completos (13/13 passing)
- [x] Alineación con SSOT v2 verificada
- [x] Verificación de endpoints completada
- [x] Dependencia @upstash/redis añadida
- [x] Logging estructurado implementado
- [x] Fallback automático funcionando
- [x] Documentación actualizada

---

**Última actualización:** 2026-01-07  
**Owner:** ROA-523  
**Status:** ✅ Ready for Review

