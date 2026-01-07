# Plan de Implementación: ROA-526 - Rate Limiting v2

**Issue:** ROA-526  
**Título:** Rate Limiting v2: Auth Wiring, Observability, and Global Validation  
**Prioridad:** [TBD - verificar en Linear]  
**Tipo:** `type:backend`, `type:docs`, `type:ci`, `type:analysis`  
**Fecha de creación:** 2025-01-07  

---

## 1. Estado Actual

### Contexto del Sistema

**Nodos GDD Resueltos:**
- `14-infraestructura.md` - Incluye subnodo `rate-limits`
- `observabilidad.md` - Logging estructurado, correlación, métricas
- `15-ssot-integration.md` - Carga de configuración desde SSOT
- `billing.md` - Estados de suscripción, límites por plan
- `04-integraciones.md` - Platform limits, smart delays

**Referencias SSOT Críticas:**
- `plans_and_limits` (SSOT §1)
- `rate_limits` (SSOT §1.4)
- `gdpr_allowed_log_structure` (SSOT §13)
- `worker_logs` (SSOT §13.4)
- `platform_limits` (SSOT §5.2)
- `billing_provider` (SSOT §16)
- `subscription_states` (SSOT §16.1)

### Estado Legacy (v1)

Según los nodos resueltos:
- **Infraestructura**: Rate limiting básico implementado pero sin integración auth completa
- **Observabilidad**: Logging estructurado existe pero no específico para rate limiting
- **Billing**: Integración con Polar pero no conectada a rate limits
- **Integraciones**: Platform limits hardcoded en algunos lugares

### Gaps Identificados

1. **Auth Wiring**: No hay conexión entre middleware de autenticación y rate limiter
2. **Observability**: Faltan métricas específicas de rate limiting (hits, rejections, resets)
3. **Global Validation**: No hay validación centralizada de configuración de rate limits en startup
4. **SSOT Compliance**: Algunos límites hardcoded en lugar de usar SSOT

---

## 2. Objetivos de la Issue

### Acceptance Criteria (inferidos del título)

1. **Auth Wiring**
   - [ ] Middleware de autenticación integrado con rate limiter
   - [ ] Rate limits por plan (free, basic, creator_plus) desde SSOT
   - [ ] Rate limits diferenciados por endpoint/recurso
   - [ ] Manejo de usuarios no autenticados

2. **Observability**
   - [ ] Logs estructurados para eventos de rate limiting (hit, reject, reset)
   - [ ] Correlation tracking con `X-Request-Id` y `X-User-Id`
   - [ ] Métricas exportables (Prometheus/Datadog format)
   - [ ] Dashboards/alertas configurables

3. **Global Validation**
   - [ ] Validación de configuración de rate limits en startup
   - [ ] Detección de conflictos/inconsistencias en config
   - [ ] Reporte de health check de rate limiter
   - [ ] Documentación de validadores

### Restricciones

- **NO modificar SSOT** fuera de §15 (section management)
- **NO hardcodear** valores de rate limits (usar SSOT)
- **NO tocar** worktrees de otras issues
- **NO leer** `spec.md` (excepto si hay `area:observability` o `test:e2e`)

---

## 3. Pasos de Implementación

### FASE 1: Análisis y Diseño

**Tareas:**
1. Revisar implementación actual de rate limiting en `src/middleware/`
2. Identificar endpoints críticos para rate limiting
3. Mapear planes de billing a límites específicos (desde SSOT §1)
4. Diseñar estructura de logs para rate limiting (compatible con GDPR §13)
5. Definir métricas key (requests/min, rejections/hour, etc.)

**Archivos a revisar:**
- `src/middleware/auth.js` (o equivalente)
- `src/middleware/rateLimit.js` (si existe)
- `src/services/settingsLoader.ts` (SSOT loader)
- `docs/SSOT-V2.md` §1, §13, §16

**Salida esperada:**
- Diagrama de flujo: Request → Auth → Rate Limiter → Endpoint
- Tabla de rate limits por plan y endpoint
- Schema de logs estructurados para rate limiting

### FASE 2: Auth Wiring Implementation

**Tareas:**
1. Extender/crear middleware de rate limiting con soporte de auth
2. Integrar con `settingsLoader.ts` para cargar límites desde SSOT
3. Implementar lógica de rate limit por `userId` y `plan`
4. Manejar casos edge: usuarios no auth, tokens inválidos, plan suspended
5. Añadir headers de respuesta: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Archivos a crear/modificar:**
- `src/middleware/rateLimiterV2.js` (nuevo)
- `src/middleware/auth.js` (integración)
- `src/utils/rateLimitHelpers.js` (helpers)

**Tests requeridos:**
- Unit tests para lógica de rate limiting por plan
- Integration tests con auth mock y diferentes planes
- Edge case tests (plan suspended, no auth, límite excedido)

### FASE 3: Observability Integration

**Tareas:**
1. Definir eventos de rate limiting en `src/utils/logger.js`
2. Implementar structured logging con campos GDPR-compliant
3. Añadir correlation tracking (`X-Request-Id`, `X-User-Id`)
4. Crear métricas exportables (usando Axiom/Datadog client si disponible)
5. Documentar formato de logs en `docs/nodes-v2/observabilidad.md`

**Archivos a crear/modificar:**
- `src/utils/rateLimitLogger.js` (nuevo)
- `src/middleware/rateLimiterV2.js` (añadir logging)
- `docs/nodes-v2/observabilidad.md` (actualizar sección de rate limiting)

**Formato de log esperado:**
```json
{
  "timestamp": "2025-01-07T10:30:00Z",
  "level": "info",
  "event": "rate_limit.hit",
  "userId": "user_123",
  "plan": "basic",
  "endpoint": "/api/roast/generate",
  "limit": 100,
  "remaining": 85,
  "resetAt": "2025-01-07T11:00:00Z",
  "requestId": "req_abc123",
  "gdprSafe": true
}
```

### FASE 4: Global Validation

**Tareas:**
1. Crear script de validación en `scripts/validate-rate-limit-config.js`
2. Validar que todos los endpoints críticos tienen rate limits definidos en SSOT
3. Detectar conflictos/duplicados en configuración
4. Integrar validación en startup de API (`src/index.js`)
5. Añadir health check endpoint `/health/rate-limiter`

**Archivos a crear/modificar:**
- `scripts/validate-rate-limit-config.js` (nuevo)
- `src/index.js` (añadir validación en startup)
- `src/routes/health.js` (añadir endpoint)

**Validaciones requeridas:**
- Todos los endpoints críticos tienen límites definidos
- Límites son consistentes con SSOT §1.4
- No hay valores hardcoded en middleware
- Configuración es parseable y válida

### FASE 5: Documentación y Evidencia

**Tareas:**
1. Actualizar `docs/nodes-v2/14-infraestructura.md` (sección rate-limits)
2. Actualizar `docs/nodes-v2/observabilidad.md` (logs de rate limiting)
3. Actualizar `docs/nodes-v2/15-ssot-integration.md` (validadores)
4. Crear `docs/test-evidence/issue-ROA-526/summary.md`
5. Generar capturas de logs/métricas si es relevante

**Archivos a actualizar:**
- `docs/nodes-v2/14-infraestructura.md`
- `docs/nodes-v2/observabilidad.md`
- `docs/nodes-v2/15-ssot-integration.md`
- `docs/test-evidence/issue-ROA-526/summary.md`

---

## 4. Agentes Requeridos

### TestEngineer
- **Trigger:** Cambios en `src/middleware/`, nuevos tests requeridos
- **Workflow:** Composer → @tests/ @src/middleware/rateLimiterV2.js → Generar tests siguiendo test-generation-skill
- **Receipt:** `docs/agents/receipts/cursor-test-engineer-[timestamp].md`

### Guardian
- **Trigger:** Cambios en SSOT (si aplica), validación de rate limits críticos
- **Workflow:** `node scripts/guardian-gdd.js --full` + manual audit
- **Receipt:** `docs/agents/receipts/cursor-guardian-[timestamp].md`

### (Opcional) Explore
- **Trigger:** Si necesito investigar implementación actual de rate limiting
- **Workflow:** Research de `src/middleware/` y `src/routes/`
- **Receipt:** `docs/agents/receipts/cursor-explore-[timestamp].md`

---

## 5. Archivos Afectados

### Archivos Nuevos
- `src/middleware/rateLimiterV2.js`
- `src/utils/rateLimitHelpers.js`
- `src/utils/rateLimitLogger.js`
- `scripts/validate-rate-limit-config.js`
- `docs/test-evidence/issue-ROA-526/summary.md`

### Archivos Modificados
- `src/middleware/auth.js` (integración con rate limiter)
- `src/index.js` (validación en startup)
- `src/routes/health.js` (health check endpoint)
- `src/utils/logger.js` (posible extensión)
- `docs/nodes-v2/14-infraestructura.md`
- `docs/nodes-v2/observabilidad.md`
- `docs/nodes-v2/15-ssot-integration.md`

### Archivos de Test
- `tests/unit/middleware/rateLimiterV2.test.js`
- `tests/integration/rateLimiterAuth.test.js`
- `tests/unit/utils/rateLimitHelpers.test.js`

---

## 6. Dependencias Externas

### SSOT (docs/SSOT-V2.md)
- §1.4 `rate_limits` - Límites por plan y endpoint
- §13 `gdpr_allowed_log_structure` - Campos permitidos en logs
- §16 `billing_provider`, `subscription_states` - Estados de facturación

### Servicios Externos
- Redis/Upstash (para almacenamiento de contadores de rate limiting)
- Axiom/Datadog (para métricas y logs)
- Polar (billing provider, para verificar plan actual)

### Nodos GDD Relacionados
- `14-infraestructura.md` (rate-limits subnode)
- `observabilidad.md` (logging, metrics)
- `15-ssot-integration.md` (settingsLoader)
- `billing.md` (plan limits)
- `04-integraciones.md` (platform limits)

---

## 7. Criterios de Validación

### Pre-Implementation
- [ ] Plan aprobado y revisado
- [ ] Nodos GDD resueltos y leídos
- [ ] SSOT §1.4, §13, §16 revisado
- [ ] Arquitectura de rate limiting diseñada

### During Implementation
- [ ] Código sigue patrones existentes en `src/middleware/`
- [ ] Valores vienen de SSOT (no hardcoded)
- [ ] Logs estructurados y GDPR-compliant
- [ ] Tests escritos para cada función/módulo

### Post-Implementation (FASE 4 - Validation)
- [ ] `node scripts/validate-v2-doc-paths.js` pasa
- [ ] `node scripts/validate-ssot-health.js` pasa
- [ ] `node scripts/check-system-map-drift.js` pasa
- [ ] `node scripts/validate-strong-concepts.js` pasa
- [ ] `node scripts/validate-rate-limit-config.js` pasa (nuevo script)
- [ ] `npm test` pasa al 100%
- [ ] `npm run test:coverage` >= 90%
- [ ] `node scripts/validate-gdd-runtime.js --full` pasa
- [ ] `node scripts/score-gdd-health.js --ci` >= 87

### Pre-Push
- [ ] Branch es `feature/ROA-526-auto`
- [ ] `.issue_lock` apunta a rama correcta
- [ ] Solo archivos del scope modificados
- [ ] SSOT health score >= 87
- [ ] No conflictos con `main`

---

## 8. Notas de Implementación

### Patrones a Seguir
- **Rate Limiting Storage:** Usar Redis/Upstash para contadores (evitar memoria local)
- **Auth Integration:** Usar `req.user` del middleware de auth (no reinventar)
- **Logging:** Usar `logger.info()` con campos estructurados, no `console.log()`
- **SSOT Loading:** Usar `settingsLoader.get('rate_limits.{plan}.{endpoint}')`, no hardcode

### Edge Cases Críticos
1. **Usuario no autenticado:** Aplicar rate limit más restrictivo (ej: IP-based)
2. **Plan suspended:** Rechazar todas las peticiones con 403
3. **Límite excedido:** 429 Too Many Requests con headers correctos
4. **SSOT no disponible:** Usar fallback seguro (límite más restrictivo)
5. **Redis down:** Fallar de forma segura (permitir requests o rechazar?)

### Decisiones Pendientes
- [ ] ¿Rate limiting por IP para usuarios no auth?
- [ ] ¿Fallback si Redis no disponible? (allow o deny)
- [ ] ¿Qué endpoints requieren rate limiting? (definir lista)
- [ ] ¿Usar sliding window o fixed window para rate limiting?

---

## 9. Estimación de Esfuerzo

**Tiempo estimado:** 3-5 días (dependiendo de complejidad de auth wiring)

- FASE 1 (Análisis): 0.5 días
- FASE 2 (Auth Wiring): 1.5 días
- FASE 3 (Observability): 1 día
- FASE 4 (Validation): 0.5 días
- FASE 5 (Docs + Tests): 1 día
- Buffer (Code Review, Fixes): 0.5 días

---

## 10. Siguientes Pasos Inmediatos

1. ✅ Plan creado
2. ⏭️ Ejecutar `node scripts/cursor-agents/detect-triggers.js` (FASE 2)
3. ⏭️ Activar agentes necesarios
4. ⏭️ Revisar implementación actual de rate limiting en codebase
5. ⏭️ Comenzar FASE 1 (Análisis y Diseño)

---

**Estado del Plan:** 🟢 DRAFT - Pendiente de aprobación automática según workflow  
**Próxima acción:** FASE 2 - Agent Activation

