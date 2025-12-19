# Plan de Implementación - ROA-359: A4 Auth Rate Limiting and Abuse Policy v2

**Issue:** ROA-359 - A4 Auth Rate Limiting and Abuse Policy v2  
**Priority:** P0/P1 (Security Critical)  
**Status:** Planning  
**Created:** 2025-12-07  
**Worktree:** `/Users/emiliopostigo/roastr-ai-worktrees/ROA-359`  
**Branch:** `feature/ROA-359-auto`

---

## 🎯 Estado Actual

### Sistema Existente (v1)

**Rate Limiting Actual:**
- `src/middleware/rateLimiter.js` - Rate limiting para login (5 intentos/15min) y password change (3 intentos/1h)
- `src/middleware/security.js` - Rate limiting general (100 req/15min), auth (10 req/15min), billing (20 req/15min)
- Almacenamiento en memoria (Map) - NO escalable, se pierde en restart
- Bloqueo temporal después de exceder límites
- Métricas básicas (totalAttempts, blockedAttempts, uniqueIPs)

**Abuse Detection Actual:**
- `src/middleware/inputValidation.js` - Detección de patrones maliciosos
- Detección de User-Agent sospechoso
- Validación de inputs con patrones regex

**Limitaciones Identificadas:**
1. ❌ Almacenamiento en memoria - NO funciona en multi-instancia
2. ❌ No hay persistencia entre restarts
3. ❌ Métricas limitadas - no hay tracking de patrones de abuse
4. ❌ No hay escalado progresivo de bloqueos
5. ❌ No hay integración con audit logs para eventos de abuse
6. ❌ No hay detección de ataques coordinados (múltiples IPs)
7. ❌ No hay whitelist/blacklist de IPs
8. ❌ No hay rate limiting diferenciado por tipo de auth (OAuth, magic link, password)

---

## 📋 Acceptance Criteria

**⚠️ SCOPE DE ESTA PR: Implementación completa del enforcement backend (rate limiting + abuse detection + policies runtime)**

Esta PR implementa el **sistema de enforcement backend completo** para rate limiting y abuse detection. Incluye:
- ✅ Rate limiting diferenciado por tipo de auth con Redis/Upstash
- ✅ Abuse detection service con detección de patrones
- ✅ Políticas de bloqueo progresivo (runtime enforcement)
- ✅ Integración con audit logs y métricas internas
- ✅ Configuración desde SSOT v2

**OUT OF SCOPE (deferido a issues futuras):**
- ❌ Admin UI para whitelist/blacklist de IPs (requiere endpoints admin)
- ❌ Dashboards visuales de métricas (solo contadores internos)
- ❌ Endpoints admin para gestión de bloqueos (requiere admin API)

### AC1: Rate Limiting Mejorado ✅ **IN-SCOPE - IMPLEMENTING**
- [x] Migrar almacenamiento de memoria a Redis (o Upstash) ✅ **IMPLEMENTED**
- [x] Rate limiting diferenciado por tipo de autenticación ✅ **IMPLEMENTED**
  - Password login: 5 intentos/15min
  - Magic link: 3 intentos/1h
  - OAuth: 10 intentos/15min
  - Password reset: 3 intentos/1h
- [x] Rate limiting por IP independiente de email/usuario ✅ **IMPLEMENTED**
- [x] Rate limiting por email/usuario independiente de IP ✅ **IMPLEMENTED**

### AC2: Abuse Detection Avanzado ✅ **IN-SCOPE - IMPLEMENTED**
- [x] Detección de patrones de abuse ✅ **IMPLEMENTED**
  - Múltiples intentos fallidos desde diferentes IPs para mismo email
  - Múltiples intentos fallidos desde misma IP para diferentes emails
  - Intentos en ráfaga (burst detection)
  - Intentos distribuidos en tiempo (slow attack detection)
- [x] Scoring de riesgo por IP/email/usuario (básico, sin ML) ✅ **IMPLEMENTED**
- [x] Escalado progresivo de bloqueos (15min → 1h → 24h → permanente) ✅ **IMPLEMENTED**

### AC3: Integración con Audit Logs ✅ **IN-SCOPE - IMPLEMENTED**
- [x] Eventos de rate limiting registrados en audit logs ✅ **IMPLEMENTED**
- [x] Eventos de abuse detection registrados en audit logs ✅ **IMPLEMENTED**
- [x] Eventos de bloqueo/desbloqueo registrados ✅ **IMPLEMENTED**
- [x] Uso de taxonomía de eventos v2 (ROA-357) ✅ **IMPLEMENTED**

### AC4: Políticas de Abuse ✅ **IN-SCOPE - IMPLEMENTED**
- [x] Política de bloqueo progresivo (runtime enforcement) ✅ **IMPLEMENTED**
  - 1ra infracción: 15 minutos
  - 2da infracción: 1 hora
  - 3ra infracción: 24 horas
  - 4ta+ infracción: Bloqueo permanente (requiere intervención manual)
- [x] Auto-desbloqueo después de período de bloqueo ✅ **IMPLEMENTED** (via TTL en Redis/memory)
- [ ] Whitelist de IPs (admin-only) - **OUT OF SCOPE** (requiere admin endpoints y UI, deferido)
- [ ] Blacklist de IPs (admin-only) - **OUT OF SCOPE** (requiere admin endpoints y UI, deferido)

### AC5: Métricas y Monitoreo ✅ **IN-SCOPE - IMPLEMENTED**
- [x] Contadores internos de métricas (logs/contadores, no dashboard) ✅ **IMPLEMENTED**
  - `auth_rate_limit_hits_total` - Total de hits de rate limit
  - `auth_blocks_active` - Bloques activos (gauge)
  - `auth_abuse_events_total` - Total de eventos de abuse detectados
- [x] Métricas por IP, email, tipo de auth ✅ **IMPLEMENTED** (en logs estructurados)
- [x] Tracking de efectividad de bloqueos ✅ **IMPLEMENTED** (via audit logs)
- [ ] Dashboard visual de métricas - **OUT OF SCOPE** (solo contadores internos, no UI)

### AC6: Configuración y Feature Flags ✅ **IN-SCOPE - IMPLEMENTED**
- [x] Configuración de límites desde SSOT ✅ **IMPLEMENTED**
- [x] Feature flags para habilitar/deshabilitar rate limiting ✅ **IMPLEMENTED**
- [x] Feature flags para habilitar/deshabilitar abuse detection ✅ **IMPLEMENTED** (ENABLE_ABUSE_DETECTION)
- [x] Configuración de duraciones de bloqueo ✅ **IMPLEMENTED**

**AC6 Implementation Details (ROA-359):**

**Keys SSOT leídas:**
- `rate_limit.auth` → Configuración de rate limits por tipo de autenticación:
  - `password`: windowMs, maxAttempts, blockDurationMs
  - `magic_link`: windowMs, maxAttempts, blockDurationMs
  - `oauth`: windowMs, maxAttempts, blockDurationMs
  - `password_reset`: windowMs, maxAttempts, blockDurationMs
- `rate_limit.auth.block_durations` → Array de duraciones progresivas:
  - `[0]`: 15 minutos (1ra infracción)
  - `[1]`: 1 hora (2da infracción)
  - `[2]`: 24 horas (3ra infracción)
  - `[3]`: null (permanente, 4ta+ infracción)

**Fallbacks (solo si SSOT no disponible):**
- `FALLBACK_RATE_LIMIT_CONFIG`: Valores por defecto documentados en código (mismos valores que SSOT sección 7.4)
- `FALLBACK_PROGRESSIVE_BLOCK_DURATIONS`: Valores por defecto documentados en código (mismos valores que SSOT sección 7.4)

**Características:**
- ✅ Configuración cargada desde SSOT v2 usando `SettingsLoaderV2`
- ✅ Cache de configuración para performance (invalida cuando SSOT cambia via `invalidateConfigCache()`)
- ✅ **NO hay valores hardcodeados activos** - todos vienen de SSOT o fallbacks documentados
- ✅ Feature flag `ENABLE_RATE_LIMIT` ya implementado
- ✅ Hot-reload: Cambios en SSOT se reflejan sin redeploy (cache invalidation)

---

## 🔧 Archivos Afectados

### Nuevos Archivos (Presentes en esta PR)
- `src/middleware/authRateLimiterV2.js` - Rate limiting v2 para auth (✅ implementado)
- `src/services/abuseDetectionService.js` - Servicio de detección de abuse (✅ implementado)
- `tests/unit/middleware/authRateLimiterV2.test.js` - Tests unitarios (✅ implementado)

### Archivos Modificados (Presentes en esta PR)
- `src/routes/auth.js` - Integración de rate limiting v2 (✅ implementado)
- `src/config/authEventsTaxonomy.js` - Eventos de rate limiting y abuse (✅ implementado)
- `docs/SSOT-V2.md` - Configuración de rate limits sección 7.4 (✅ implementado)
- `docs/plan/issue-ROA-359.md` - Este plan (✅ actualizado)

### Archivos Fuera de Alcance / Futuro
- `src/services/abusePolicyService.js` - No implementado (políticas están en authRateLimiterV2)
- `src/utils/abuseScoring.js` - No implementado (scoring está en abuseDetectionService)
- `tests/integration/abuseDetection.test.js` - Deferido a tests futuros
- `src/middleware/rateLimiter.js` - No modificado (v1 se mantiene)
- `src/middleware/security.js` - No modificado (v1 se mantiene)
- Admin UI / Dashboards - Fuera de scope (requiere endpoints admin)

---

## 🚀 Pasos de Implementación

### Paso 1: Setup Redis/Upstash
1. Verificar si Redis/Upstash está disponible
2. Crear cliente Redis para rate limiting
3. Crear abstracción de almacenamiento (MemoryStore vs RedisStore)
4. Tests de conexión y fallback a memoria

### Paso 2: Rate Limiting v2 Core
1. Crear `authRateLimiterV2.js` con:
   - Rate limiting por tipo de auth
   - Rate limiting por IP
   - Rate limiting por email/usuario
   - Integración con Redis
2. Migrar lógica existente de `rateLimiter.js`
3. Mantener compatibilidad con v1 durante transición

### Paso 3: Abuse Detection Service
1. Crear `abuseDetectionService.js` con:
   - Detección de patrones de abuse
   - Scoring de riesgo
   - Tracking de intentos distribuidos
2. Integrar con rate limiting v2
3. Tests de detección de patrones

### Paso 4: Políticas de Bloqueo Progresivo
1. Implementar política de bloqueo progresivo en `authRateLimiterV2.js`:
   - Escalado automático (15min → 1h → 24h → permanente)
   - Cálculo correcto de `retryAfter` usando `progressiveBlockDurations`
   - Manejo de bloques permanentes (sin `retryAfter`)
2. Integrar con abuse detection para acelerar bloqueos
3. Tests de políticas progresivas

**Nota:** Whitelist/Blacklist de IPs está OUT OF SCOPE (requiere admin endpoints)

### Paso 5: Integración con Audit Logs
1. Añadir eventos de abuse a `authEventsTaxonomy.js`
2. Integrar con `auditLogService.js`
3. Registrar eventos de rate limiting, abuse, bloqueos
4. Tests de logging

### Paso 6: Métricas y Monitoreo
1. Implementar contadores internos de métricas:
   - `auth_rate_limit_hits_total` (counter)
   - `auth_blocks_active` (gauge)
   - `auth_abuse_events_total` (counter)
2. Integrar con `metricsService` para emisión de métricas
3. Tests de métricas

**Nota:** Dashboard visual y endpoint admin están OUT OF SCOPE (solo contadores internos)

### Paso 7: Configuración SSOT
1. Añadir configuración de rate limits a SSOT-V2
2. Feature flags para rate limiting v2
3. Documentación de configuración

### Paso 8: Migración y Tests
1. Tests unitarios completos
2. Tests de integración
3. Tests E2E de rate limiting
4. Migración gradual de v1 a v2
5. Validación de no regresión

---

## 🧪 Test Matrix

### Unit Tests
- [x] Rate limiting por tipo de auth ✅ **IMPLEMENTED**
- [x] Rate limiting por IP ✅ **IMPLEMENTED**
- [x] Rate limiting por email/usuario ✅ **IMPLEMENTED**
- [x] Detección de patrones de abuse ✅ **IMPLEMENTED**
- [x] Scoring de riesgo ✅ **IMPLEMENTED** (básico, sin ML)
- [x] Políticas de bloqueo progresivo ✅ **IMPLEMENTED**
- [x] Auto-desbloqueo ✅ **IMPLEMENTED** (via TTL)
- [ ] Whitelist/Blacklist - **OUT OF SCOPE** (requiere admin endpoints)

### Integration Tests
- [x] Rate limiting con Redis ✅ **IMPLEMENTED** (en tests unitarios)
- [x] Fallback a memoria si Redis no disponible ✅ **IMPLEMENTED** (en tests unitarios)
- [x] Integración con audit logs ✅ **IMPLEMENTED** (mocked en tests)
- [x] Integración con auth endpoints ✅ **IMPLEMENTED** (en src/routes/auth.js)
- [ ] Persistencia entre restarts - **DEFERRED** (tests E2E futuros)

### E2E Tests
- [ ] Flujo completo de rate limiting en login - **DEFERRED** (tests E2E futuros)
- [ ] Flujo completo de abuse detection - **DEFERRED** (tests E2E futuros)
- [ ] Bloqueo progresivo funcionando - **DEFERRED** (tests E2E futuros)
- [ ] Whitelist/Blacklist funcionando - **OUT OF SCOPE** (requiere admin endpoints)

---

## 🔒 Seguridad

### Consideraciones
- ❌ NO exponer información sensible en respuestas de rate limiting
- ❌ NO revelar timing exacto de bloqueos (prevenir enumeration)
- ✅ Usar hashing para emails en almacenamiento
- ✅ Validar inputs antes de procesar
- ✅ Rate limiting en todos los endpoints de auth
- ✅ Logging de eventos de abuse para auditoría

### Validaciones
- [ ] No hay información de usuarios en logs de rate limiting
- [ ] Emails hasheados en almacenamiento
- [ ] Timing no revela información sobre bloqueos
- [ ] Rate limiting aplicado a todos los endpoints de auth
- [ ] Audit logs contienen información suficiente para investigación

---

## 📊 Métricas de Éxito

- [ ] Reducción de intentos de brute force > 80%
- [ ] Tiempo de detección de abuse < 5 minutos
- [ ] Falsos positivos < 1%
- [ ] Cobertura de tests > 90%
- [ ] Latencia de rate limiting < 10ms

---

## 🔗 Referencias

- Nodo GDD Auth: `docs/nodes-v2/02-autenticacion-usuarios.md`
- Nodo GDD Infraestructura: `docs/nodes-v2/14-infraestructura.md`
- Rate Limiting Actual: `src/middleware/rateLimiter.js`
- Security Middleware: `src/middleware/security.js`
- Auth Events Taxonomy: `src/config/authEventsTaxonomy.js` (ROA-357)
- SSOT: `docs/SSOT-V2.md`

---

## 📝 Notas de Implementación

### Redis/Upstash
- Usar Upstash si Redis no está disponible
- Fallback a memoria si ambos fallan
- Configurar TTL apropiado para keys

### Compatibilidad
- Mantener v1 funcionando durante migración
- Feature flag para habilitar v2 gradualmente
- No romper endpoints existentes

### Performance
- Rate limiting debe ser < 10ms de latencia
- Usar pipeline de Redis para operaciones batch
- Cache de whitelist/blacklist en memoria

---

**Última actualización:** 2025-12-07  
**Estado:** Planning completo - Listo para implementación

