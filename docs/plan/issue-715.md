# Plan de Implementación — Issue #715: Analytics Dashboard completo

## Estado actual
- El backend expone endpoints analíticos parciales en `src/routes/analytics.js` (config-performance, shield-effectiveness, usage-trends, roastr-persona-insights) con caché en memoria, pero no existe un dashboard dedicado que consuma estos datos.
- El frontend sólo dispone del panel general (`frontend/src/pages/dashboard.jsx`) sin vistas específicas para analytics. No se utiliza Chart.js ni librerías de visualización; los datos analíticos se muestran como métricas sueltas.
- No hay endpoints de exportación (CSV/JSON) para snapshots o eventos analíticos (`analytics_snapshots`, `analytics_events`).
- La integración con Polar ya existe para checkout (`src/routes/checkout.js`) y helpers (`src/utils/polarHelpers.js`), pero no hay agregaciones de ingresos/KPIs conectadas al módulo de analytics ni endpoints para exponerlos al dashboard.
- Cobertura de tests en analytics ~59% (según nodo GDD); faltan pruebas específicas para nuevos flujos y cualquier UI futura carece de tests.

## Objetivos y alcance
- Diseñar e implementar una vista `/dashboard/analytics` con gráficos interactivos (Chart.js) para roasts, acciones Shield, créditos consumidos y métricas de ingresos Polar.
- Añadir endpoints backend orientados a dashboards (resúmenes diarios, breakdown por plataforma/tono, KPIs Polar) y a exportaciones CSV/JSON filtrables por rango de fechas y organización.
- Garantizar tiempos de respuesta <2s mediante caching (aprovechando `analyticsCache`) y consultas optimizadas.
- Cubrir con tests (≥80%) backend y frontend, incluyendo generación de archivos de exportación.
- Documentar cambios en nodos GDD afectados y actualizar recibos de agentes.

## Pasos de implementación
1. **Discovery & diseño técnico**
   - Mapear datos necesarios desde `analytics_snapshots`, `analytics_events`, `usage_records`, `responses`, `shield_actions` y Polar API.
   - Diseñar estructuras de respuesta para nuevos endpoints (`/api/analytics/dashboard`, `/api/analytics/billing`, `/api/analytics/export`).
   - Definir layout de la vista React (secciones, filtros, componentes reutilizables).

2. **Backend: endpoints de analytics**
   - Crear servicio `AnalyticsDashboardService` (o extender servicio existente si aplica) que agregue métricas (series temporales, breakdowns por plataforma, tono, severidad, costes).
   - Implementar endpoint REST `GET /api/analytics/dashboard` con parámetros (range, groupBy, platform) usando caché y límites controlados.
   - Añadir `GET /api/analytics/billing` que consume Polar (nuevo `polarAnalyticsService` con autenticación via `@polar-sh/sdk`) y combina datos propios (cost-control).
   - Garantizar paginación, sanitización, multi-tenant (filter `organization_id`), logs estructurados y manejo de errores consistente.

3. **Backend: exportaciones**
   - Implementar `GET /api/analytics/export.csv` y `/api/analytics/export.json` con filtros (periodo, métricas seleccionadas) y streaming (`res.setHeader`, `res.write`) para CSV.
   - Reutilizar agregaciones del servicio para evitar duplicación y respetar límites del plan (usar `planLimitsService`).
   - Añadir verificación de permisos y rate limit específico para exportaciones (descargas grandes).

4. **Frontend: nueva página y navegación**
   - Crear `frontend/src/pages/Analytics.jsx` con estructura modular (header, filtros, tarjetas resumen, contenedor Chart.js).
   - Añadir ruta protegida `/dashboard/analytics` en `frontend/src/App.js` + actualización de navegación/Sidebar para visibilidad.
   - Construir componentes: filtros (rango temporal, plataformas, métricas), tarjetas KPI, gráficos (líneas para roasts/analyses, barras para Shield, doughnut para plataforma/tone breakdown, tabla Polar).
   - Incluir botones de exportación que llamen a endpoints, con feedback (toasts, loaders) y manejo de descargas.

5. **Integración con Chart.js**
   - Instalar dependencias `chart.js` y `react-chartjs-2` con configuración global (lazy loading, tooltips personalizados, tema dark/light).
   - Crear wrapper `AnalyticsChart` reutilizable con memoization para evitar rerenders pesados.
   - Asegurar accesibilidad (descripciones ARIA, fallback textual) y manejo responsivo.

6. **Rendimiento y caching**
   - Extender `analyticsCache` para clavear por organización y parámetros (incluir TTL específico).
  - Implementar precálculo opcional (worker o cron) si queries intensivas lo requieren (planificar hook a `AnalyticsSnapshotWorker` si existe o crear job).
   - Añadir métricas de logging (latencia, hits/misses de caché) al logger.

7. **Tests y cobertura**
   - Backend: tests unitarios (servicios) + integración (routes) incluyendo escenarios de cache hit/miss, exportaciones grandes, errores Polar (mock SDK).
   - Frontend: tests de renderizado para página Analytics, verificación de llamadas fetch, snapshot/DOM para charts (mock Chart.js), interacción con filtros y export buttons.
   - Playwright MCP: validar UI responsiva y accesible (desktop/tablet/móvil) y generar evidencia (`docs/test-evidence/issue-715/...`).
   - Verificar cobertura ≥80% en nuevas áreas y actualizar reportes en GDD (`analytics`, `cost-control`, `billing`, `social-platforms` si aplica).

8. **Documentación y GDD**
   - Actualizar nodos relevantes (`analytics`, `cost-control`, `billing`, `social-platforms`, `plan-features`, `queue-system` si se usa worker) con nuevos flujos, endpoints y agentes.
   - Añadir entradas en changelog/plan si aplica y generar recibos de agentes (`docs/agents/receipts/...`).

9. **Validación final**
   - Ejecutar `npm test`, `npm run test:coverage`, `node scripts/validate-gdd-runtime.js --full`, `node scripts/score-gdd-health.js --ci`, `node scripts/predict-gdd-drift.js --full`.
   - Correr visual validation (Playwright MCP) y adjuntar reportes.
   - Ejecutar `npm run coderabbit:review` para garantizar 0 observaciones.

## Agentes y habilidades requeridas
- **TaskAssessor** (AC ≥3) – plan ya generado, actualizar recibo correspondiente.
- **FrontendDev** – implementación UI + Chart.js + validación visual (requiere Playwright MCP).
- **TestEngineer** – generación de tests, cobertura, reporte en `docs/test-evidence/issue-715/`.
- **Guardian** – cambios sensibles (billing/Polar, cost-control, GDD sync y policy enforcement).
- **general-purpose** – posible coordinación PR/receipts si proceso se extiende.
- Habilidades automáticas esperadas: `test-generation-skill`, `visual-validation-skill`, `gdd-sync-skill`, `verification-before-completion-skill`, `security-audit-skill` (por tocar billing).

## Archivos / áreas afectados (estimado)
- Backend: `src/routes/analytics.js`, `src/services/**` (nuevo `analyticsDashboardService.js`, `polarAnalyticsService.js`), `src/utils/logger.js` (hooks), posibles workers.
- Frontend: `frontend/src/App.js`, `frontend/src/pages/Analytics.jsx` (nuevo), componentes en `frontend/src/components/analytics/`, hooks, estilos, `frontend/src/contexts/SidebarContext` si se ajusta menú.
- Configuración: `package.json`, `package-lock.json` para dependencias Chart.js.
- Tests: `tests/unit/routes/analytics*.test.js`, nuevos tests en `frontend/src/pages/__tests__/Analytics.test.jsx`, mocks Polar, Playwright specs (`admin-dashboard/tests/e2e` o nuevo suite).
- Documentación: nodos GDD mencionados, `docs/test-evidence/issue-715/`, `docs/changelog/issue-715.md` (si requerido), recibos en `docs/agents/receipts/`.

## Validación y evidencia
- Pruebas unitarias/integración (`npm test`) con enfoque en analytics y exportaciones.
- Cobertura (`npm run test:coverage`) ≥90% global, ≥80% en módulos nuevos.
- GDD: `validate-gdd-runtime`, `score-gdd-health`, `predict-gdd-drift`.
- Visual validation: reportes Playwright + capturas multi viewport.
- Evidencia de exportaciones (CSV/JSON) funcionando (logs + fixtures en tests).

## Riesgos y preguntas abiertas
- **Polar API rate limits**: confirmar límites permitidos para métricas agregadas y considerar caching persistente si necesario.
- **Volumen de datos**: queries sobre `analytics_events` pueden ser pesadas; evaluar índices adicionales o materialized views.
- **Compatibilidad Chart.js**: verificar SSR/build de frontend; Chart.js puede requerir dynamic import para evitar errores en tests.
- **Planes y límites**: al exponer exportaciones, asegurar cumplimiento de `plan-features` (p. ej. Starter Trial sin acceso a determinados filtros).
- **Seguridad**: exportaciones deben evitar PII innecesaria y cumplir GDPR (posible anonimización); validar con Guardian.



