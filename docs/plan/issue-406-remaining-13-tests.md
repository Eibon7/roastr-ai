# Issue #406 - Remaining 13 Tests - Planning Document

**Issue:** #406 - [Integración] Ingestor – deduplicación, ack, orden, errores
**CodeRabbit Comment:** https://github.com/Eibon7/roastr-ai/pull/530#issuecomment-3393202994
**Current Status:** 31/44 tests passing (70%)
**Target:** 44/44 tests passing (100%)
**Remaining:** 13 tests (3 order-processing + 10 error-handling)

---

## Executive Summary

CodeRabbit solicita completar los 13 tests restantes para alcanzar 100% de cobertura en los tests de integración del ingestor. El trabajo se divide en dos categorías principales con problemas arquitecturales diferentes en el mock queue.

**Estimación Original:** 6-9 horas
**Complejidad:** ALTA
**Risk Level:** 🟡 MEDIUM (cambios en test infrastructure)

---

## 1. Análisis de Issues Restantes

### Order-Processing Tests (3 tests - 2-3 horas)

#### Test 1: "should respect priority-based ordering"
- **Severity:** Major (Test Coverage)
- **Category:** Architecture - Mock Implementation
- **File:** `tests/integration/ingestor-order-processing.test.js`
- **Root Cause:** Mock `getNextJob` no implementa priority-based ordering
- **Current Behavior:** FIFO only, ignora priority levels
- **Expected Behavior:** Jobs con priority 1 (critical) deben procesarse antes que priority 5 (low)

#### Test 2: "should not block processing when one job permanently fails"
- **Severity:** Major (Test Coverage)
- **Category:** Architecture - Mock Implementation
- **File:** `tests/integration/ingestor-order-processing.test.js`
- **Root Cause:** Mock queue no simula concurrent processing correctamente
- **Current Behavior:** Un job fallando bloquea el procesamiento de otros
- **Expected Behavior:** Jobs independientes deben continuar procesándose aunque uno falle

#### Test 3: "should preserve order across different priority levels with concurrency"
- **Severity:** Major (Test Coverage)
- **Category:** Architecture - Mock Implementation
- **File:** `tests/integration/ingestor-order-processing.test.js`
- **Root Cause:** Concurrency + priority ordering no implementado en mock
- **Current Behavior:** Order no se preserva en escenarios complejos
- **Expected Behavior:** Within same priority: FIFO. Across priorities: priority-first

---

### Error-Handling Tests (10 tests - 4-6 horas)

#### Test 1: "should retry transient network errors"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** Mock `fetchCommentsFromPlatform` not storing comments on retry success
- **Expected Fix:** Ensure comments stored after successful retry

#### Test 2: "should not retry authentication errors"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** Error classification not being tested correctly in mock
- **Expected Fix:** Verify `isRetryableError` returns false for 401 errors

#### Test 3: "should not retry forbidden/permission errors"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** 403 errors not classified as non-retryable
- **Expected Fix:** Verify `isRetryableError` returns false for 403 errors

#### Test 4: "should not retry malformed request errors"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** 400 errors should be non-retryable
- **Expected Fix:** Verify `isRetryableError` returns false for 400 errors

#### Test 5: "should not retry resource not found errors"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** 404 errors should be non-retryable
- **Expected Fix:** Verify `isRetryableError` returns false for 404 errors

#### Test 6: "should correctly classify HTTP status codes"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** Comprehensive status code classification not tested
- **Expected Fix:** Test matrix of status codes (4xx non-retryable, 5xx retryable, 429 retryable)

#### Test 7: "should handle mixed error scenarios in batch processing"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** Batch processing with mixed errors not handled correctly in mock
- **Expected Fix:** Some jobs succeed, some fail, verify correct state

#### Test 8: "should maintain consistent state after error recovery"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** State not preserved correctly after retry success
- **Expected Fix:** Verify job counts, statuses, and mock storage consistency

#### Test 9: "should handle database errors during comment storage"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** Database errors in `storeComments` not simulated
- **Expected Fix:** Mock Supabase insert errors, verify error handling

#### Test 10: "should handle partial batch failures gracefully"
- **Severity:** Major (Test Coverage)
- **Category:** Bug - Mock Setup
- **File:** `tests/integration/ingestor-error-handling.test.js`
- **Root Cause:** Partial batch failures don't store successful comments
- **Expected Fix:** Verify successful comments stored even when some fail

---

## 2. GDD Node Analysis

### Affected Nodes

#### `queue-system` (Production v1.2.0)
- **Impact:** HIGH - Mock implementation changes affect queue testing
- **Coverage:** 87% (maintained)
- **Changes Required:** NO (tests only, not production code)
- **Validation:** Ensure mock changes don't affect production queue

#### `testing` (hypothetical node - not exists yet)
- **Impact:** HIGH - Test infrastructure improvements
- **Coverage:** N/A
- **Changes Required:** Maybe create if test patterns emerge
- **Validation:** Document test patterns for future reference

### Nodes NOT Affected

All production GDD nodes remain unchanged:
- `analytics`, `billing`, `cost-control`, `guardian`, `multi-tenant`, `persona`, `plan-features`, `platform-constraints`, `roast`, `shield`, `social-platforms`, `tone`, `trainer`

**Rationale:** All changes are in test infrastructure (mocks), not production code.

---

## 3. Subagents Assignment

### Primary Agent: **Test Engineer Agent**
- **Responsibility:** Fix all 13 failing tests
- **Scope:** Mock queue implementation + error scenario mocks
- **Deliverables:** 44/44 tests passing, test evidence, documentation

### Supporting Agents

- **Back-end Dev Agent** (Consulta únicamente)
  - Review production code to understand expected behavior
  - Verify mock implementations match production logic
  - NO code changes in production

- **Orchestrator** (Supervisión)
  - Coordinate test fixes
  - Validate test evidence
  - Ensure quality standards

### Agents NOT Required

- ❌ Security Audit (no security changes)
- ❌ Front-end Dev (backend tests only)
- ❌ UI Designer (no UI)
- ❌ Documentation Agent (test-only changes)

---

## 4. Files Affected

### Test Utilities (PRIMARY CHANGES)

1. **`tests/helpers/ingestor-test-utils.js`** (MAJOR CHANGES)
   - **Current:** Simple FIFO `getNextJob` implementation
   - **Required:** Priority-based ordering with concurrency support
   - **Changes:**
     - Sort by priority (1-5) then by timestamp (FIFO within priority)
     - Support concurrent processing simulation
     - Handle permanent failures without blocking
   - **Impact:** Fixes 3 order-processing tests
   - **Estimated:** 2-3 hours

### Test Files (MINOR CHANGES - Mock Setup)

2. **`tests/integration/ingestor-order-processing.test.js`**
   - **Changes:** Verify/adjust test expectations if needed
   - **Impact:** 3 tests should pass
   - **Estimated:** 30 min

3. **`tests/integration/ingestor-error-handling.test.js`** (MODERATE CHANGES)
   - **Changes:** Fix mock setup for each failing test
   - **Specific Fixes:**
     - Ensure `fetchCommentsFromPlatform` mock returns comments after retry
     - Verify error classification with proper status codes
     - Handle batch processing scenarios
     - Simulate database errors in Supabase mock
     - Preserve state correctly across retries
   - **Impact:** 10 tests should pass
   - **Estimated:** 4-6 hours

### Source Code (NO CHANGES EXPECTED)

4. **`src/workers/BaseWorker.js`** - NO CHANGES (read for reference only)
5. **`src/workers/FetchCommentsWorker.js`** - NO CHANGES (read for reference only)
6. **`src/services/queueService.js`** - NO CHANGES (read for reference only)

---

## 5. Implementation Strategy

### Phase 1: Order-Processing Fixes (2-3 hours)

**Step 1.1: Implement Priority Ordering in Mock Queue**
```javascript
// tests/helpers/ingestor-test-utils.js - getNextJob enhancement

getNextJob: async () => {
  const pendingJobs = this.mockStoredJobs.filter(job => job.status === 'pending');
  if (pendingJobs.length === 0) return null;

  // Sort by priority (lower number = higher priority) then by creation time (FIFO)
  pendingJobs.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority; // 1 (critical) comes before 5 (low)
    }
    return new Date(a.created_at) - new Date(b.created_at); // FIFO within same priority
  });

  return pendingJobs[0];
}
```

**Step 1.2: Add Concurrent Processing Simulation**
- Mock queue should allow multiple jobs to be "in progress" simultaneously
- Don't block on permanent failures (mark as failed, continue with next)

**Step 1.3: Validate Order-Processing Tests**
```bash
ENABLE_MOCK_MODE=true npm test -- tests/integration/ingestor-order-processing.test.js
```
**Expected:** 8/8 tests passing (currently 5/8)

---

### Phase 2: Error-Handling Fixes (4-6 hours)

**Step 2.1: Fix Transient Error Retry (Test 1)**
- Problem: Comments not stored after successful retry
- Fix: Ensure `storeComments` called after retry success in mock
- Validation: Check `mockStoredComments` contains data after retry

**Step 2.2: Fix Error Classification Tests (Tests 2-6)**
- Problem: `isRetryableError` not properly tested
- Fix: Create proper error objects with status codes in mocks
- Validation: Verify retryable vs non-retryable classification

**Step 2.3: Fix Batch Processing (Tests 7, 10)**
- Problem: Mixed success/failure not handled correctly
- Fix: Process each comment independently in mock
- Validation: Verify partial success stores successful comments

**Step 2.4: Fix State Consistency (Test 8)**
- Problem: State not preserved after retry
- Fix: Ensure mock storage updated correctly
- Validation: Check job counts and statuses

**Step 2.5: Fix Database Errors (Test 9)**
- Problem: Database errors not simulated
- Fix: Mock Supabase errors in specific tests
- Validation: Verify error handling code path

**Step 2.6: Validate Error-Handling Tests**
```bash
ENABLE_MOCK_MODE=true npm test -- tests/integration/ingestor-error-handling.test.js
```
**Expected:** 13/13 tests passing (currently 3/13)

---

### Phase 3: Full Validation (30 min)

**Step 3.1: Run All Ingestor Tests**
```bash
ENABLE_MOCK_MODE=true npm test -- tests/integration/ingestor-*.test.js
```
**Expected:** 44/44 tests passing (100%)

**Step 3.2: Run Full Test Suite**
```bash
npm test
```
**Expected:** All tests passing, no regressions

**Step 3.3: Verify Coverage**
```bash
npm run test:coverage
```
**Expected:** Coverage maintained or improved

---

## 6. Testing Plan

### Pre-Change Baseline

```bash
# Capture current state
ENABLE_MOCK_MODE=true npm test -- tests/integration/ingestor-*.test.js > docs/test-evidence/issue-406-completion/tests-before.txt 2>&1
```

**Expected Baseline:**
- ingestor-mock-test: 1/1 passing ✅
- ingestor-deduplication: 6/6 passing ✅
- ingestor-retry-backoff: 8/8 passing ✅
- ingestor-acknowledgment: 8/8 passing ✅
- **ingestor-order-processing: 5/8 passing** ⚠️  (3 failing)
- **ingestor-error-handling: 3/13 passing** ⚠️  (10 failing)

**Total:** 31/44 passing (70%)

### Post-Change Validation

```bash
# After Phase 1
ENABLE_MOCK_MODE=true npm test -- tests/integration/ingestor-order-processing.test.js

# After Phase 2
ENABLE_MOCK_MODE=true npm test -- tests/integration/ingestor-error-handling.test.js

# Final validation
ENABLE_MOCK_MODE=true npm test -- tests/integration/ingestor-*.test.js > docs/test-evidence/issue-406-completion/tests-after.txt 2>&1
```

**Expected Final:**
- ingestor-mock-test: 1/1 passing ✅
- ingestor-deduplication: 6/6 passing ✅
- ingestor-retry-backoff: 8/8 passing ✅
- ingestor-acknowledgment: 8/8 passing ✅
- **ingestor-order-processing: 8/8 passing ✅** (3 fixed)
- **ingestor-error-handling: 13/13 passing ✅** (10 fixed)

**Total:** 44/44 passing (100%) ✅

---

## 7. Commit Strategy

### Single Commit (Recommended)

**Rationale:** All changes are part of completing Issue #406, logically related

**Commit Message:**
```
test: Complete Issue #406 - Fix remaining 13 ingestor tests (100% passing)

### Issues Addressed

**Order-Processing (3 tests):**
- ✅ Implement priority-based ordering in mock queue
- ✅ Handle concurrent processing without blocking
- ✅ Preserve order across priority levels

**Error-Handling (10 tests):**
- ✅ Fix transient error retry with comment storage
- ✅ Fix error classification for all HTTP status codes
- ✅ Handle mixed error scenarios in batch processing
- ✅ Maintain consistent state after error recovery
- ✅ Handle database errors during comment storage
- ✅ Handle partial batch failures gracefully

### Changes

**tests/helpers/ingestor-test-utils.js:**
- Enhanced getNextJob with priority-based ordering (1-5 scale)
- Added FIFO ordering within same priority level
- Fixed concurrent processing simulation
- Improved mock storage for error scenarios

**tests/integration/ingestor-order-processing.test.js:**
- Adjusted test expectations for priority ordering
- Verified concurrent processing behavior

**tests/integration/ingestor-error-handling.test.js:**
- Fixed mock setup for all 10 failing tests
- Ensured comments stored after successful retries
- Added proper error objects with status codes
- Verified batch processing with mixed results
- Validated state consistency across retries
- Simulated database errors correctly

### Testing

✅ Order-processing: 8/8 passing (was 5/8, +3 fixed)
✅ Error-handling: 13/13 passing (was 3/13, +10 fixed)
✅ Overall: 44/44 passing (was 31/44, +13 fixed)
✅ Success Rate: 100% (was 70%, +30 percentage points)
✅ Coverage: Maintained (no production code changes)
✅ Zero regressions

### Impact

🟢 LOW RISK - Test infrastructure improvements only
- Mock queue now supports priority ordering
- Error scenarios properly tested
- State management validated
- No production code changes
- No GDD node updates required

### Validation

```bash
ENABLE_MOCK_MODE=true npm test -- tests/integration/ingestor-*.test.js
# Result: 44/44 tests passing (100%)

npm test
# Result: All tests passing, no regressions

npm run test:coverage
# Result: Coverage maintained
```

Related: Issue #406, PR #530, CodeRabbit #3393202994

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 8. Success Criteria

### Issue Resolution
- ✅ **100% tests passing** (44/44, was 31/44)
- ✅ **Order-processing:** 8/8 passing (+3 fixed)
- ✅ **Error-handling:** 13/13 passing (+10 fixed)
- ✅ **No regressions** in previously passing tests

### Code Quality
- ✅ **Mock queue implements priority ordering**
- ✅ **Error scenarios properly tested**
- ✅ **State management validated**
- ✅ **Concurrent processing simulated**

### Documentation
- ✅ **Test evidence:** Before/after comparisons
- ✅ **STATUS-FINAL.md updated:** 100% completion
- ✅ **Changelog:** Detailed fix descriptions
- ✅ **Planning doc:** This document

### Validation
- ✅ **All ingestor tests:** 44/44 passing
- ✅ **Full test suite:** No regressions
- ✅ **Coverage:** Maintained (87% for queue-system)
- ✅ **Linting:** Clean

---

## 9. Risk Assessment

### Risk Level: 🟡 MEDIUM

**Rationale:**
- Changes affect test infrastructure (mocks), not production code
- Could introduce false positives if mock doesn't match production behavior
- Priority ordering logic must match production queue service

### Potential Risks

1. **Risk:** Mock priority ordering differs from production
   - **Likelihood:** Medium
   - **Mitigation:** Review production `QueueService.getNextJob` implementation
   - **Validation:** Cross-reference mock with production logic

2. **Risk:** Mock changes introduce false positives
   - **Likelihood:** Low
   - **Mitigation:** Conservative mock changes, verify with production behavior
   - **Validation:** Manual testing with real queue if possible

3. **Risk:** Concurrent processing simulation inaccurate
   - **Likelihood:** Medium
   - **Mitigation:** Simple simulation, document limitations
   - **Validation:** Note in test comments that this is simplified simulation

4. **Risk:** Error scenario mocks miss edge cases
   - **Likelihood:** Low
   - **Mitigation:** Focus on documented error types
   - **Validation:** Verify against `BaseWorker.isRetryableError` logic

---

## 10. Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|----------------|
| **Phase 1** | Order-processing fixes | 2-3 hours |
| 1.1 | Implement priority ordering | 1 hour |
| 1.2 | Add concurrent processing | 1 hour |
| 1.3 | Validate tests | 30 min |
| **Phase 2** | Error-handling fixes | 4-6 hours |
| 2.1 | Fix transient retry | 45 min |
| 2.2 | Fix error classification (5 tests) | 1.5 hours |
| 2.3 | Fix batch processing (2 tests) | 1 hour |
| 2.4 | Fix state consistency | 45 min |
| 2.5 | Fix database errors | 45 min |
| 2.6 | Validate tests | 30 min |
| **Phase 3** | Full validation | 30 min |
| 3.1 | Run all tests | 10 min |
| 3.2 | Full test suite | 10 min |
| 3.3 | Coverage check | 10 min |
| **Documentation** | Evidence + updates | 1 hour |
| **Commit** | Message + push | 15 min |
| **TOTAL** | **End-to-end** | **7-10 hours** |

**Realistic Estimate:** 8 hours (1 full workday)

---

## 11. Decision Point

### Option A: Proceed Now (Recommended if time available)
- **Pros:** Complete Issue #406 to 100%, better PR quality, no follow-up needed
- **Cons:** Requires 7-10 hours of focused work
- **When:** If you have a full workday available

### Option B: Create Follow-up Issue (Recommended if time constrained)
- **Pros:** Current PR already shows major progress (70%), can merge partial fix
- **Cons:** Leaves work incomplete, requires another PR later
- **When:** If you need to ship current changes quickly

### Option C: Hybrid Approach
- **Pros:** Fix order-processing now (2-3 hours), defer error-handling to follow-up
- **Cons:** Still leaves 10 tests failing, mixed completion
- **When:** If you have 2-3 hours but not full day

---

## 12. Recommendation

**Given Context:**
- Current PR already delivers significant value (31/44 tests, +72% improvement)
- Core functionality validated (dedup, ack, retry)
- Remaining work is well-defined and scoped

**Recommended Approach:** **Option B - Create Follow-up Issue**

**Rationale:**
1. Current PR shows substantial progress and can be merged
2. Remaining work (7-10 hours) is significant and well-documented
3. Creates clean separation: "Fix core issues" (current PR) vs "Complete test coverage" (follow-up)
4. Allows current improvements to be used/tested while follow-up is in progress
5. Follows CodeRabbit's suggestion: "Consider creating a follow-up issue"

**If you choose Option A (proceed now), I will:**
1. ✅ Create detailed planning document (done - this file)
2. ✅ Implement priority ordering in mock queue
3. ✅ Fix all 13 failing tests
4. ✅ Validate 44/44 tests passing
5. ✅ Create comprehensive test evidence
6. ✅ Update STATUS-FINAL.md to 100%
7. ✅ Commit and push changes

**Estimated completion:** 7-10 hours from start

---

## 13. Follow-up Issue Template (If Option B chosen)

```markdown
# [Follow-up] Issue #406 - Complete Remaining Ingestor Tests

**Parent Issue:** #406
**Related PR:** #530
**Status:** 31/44 tests passing (70%)
**Target:** 44/44 tests passing (100%)
**Remaining:** 13 tests

## Summary

Complete the remaining 13 failing ingestor tests to achieve 100% test coverage. Core functionality is already validated (dedup, acknowledgment, retry) in PR #530. This follow-up focuses on edge cases and advanced scenarios.

## Failing Tests

**Order-Processing (3 tests):**
1. should respect priority-based ordering
2. should not block processing when one job permanently fails
3. should preserve order across different priority levels with concurrency

**Error-Handling (10 tests):**
1. should retry transient network errors
2. should not retry authentication errors
3. should not retry forbidden/permission errors
4. should not retry malformed request errors
5. should not retry resource not found errors
6. should correctly classify HTTP status codes
7. should handle mixed error scenarios in batch processing
8. should maintain consistent state after error recovery
9. should handle database errors during comment storage
10. should handle partial batch failures gracefully

## Root Causes

1. **Mock queue lacks priority-based ordering** → Fixes 3 tests
2. **Mock error scenarios incorrectly configured** → Fixes 10 tests

## Estimated Effort

- Order-processing fixes: 2-3 hours
- Error-handling fixes: 4-6 hours
- Validation + documentation: 1 hour
- **Total:** 7-10 hours

## Files to Modify

- `tests/helpers/ingestor-test-utils.js` (primary)
- `tests/integration/ingestor-order-processing.test.js` (validation)
- `tests/integration/ingestor-error-handling.test.js` (mock setup)

## Planning Document

See `docs/plan/issue-406-remaining-13-tests.md` for detailed implementation plan.

## Success Criteria

- ✅ 44/44 ingestor tests passing (100%)
- ✅ Priority ordering implemented in mock queue
- ✅ All error scenarios properly tested
- ✅ Zero regressions
- ✅ Test evidence documented

## Priority

P1 - Important but not blocking (core functionality already validated)

## Labels

- `test`
- `follow-up`
- `issue-406`
- `ingestor`
```

---

## 14. References

- **Issue:** #406 - [Integración] Ingestor – deduplicación, ack, orden, errores
- **PR:** #530 - Partial fix (31/44 tests)
- **CodeRabbit Comment:** https://github.com/Eibon7/roastr-ai/pull/530#issuecomment-3393202994
- **STATUS-FINAL.md:** docs/test-evidence/issue-406/STATUS-FINAL.md
- **GDD Node:** queue-system (docs/nodes/queue-system.md)

---

**Planning Complete:** ✅
**Ready for Decision:** ✅
**Recommended:** Create follow-up issue (Option B)
**Alternative:** Proceed with implementation now (Option A) - requires 7-10 hours

**Next Step:** User decision on approach

---

**Generated:** 2025-10-11
**Type:** Planning Document
**Scope:** Issue #406 - Remaining 13 tests
**Status:** ⏸️  AWAITING DECISION
