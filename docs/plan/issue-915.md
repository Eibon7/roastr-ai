# Plan: Issue #915 - Tests para Workers System (BaseWorker + WorkerManager)

## Objetivo

Garantizar cobertura automatizada ≥80% para `BaseWorker` y `WorkerManager` con pruebas producción-ready que validen inicio, ciclo de vida, salud, errores y limpieza de jobs dentro del ecosistema de queues y cost control.

## Análisis del Requerimiento

### Criterios de Aceptación principales

- **AC1 – BaseWorker Tests (≥80%)**: inicialización, `processJob`, salud, retries, shutdown, integración con queue/cost-control y edge cases (jobs inválidos, timeouts y errores).
- **AC2 – WorkerManager Tests (≥80%)**: lifecycle completo (start/stop/restart), health monitoring, graceful shutdown, reinicio tras fallo, distribución y balanceo de jobs, detección de workers defectuosos.
- **AC3 – Calidad de los tests**: prueba comportamiento real (no solo mocks), cobertura de errores y estados límite, documentación clara y ejecución rápida (<1s por suite), tests aislados y reproducibles.
- **AC4 – Integración**: validar flujos que involucran `QueueService` y `CostControlService`, simulando procesamiento end-to-end y resaltando dependencias multi-tenant/multi-plan.

### Riesgos y observaciones

- El worker system es crítico (P0) y la cobertura actual está en 0%; romperá cualquier pipeline si fallan los tests.
- Los workers usan `supabaseServiceClient`, queues y cost-control; hay que cuidar mocks/fixtures siguiendo el patrón de `supabaseMockFactory` del CodRabbit Lesson #11.
- Evitar `console.log` y usar `utils/logger.js` (Lesson #1 y #6).

## Estrategia de Implementación

### 1. Tests unitarios para `BaseWorker`

- Crear `tests/unit/workers/BaseWorker.*.test.js` que instancie subclases mockeadas y verifique `processJob`, `enqueue`, health check, retries, shutdown y logging con `advancedLogger`.
- Simular jobs válidos, jobs inválidos, timeouts (usando timers fake) y fallos para validar backoff y `failJob`→DLQ.
- Validar integración con `queueService` y `costControlService` mediante mocks compartidos (crear helper `createWorkerDependenciesMock()`).

### 2. Tests unitarios para `WorkerManager`

- Crear `tests/unit/workers/WorkerManager.test.js` que arranque/modele múltiples workers, verifique `start()`, `stop()`, reinicios automáticos y redistribución de jobs.
- Mocks de `QueueService` para simular jobs encolados y workers ocupados/caídos.
- Verificar que el manager detecta fallos repetidos y aplica `backoff`, `restart` o `alert` según la política.

### 3. Integraciones ligeras

- Añadir tests de integración o high-level mocks en `tests/integration/worker-system.test.js` para validar flujo completo: job entra a cola, `WorkerManager` lo asigna, `BaseWorker` lo procesa, `CostControlService` registra uso.
- Aprovechar fixtures existentes (tenantTestUtils) para simular organizaciones y planes, cubriendo multi-tenant y límites de `plan-features`.
- Incluir casos donde un worker excede límite de plan y verificar que `CostControlService` bloquea/reduce operaciones.

### 4. Cobertura y documentación

- Medir cobertura por archivo (`BaseWorker`, `WorkerManager`) y asegurar ≥80% antes de finalizar.
- Documentar las nuevas suites y helpers en `tests/README` o `docs/test-evidence/issue-915/summary.md`.
- Actualizar nodos GDD relevantes (`queue-system`, `cost-control`, `multi-tenant`, `plan-features`, `observability`) añadiendo “Test Engineer” y “Test coverage” como Agentes relevantes si no están.

## Archivos clave

- `src/workers/BaseWorker.js`
- `src/workers/WorkerManager.js`
- `src/services/queueService.js`
- `src/services/costControl.js`
- `tests/helpers/supabaseMockFactory.js`
- Nuevos tests en `tests/unit/workers/` y `tests/integration/worker-system.test.js`

## Agentes Relevantes

- **Test Engineer** – diseño y ejecución de tests.
- **Backend Developer** – cambios en workers y servicios.
- **Guardian** – revisar seguridad/manejo de errores (cost control y multi-tenant).
- **General-purpose** – coordinación general y plan.

## Validación y pruebas

- `npm test -- tests/unit/workers/BaseWorker.test.js`
- `npm test -- tests/unit/workers/WorkerManager.test.js`
- `npm test -- tests/integration/worker-system.test.js`
- `npm run test:coverage -- --runInBand` (o comando equivalente) para certificar ≥80%.
- `node scripts/validate-gdd-runtime.js --full`
- `node scripts/score-gdd-health.js --ci`

## Seguimiento

- ✅ Crear evidencia en `docs/test-evidence/issue-915/summary.md` con resultados de cobertura, suites ejecutadas, y enlaces a logs.
- ⏳ Generar receipts para agentes involucrados (especialmente TestEngineer) en `docs/agents/receipts/`.

## Estado Actual

### ✅ Completado

1. **Tests unitarios para BaseWorker**: 47 tests implementados, todos pasando
   - Cobertura: 67.77% statements (objetivo: ≥80%)
   - Cubre: inicialización, lifecycle, job processing, error handling, retries, graceful shutdown, utility methods
2. **Tests unitarios para WorkerManager**: 47 tests implementados, todos pasando
   - Cobertura: 89.47% statements ✅ (supera objetivo del 80%)
   - Cubre: constructor, lifecycle, health monitoring, statistics, dynamic management, graceful shutdown
3. **Tests de integración**: 2 tests implementados, todos pasando
   - Cubre: integración con QueueService y CostControlService
4. **Documentación**: Resumen de evidencia creado en `docs/test-evidence/issue-915/summary.md`

### ⚠️ Pendiente

1. **Mejorar cobertura de BaseWorker**: Actualmente 67.77%, necesita llegar a ≥80%
   - Líneas no cubiertas: inicialización de Supabase real, signal handlers en producción, algunos edge cases
2. **Actualizar nodos GDD**: Añadir "Test Engineer" y "Test coverage" como agentes relevantes
3. **Generar receipts**: Crear receipts para agentes involucrados

### 📊 Resumen de Cobertura

- **BaseWorker**: 67.77% statements, 61.11% branches, 71.05% functions, 68.18% lines
- **WorkerManager**: 89.47% statements, 92.68% branches, 80.95% functions, 89.47% lines ✅

### 📈 Total de Tests

- **BaseWorker**: 47 tests ✅
- **WorkerManager**: 47 tests ✅
- **Integración**: 2 tests ✅
- **Total**: 96 tests, todos pasando ✅
