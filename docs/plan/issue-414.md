# Plan: Issue #414 - Kill-switch Integration Tests

**Date:** 2025-10-05
**Priority:** P0 (Critical)
**Assessment:** ENHANCE (implementation exists, needs tests + UI)

## Estado Actual

### ✅ Implementación Existente

- `src/services/killSwitchService.js` (139 líneas) - Lógica completa
- `src/workers/PublishResponseWorker.js` - Worker integrado
- `database/schema.sql` - Tabla `kill_switch` con RLS
- Multi-tenant isolation ✅
- Audit trail ✅

### ❌ Gaps Críticos

- **Zero test coverage** (P0 issue)
- **No UI/API endpoints** (AC #3 bloqueado)
- No monitoring/observability

## Fases de Implementación

### FASE 1: Integration Tests (Este PR)

**Archivo:** `tests/integration/kill-switch-issue-414.test.js`

**Tests a Crear (10 tests):**

1. **AC1: Bloquea nuevas publicaciones (2 tests)**
   - ✅ Rechaza jobs cuando kill-switch activo
   - ✅ Permite jobs cuando kill-switch inactivo

2. **AC2: Jobs cancelados (2 tests)**
   - ✅ Cancela pending jobs al activar
   - ✅ Marca in-progress jobs como cancelados

3. **AC4: Estado persistido (2 tests)**
   - ✅ Persiste estado across restarts
   - ✅ Mantiene audit trail (activated_by, timestamps)

4. **AC5: Rollback (2 tests)**
   - ✅ Desactiva y resume publishing
   - ✅ No afecta jobs ya cancelados

5. **Multi-tenant (2 tests)**
   - ✅ Solo afecta org target
   - ✅ Otras orgs siguen publicando

**Tiempo estimado:** 3-4 horas

### FASE 2: UI + API (Siguiente PR - Issue separado)

**API Endpoints:** `src/routes/killSwitch.js`

- POST /api/kill-switch/activate
- POST /api/kill-switch/deactivate
- GET /api/kill-switch/status

**UI Components:** `backoffice/components/KillSwitchPanel.jsx`

- Activate/deactivate toggle
- Reason input
- Status indicator
- Audit log

**Tiempo estimado:** 6-8 horas

### FASE 3: Monitoring (Futuro)

- Metrics: activations, duration
- Alerts: notify on activation
- Dashboard: status + history

**Tiempo estimado:** 2-3 horas

## Implementación de Tests

### Setup

```javascript
const killSwitchService = require('../../src/services/killSwitchService');
const PublishResponseWorker = require('../../src/workers/PublishResponseWorker');
const { supabase } = require('../../src/config/supabase');

describe('Kill-switch Integration - Issue #414', () => {
  let orgA, orgB, worker;

  beforeAll(async () => {
    orgA = await createTestOrg('Org A');
    orgB = await createTestOrg('Org B');
    worker = new PublishResponseWorker();
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
```

### Test Patterns

#### AC1: Bloqueo de publicaciones

```javascript
it('should reject new jobs when kill-switch is active', async () => {
  // Activate kill-switch
  await killSwitchService.activate(orgA.id, 'Testing');

  // Try to publish
  const job = { data: { orgId: orgA.id, roastId: 'test' } };
  await worker.processJob(job);

  // Verify job was cancelled
  expect(job.status).toBe('cancelled');
  expect(job.cancelReason).toBe('Kill-switch active');
});
```

#### AC2: Cancelación de jobs

```javascript
it('should cancel pending jobs on activation', async () => {
  // Create pending jobs
  await createPendingJobs(orgA.id, 3);

  // Activate kill-switch
  await killSwitchService.activate(orgA.id, 'Emergency stop');

  // Verify all jobs cancelled
  const jobs = await getPendingJobs(orgA.id);
  expect(jobs.every((j) => j.status === 'cancelled')).toBe(true);
});
```

#### AC4: Persistencia

```javascript
it('should persist state across service restarts', async () => {
  await killSwitchService.activate(orgA.id, 'Test');

  // Simulate restart (new service instance)
  const newService = new KillSwitchService();

  const isActive = await newService.isActive(orgA.id);
  expect(isActive).toBe(true);
});
```

#### AC5: Rollback

```javascript
it('should resume publishing after deactivation', async () => {
  await killSwitchService.activate(orgA.id, 'Test');
  await killSwitchService.deactivate(orgA.id);

  const job = { data: { orgId: orgA.id, roastId: 'test' } };
  await worker.processJob(job);

  expect(job.status).not.toBe('cancelled');
});
```

#### Multi-tenant isolation

```javascript
it('should only affect target org', async () => {
  await killSwitchService.activate(orgA.id, 'Test');

  const jobA = { data: { orgId: orgA.id, roastId: 'a' } };
  const jobB = { data: { orgId: orgB.id, roastId: 'b' } };

  await worker.processJob(jobA);
  await worker.processJob(jobB);

  expect(jobA.status).toBe('cancelled');
  expect(jobB.status).not.toBe('cancelled'); // Org B unaffected
});
```

## Criterios de Validación

### Tests Passing

- [ ] 10/10 integration tests passing
- [ ] Coverage > 90% for `killSwitchService.js`
- [ ] No regressions in other tests

### ACs Validados (via tests)

- [ ] AC1: Bloquea publicaciones ✅
- [ ] AC2: Jobs cancelados ✅
- [ ] AC3: UI refleja estado ❌ (siguiente PR)
- [ ] AC4: Estado persistido ✅
- [ ] AC5: Rollback funciona ✅

### Documentación

- [ ] Test evidence en `docs/test-evidence/issue-414/`
- [ ] `queue-system.md` actualizado con kill-switch testing
- [ ] GDD validation passing

## Archivos a Modificar/Crear

### Nuevos

- `tests/integration/kill-switch-issue-414.test.js` (300+ líneas)
- `docs/test-evidence/issue-414/tests-passing.txt`
- `docs/test-evidence/issue-414/SUMMARY.md`
- `docs/plan/issue-414.md` (este archivo)
- `docs/assessment/issue-414.md` (ya creado)

### Modificar

- `docs/nodes/queue-system.md` (añadir sección testing)

## Siguiente Issue (AC #3 - UI)

**Crear nueva issue:** "Implementar UI/API para Kill-switch - AC #3 de Issue #414"

**Scope:**

- API endpoints en `src/routes/killSwitch.js`
- UI components en `backoffice/components/KillSwitchPanel.jsx`
- Integration con admin dashboard
- Tests E2E para UI

**Priority:** P1 (después de tests P0)

---

**Tiempo total este PR:** 3-4 horas
**Tokens disponibles:** ~87k (suficiente)
