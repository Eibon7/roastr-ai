# Plan de Implementación - Issue #828: E2E Tests for Worker Monitoring Dashboard

## 📋 Estado Actual

**Issue:** #828 - E2E Tests for Worker Monitoring Dashboard  
**Labels:** `test:e2e`  
**Estado:** OPEN  
**Relacionado:** Issue #713 - Worker Monitoring Dashboard

### Componentes Existentes

1. **Backend:**
   - ✅ Endpoints implementados: `/api/workers/status`, `/api/workers/health`
   - ✅ Tests unitarios: `tests/unit/routes/workers-metrics.test.js`
   - ⚠️ Endpoints esperados por frontend: `/api/workers/metrics`, `/api/workers/queues/status` (pueden no estar implementados)

2. **Frontend:**
   - ✅ Dashboard implementado: `admin-dashboard/src/pages/Workers/index.tsx`
   - ✅ Hooks: `admin-dashboard/src/hooks/useWorkerMetrics.ts`
   - ✅ Componentes: WorkerStatusCard, QueueStatusTable

3. **Tests E2E Existentes:**
   - ✅ Patrones establecidos en `admin-dashboard/tests/e2e/`
   - ✅ Configuración Playwright: `admin-dashboard/playwright.config.ts`
   - ✅ Tests de referencia: dashboard-navigation, dashboard-responsive, dashboard-accessibility

## 🎯 Acceptance Criteria

### AC 1: Playwright E2E Tests
- [ ] Crear `tests/e2e/admin-dashboard/workers-dashboard.test.ts`
- [ ] Test dashboard loads correctly
- [ ] Test worker status cards display
- [ ] Test queue status table renders
- [ ] Test metrics update in real-time
- [ ] Test error handling (workers not initialized)
- [ ] Test responsive design (mobile/tablet/desktop)

### AC 2: Visual Regression Tests
- [ ] Screenshots para dashboard en diferentes estados
- [ ] Comparar contra baseline
- [ ] Test con diferentes worker states (healthy/unhealthy)

### AC 3: Integration with CI
- [ ] Tests corren en CI pipeline
- [ ] Screenshots almacenados como artifacts
- [ ] Tests no requieren backend real (usar mocks)

## 📝 Pasos de Implementación

### Paso 1: Crear archivo de test base
- Crear `admin-dashboard/tests/e2e/workers-dashboard.test.ts`
- Configurar mocks de API usando `page.route()`
- Estructura siguiendo patrones existentes

### Paso 2: Implementar tests de carga y renderizado
- Test: Dashboard carga correctamente
- Test: Worker status cards se muestran
- Test: Queue status table se renderiza
- Mockear respuestas de `/api/workers/metrics` y `/api/workers/queues/status`

### Paso 3: Implementar tests de actualización en tiempo real
- Test: Métricas se actualizan cada 10 segundos
- Test: Loading states durante refresh
- Test: Error states manejados gracefully

### Paso 4: Implementar tests de error handling
- Test: Workers no inicializados muestra error apropiado
- Test: API errors se manejan correctamente

### Paso 5: Implementar tests responsive
- Test: Mobile viewport (375x667)
- Test: Tablet viewport (768x1024)
- Test: Desktop viewport (1920x1080)

### Paso 6: Implementar visual regression tests
- Capturar screenshots en diferentes estados
- Comparar contra baseline
- Test con workers healthy/unhealthy

### Paso 7: Configurar CI integration
- Verificar que tests corren en CI
- Configurar artifacts para screenshots
- Documentar uso de mocks

## 🔧 Archivos a Modificar/Crear

### Nuevos Archivos
- `admin-dashboard/tests/e2e/workers-dashboard.test.ts` - Tests E2E principales
- `docs/test-evidence/workers-dashboard/` - Screenshots y evidencias

### Archivos de Referencia
- `admin-dashboard/tests/e2e/dashboard-navigation.spec.ts` - Patrón de navegación
- `admin-dashboard/tests/e2e/dashboard-responsive.spec.ts` - Patrón responsive
- `admin-dashboard/src/pages/Workers/index.tsx` - Componente a testear
- `admin-dashboard/src/hooks/useWorkerMetrics.ts` - Hooks a mockear

## 🧪 Estrategia de Mocking

Usar `page.route()` de Playwright para interceptar requests:

```typescript
await page.route('**/api/workers/metrics', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: mockMetrics })
  });
});
```

### Mock Data Structures

1. **Worker Metrics Mock:**
   - Workers: total, healthy, unhealthy, status, details[]
   - Queues: totalDepth, totalProcessing, totalFailed, totalDLQ, byQueue{}
   - Jobs: totalProcessed, totalFailed, currentProcessing, successRate
   - Performance: uptime, averageProcessingTime

2. **Queue Status Mock:**
   - Queues: Record<queueName, queueStats>
   - Summary: totalPending, totalProcessing, totalDLQ

3. **Error States:**
   - 503: Workers not initialized
   - 500: API error
   - Network error

## ✅ Validación

### Pre-Flight Checklist
- [ ] Tests pasan localmente
- [ ] Screenshots capturados correctamente
- [ ] Mocks funcionan sin backend real
- [ ] Tests responsive funcionan en todos los viewports
- [ ] Error handling tests pasan
- [ ] Visual regression tests pasan

### Comandos de Validación
```bash
cd admin-dashboard
npm run test:e2e  # Ejecutar tests E2E
npm run test:e2e:ui  # Ejecutar con UI
```

## 📊 Agentes Relevantes

- **TestEngineer**: Implementación de tests E2E
- **FrontendDev**: Validación de componentes UI
- **Orchestrator**: Coordinación y validación final

## 🔗 Referencias

- Issue #713: Worker Monitoring Dashboard
- Dashboard: `admin-dashboard/src/pages/Workers/index.tsx`
- API Endpoints: `src/routes/workers.js`
- Unit Tests: `tests/unit/routes/workers-metrics.test.js`
- Playwright Docs: https://playwright.dev/docs/api-testing

