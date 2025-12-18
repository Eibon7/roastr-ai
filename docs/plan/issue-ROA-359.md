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

### AC1: Rate Limiting Mejorado
- [ ] Migrar almacenamiento de memoria a Redis (o Upstash)
- [ ] Rate limiting diferenciado por tipo de autenticación:
  - Password login: 5 intentos/15min (mantener)
  - Magic link: 3 intentos/1h (más restrictivo)
  - OAuth: 10 intentos/15min
  - Password reset: 3 intentos/1h (mantener)
- [ ] Rate limiting por IP independiente de email/usuario
- [ ] Rate limiting por email/usuario independiente de IP

### AC2: Abuse Detection Avanzado
- [ ] Detección de patrones de abuse:
  - Múltiples intentos fallidos desde diferentes IPs para mismo email
  - Múltiples intentos fallidos desde misma IP para diferentes emails
  - Intentos en ráfaga (burst detection)
  - Intentos distribuidos en tiempo (slow attack detection)
- [ ] Scoring de riesgo por IP/email/usuario
- [ ] Escalado progresivo de bloqueos (15min → 1h → 24h → permanente)

### AC3: Integración con Audit Logs
- [ ] Eventos de rate limiting registrados en audit logs
- [ ] Eventos de abuse detection registrados en audit logs
- [ ] Eventos de bloqueo/desbloqueo registrados
- [ ] Uso de taxonomía de eventos v2 (ROA-357)

### AC4: Políticas de Abuse
- [ ] Política de bloqueo progresivo:
  - 1ra infracción: 15 minutos
  - 2da infracción: 1 hora
  - 3ra infracción: 24 horas
  - 4ta+ infracción: Bloqueo permanente (requiere intervención manual)
- [ ] Whitelist de IPs (admin-only)
- [ ] Blacklist de IPs (admin-only)
- [ ] Auto-desbloqueo después de período de bloqueo

### AC5: Métricas y Monitoreo
- [ ] Dashboard de métricas de rate limiting
- [ ] Alertas para patrones de abuse sospechosos
- [ ] Métricas por IP, email, tipo de auth
- [ ] Tracking de efectividad de bloqueos

### AC6: Configuración y Feature Flags
- [ ] Configuración de límites desde SSOT
- [ ] Feature flags para habilitar/deshabilitar rate limiting
- [ ] Feature flags para habilitar/deshabilitar abuse detection
- [ ] Configuración de duraciones de bloqueo

---

## 🔧 Archivos Afectados

### Nuevos Archivos
- `src/middleware/authRateLimiterV2.js` - Rate limiting v2 para auth
- `src/services/abuseDetectionService.js` - Servicio de detección de abuse
- `src/services/abusePolicyService.js` - Servicio de políticas de abuse
- `src/utils/abuseScoring.js` - Sistema de scoring de riesgo
- `tests/unit/middleware/authRateLimiterV2.test.js` - Tests unitarios
- `tests/integration/abuseDetection.test.js` - Tests de integración

### Archivos Modificados
- `src/middleware/rateLimiter.js` - Refactorizar para usar Redis
- `src/middleware/security.js` - Integrar con v2
- `src/routes/auth.js` - Aplicar rate limiting v2
- `src/services/auditLogService.js` - Añadir eventos de abuse
- `src/config/authEventsTaxonomy.js` - Añadir eventos de abuse (si aplica)
- `docs/nodes-v2/02-autenticacion-usuarios.md` - Actualizar documentación
- `docs/nodes-v2/14-infraestructura.md` - Actualizar sección de rate limits

### Archivos de Configuración
- `.env.example` - Añadir variables de Redis/Upstash
- `docs/SSOT-V2.md` - Añadir configuración de rate limits (sección 15)

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

### Paso 4: Abuse Policy Service
1. Crear `abusePolicyService.js` con:
   - Política de bloqueo progresivo
   - Whitelist/Blacklist
   - Auto-desbloqueo
2. Integrar con abuse detection
3. Tests de políticas

### Paso 5: Integración con Audit Logs
1. Añadir eventos de abuse a `authEventsTaxonomy.js`
2. Integrar con `auditLogService.js`
3. Registrar eventos de rate limiting, abuse, bloqueos
4. Tests de logging

### Paso 6: Métricas y Monitoreo
1. Crear endpoint de métricas (admin-only)
2. Integrar con sistema de alertas
3. Dashboard básico de métricas
4. Tests de métricas

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
- [ ] Rate limiting por tipo de auth
- [ ] Rate limiting por IP
- [ ] Rate limiting por email/usuario
- [ ] Detección de patrones de abuse
- [ ] Scoring de riesgo
- [ ] Políticas de bloqueo progresivo
- [ ] Whitelist/Blacklist
- [ ] Auto-desbloqueo

### Integration Tests
- [ ] Rate limiting con Redis
- [ ] Fallback a memoria si Redis no disponible
- [ ] Integración con audit logs
- [ ] Integración con auth endpoints
- [ ] Persistencia entre restarts

### E2E Tests
- [ ] Flujo completo de rate limiting en login
- [ ] Flujo completo de abuse detection
- [ ] Bloqueo progresivo funcionando
- [ ] Whitelist/Blacklist funcionando

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

