# Plan: Issue #924 - Tests para Middleware Crítico (0% → 80%+)

## Estado Actual

**Cobertura global:** 39.22%  
**Objetivo:** 60%+  
**Impacto esperado:** +2-3% cobertura global

### Archivos sin cobertura (0%)

**Prioridad Alta:**
- `src/middleware/errorHandling.js` (0% - 126 statements)
- `src/middleware/csrfProtection.js` (0% - 71 statements)  
- `src/middleware/webhookSecurity.js` (0% - 142 statements)

**Prioridad Media:**
- `src/middleware/adminRateLimiter.js` (0% - 22 statements)
- `src/middleware/responseCache.js` (0% - 76 statements)

## Pasos de Implementación

### 1. Tests para errorHandling.js

**Objetivo:** ≥80% cobertura (statements, functions, branches)

**Casos a cubrir:**
- ✅ Clasificación de errores por status code y mensaje
- ✅ Generación de error IDs únicos
- ✅ Construcción de contexto de error
- ✅ Construcción de respuestas seguras (producción vs desarrollo)
- ✅ Cálculo de retry delays
- ✅ Intentos de recuperación automática
- ✅ Logging por severidad
- ✅ Middleware errorHandler con todas las opciones
- ✅ asyncWrapper para handlers async
- ✅ Clases de error personalizadas (BaseError, ValidationError, etc.)
- ✅ notFoundHandler
- ✅ Manejo de uncaught exceptions y unhandled rejections
- ✅ Edge cases: response already sent, handler errors

**Archivo:** `tests/unit/middleware/errorHandling.test.js`

### 2. Tests para csrfProtection.js

**Objetivo:** ≥80% cobertura

**Casos a cubrir:**
- ✅ Generación de tokens únicos
- ✅ Almacenamiento y validación de tokens
- ✅ Expiración de tokens (maxTokenAge)
- ✅ Limpieza de tokens expirados
- ✅ Obtención de sessionId (sessionID, session.id, fallback IP+UA)
- ✅ Middleware csrfProtection:
  - Skip paths configurados
  - Ignore methods (GET, HEAD, OPTIONS)
  - Generación de token para métodos seguros
  - Validación de token para métodos inseguros
  - Cookies con configuración de seguridad
  - Test environment bypass
  - Feature flag bypass
- ✅ Validación timing-safe
- ✅ Edge cases: token inválido, token faltante, token expirado

**Archivo:** `tests/unit/middleware/csrfProtection.test.js`

### 3. Tests para webhookSecurity.js

**Objetivo:** ≥80% cobertura

**Casos a cubrir:**
- ✅ Verificación de firma Stripe (verifyStripeSignature):
  - Firma válida
  - Firma inválida
  - Timestamp fuera de tolerancia (replay attack)
  - Firma faltante
  - Secret faltante
- ✅ Verificación de idempotencia (checkIdempotency):
  - Evento nuevo
  - Evento duplicado
  - Error de base de datos (fail open)
- ✅ Detección de payloads sospechosos (detectSuspiciousWebhookPayload):
  - Patrones de inyección
  - Objetos anidados profundos (DoS)
  - Arrays excesivamente grandes
- ✅ Middleware stripeWebhookSecurity:
  - Body faltante
  - Body demasiado grande
  - Firma inválida
  - JSON inválido
  - Payload sospechoso (log pero no bloquea)
  - Evento duplicado (idempotencia)
  - Validación exitosa
- ✅ Middleware genericWebhookSecurity:
  - Rate limiting
  - Verificación de firma
  - Firma faltante
  - Firma inválida
- ✅ Limpieza de registros de idempotencia expirados
- ✅ Rate limiter webhook específico

**Archivo:** `tests/unit/middleware/webhookSecurity.test.js`

### 4. Tests para adminRateLimiter.js

**Objetivo:** ≥80% cobertura

**Casos a cubrir:**
- ✅ Creación de rate limiter con opciones:
  - windowMs y max configurables
  - Override por variables de entorno
  - Validación de valores mínimos
- ✅ Test environment bypass
- ✅ Feature flag bypass
- ✅ Key generator:
  - Por user ID si autenticado
  - Por IP (con IPv6 support) si no autenticado
- ✅ Handler de rate limit exceeded:
  - Logging
  - Respuesta 429 con retryAfter
- ✅ Skip para health checks
- ✅ Logging de inicialización

**Archivo:** `tests/unit/middleware/adminRateLimiter.test.js`

### 5. Tests para responseCache.js

**Objetivo:** ≥80% cobertura

**Casos a cubrir:**
- ✅ Generación de cache keys (método, URL, user, query)
- ✅ Get/Set de cache:
  - Cache hit
  - Cache miss
  - Expiración de entradas
- ✅ Invalidación:
  - Por patrón string
  - Por patrón RegExp
  - invalidateAdminUsersCache (Issue #739)
- ✅ Limpieza completa (clear)
- ✅ Estadísticas (getStats):
  - Hit rate
  - Tamaño de cache
  - Invalidaciones
- ✅ Middleware cacheResponse:
  - Solo cachea GET requests
  - Skip function
  - Cache hit (envía respuesta cached)
  - Cache miss (intercepta y cachea respuesta)
  - Solo cachea respuestas exitosas (2xx)
  - Headers X-Cache y X-Cache-Key
- ✅ LRU-like behavior (maxSize enforcement)

**Archivo:** `tests/unit/middleware/responseCache.test.js`

## Agentes a Usar

- **Test Engineer** - Generación de tests siguiendo test-generation-skill
- **Guardian** - Validación de seguridad en tests de middleware crítico

## Archivos Afectados

**Nuevos:**
- `tests/unit/middleware/errorHandling.test.js`
- `tests/unit/middleware/csrfProtection.test.js`
- `tests/unit/middleware/webhookSecurity.test.js`
- `tests/unit/middleware/adminRateLimiter.test.js`
- `tests/unit/middleware/responseCache.test.js`

**Modificados:**
- Nodos GDD (actualizar cobertura cuando tests pasen)

## Validación Requerida

1. ✅ Todos los tests pasan (0 failures)
2. ✅ Cobertura ≥80% para cada archivo (statements, functions, branches)
3. ✅ Tests cubren casos de éxito, error, y edge cases
4. ✅ Tests usan mocks apropiados (sin llamadas reales)
5. ✅ Coverage Source: auto (NUNCA manual)
6. ✅ GDD health score ≥87 después de actualización

## Referencias

- `docs/patterns/coderabbit-lessons.md` - Patrones de testing
- `docs/TESTING-GUIDE.md` - Guía de testing
- Tests existentes en `tests/unit/middleware/` como referencia

