# Análisis de Implementación Actual - Rate Limiting v2

**Issue:** ROA-526  
**Fecha:** 2025-01-07  
**Status:** FASE 1 - Análisis  

---

## 1. Implementaciones Existentes

### 1.1 Rate Limiters Identificados

| Archivo | Tipo | Descripción | SSOT Integration | Storage |
|---------|------|-------------|------------------|---------|
| `middleware/rateLimiter.js` | Login/Password | Rate limit básico para login/password | ❌ NO (hardcoded limits) | In-memory (Map) |
| `middleware/authRateLimiterV2.js` | Auth (v2) | Rate limiting avanzado con SSOT | ✅ YES (settingsLoaderV2) | Redis/Upstash + Memory fallback |
| `middleware/roastRateLimiter.js` | Roast Generation | Límites específicos para generación de roasts | ⚠️ Unknown (needs review) | Unknown |
| `middleware/roastrPersonaRateLimiter.js` | Persona Updates | Límites para actualizaciones de persona | ⚠️ Unknown (needs review) | Unknown |
| `middleware/notificationRateLimiter.js` | Notifications | Límites para notificaciones | ⚠️ Unknown (needs review) | Unknown |
| `middleware/gdprRateLimiter.js` | GDPR Endpoints | Límites para endpoints GDPR | ⚠️ Unknown (needs review) | Unknown |
| `middleware/passwordChangeRateLimiter.js` | Password Change | Límites para cambio de password | ⚠️ Unknown (needs review) | Unknown |
| `middleware/adminRateLimiter.js` | Admin Endpoints | Límites para rutas admin | ⚠️ Unknown (needs review) | Unknown |
| `services/ingestion/policies/RateLimitPolicy.js` | Ingestion | Rate limiting para ingestion de comentarios | ⚠️ Partial (SSOT defaults in comments) | Redis (sliding window) |

---

## 2. Estado de `authRateLimiterV2.js` (Principal)

### 2.1 Features Implementadas ✅

#### Auth Wiring (Parcial)
- ✅ Middleware pre-auth que verifica bloqueos ANTES de la ejecución de la ruta
- ✅ Middleware post-auth que procesa resultados DESPUÉS de la ejecución
- ✅ Rate limiting por tipo de auth (password, magic_link, oauth, password_reset)
- ✅ Rate limiting independiente por IP y email (con hash SHA256)
- ✅ Bloques progresivos (15min → 1h → 24h → permanent)
- ✅ Detección de abuso integrada (`detectAbuse()`)

#### SSOT Integration
- ✅ Carga de configuración desde SSOT v2 via `settingsLoader.getValue('rate_limit.auth')`
- ✅ Carga de durations progresivas desde SSOT (`rate_limit.auth.block_durations`)
- ✅ Carga de thresholds de abuse desde SSOT (`abuse_detection.thresholds`)
- ✅ Fallbacks seguros si SSOT no disponible
- ✅ Cache de configuración (TTL 1 minuto)

#### Storage
- ✅ Redis/Upstash como storage principal
- ✅ Fallback a memoria si Redis no disponible
- ✅ Limpieza automática de timers (evita memory leaks - ROA-359)

#### Observability (Parcial)
- ✅ Logging estructurado con `logger.info/warn/error`
- ✅ Audit logging via `auditLogService` para eventos:
  - `auth.abuse.detected`
  - `auth.rate_limit.blocked`
  - `auth.rate_limit.hit`
  - `auth.rate_limit.unblocked`
- ✅ Métricas internas (`metrics.getMetrics()`)
  - `auth_rate_limit_hits_total`
  - `auth_blocks_active`
  - `auth_abuse_events_total`

### 2.2 Gaps Identificados ❌

#### Auth Wiring
- ❌ **NO integrado en TODOS los endpoints auth**: Solo funciona si se aplica el middleware explícitamente
- ❌ **Falta integración con `middleware/auth.js`**: El auth middleware estándar no usa rate limiting
- ❌ **NO hay rate limiting por plan/tier**: Todos los usuarios tienen los mismos límites (no diferencia free vs pro)

#### Observability
- ❌ **NO hay correlation tracking**: No se propaga `X-Request-Id` ni `X-User-Id` en headers
- ❌ **NO hay exportación de métricas**: Métricas son internas, no se exportan a Prometheus/Datadog
- ❌ **Falta dashboarding**: No hay configuración de Grafana/Datadog dashboards
- ❌ **Logs NO estructurados con GDPR-compliance**: Falta verificar estructura de logs según SSOT §13

#### Global Validation
- ❌ **NO hay validación en startup**: No se verifica que SSOT tenga valores válidos al arrancar API
- ❌ **NO hay health check**: No existe endpoint `/health/rate-limiter`
- ❌ **NO hay script de validación**: No existe `scripts/validate-rate-limit-config.js`

---

## 3. Estado de `middleware/rateLimiter.js` (Legacy)

### 3.1 Features
- ✅ Rate limiting básico para login (IP + email)
- ✅ Storage en memoria con Map()
- ✅ Cleanup automático cada 10 minutos
- ✅ Métricas básicas (`getMetrics()`)

### 3.2 Problemas ❌
- ❌ **NO usa SSOT**: Límites hardcoded
- ❌ **NO usa Redis**: Solo memoria (no funciona en multi-instance)
- ❌ **NO tiene rate limiting por plan**: Todos los usuarios igual
- ❌ **Intercepta `res.end`**: Patrón legacy propenso a errores

### 3.3 Recomendación
- 🔄 **Migrar a authRateLimiterV2**: Este middleware debe deprecarse en favor de v2
- 🔄 **Mantener temporalmente**: Hasta que v2 esté completamente integrado

---

## 4. Estado de `services/ingestion/policies/RateLimitPolicy.js`

### 4.1 Features
- ✅ Rate limiting para ingestion (global, per-user, per-account)
- ✅ Storage en Redis con sliding window
- ✅ Comentarios con valores de SSOT (12.6)

### 4.2 Problemas ❌
- ❌ **NO carga desde SSOT**: Valores hardcoded con comentario "TODO: Load from SettingsLoader"
- ❌ **NO integrado con authRateLimiterV2**: Sistema separado

### 4.3 Recomendación
- 🔄 **Integrar con settingsLoader**: Cargar desde SSOT §12.6
- ✅ **Mantener separado**: Ingestion rate limiting es diferente de auth rate limiting

---

## 5. Análisis de `middleware/auth.js`

### 5.1 Estado Actual
- ✅ Middleware de autenticación funcional
- ✅ Usa `getUserFromToken()` de Supabase
- ✅ Auth Error Taxonomy v2 integrado
- ❌ **NO tiene rate limiting aplicado**: Solo verifica token, no aplica límites

### 5.2 Propuesta de Integración
```javascript
// En src/middleware/auth.js
const { authRateLimiterV2 } = require('./authRateLimiterV2');

// Aplicar rate limiting ANTES de verificar token
const authenticateToken = async (req, res, next) => {
  // Primero, rate limiting
  await authRateLimiterV2Pre(req, res, () => {
    if (res.headersSent) return; // Si bloqueado por rate limit, stop
    
    // Luego, verificar token
    // ... (código actual)
  });
};
```

---

## 6. Plan de Acción

### 6.1 Prioridad Alta (P0)

1. **Auth Wiring:**
   - Integrar `authRateLimiterV2` en `middleware/auth.js`
   - Asegurar que TODOS los endpoints auth usen rate limiting

2. **Global Validation:**
   - Crear `scripts/validate-rate-limit-config.js`
   - Integrar validación en startup (`src/index.js`)
   - Crear health check endpoint `/health/rate-limiter`

3. **Observability:**
   - Añadir correlation tracking (`X-Request-Id`, `X-User-Id`)
   - Estructurar logs según GDPR (SSOT §13)

### 6.2 Prioridad Media (P1)

4. **Observability:**
   - Exportar métricas (Prometheus/Datadog)
   - Configurar dashboards

5. **Auth Wiring:**
   - Añadir rate limiting por plan/tier (free vs pro)

6. **Ingestion Rate Limiting:**
   - Migrar RateLimitPolicy a usar settingsLoader

### 6.3 Prioridad Baja (P2)

7. **Deprecation:**
   - Deprecar `middleware/rateLimiter.js` (legacy)
   - Migrar todos los usos a `authRateLimiterV2`

---

## 7. Decisiones Técnicas

### 7.1 Storage
- ✅ **Redis/Upstash** como storage principal (ya implementado)
- ✅ **Memory fallback** para desarrollo/test (ya implementado)

### 7.2 Rate Limiting Strategy
- ✅ **Sliding window** para ingestion (RateLimitPolicy)
- ✅ **Fixed window con progressive blocks** para auth (authRateLimiterV2)

### 7.3 Fallback Behavior
- ✅ **Fail-safe (allow requests)** si Redis down (authRateLimiterV2)
- ✅ **Fail-safe (block requests)** si Redis down (RateLimitPolicy) - más seguro para ingestion

### 7.4 SSOT Integration
- ✅ **settingsLoaderV2** como interface única para SSOT
- ✅ **Cache de 1 minuto** para evitar lookups frecuentes
- ✅ **Fallbacks seguros** si SSOT no disponible

---

## 8. Archivos a Revisar en Detalle

### 8.1 Rate Limiters Adicionales (Pendiente)
- [ ] `middleware/roastRateLimiter.js`
- [ ] `middleware/roastrPersonaRateLimiter.js`
- [ ] `middleware/notificationRateLimiter.js`
- [ ] `middleware/gdprRateLimiter.js`
- [ ] `middleware/passwordChangeRateLimiter.js`
- [ ] `middleware/adminRateLimiter.js`

### 8.2 Services Relevantes
- [ ] `src/services/settingsLoaderV2.js` (verificar API)
- [ ] `src/services/abuseDetectionService.js` (verificar integración)
- [ ] `src/services/auditLogService.js` (verificar formato de logs)

### 8.3 Config/SSOT
- [ ] `docs/SSOT-V2.md` §1.4 (rate_limits)
- [ ] `docs/SSOT-V2.md` §13 (GDPR logs)
- [ ] `docs/SSOT-V2.md` §16 (billing, plan limits)

---

## 9. Próximos Pasos Inmediatos

1. ✅ **Análisis completado** (este documento)
2. ⏭️ **Revisar settingsLoaderV2.js** para entender API de carga de config
3. ⏭️ **Crear script de validación** `validate-rate-limit-config.js`
4. ⏭️ **Integrar authRateLimiterV2** en `middleware/auth.js`
5. ⏭️ **Añadir correlation tracking** en logging
6. ⏭️ **Crear health check endpoint** `/health/rate-limiter`

---

**Status:** ✅ FASE 1 completada  
**Próxima FASE:** FASE 2 - Implementation (Auth Wiring + Validation)

