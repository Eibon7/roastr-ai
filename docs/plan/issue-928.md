# Plan de Implementación - Issue #928

## Issue

[Coverage] Fase 2.2: Tests para Workers Secundarios (0-5% → 70%+)

## Estado Actual

- **AccountDeletionWorker.js**: 0% cobertura
- **GDPRRetentionWorker.js**: 5.2% cobertura
- **ModelAvailabilityWorker.js**: 0% cobertura
- **StyleProfileWorker.js**: 0% cobertura

## Objetivo

Llevar todos los workers a ≥70% cobertura con tests completos y production-quality.

## Análisis de Workers

### 1. AccountDeletionWorker

**Complejidad:** Alta (GDPR compliance, multi-step processing)

**Métodos principales:**

- `processJob()` - NO TIENE, usa `processSingleDeletion()`
- `processPendingDeletions()` - Busca y procesa deletions pendientes
- `processSingleDeletion()` - PRINCIPAL: 5 pasos (export, anonymize, delete, notify, audit)
- `sendReminderNotifications()` - Notificaciones pre-deletion
- `handleDeletionFailure()` - Retry logic + audit trail

**Dependencias a mockear:**

- `dataExportService.exportUserData()`
- `dataExportService.anonymizeUserData()`
- `dataExportService.deleteUserData()`
- `emailService.sendAccountDeletionCompletedEmail()`
- `emailService.sendAccountDeletionReminderEmail()`
- `auditService.logGdprAction()`
- `auditService.logDataExport()`
- `auditService.logAccountDeletionCompleted()`
- Supabase: `account_deletion_requests` table

**Casos de test:**

- ✅ Deletion completa exitosa (5 pasos)
- ✅ Data export falla → continua con anonymize
- ✅ Email notification falla → log warning pero continua
- ⚠️ Grace period no cumplido → skip deletion
- ⚠️ Retry logic cuando max attempts no alcanzado
- ❌ Anonymization falla → handleDeletionFailure
- ❌ Deletion falla → audit trail logged

---

### 2. GDPRRetentionWorker

**Complejidad:** Alta (crypto operations, batch processing)

**Métodos principales:**

- `processJob()` - PRINCIPAL: Switch entre operations
- `anonymizeOldRecords()` - Day 80: HMAC-SHA-256 anonymization
- `anonymizeBatch()` - Batch processing con crypto
- `purgeOldRecords()` - Day 90: Complete deletion
- `cleanupOldProfiles()` - RPC call para offender profiles
- `runFullRetentionCycle()` - Full cycle: anonymize + purge + cleanup

**Dependencias a mockear:**

- `crypto.createHmac()` - HMAC generation
- Supabase: `shield_events`, `offender_profiles`, `shield_retention_log`
- Supabase RPC: `cleanup_old_offender_profiles()`
- Environment: `GDPR_HMAC_PEPPER`, `SUPABASE_SERVICE_KEY`

**Casos de test:**

- ✅ Anonymize day-80 records exitosamente
- ✅ Purge day-90 records exitosamente
- ✅ Cleanup old profiles via RPC
- ✅ Full retention cycle (3 operations)
- ✅ Dry-run mode (no real changes)
- ⚠️ Batch processing con múltiples batches
- ❌ HMAC generation falla
- ❌ Missing GDPR_HMAC_PEPPER environment variable
- ❌ Supabase operation falla → logged to retention_log

---

### 3. ModelAvailabilityWorker

**Complejidad:** Baja (polling worker, simple logic)

**Métodos principales:**

- `runCheck()` - PRINCIPAL: Check model availability
- `start()` - Start periodic checks (24h interval)
- `stop()` - Stop worker gracefully
- `runManualCheck()` - Manual trigger
- `notifyGPT5Available()` - Notification when GPT-5 available
- `getStatus()` - Worker status + stats

**Dependencias a mockear:**

- `modelAvailabilityService.forceRefresh()`
- `modelAvailabilityService.getModelStats()`
- `setInterval` / `clearInterval`
- Logger

**Casos de test:**

- ✅ runCheck exitoso con GPT-5 disponible
- ✅ runCheck exitoso con GPT-5 NO disponible
- ✅ start() inicia polling interval
- ✅ stop() detiene polling interval
- ✅ GPT-5 availability notification logged
- ✅ Manual check trigger
- ❌ modelService.forceRefresh() falla → error logged
- ❌ getStats() falla → empty object returned

---

### 4. StyleProfileWorker

**Complejidad:** Media (extends BaseWorker, queue integration)

**Métodos principales:**

- `processJob()` - PRINCIPAL: Extract style profile
- `scheduleNextRefresh()` - Schedule 90-day refresh
- `shouldRetry()` - Determine retryability
- `onJobComplete()` - Hook after completion
- `onJobFailed()` - Hook after failure

**Dependencias a mockear:**

- `styleProfileService.needsRefresh()`
- `styleProfileService.extractStyleProfile()`
- `queueService.addJob()` (para schedule next refresh)
- Supabase (via BaseWorker)

**Casos de test:**

- ✅ Extract profile exitosamente
- ✅ Profile up-to-date → skip extraction
- ✅ Refresh forced (isRefresh=true)
- ✅ Schedule next refresh (90 days)
- ⚠️ Non-retryable errors → permanent failure
- ⚠️ Retryable errors → throw (queue retry)
- ❌ extractStyleProfile falla (retryable)
- ❌ extractStyleProfile falla (non-retryable)

---

## Estrategia de Testing

### Patrón Supabase Mock (CRÍTICO)

Usar patrón #11 de coderabbit-lessons.md:

```javascript
// Create mock BEFORE jest.mock() call
const mockSupabase = {
  from: jest.fn((tableName) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() =>
          Promise.resolve({
            data: { id: '123', status: 'pending' },
            error: null
          })
        )
      }))
    })),
    insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    delete: jest.fn(() => ({
      lt: jest.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  })),
  rpc: jest.fn((functionName) => Promise.resolve({ data: null, error: null }))
};

// Reference in jest.mock()
jest.mock('../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));
```

### Test Structure

**Por cada worker:**

- File: `tests/unit/workers/<WorkerName>.test.js`
- Grupos: Success cases, Error cases, Edge cases
- Coverage goal: ≥70% lines, statements, functions, branches

**Template:**

```javascript
describe('<WorkerName>', () => {
  describe('processJob() - Success', () => {
    test('should process job successfully', async () => {
      // Arrange: Setup mocks
      // Act: Call processJob
      // Assert: Verify results + mock calls
    });
  });

  describe('processJob() - Error Handling', () => {
    test('should handle X error gracefully', async () => {
      // Arrange: Mock failure
      // Act: Call processJob
      // Assert: Error logged, handled correctly
    });
  });

  describe('Edge Cases', () => {
    test('should handle Y edge case', async () => {
      // Arrange, Act, Assert
    });
  });
});
```

### Mock Utilities

**Logger mock (always):**

```javascript
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  SafeUtils: {
    safeUserIdPrefix: jest.fn((id) => id?.substr(0, 8) + '...')
  }
}));
```

**Service mocks:**

```javascript
const mockDataExportService = {
  exportUserData: jest.fn(),
  anonymizeUserData: jest.fn(),
  deleteUserData: jest.fn()
};

jest.mock('../../src/services/dataExportService', () => {
  return jest.fn().mockImplementation(() => mockDataExportService);
});
```

---

## Archivos a Crear/Modificar

### Tests a crear:

1. `tests/unit/workers/AccountDeletionWorker.test.js` (nuevo)
2. `tests/unit/workers/GDPRRetentionWorker.test.js` (nuevo)
3. `tests/unit/workers/ModelAvailabilityWorker.test.js` (nuevo)
4. `tests/unit/workers/StyleProfileWorker.test.js` (nuevo)

### Evidencias:

- `docs/test-evidence/issue-928/summary.md`
- `docs/test-evidence/issue-928/coverage-before.txt`
- `docs/test-evidence/issue-928/coverage-after.txt`

### GDD Updates:

- `docs/nodes/queue-system.md` - Actualizar coverage stats + "Agentes Relevantes"

---

## Pasos de Implementación

### Paso 1: AccountDeletionWorker Tests (Día 1)

- [ ] Crear test file con Supabase mock pattern
- [ ] Tests para processSingleDeletion (5 steps)
- [ ] Tests para sendReminderNotifications
- [ ] Tests para handleDeletionFailure
- [ ] Ejecutar coverage: `npm test -- AccountDeletionWorker.test.js --coverage`
- [ ] Verificar ≥70% coverage

### Paso 2: GDPRRetentionWorker Tests (Día 1-2)

- [ ] Crear test file con crypto + Supabase mocks
- [ ] Tests para anonymizeOldRecords + anonymizeBatch
- [ ] Tests para purgeOldRecords
- [ ] Tests para cleanupOldProfiles (RPC mock)
- [ ] Tests para runFullRetentionCycle
- [ ] Tests para dry-run mode
- [ ] Ejecutar coverage: `npm test -- GDPRRetentionWorker.test.js --coverage`
- [ ] Verificar ≥70% coverage

### Paso 3: ModelAvailabilityWorker Tests (Día 2)

- [ ] Crear test file con modelService mock
- [ ] Tests para runCheck (GPT-5 available/not available)
- [ ] Tests para start/stop lifecycle
- [ ] Tests para notifyGPT5Available
- [ ] Tests para runManualCheck
- [ ] Ejecutar coverage: `npm test -- ModelAvailabilityWorker.test.js --coverage`
- [ ] Verificar ≥70% coverage

### Paso 4: StyleProfileWorker Tests (Día 2-3)

- [ ] Crear test file con styleProfileService mock
- [ ] Tests para processJob (extract + skip)
- [ ] Tests para scheduleNextRefresh
- [ ] Tests para shouldRetry (retryable vs non-retryable)
- [ ] Tests para onJobComplete + onJobFailed hooks
- [ ] Ejecutar coverage: `npm test -- StyleProfileWorker.test.js --coverage`
- [ ] Verificar ≥70% coverage

### Paso 5: Integración y Validación (Día 3)

- [ ] Ejecutar ALL tests: `npm test`
- [ ] Verificar 0 failures
- [ ] Ejecutar coverage global: `npm run test:coverage`
- [ ] Verificar cobertura global ≥90%
- [ ] Generar evidencias en `docs/test-evidence/issue-928/`
- [ ] Actualizar `docs/nodes/queue-system.md` (coverage + agentes)

### Paso 6: GDD Validation (Día 3)

- [ ] `node scripts/validate-gdd-runtime.js --full` (debe pasar)
- [ ] `node scripts/score-gdd-health.js --ci` (≥87)
- [ ] `node scripts/predict-gdd-drift.js --full` (<60 risk)
- [ ] Actualizar "Agentes Relevantes" en queue-system.md (añadir TestEngineer)

### Paso 7: Code Quality (Día 3)

- [ ] Ejecutar `npm run coderabbit:review`
- [ ] Resolver TODAS las issues CodeRabbit (objetivo: 0 comentarios)
- [ ] Verificar no hay console.logs
- [ ] Verificar no hay TODOs sin issue#
- [ ] Self-review exhaustivo

---

## Agentes a Usar

### TestEngineer (PRINCIPAL)

- **Trigger:** AC ≥3, cambios en workers
- **Workflow:** Composer → @tests/ @src/workers/ → "Generate tests following test-generation-skill"
- **Receipt:** `docs/agents/receipts/cursor-test-engineer-[timestamp].md`

### Guardian (SECUNDARIO)

- **Trigger:** Cambios en GDD nodes, compliance (GDPR)
- **Workflow:** `node scripts/guardian-gdd.js --full` + manual audit
- **Receipt:** `docs/agents/receipts/cursor-guardian-[timestamp].md`

---

## Validación Pre-Merge

**Tests:**

```bash
npm test -- tests/unit/workers/AccountDeletionWorker.test.js
npm test -- tests/unit/workers/GDPRRetentionWorker.test.js
npm test -- tests/unit/workers/ModelAvailabilityWorker.test.js
npm test -- tests/unit/workers/StyleProfileWorker.test.js
npm test  # All tests
npm run test:coverage  # ≥90%
```

**GDD:**

```bash
node scripts/validate-gdd-runtime.js --full
node scripts/score-gdd-health.js --ci  # ≥87
node scripts/predict-gdd-drift.js --full  # <60
```

**Quality:**

```bash
npm run coderabbit:review  # 0 comentarios
```

---

## Impacto Esperado

**Cobertura:**

- AccountDeletionWorker: 0% → 70%+
- GDPRRetentionWorker: 5.2% → 70%+
- ModelAvailabilityWorker: 0% → 70%+
- StyleProfileWorker: 0% → 70%+
- **Global:** +2-3% cobertura total

**Calidad:**

- Compliance validado (GDPR, data deletion)
- Casos de éxito y error cubiertos
- Retry logic testeado
- Audit trail verificado

**Riesgo:**

- 🟡 MEDIO: Workers menos frecuentes pero críticos para compliance

---

**Plan creado:** 2025-11-23
**Estimación:** 2-3 días
**Prioridad:** 🟡 MEDIA (compliance importante)
