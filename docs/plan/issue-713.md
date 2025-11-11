# Plan de Implementación - Issue #713: Dashboard de Monitoreo de Workers

**Issue:** #713  
**Título:** Worker Monitoring Dashboard - Create dashboard and alerting system  
**Prioridad:** P1  
**Estado:** En Planificación  
**Fecha:** 2025-11-11

## Estado Actual

### Contexto
- Workers existentes: `FetchCommentsWorker`, `AnalyzeToxicityWorker`, `GenerateReplyWorker`, `ShieldActionWorker`
- Queue system documentado en `docs/nodes/queue-system.md`
- Existe `src/services/monitoringService.js` con métricas básicas
- Existe `src/routes/workers.js` con endpoints `/api/workers/status` y `/api/workers/health`
- Existe `src/workers/WorkerManager.js` con métodos `getStats()` y `getHealthStatus()`
- No hay dashboard centralizado de monitoreo
- No hay sistema de alertas para workers fallidos

### Gap Identificado
- No hay visibilidad en tiempo real del estado de workers
- No hay monitoreo de profundidad de cola
- No hay tracking de trabajos fallidos
- No hay sistema de alertas (email/Slack)
- No hay endpoint de métricas estructurado
- No hay dashboard admin en `/admin/workers`

## Objetivos

Crear sistema completo de monitoreo y alertas para workers:
1. Dashboard en tiempo real de estado de workers
2. Monitoreo de profundidad de cola
3. Tracking de trabajos fallidos
4. Sistema de alertas (email/Slack)
5. Endpoint de métricas API
6. Dashboard admin en `/admin/workers`

## Pasos de Implementación

### FASE 1: Endpoint de Métricas API

**Archivo:** `src/routes/workers.js` (extender)

**Nuevos endpoints:**
1. `GET /api/workers/metrics`
   - Métricas agregadas de todos los workers
   - Profundidad de cola por tipo
   - Tasa de éxito/fallo
   - Tiempo promedio de procesamiento
   - Trabajos fallidos recientes

2. `GET /api/workers/:workerType/metrics`
   - Métricas específicas de un worker
   - Historial de trabajos procesados
   - Tasa de éxito
   - Tiempo promedio

3. `GET /api/workers/queues/status`
   - Estado de todas las colas
   - Profundidad por cola
   - Trabajos en procesamiento
   - Trabajos fallidos en DLQ

**Dependencias:**
- Usar `QueueService.getQueueStats()` existente
- Usar `WorkerManager.getStats()` existente
- Integrar con `monitoringService.js`

### FASE 2: Servicio de Alertas

**Archivo:** `src/services/workerAlertingService.js` (nuevo)

**Funcionalidades:**
1. **Detección de condiciones:**
   - Worker caído (no responde healthcheck)
   - Cola con profundidad > threshold
   - Tasa de fallo > threshold
   - Trabajos fallidos acumulados en DLQ
   - Tiempo de procesamiento > threshold

2. **Canales de alerta:**
   - Email (usar servicio existente si existe)
   - Slack (webhook)
   - Logging estructurado

3. **Configuración:**
   - Thresholds configurables por organización
   - Frecuencia de alertas (evitar spam)
   - Cooldown entre alertas del mismo tipo

**Dependencias:**
- Integrar con `alertingService.js` si existe
- Usar `utils/logger.js` para logging

### FASE 3: Dashboard Admin Frontend

**Archivo:** `admin-dashboard/src/pages/Workers/index.tsx` (nuevo)

**Componentes:**
1. **Worker Status Cards**
   - Estado de cada worker (running/stopped/error)
   - Métricas clave (jobs procesados, tasa de éxito)
   - Última actividad

2. **Queue Depth Chart**
   - Gráfico de profundidad de cola en tiempo real
   - Por tipo de cola (fetch_comments, analyze_toxicity, etc.)
   - Alertas visuales cuando profundidad > threshold

3. **Failed Jobs Table**
   - Lista de trabajos fallidos recientes
   - Filtros por worker, fecha, tipo de error
   - Acción: Retry job

4. **Metrics Dashboard**
   - Tiempo promedio de procesamiento
   - Tasa de éxito por worker
   - Throughput (jobs/segundo)
   - Gráficos de tendencia

5. **Alert Configuration**
   - Configurar thresholds
   - Habilitar/deshabilitar alertas
   - Configurar canales (email/Slack)

**Dependencias:**
- Usar React + TypeScript (stack existente)
- Usar Chart.js o similar para gráficos
- Polling cada 5-10 segundos para actualización en tiempo real

### FASE 4: Backend - Recopilación de Métricas

**Archivos:**
- `src/services/workerMetricsService.js` (nuevo o extender `monitoringService.js`)

**Funcionalidades:**
1. **Recopilación de métricas:**
   - Polling de workers cada 30 segundos
   - Agregación de métricas por worker
   - Historial de métricas (últimas 24 horas)
   - Cálculo de tendencias

2. **Almacenamiento:**
   - Cache en memoria (últimas métricas)
   - Opcional: Persistencia en DB para histórico

3. **Detección de anomalías:**
   - Worker caído
   - Cola bloqueada
   - Tasa de fallo anormal
   - Performance degradation

**Dependencias:**
- Integrar con `WorkerManager`
- Integrar con `QueueService`
- Usar `monitoringService.js` existente

### FASE 5: Tests

**Archivos:**
- `tests/unit/services/workerMetricsService.test.js`
- `tests/unit/services/workerAlertingService.test.js`
- `tests/integration/workers/monitoring.test.js`
- `tests/e2e/admin-dashboard/workers-dashboard.test.ts`

**Cobertura:**
- ✅ Recopilación de métricas
- ✅ Detección de condiciones de alerta
- ✅ Envío de alertas
- ✅ Endpoints de API
- ✅ Dashboard frontend (tests E2E con Playwright)

## Agentes a Usar

- **FrontendDev**: Implementar dashboard React
- **Backend Developer**: Implementar servicios de métricas y alertas
- **TestEngineer**: Generar tests unitarios, integración y E2E
- **UIDesigner**: Diseñar UI del dashboard
- **Guardian**: Validar seguridad (no exponer datos sensibles)

## Archivos Afectados

### Nuevos
- `src/services/workerMetricsService.js`
- `src/services/workerAlertingService.js`
- `admin-dashboard/src/pages/Workers/index.tsx`
- `admin-dashboard/src/components/WorkerStatusCard.tsx`
- `admin-dashboard/src/components/QueueDepthChart.tsx`
- `admin-dashboard/src/components/FailedJobsTable.tsx`
- `tests/unit/services/workerMetricsService.test.js`
- `tests/unit/services/workerAlertingService.test.js`
- `tests/integration/workers/monitoring.test.js`
- `tests/e2e/admin-dashboard/workers-dashboard.test.ts`

### Modificados
- `src/routes/workers.js` (añadir endpoints de métricas)
- `src/services/monitoringService.js` (extender si necesario)
- `src/workers/WorkerManager.js` (exponer métricas adicionales si necesario)
- `admin-dashboard/src/App.tsx` (añadir ruta `/admin/workers`)

## Validación Requerida

### Tests
- ✅ Tests unitarios para servicios de métricas y alertas
- ✅ Tests de integración para endpoints API
- ✅ Tests E2E para dashboard (Playwright)
- ✅ Coverage ≥90% para servicios nuevos

### GDD
- ✅ Actualizar `docs/nodes/queue-system.md` con información de monitoreo
- ✅ Ejecutar `node scripts/validate-gdd-runtime.js --full` (debe pasar)
- ✅ Ejecutar `node scripts/score-gdd-health.js --ci` (debe ≥87)

### Funcionalidad
- ✅ Dashboard muestra estado de workers en tiempo real
- ✅ Alertas se envían cuando se cumplen condiciones
- ✅ Endpoints API retornan métricas correctas
- ✅ Dashboard es responsive (mobile/tablet/desktop)

## Estimación

**Esfuerzo:** 1 semana
**Complejidad:** MEDIUM (integración de componentes existentes)

## Riesgos y Mitigaciones

### Riesgo 1: Performance del polling
**Mitigación:** Usar polling eficiente (cada 30s), cache en memoria, WebSockets opcionales.

### Riesgo 2: Spam de alertas
**Mitigación:** Implementar cooldown entre alertas, agrupar alertas similares.

### Riesgo 3: Escalabilidad de métricas
**Mitigación:** Limitar historial (últimas 24h), usar agregación eficiente.

## Criterios de Aceptación

- ✅ Dashboard en tiempo real de estado de workers
- ✅ Monitoreo de profundidad de cola
- ✅ Tracking de trabajos fallidos
- ✅ Sistema de alertas (email/Slack)
- ✅ Endpoint de métricas API (`/api/workers/metrics`)
- ✅ Dashboard admin en `/admin/workers`
- ✅ Tests pasando (unitarios + integración + E2E)
- ✅ Coverage ≥90%
- ✅ Documentación actualizada

---

**Próximos pasos:** Comenzar con FASE 1 - Endpoint de métricas API


