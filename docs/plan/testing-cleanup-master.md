# Master Plan: Testing Suite Cleanup & Stabilization

**Created:** 2025-10-20
**Owner:** Claude Code Orchestrator
**Epic:** Issue #480 - Test Suite Stabilization
**Priority:** P0 (Critical for MVP)
**Estimated Total:** 34-45 hours (1-1.5 sprints)

---

## 📊 Estado Actual (Baseline - 2025-10-20)

### Test Execution Results
```bash
npm test (executed: 2025-10-20T16:49:41.718Z)

Test Suites: 175 failed, 2 skipped, 143 passed, 318 of 320 total
Tests:       1215 failed, 55 skipped, 3945 passed, 5215 total
Time:        62.633 s
Success Rate: 45% suites passing, 77% tests passing
```

### Critical Errors Identified
1. **fs.remove is not a function** - `tests/integration/cli/logCommands.test.js:386,462`
2. **Test timeout** - `tests/integration/cli/logCommands.test.js:328`
3. **175 test suites failing** (55% failure rate)
4. **1215 tests failing** (23% failure rate)

### Test Suite Structure
- **Total test files:** 343 (134,540 lines)
- **Unit tests:** 243 files (70%)
- **Integration tests:** 83 files (24%)
- **E2E tests:** 7 files (2%)
- **Test helpers:** 11 files (3,651 lines)

### Critical Gaps (From Analysis)
1. **8 skipped tests** in `roast.test.js` (CORE ENDPOINTS)
2. **158 console.log statements** to remove
3. **12 duplicate test files** to consolidate
4. **3 missing worker tests:** PublisherWorker, ModelAvailabilityWorker, StyleProfileWorker
5. **22 missing route tests:** Guardian, Shield, Webhooks, Approval, Comments (+17 more)

---

## 🎯 Objetivos del Plan

### Success Metrics
- ✅ **Test suites passing:** 175 → 318 (100%)
- ✅ **Tests passing:** 3945 → 5215 (100%)
- ✅ **Console statements:** 158 → 0
- ✅ **Duplicate test files:** 12 → 0 (consolidated)
- ✅ **Skipped core tests:** 8 → 0 (enabled or documented)
- ✅ **Missing worker tests:** 3 → 0 (PublisherWorker, etc.)
- ✅ **Issues cerradas:** 11 issues (#480-489, #583, #588)

### Quality Gates
- **Gate 1 (Phase 1):** All existing tests passing (100% suite pass rate)
- **Gate 2 (Phase 2):** No console statements, no duplicates
- **Gate 3 (Phase 3):** Missing critical tests added
- **Gate 4 (Phase 4):** All testing issues closed

---

## 📋 Plan de Ataque - 4 Fases (REVISADO)

**⚠️ PLAN REVISADO:** Task Assessor Agent recomienda dividir FASE 1 en 3 PRs para reducir riesgo de contexto loss y facilitar code review.

### FASE 1: Estabilización de Tests Existentes (P0 - CRÍTICO)
**Objetivo:** Hacer que todos los tests existentes pasen
**Duración estimada:** 10-13 horas (dividida en 3 PRs)
**Strategy:** Dependency-ordered PRs (Infrastructure → Services → API/E2E)
**Issues a cerrar:** #481, #482, #483, #484, #485

#### Estrategia de Ejecución (3 PRs)

##### PR 1.1: Critical Infrastructure Tests (P0) - 3-4 hours
**Branch:** `test/stabilization-infrastructure`
**Scope:** Fix tests blocking other tests (foundational layer)
**Files:** ~20-30 test files
**Estimated fixes:** 50+ suites

**Focus areas:**
- Queue infrastructure tests
- Database connection tests
- Worker base class tests
- Test helper utilities
- Critical mocking infrastructure

**Success Criteria:**
- ✅ Infrastructure layer tests 100% passing
- ✅ Queue tests stable
- ✅ Worker base tests passing
- ✅ Test helpers validated

##### PR 1.2: Service & Integration Tests (P0) - 4-5 hours
**Branch:** `test/stabilization-services`
**Scope:** Fix service layer tests
**Files:** ~30-40 test files
**Estimated fixes:** 60+ suites

**Focus areas:**
- PersonaService tests (Issue #595)
- Cost control tests
- Platform service tests (Twitter, YouTube, etc.)
- RLS policy tests (Issue #583)
- Multi-tenant service tests

**Success Criteria:**
- ✅ Service layer tests 100% passing
- ✅ RLS tests complete and validated
- ✅ Platform services stable

##### PR 1.3: API & E2E Tests (P0) - 3-4 hours
**Branch:** `test/stabilization-api-e2e`
**Scope:** Fix API endpoint and E2E tests
**Files:** ~30-40 test files
**Estimated fixes:** 65+ suites

**Focus areas:**
- API endpoint tests
- Authentication flow tests (Issue #593)
- E2E flow tests (Issues #487, #488, #489)
- Frontend component tests

**Success Criteria:**
- ✅ API layer tests 100% passing
- ✅ E2E tests validated
- ✅ **GATE: 100% test suite passing (0 failing suites)**

---

#### Checkpoint System (Recovery Strategy)

After fixing every 10 suites, commit with checkpoint marker:
```bash
git add <files>
git commit -m "test: Fix <subsystem> tests - Checkpoint N/18

✅ Fixed: <list of test suites>
⏳ Remaining: <count> failing suites

Checkpoint: test-stabilization-phase1-checkpoint-N"
```

Generate checkpoint evidence:
```bash
npm test 2>&1 | tail -20 > docs/test-evidence/checkpoint-N.txt
git log --oneline -1 >> docs/test-evidence/checkpoint-N.txt
```

**Recovery command if context lost:**
```bash
# Find last checkpoint
git log --grep="Checkpoint" --oneline | head -1
# Read checkpoint evidence
cat docs/test-evidence/checkpoint-*.txt | tail -50
# Resume from last checkpoint
```

---

#### Tareas (Original - Now distributed across 3 PRs)

##### 1.1 Fix fs.remove Error (BLOQUEANTE)
**File:** `tests/integration/cli/logCommands.test.js`
**Error:** `TypeError: fs.remove is not a function` (lines 386, 462)
**Root cause:** `fs-extra` not properly imported or using wrong API

**Fix:**
```javascript
// BEFORE
await fs.remove(tempLogDir);

// AFTER
const fs = require('fs-extra'); // Ensure fs-extra is imported
await fs.remove(tempLogDir);

// OR use standard fs with rimraf
const { rm } = require('fs').promises;
await rm(tempLogDir, { recursive: true, force: true });
```

**Verification:**
```bash
npm test -- tests/integration/cli/logCommands.test.js
# Should pass all tests
```

**Time:** 30 minutes

---

##### 1.2 Fix Test Timeouts
**File:** `tests/integration/cli/logCommands.test.js:328`
**Error:** Test timeout

**Actions:**
1. Increase timeout for long-running CLI tests
2. Add proper cleanup in afterEach
3. Kill child processes properly

**Fix:**
```javascript
// Increase timeout for integration tests
jest.setTimeout(30000); // 30 seconds

// Proper child process cleanup
afterEach(async () => {
  if (child && !child.killed) {
    child.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
});
```

**Verification:**
```bash
npm test -- tests/integration/cli/
# All CLI tests should pass
```

**Time:** 1 hour

---

##### 1.3 Investigate & Fix roast.test.js Skipped Tests (CRÍTICO)
**File:** `tests/unit/routes/roast.test.js`
**Issue:** 8 CORE endpoint tests are skipped (it.skip)

**Skipped tests:**
1. `should generate a roast preview successfully`
2. `should validate required text parameter`
3. `should validate text length`
4. `should validate tone parameter`
5. `should validate intensity parameter`
6. `should handle empty text`
7. `should use default values for optional parameters`
8. `should generate a roast and consume credits`

**Investigation steps:**
1. Read test file to understand why tests were skipped
2. Check if dependencies/mocks are missing
3. Check if route implementation changed
4. Enable tests one by one

**Actions:**
```bash
# Read current test
cat tests/unit/routes/roast.test.js | grep -A 10 "it.skip"

# Check route implementation
cat src/routes/roast.js

# Try enabling one test
# Change it.skip → it in test file
npm test -- tests/unit/routes/roast.test.js
```

**Possible fixes:**
- Add missing mocks for OpenAI service
- Update test expectations to match current API
- Fix authentication/authorization in tests
- Update cost control mocks

**Decision tree:**
- If tests pass when enabled → Enable all 8 tests
- If tests need minor fixes → Fix and enable
- If tests are obsolete → Delete (document reason in commit)
- If tests need major rework → Create follow-up issue, document reason

**Time:** 3-4 hours

---

##### 1.4 Fix Remaining Failing Test Suites
**Target:** 175 failing suites → 0 failing suites

**Approach:**
1. Run tests and collect all unique error types
2. Group errors by root cause
3. Fix systematically by error type

**Commands:**
```bash
# Get all unique error messages
npm test 2>&1 | grep "Error:" | sort | uniq -c | sort -rn > test-errors.txt

# Run specific test suite
npm test -- <test-file-path>

# Run tests matching pattern
npm test -- --testNamePattern="<pattern>"
```

**Common error patterns to fix:**
- Missing mocks
- Incorrect imports
- Schema mismatches
- Environment variable issues
- Timeout issues

**Verification:**
```bash
npm test
# Expected: Test Suites: 318 passed, 318 total
# Expected: Tests: 5160+ passed (minus skipped acceptable)
```

**Time:** 4-6 hours

---

#### FASE 1: Acceptance Criteria

- ✅ `fs.remove` error fixed
- ✅ Test timeouts fixed
- ✅ All 8 roast.test.js tests enabled OR documented why skipped
- ✅ **100% test suites passing** (318/318)
- ✅ **95%+ tests passing** (allowing for acceptable skips)
- ✅ No CRITICAL errors remaining

#### FASE 1: PR Checklist

- [ ] All existing tests passing (100% suite pass rate)
- [ ] Documented reason for any remaining it.skip()
- [ ] Updated test-analysis documentation with results
- [ ] GDD validation passing
- [ ] Pre-Flight Checklist ejecutado
- [ ] Self-review completado

#### FASE 1: Issues Cerradas
- #481 - [Test Fix] Ingestor Test Suite
- #482 - [Test Fix] Shield Test Suite
- #483 - [Test Fix] Roast Generation Test Suite
- #484 - [Test Fix] Multi-Tenant & Billing Test Suite
- #485 - [Test Fix] Unit Test Suite

---

### FASE 2: Code Quality & Consolidation (P1 - HIGH)
**Objetivo:** Limpiar código de test, consolidar duplicados
**Duración estimada:** 6-8 horas
**PR:** `chore/test-quality-phase2`
**Strategy:** ⚡ **CAN RUN IN PARALLEL** with PR 1.2/1.3 reviews
**Issues a cerrar:** Partial #480

**⚡ PARALLEL WORK OPPORTUNITY:**
- Start FASE 2 while PR 1.2 is in code review
- Low risk: cosmetic changes only (console.log removal, file consolidation)
- Merge after all FASE 1 PRs complete
- **Benefit:** Saves 2-3 hours on critical path

#### Tareas

##### 2.1 Remove Console Statements (158 instances)
**Target:** Remove all console.log, console.error, console.warn from tests

**Command:**
```bash
# Find all console statements
grep -rn "console\." tests/ --include="*.test.js" > console-statements.txt

# Count by file
grep -r "console\." tests/ --include="*.test.js" | cut -d: -f1 | sort | uniq -c | sort -rn
```

**Fix options:**
```javascript
// Option 1: Remove completely (if debug-only)
// console.log('Debug:', data); // DELETE

// Option 2: Replace with logger (if needed)
const logger = require('../../src/utils/logger');
logger.debug('Test data:', data);

// Option 3: Conditional debug
if (process.env.DEBUG_TESTS) {
  console.log('Debug:', data);
}
```

**Automated cleanup:**
```bash
# Remove simple console.log statements (review changes!)
find tests -name "*.test.js" -type f -exec sed -i '' '/^\s*console\.log/d' {} +

# Verify no critical logs removed
git diff tests/

# Run tests to ensure nothing broke
npm test
```

**Time:** 2-3 hours

---

##### 2.2 Consolidate Duplicate Test Files (12 pairs)
**Target:** Merge or document purpose of -simple, -basic, -cleanup variants

**Duplicates to consolidate:**

1. **BillingWorker tests (3 files → 1 file)**
   ```bash
   tests/unit/workers/BillingWorker.test.js (main)
   tests/unit/workers/BillingWorker-simple.test.js
   tests/unit/workers/BillingWorker-cleanup.test.js
   ```
   **Action:** Merge all tests into main file, organize by describe blocks

2. **csvRoastService tests (2 files → 1 file)**
   ```bash
   tests/unit/csvRoastService.test.js
   tests/unit/csvRoastService-simple.test.js
   ```

3. **twitterService tests (2 files → 1 file)**
   ```bash
   tests/unit/twitterService.test.js
   tests/unit/twitterService-simple.test.js
   ```

4. **Persona tolerance tests (2 files → 1 file)**
   ```bash
   tests/unit/routes/roastr-persona-tolerance.test.js
   tests/unit/routes/roastr-persona-tolerance-simple.test.js
   ```

5. **User tests (3 files → 1 file)**
   ```bash
   tests/unit/routes/user.test.js
   tests/unit/routes/user-profile-simple.test.js
   tests/unit/routes/user-theme-simple.test.js
   ```

6. **API integration tests (2 files → 1 file)**
   ```bash
   tests/integration/api.test.js
   tests/integration/api-simple.test.js
   ```

7. **Persona sanitization tests (2 files → 1 file)**
   ```bash
   tests/integration/roastr-persona-sanitization.test.js
   tests/integration/roastr-persona-sanitization-simple.test.js
   ```

8. **Flags tests (2 files → 1 file)**
   ```bash
   tests/unit/config/flags-basic.test.js
   tests/unit/config/__tests__/flags.test.js
   ```

**Consolidation process:**
```bash
# For each pair:
# 1. Compare files
diff tests/unit/workers/BillingWorker.test.js tests/unit/workers/BillingWorker-simple.test.js

# 2. Identify unique tests in -simple variant
# 3. Merge unique tests into main file
# 4. Organize with describe blocks
# 5. Delete -simple file
git rm tests/unit/workers/BillingWorker-simple.test.js

# 6. Run tests
npm test -- tests/unit/workers/BillingWorker.test.js

# 7. Commit
git add tests/unit/workers/BillingWorker.test.js
git commit -m "test(workers): Consolidate BillingWorker tests"
```

**Time:** 4-5 hours (30 min per pair)

---

#### FASE 2: Acceptance Criteria

- ✅ **0 console statements** in test files
- ✅ **0 duplicate test files** (12 pairs consolidated)
- ✅ All tests still passing after cleanup
- ✅ Test count maintained or increased (no tests lost)

#### FASE 2: PR Checklist

- [ ] All console statements removed or justified
- [ ] All duplicate files consolidated or documented
- [ ] Tests still passing after consolidation
- [ ] Git history shows proper file deletion
- [ ] Pre-Flight Checklist ejecutado

---

### FASE 3: Missing Critical Tests (P1 - HIGH)
**Objetivo:** Añadir tests faltantes críticos
**Duración estimada:** 16-24 hours
**PR:** `test/add-missing-critical-tests-phase3`
**Issues a cerrar:** #456 (partial), #487, #488, #489, #583, #588

#### Tareas

##### 3.1 Add PublisherWorker Tests (CRÍTICO)
**File to create:** `tests/integration/publisher-worker.test.js`
**Source file:** `src/workers/PublisherWorker.js` (15,944 bytes, fully implemented)

**Test coverage needed (from Issue #456):**
1. Publication success + platform_post_id persistence
2. Idempotency check (skip if already published)
3. Rate limit handling (429 errors + exponential backoff)
4. Error classification (4xx permanent, 5xx retry)
5. Platform service selection (Twitter, YouTube, etc.)
6. Comprehensive logging

**Test structure:**
```javascript
describe('PublisherWorker', () => {
  describe('Publication Flow', () => {
    test('should publish roast and save platform_post_id', async () => {});
    test('should skip duplicate publication (idempotency)', async () => {});
  });

  describe('Rate Limiting', () => {
    test('should retry on 429 with exponential backoff', async () => {});
    test('should handle rate limit after max retries', async () => {});
  });

  describe('Error Handling', () => {
    test('should NOT retry 4xx errors (401, 403, 400)', async () => {});
    test('should retry 5xx errors (500, 502, 503)', async () => {});
  });

  describe('Platform Integration', () => {
    test('should select correct platform service', async () => {});
    test('should handle missing platform service', async () => {});
  });

  describe('Logging', () => {
    test('should log all attempts and outcomes', async () => {});
  });
});
```

**Time:** 6-8 hours

---

##### 3.2 Update RLS Integration Tests for Current Schema
**Issue:** #583
**File:** `tests/integration/multi-tenant-rls-issue-412.test.js`
**Problem:** Tests reference old schema (posts table doesn't exist)

**Actions:**
1. Read current test file
2. Read current schema from `database/schema.sql`
3. Update test helper `tests/helpers/tenantTestUtils.js`
4. Update test expectations

**Schema changes needed:**
- Remove `posts` table references
- Update `comments` structure (add `integration_config_id`, `organization_id`)
- Rename `roasts` → `responses` (add `comment_id` FK)

**Verification:**
```bash
npm test -- tests/integration/multi-tenant-rls-issue-412.test.js
# Should pass all 14 tests
```

**Time:** 2-3 hours

---

##### 3.3 Implement MVP Validation Gap Closures (G1, G6, G10)
**Issue:** #588
**Files to modify:**
1. `scripts/validate-flow-basic-roast.js` (G1 - Quality Check >50 chars)
2. `tests/integration/test-multi-tenant-rls.test.js` (G6 - RLS 403 Error)
3. `scripts/validate-flow-billing.js` (G10 - Billing 403 Error)

**G1: Quality Check**
```javascript
// Add after line 250 in validate-flow-basic-roast.js
const MIN_ROAST_LENGTH = 50;
if (roastResult.roast.length < MIN_ROAST_LENGTH) {
  throw new Error(`Quality check FAILED: Roast too short (${roastResult.roast.length} chars)`);
}
console.log(`✅ Quality check passed: ${roastResult.roast.length} chars`);
```

**G6: RLS 403 Validation**
```javascript
// Add to test-multi-tenant-rls.test.js
test('Cross-tenant access returns 403 error (PGRST301)', async () => {
  const { tenantA, tenantB } = await createTestTenants();
  await setTenantContext(tenantA.id);

  const { data, error } = await testClient
    .from('organizations')
    .select('*')
    .eq('id', tenantB.id)
    .single();

  expect(error).toBeDefined();
  expect(error.code).toBe('PGRST301'); // RLS violation
});
```

**G10: Billing 403 Error Code**
```javascript
// Enhance error handling in validate-flow-billing.js
catch (err) {
  console.log(`Error type: ${err.constructor.name}`);
  const errorMessage = err.message.toLowerCase();
  const isLimitError = errorMessage.includes('limit') ||
                       errorMessage.includes('exceeded');
  if (!isLimitError) {
    throw new Error(`Error doesn't indicate limit: ${err.message}`);
  }
  console.log(`✅ Error correctly indicates limit exceeded (HTTP 403 equivalent)`);
}
```

**Time:** 2-3 hours

---

##### 3.4 Add Flow Validation Tests (E2E)
**Issues:** #487 (Shield), #488 (Multi-Tenant RLS), #489 (Billing)

**Tests to create:**

1. **Shield Automated Moderation Flow** (#487)
   ```bash
   tests/e2e/flow-shield-moderation.test.js
   ```
   - High toxicity comment → Shield analysis → Action taken
   - Verify escalation logic
   - Verify action persistence

2. **Multi-Tenant RLS Isolation Flow** (#488)
   ```bash
   tests/e2e/flow-multitenant-rls.test.js
   ```
   - Org A creates data
   - Org B cannot access Org A data
   - Verify complete isolation

3. **Billing & Plan Limits Enforcement Flow** (#489)
   ```bash
   tests/e2e/flow-billing-limits.test.js
   ```
   - Free plan: limit at 100 roasts
   - Pro plan: limit at 1,000 roasts
   - Verify limit enforcement + error messages

**Time:** 3-4 hours per flow = 9-12 hours total

---

#### FASE 3: Acceptance Criteria

- ✅ PublisherWorker tests implemented (20+ tests)
- ✅ RLS integration tests updated and passing
- ✅ MVP validation gaps closed (G1, G6, G10)
- ✅ 3 E2E flow validation tests implemented
- ✅ All new tests passing

#### FASE 3: Issues Cerradas
- #456 - PublisherWorker tests completed
- #487 - Shield flow validation
- #488 - Multi-Tenant RLS flow validation
- #489 - Billing limits flow validation
- #583 - RLS integration tests updated
- #588 - MVP validation gaps closed

---

### FASE 4: Remaining Tests & Closure (P2 - MEDIUM)
**Objetivo:** Completar tests restantes, cerrar epic
**Duración estimada:** 8-12 hours
**PR:** `test/complete-remaining-tests-phase4`
**Issues a cerrar:** #480 (EPIC)

#### Tareas

##### 4.1 Add Remaining Worker Tests
**Workers missing tests:**
1. `ModelAvailabilityWorker.js`
2. `StyleProfileWorker.js`

**Time:** 3-4 hours per worker = 6-8 hours

---

##### 4.2 Add Critical Route Tests
**Routes missing tests (select 5 most critical):**
1. `guardian.js` (admin critical)
2. `shield.js` (admin critical)
3. `webhooks.js` (integration critical)
4. `approval.js` (workflow)
5. `comments.js` (core feature)

**Time:** 2 hours per route = 10 hours

**Decision:** Defer remaining 17 routes to Post-MVP (create follow-up issues)

---

##### 4.3 Final Cleanup & Documentation
1. Update test-analysis documentation with final results
2. Update GDD nodes with new coverage
3. Close all testing issues
4. Document any remaining gaps for Post-MVP

**Time:** 2-3 hours

---

#### FASE 4: Acceptance Criteria

- ✅ 2 remaining worker tests implemented
- ✅ 5 critical route tests implemented
- ✅ All documentation updated
- ✅ All testing issues closed
- ✅ Post-MVP follow-up issues created for remaining work

#### FASE 4: Issues Cerradas
- #480 - EPIC: Test Suite Stabilization (100% complete)

---

## 🚀 Execution Strategy (REVISADO)

### Daily Workflow
```bash
# Start of day
git checkout main
git pull origin main
git checkout -b <pr-branch>

# During work (with checkpoints)
npm test -- <specific-test>
git add <files>
git commit -m "<conventional-commit>"

# Every 10 suites fixed - CHECKPOINT
npm test 2>&1 | tail -20 > docs/test-evidence/checkpoint-N.txt
git add docs/test-evidence/checkpoint-N.txt
git commit -m "test: Fix <subsystem> - Checkpoint N/18"

# End of day / PR ready
npm test  # Full suite
npm run test:coverage
node scripts/validate-gdd-runtime.js --full
git push origin <pr-branch>
gh pr create --title "<PR-title>" --body "$(cat PR-template)"
```

### PR Strategy (REVISED)
- **6 PRs total** (was 4): 3 for FASE 1, 1 each for FASE 2/3/4
- FASE 1 split into 3 dependency-ordered PRs
- Each PR closes specific issues
- Each PR passes Pre-Flight Checklist
- Each PR has 0 CodeRabbit comments before merge
- **Smaller PRs = Faster reviews + Lower risk**

### Parallel Work Strategy (OPTIMIZED)
- **FASE 1:** Sequential (PR 1.1 → PR 1.2 → PR 1.3) - Dependencies exist
- **FASE 2:** ⚡ Start while PR 1.2 in review (saves 2-3 hours)
- **FASE 3:** Partially parallel (multiple test files)
- **FASE 4:** Fully parallel (worker tests, route tests)
- **Total time saved:** ~2-3 hours on critical path

### Risk Management
- **Checkpoint every 10 suites** - No more than 1 hour work lost
- **Dependency-ordered PRs** - Infrastructure first prevents cascade failures
- **Parallel FASE 2** - Low-risk cosmetic changes
- **Recovery docs** - `docs/test-evidence/checkpoint-*.txt`

---

## 📈 Progress Tracking

### Metrics Dashboard
```bash
# Test pass rate
npm test 2>&1 | tail -5

# Console statements count
grep -r "console\." tests/ --include="*.test.js" | wc -l

# Duplicate files count
find tests -name "*-simple.test.js" | wc -l

# Skipped tests count
grep -r "it\.skip\|describe\.skip" tests/ --include="*.test.js" | wc -l
```

### Recovery Checkpoints
If context window lost, recover with:
```bash
# Read this file
cat docs/plan/testing-cleanup-master.md

# Check current phase
git branch --show-current
# Expected: fix/test-stabilization-phase1, chore/test-quality-phase2, etc.

# Check progress
npm test 2>&1 | tail -10
git status
git log --oneline -5

# Continue from last checkpoint
# See "Current Phase" section below
```

---

## 🎯 Success Criteria (Final)

### Must-Have (MVP)
- ✅ 100% test suites passing (318/318)
- ✅ 95%+ tests passing (5000+/5215)
- ✅ 0 console statements in tests
- ✅ 0 duplicate test files
- ✅ PublisherWorker tests implemented
- ✅ All critical flow validations passing
- ✅ All testing issues closed

### Nice-to-Have (Post-MVP)
- Additional route tests (17 remaining routes)
- Additional service tests (15+ services)
- Snapshot testing expansion
- Custom Jest matchers
- Performance benchmarks

---

## 📝 Current Phase Tracker

**Current Phase:** FASE 1.1 - Critical Infrastructure
**Current Branch:** `test/stabilization-infrastructure`
**Current PR:** PR 1.1 (not created yet)
**Current Task:** Setup + Fix fs.remove Error
**Last Updated:** 2025-10-20
**Test Status:** 175 failing suites / 318 total (baseline)

### Phase Status (REVISED)
- [ ] PR 1.1: Critical Infrastructure (Not started)
- [ ] PR 1.2: Service & Integration Tests (Blocked by 1.1)
- [ ] PR 1.3: API & E2E Tests (Blocked by 1.2)
- [ ] FASE 2: Code Quality (Can start in parallel with 1.2 review)
- [ ] FASE 3: Missing Critical Tests (Blocked by FASE 1 complete)
- [ ] FASE 4: Remaining Tests & Closure (Blocked by FASE 3)

### PR Status
- [ ] PR 1.1 - Infrastructure (~50 suites) - 0%
- [ ] PR 1.2 - Services (~60 suites) - 0%
- [ ] PR 1.3 - API/E2E (~65 suites) - 0%
- [ ] PR 2 - Code Quality - 0%
- [ ] PR 3 - Missing Tests - 0%
- [ ] PR 4 - Cleanup & Closure - 0%

### Issues Status
- [ ] #480 - EPIC (0% → tracking all)
- [ ] #481 - Ingestor (0% → PR 1.2)
- [ ] #482 - Shield (0% → PR 1.2)
- [ ] #483 - Roast Generation (0% → PR 1.3)
- [ ] #484 - Multi-Tenant & Billing (0% → PR 1.2)
- [ ] #485 - Unit Test Suite (0% → PR 1.1)
- [ ] #487 - Flow: Shield (0% → PR 1.3)
- [ ] #488 - Flow: Multi-Tenant RLS (0% → PR 1.3)
- [ ] #489 - Flow: Billing (0% → PR 1.3)
- [ ] #583 - Update RLS Tests (0% → PR 1.2)
- [ ] #588 - MVP Gaps (0% → PR 1.3)

### Checkpoints
No checkpoints yet. First checkpoint after fixing 10 suites.

---

## 🔗 Referencias

### Documentation
- [Test Analysis Index](../TEST-ANALYSIS-INDEX.md)
- [Test Analysis Main Report](../test-analysis-2025-10-20.md)
- [Test Cleanup Actions](../test-obsolete-and-cleanup.md)
- [Test Analysis Summary](../test-analysis-summary.txt)

### Issues
- #480 - EPIC: Test Suite Stabilization
- #481-485 - Test Fix issues
- #487-489 - Flow Validation issues
- #583 - RLS Tests Update
- #588 - MVP Gaps

### Tools
- `npm test` - Run all tests
- `npm test -- <file>` - Run specific test file
- `npm run test:coverage` - Generate coverage report
- `node scripts/validate-gdd-runtime.js --full` - GDD validation

---

**Plan Created By:** Claude Code Orchestrator
**Last Updated:** 2025-10-20
**Status:** ACTIVE - Ready for execution
