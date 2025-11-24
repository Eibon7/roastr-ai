# Planning Document - Issue #417: Observabilidad Mínima

**Date:** 2025-10-12
**Issue:** #417 - [Integración] Observabilidad mínima – structured logs y correlación
**Priority:** P1 (High)
**Type:** test:integration
**Area:** observability
**Estimated Effort:** 20 hours (~2.5 days)

---

## Executive Summary

**Assessment Recommendation:** ⚠️ **ENHANCE**

**Current State:** Strong logging foundation exists (Winston-based, JSON format, timestamps) but lacks comprehensive correlation IDs, E2E traceability, and integration tests.

**What Needs to Be Done:**

1. Enhance worker logging with structured logs at key lifecycle points
2. Implement correlation ID propagation (trace IDs) across API → Queue → Worker
3. Create comprehensive integration tests to validate all acceptance criteria
4. Update logger utility with worker-specific helpers
5. Document observability system in GDD nodes

**Impact:** Improves system observability, debugging capabilities, and production monitoring without architectural changes.

---

## 1. Estado Actual (basado en Assessment)

### ✅ What EXISTS (Strong Foundation)

**Logger Infrastructure** (`src/utils/logger.js`):

- ✅ Winston-based logging with multiple transports
- ✅ Structured JSON format in production
- ✅ Consistent timestamps (ISO 8601)
- ✅ Multiple log levels (error, warn, info, debug)
- ✅ Request correlation via `logRequest()` helper
- ✅ Tenant context preservation
- ✅ PII masking for security

**Correlation IDs (Partial)**:

- ✅ `tenant_id` - Logged in tenant actions
- ✅ `user_id` - Present in request logging
- ✅ Request context via `logRequest()`
- ✅ Timestamps in all logs

### ❌ What's MISSING (Critical Gaps)

**Correlation IDs**:

- ❌ `comment_id` - Not consistently logged in comment processing
- ❌ `roast_id` - Not consistently logged in roast generation
- ❌ Correlation ID propagation across workers
- ❌ End-to-end request tracing (API → Queue → Worker → Response)

**Worker Logging**:

- ❌ Workers lack structured logging at key lifecycle points
- ❌ No consistent logging pattern across 4 workers
- ❌ Missing job metadata in logs (queue name, priority, retry count)

**Testing**:

- ❌ **CRITICAL**: No integration tests for observability
- ❌ No tests validating logging behavior
- ❌ No tests for correlation ID propagation
- ❌ No tests for E2E traceability

### Test Files Status

**Existing Tests:**

- ✅ Unit tests for services (costControl, queueService, etc.)
- ✅ E2E workflow tests (test-e2e-workflow.test.js)
- ❌ No observability-specific tests

**Search Results:**

```bash
# No tests found for:
tests/integration/*observability*
tests/integration/*logging*
tests/integration/*correlation*
```

---

## 2. Análisis de la Issue

### Objetivo

Verificar structured logs y correlación para observabilidad mínima.

### Scope

**Type:** Integration testing + implementation enhancement
**Components Affected:**

- Logger utility (`src/utils/logger.js`)
- 4 Workers (FetchComments, AnalyzeToxicity, GenerateReply, ShieldAction)
- Queue Service (`src/services/queueService.js`)
- New integration tests

### Acceptance Criteria (5 total)

#### AC1: Logs estructurados por paso clave

**Status:** ⚠️ PARTIAL

- **Current:** Basic logging exists, but workers lack structured logs
- **Gap:** Need structured logs at worker lifecycle points (start, success, error)
- **Action:** Add structured logging to all 4 workers

#### AC2: Correlación con tenant_id, user_id, comment_id, roast_id

**Status:** ⚠️ PARTIAL

- **Current:** tenant_id and user_id exist, but comment_id/roast_id inconsistent
- **Gap:** Missing IDs in worker logs, no propagation
- **Action:** Include all 4 IDs consistently in all logs

#### AC3: Timestamps consistentes en todos los logs

**Status:** ✅ MET

- **Current:** Winston's `format.timestamp()` ensures ISO 8601 format
- **Action:** No changes needed, validate in tests

#### AC4: Trazabilidad end-to-end de requests

**Status:** ❌ MISSING

- **Current:** No trace ID that follows requests across services
- **Gap:** No correlation between API → Queue → Worker → Response
- **Action:** Implement correlation ID (trace ID) propagation

#### AC5: Formato JSON estructurado para análisis

**Status:** ✅ MET

- **Current:** Production uses `winston.format.json()`
- **Action:** No changes needed, validate in tests

### Preconditions/Fixtures

- Sistema de logging configurado ✅ (Winston already configured)
- Múltiples requests concurrentes (simulate in tests)
- Diferentes tenants y usuarios (use test fixtures)

### Test Steps

1. Ejecutar flujo completo con logging activo
2. Verificar presencia de IDs de correlación
3. Confirmar estructura JSON en logs
4. Validar timestamps y secuencia
5. Probar trazabilidad cross-service

---

## 3. Diseño GDD

### Nodos Afectados

**Existing Nodes** (to update):

1. **`queue-system`** - Add observability notes for job logging
   - Update "Implementation Notes" with correlation ID propagation
   - Document logging patterns for workers
   - Add to "Agentes Relevantes": Test Engineer, Orchestrator

2. **`multi-tenant`** - Document tenant context in logs
   - Add observability notes for tenant_id logging
   - Reference integration tests

**New Node** (to create): 3. **`observability`** or update in spec.md

- **Decision:** Don't create new node, document in spec.md + update existing nodes
- **Rationale:** Observability is cross-cutting, not a standalone feature

### Validar Edges

**Dependencies:**

- observability → queue-system (worker logging)
- observability → multi-tenant (tenant context in logs)
- queue-system → logger utility
- workers → logger utility

**No New Dependencies:** All edges already exist implicitly

### Actualizar Grafo

**No Changes Needed:**

- Observability is enhancement to existing system
- No new architectural components
- No new database tables or APIs

---

## 4. Subagentes Requeridos

**By Role:**

### Test Engineer (Critical)

**Tasks:**

- Create comprehensive integration tests (`tests/integration/test-observability.test.js`)
- Design test fixtures for multi-tenant scenarios
- Validate all 5 acceptance criteria with tests
- Mock/intercept logger for test assertions
- Create evidence documentation

**Estimated Effort:** 6-8 hours

### Backend Developer (Primary)

**Tasks:**

- Enhance worker logging in 4 worker files
- Implement correlation ID propagation in queueService
- Add logger utility helpers for workers
- Ensure all correlation IDs logged consistently

**Estimated Effort:** 6-8 hours

### Documentation Agent (Secondary)

**Tasks:**

- Update `docs/nodes/queue-system.md` with logging patterns
- Update `docs/nodes/multi-tenant.md` with observability notes
- Update `spec.md` if needed (minimal changes)
- Update CLAUDE.md with logging best practices

**Estimated Effort:** 2-3 hours

### Orchestrator (Coordination)

**Tasks:**

- Coordinate subagents
- Ensure GDD validation passes
- Run Pre-Flight Checklist
- Create PR and evidence documentation

**Estimated Effort:** 2-3 hours

**Total Agents:** 4

---

## 5. Archivos Afectados

### Implementation Files (7 files)

#### 1. `src/utils/logger.js` (Enhancement)

**Changes:**

- Add `logWorkerAction(workerName, action, meta)` helper
- Add `createCorrelationContext(correlationId, meta)` helper
- Improve PII masking coverage
- Add validation for required correlation fields

**Lines:** ~120 lines (currently 100)
**Estimated Time:** 2 hours

#### 2. `src/services/queueService.js` (Enhancement)

**Changes:**

- Add `correlationId` to job metadata
- Propagate correlation ID from API → Queue
- Generate UUID v4 for new correlationIds
- Log correlationId when enqueuing jobs

**Lines:** ~20 lines added
**Estimated Time:** 1 hour

#### 3-6. Workers (4 files, Enhancement)

**Files:**

- `src/workers/FetchCommentsWorker.js`
- `src/workers/AnalyzeToxicityWorker.js`
- `src/workers/GenerateReplyWorker.js`
- `src/workers/ShieldActionWorker.js`

**Changes (per worker):**

- Add structured log at job start (with correlationId, commentId, tenantId, userId)
- Add structured log at job success (with results)
- Add structured log at job error (with error context)
- Include job metadata (queue name, priority, retry count)

**Lines:** ~30 lines per worker (120 total)
**Estimated Time:** 4 hours (1h per worker)

### Test Files (1 new file)

#### 7. `tests/integration/test-observability.test.js` (Create)

**Test Suites:**

1. Structured Logging - Verify all key steps log with proper structure
2. Correlation IDs - Verify tenant_id, user_id, comment_id, roast_id present
3. Timestamp Consistency - Verify ISO 8601 format
4. E2E Traceability - Follow correlation ID across services
5. JSON Format - Verify production logs are valid JSON
6. Concurrent Requests - Verify correlation IDs don't mix
7. Error Logging - Verify errors include context + stack traces

**Lines:** ~400 lines (7 suites × ~60 lines each)
**Estimated Time:** 6 hours

### Documentation Files (3 files)

#### 8. `docs/nodes/queue-system.md` (Update)

**Changes:**

- Add "Observability" section with logging patterns
- Document correlation ID propagation
- Update "Agentes Relevantes" (add Test Engineer, Orchestrator)
- Update "Last Updated" and coverage %

**Lines:** ~30 lines added
**Estimated Time:** 30 minutes

#### 9. `docs/nodes/multi-tenant.md` (Update)

**Changes:**

- Add "Observability" section with tenant context logging
- Reference integration tests
- Update "Agentes Relevantes" if needed

**Lines:** ~20 lines added
**Estimated Time:** 20 minutes

#### 10. `CLAUDE.md` (Update)

**Changes:**

- Add "Logging Best Practices" section
- Document correlation ID usage
- Reference observability tests

**Lines:** ~40 lines added
**Estimated Time:** 30 minutes

### Evidence Files

#### 11. `docs/test-evidence/issue-417/` (Create directory)

**Files:**

- `tests-passing.txt` (test output)
- `coverage-report.json` (auto-generated)
- `SUMMARY.md` (executive summary)

**Estimated Time:** 1 hour

### Total Files Affected

- **Implementation:** 7 files (1 create, 6 enhance)
- **Tests:** 1 file (create)
- **Documentation:** 3 files (update)
- **Evidence:** 3 files (create)
- **Total:** 14 files

---

## 6. Estrategia de Implementación

### Phase 1: Logger Utility Enhancement (2 hours)

**Order:**

1. Add `logWorkerAction()` helper to `src/utils/logger.js`
2. Add `createCorrelationContext()` helper
3. Improve PII masking
4. Add validation utilities

**Validation:** Unit tests for new helpers (quick sanity checks)

### Phase 2: Correlation ID Propagation (1 hour)

**Order:**

1. Modify `queueService.addJob()` to accept/generate correlationId
2. Include correlationId in job metadata
3. Log correlationId when enqueuing jobs

**Validation:** Manual test - enqueue job, check logs for correlationId

### Phase 3: Worker Logging Enhancement (4 hours)

**Order (sequential per worker):**

1. `FetchCommentsWorker.js` - Add structured logs
2. `AnalyzeToxicityWorker.js` - Add structured logs
3. `GenerateReplyWorker.js` - Add structured logs
4. `ShieldActionWorker.js` - Add structured logs

**Pattern (per worker):**

```javascript
async processJob(job) {
  const { commentId, tenantId, userId, correlationId } = job.data;

  // Start log
  logger.info('Worker starting', {
    worker: 'WorkerName',
    correlationId,
    commentId,
    tenantId,
    userId,
    jobId: job.id,
    priority: job.priority
  });

  try {
    const result = await this.process(job.data);

    // Success log
    logger.info('Worker completed', {
      worker: 'WorkerName',
      correlationId,
      commentId,
      result: result.summary
    });

    return result;
  } catch (error) {
    // Error log
    logger.error('Worker failed', {
      worker: 'WorkerName',
      correlationId,
      commentId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
```

**Validation:** Run existing worker tests, ensure no regressions

### Phase 4: Integration Tests (6 hours)

**Order:**

1. Create test file structure
2. Implement log capture/mocking mechanism
3. Write 7 test suites (one per acceptance criterion + extras)
4. Run tests, iterate until all pass

**Test Approach:**

- Mock Winston logger to capture logs
- Parse captured logs (JSON)
- Assert structure, IDs, timestamps, traceability
- Simulate concurrent requests
- Validate error scenarios

**Validation:** `npm test -- test-observability.test.js` (100% passing)

### Phase 5: Documentation Updates (1.5 hours)

**Order:**

1. Update `docs/nodes/queue-system.md`
2. Update `docs/nodes/multi-tenant.md`
3. Update `CLAUDE.md`

**Validation:** Markdownlint, GDD validation

### Phase 6: Evidence & Validation (3 hours)

**Order:**

1. Run all tests with coverage (`npm test -- --coverage`)
2. Capture test output to `docs/test-evidence/issue-417/tests-passing.txt`
3. Generate coverage report
4. Create `SUMMARY.md`
5. Run GDD validation (`node scripts/validate-gdd-runtime.js --full`)
6. Run Pre-Flight Checklist

**Validation:** All quality gates pass

### Plan de Testing

**Unit Tests:**

- Logger utility helpers (2 new tests)
- Queue service correlation ID (1 new test)

**Integration Tests:**

- 7 test suites in `test-observability.test.js`
- ~20-30 individual test cases
- Coverage: All 5 acceptance criteria

**E2E Tests:**

- Use existing E2E tests, verify logs produced
- Validate correlation IDs in E2E workflow

**Coverage Target:**

- Maintain current coverage (87% for queue-system)
- New observability test file: 100% AC coverage

### Evidencias Necesarias

**Screenshots:** Not applicable (backend logging)

**Test Output:**

- `tests-passing.txt` (full test output)
- `coverage-report.json` (auto-generated)

**Logs:**

- Sample logs showing structured format
- Sample logs showing correlation ID propagation
- Sample logs showing error handling

**Reports:**

- `SUMMARY.md` (executive summary)
- GDD validation report
- Pre-Flight Checklist results

---

## 7. Criterios de Éxito

### Issue 100% Resuelta

- [ ] AC1: Logs estructurados por paso clave ✅
- [ ] AC2: Correlación con tenant_id, user_id, comment_id, roast_id ✅
- [ ] AC3: Timestamps consistentes ✅ (already met, validated)
- [ ] AC4: Trazabilidad E2E ✅
- [ ] AC5: Formato JSON estructurado ✅ (already met, validated)

**Overall:** 5/5 acceptance criteria met

### Tests 100% Passing

- [ ] New integration test file: `test-observability.test.js` (7 suites, ~20-30 tests)
- [ ] All existing tests still pass (no regressions)
- [ ] Coverage maintains or increases

**Command:**

```bash
npm test -- test-observability.test.js
# Expected: Test Suites: 1 passed, 1 total
# Expected: Tests: ~25 passed, ~25 total
```

### Coverage Mantiene o Sube (auto-updated)

**Current Coverage:**

- queue-system: 87%
- logger utility: Not tracked separately

**Target:**

- queue-system: ≥87%
- New observability tests: 100% AC coverage
- Auto-updated via `npm test -- --coverage`

### GDD Validado (health ≥ 95)

**Commands:**

```bash
node scripts/validate-gdd-runtime.js --full
# Expected: 🟢 HEALTHY

node scripts/predict-gdd-drift.js --full
# Expected: Drift risk < 60

node scripts/compute-gdd-health.js --threshold=95
# Expected: Health score ≥ 95
```

### spec.md Actualizado (si aplica)

**Decision:** Minimal updates to spec.md

**Changes:**

- Add brief mention of observability in "Logging" section (if exists)
- Reference integration tests

**Rationale:** Observability is implementation detail, not public API

### 0 Comentarios de CodeRabbit

**Pre-Flight Self-Review:**

- Code quality (no console.logs, TODOs, dead code)
- Tests comprehensive and meaningful
- Documentation clear and accurate
- No obvious bugs or edge cases

**Action:** Run self-review as if CodeRabbit, fix all issues before PR

### CI/CD Passing

**Required:**

- ✅ All test suites pass
- ✅ Linting passes (`npm run lint`)
- ✅ Build succeeds (`npm run build`)
- ✅ No merge conflicts with main
- ✅ GDD validation passes
- ✅ Coverage threshold met

---

## 8. Risk Assessment

### Technical Risks

| Risk                                               | Severity  | Mitigation                                       |
| -------------------------------------------------- | --------- | ------------------------------------------------ |
| Performance impact of increased logging            | 🟡 Low    | Winston handles high volume well, use log levels |
| Correlation ID propagation across async boundaries | 🟡 Medium | Use job metadata, test thoroughly                |
| Log volume in production                           | 🟡 Low    | Configure log levels per environment             |
| Test flakiness (async logging)                     | 🟡 Low    | Use proper async/await, mock logger              |

### Blockers

**None Identified:**

- All dependencies already exist (Winston, queue service, workers)
- No external API changes needed
- No database schema changes
- No breaking changes to existing code

### Dependencies

**Internal:**

- ✅ Winston logger (already configured)
- ✅ Queue service (supports metadata)
- ✅ Workers (need enhancement but no breaking changes)

**External:**

- None

---

## 9. Timeline

**Total Estimated Effort:** 20 hours (~2.5 days)

| Phase                              | Duration | Status      |
| ---------------------------------- | -------- | ----------- |
| **Phase 0: Assessment**            | 1h       | ✅ Complete |
| **Phase 1: Logger Enhancement**    | 2h       | ⏭️ Next     |
| **Phase 2: Correlation ID**        | 1h       | ⏭️ Pending  |
| **Phase 3: Worker Logging**        | 4h       | ⏭️ Pending  |
| **Phase 4: Integration Tests**     | 6h       | ⏭️ Pending  |
| **Phase 5: Documentation**         | 1.5h     | ⏭️ Pending  |
| **Phase 6: Evidence & Validation** | 3h       | ⏭️ Pending  |
| **Phase 7: PR & Merge**            | 1.5h     | ⏭️ Pending  |

**Start Date:** 2025-10-12
**Target Completion:** 2025-10-14 (2.5 days)

---

## 10. Next Steps (Immediate Actions)

### After Planning (CONTINUE AUTOMATICALLY)

⚠️ **CRÍTICO**: Según workflow autónomo, **NO esperar confirmación del usuario**. Proceder directamente con implementación.

**Immediate Actions:**

1. ✅ Planning document saved (this file)
2. ⏭️ **START Phase 1:** Enhance logger utility
3. ⏭️ **START Phase 2:** Implement correlation ID propagation
4. ⏭️ **START Phase 3:** Enhance worker logging (4 workers)
5. ⏭️ **START Phase 4:** Create integration tests
6. ⏭️ **START Phase 5:** Update documentation
7. ⏭️ **START Phase 6:** Run validation & create evidence
8. ⏭️ **START Phase 7:** Create PR & merge

**Workflow:**

- Execute phases sequentially
- Validate after each phase
- Continue automatically unless blocker encountered
- Update TODO list after each phase

---

## 11. References

**Issue:**

- Issue #417: [Integración] Observabilidad mínima – structured logs y correlación
- URL: https://github.com/Eibon7/roastr-ai/issues/417

**Assessment:**

- `docs/assessment/issue-417.md` (comprehensive current state analysis)

**GDD Nodes:**

- `docs/nodes/queue-system.md` (worker architecture)
- `docs/nodes/multi-tenant.md` (tenant context)

**Related Files:**

- `src/utils/logger.js` (logger implementation)
- `src/services/queueService.js` (queue service)
- `src/workers/*.js` (4 worker files)

**Similar Issues/PRs:**

- None directly related (first observability integration tests)

---

**Planning Status:** ✅ COMPLETE
**Ready to Implement:** ✅ YES
**Quality Level:** MAXIMUM (Calidad > Velocidad)
**Estimated Effort:** 20 hours (~2.5 days)
**Confidence:** High

---

_Generated by Orchestrator Agent - 2025-10-12_
_Following CLAUDE.md quality standards: Calidad > Velocidad_
_Assessment: ENHANCE (strong foundation, targeted improvements needed)_
