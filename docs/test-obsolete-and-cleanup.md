# Test Suite: Obsolete Tests & Cleanup Action Items

**Date:** October 20, 2025  
**Status:** Medium Thoroughness Analysis Complete

---

## 1. Tests to Remove or Consolidate

### 1.1 Duplicate Test Files (CONSOLIDATE OR DELETE)

These test files have simplified variants that should be merged or their purpose clarified:

#### BillingWorker Tests
```
/tests/unit/workers/BillingWorker.test.js (main)
/tests/unit/workers/BillingWorker-simple.test.js (simplified variant)
/tests/unit/workers/BillingWorker-cleanup.test.js (cleanup-focused variant)
```
**Action:** Consolidate into single main file or document why variants are kept

#### csvRoastService Tests
```
/tests/unit/csvRoastService.test.js (main)
/tests/unit/csvRoastService-simple.test.js (simplified variant)
```
**Action:** Merge -simple tests into main file

#### twitterService Tests
```
/tests/unit/twitterService.test.js (main)
/tests/unit/twitterService-simple.test.js (simplified variant)
```
**Action:** Merge -simple tests into main file

#### Persona Tests
```
/tests/unit/routes/roastr-persona-tolerance.test.js (main)
/tests/unit/routes/roastr-persona-tolerance-simple.test.js (simplified)
```
**Action:** Consolidate tolerance tests

#### User Profile/Theme Tests
```
/tests/unit/routes/user.test.js (main)
/tests/unit/routes/user-profile-simple.test.js (simplified)
/tests/unit/routes/user-theme-simple.test.js (simplified)
```
**Action:** Merge -simple variants into main user test file

#### API Integration Tests
```
/tests/integration/api.test.js (main)
/tests/integration/api-simple.test.js (simplified)
```
**Action:** Consolidate or document purpose of simple variant

#### Persona Sanitization Tests
```
/tests/integration/roastr-persona-sanitization.test.js (main)
/tests/integration/roastr-persona-sanitization-simple.test.js (simplified)
```
**Action:** Consolidate sanitization tests

#### Flags Configuration Tests
```
/tests/unit/config/flags-basic.test.js
/tests/unit/config/__tests__/flags.test.js
```
**Action:** Use single canonical flags test file

---

## 2. Skipped Tests (19 total)

### 2.1 Investigate & Fix

#### roast.test.js - 8 SKIPPED TESTS (CRITICAL)
```javascript
// tests/unit/routes/roast.test.js
it.skip('should generate a roast preview successfully', ...)
it.skip('should validate required text parameter', ...)
it.skip('should validate text length', ...)
it.skip('should validate tone parameter', ...)
it.skip('should validate intensity parameter', ...)
it.skip('should handle empty text', ...)
it.skip('should use default values for optional parameters', ...)
it.skip('should generate a roast and consume credits', ...)
```
**Status:** ⚠️ **CRITICAL** - Core endpoint tests are disabled  
**Action:** 
1. Investigate why these tests were skipped
2. Enable them or document permanent reason in code comment
3. If dependencies are missing, create mocks

### 2.2 Acceptable Skips

#### billing.test.js - 2 WEBHOOK TESTS
```javascript
it.skip('should handle customer.subscription.updated event', ...)
it.skip('should handle customer.subscription.deleted event', ...)
```
**Status:** ℹ️ Acceptable - Webhook event handling  
**Action:** Document in PR why webhook events are tested elsewhere

#### billing.test.js (Frontend) - 2 JSDOM TESTS
```javascript
it.skip('should create checkout session successfully (JSDOM location redirect limitation)', ...)
it.skip('should open customer portal successfully (JSDOM location redirect limitation)', ...)
```
**Status:** ℹ️ Acceptable - Known JSDOM limitation  
**Action:** Consider Playwright for these tests instead

#### roastGeneratorEnhanced.test.js - 2 FEATURE GATED TESTS
```javascript
it.skip('should track tokens and costs for Creator+ RQC (requires ENABLE_RQC=true)', ...)
```
**Status:** ℹ️ Acceptable - Feature flag dependent  
**Action:** Add comment explaining flag requirement

#### spec14-tier-validation.test.js - 1 INTEGRATION SKIP
```javascript
describe.skip('Tier Validation E2E', () => {
  // Integration tests - shouldUseMocks conditional
})
```
**Status:** ℹ️ Acceptable - Integration test  
**Action:** Document mock requirement

#### tierValidationSecurity.test.js - 1 INTEGRATION SKIP
```javascript
describe.skip('Tier Validation Security', () => {
  // shouldSkipIntegrationTests conditional
})
```
**Status:** ℹ️ Acceptable - Integration test  
**Action:** Document why integration tests are gated

#### spec14-integral-test-suite.test.js - 1 E2E SKIP
```javascript
const describeFunction = shouldUseMocks ? describe : describe.skip;
```
**Status:** ℹ️ Acceptable - E2E mock gating  
**Action:** Document conditional in test description

#### secure-write-security.test.js - 1 PLATFORM-SPECIFIC SKIP
```javascript
const describeWindows = process.platform === 'win32' ? describe : describe.skip;
```
**Status:** ℹ️ Acceptable - Platform specific (Windows)  
**Action:** Document platform requirement

---

## 3. Code Quality Issues to Fix

### 3.1 Console Statements (158 instances)

Remove or replace all `console.log`, `console.error`, `console.warn` in test files.

**Sample Problem Code:**
```javascript
// tests/unit/routes/roast.test.js:133-137
console.log('Response status:', response.status);
console.log('Response body:', response.body);
if (response.status !== 200) {
    console.log('Response text:', response.text);
}
```

**Files Most Affected:**
- `roast.test.js` - Multiple debug logs
- Various service tests
- Utility tests

**Recommended Fix:**
- Use debug logger instead: `logger.debug()` 
- Or remove entirely if no longer needed
- Use `process.env.DEBUG` conditional if debugging needed

### 3.2 Test Data Quality

**Assessment:** ✅ **GOOD** - No credentials leakage detected

- JWT tokens use 'secret' placeholder (appropriate)
- No API keys hardcoded
- No passwords exposed
- Uses proper mock pattern

---

## 4. Tests Referencing Removed/Changed Schema

### 4.1 Search Results
**Status:** ✅ **GOOD** - No obsolete schema references found

No tests reference old schema like:
- `posts` table (migrated to `responses`)
- `roasts` table (if previously existed)
- Old column names

---

## 5. Tests Importing Non-Existent Files

### 5.1 Search Results
**Status:** ✅ **GOOD** - All imports are valid

All test imports reference existing files in:
- `src/routes/`
- `src/services/`
- `src/middleware/`
- `src/config/`
- `src/utils/`

**No dead imports found.**

---

## 6. Tests for Removed Features

### 6.1 Assessment
**Status:** ✅ **GOOD** - No tests for removed features detected

All test files correspond to existing source code files.

---

## 7. Cleanup Action Plan (Prioritized)

### Phase 1: CRITICAL (Before Next Release)
1. **Investigate roast.test.js skipped tests** (8 tests)
   - File: `/tests/unit/routes/roast.test.js`
   - Action: Enable tests or document permanent reason
   - Estimated Time: 2-4 hours

2. **Remove console statements from tests** (158 instances)
   - Files: Multiple
   - Action: Remove or replace with logger
   - Estimated Time: 2-3 hours

### Phase 2: HIGH (Within 1 Sprint)
1. **Consolidate duplicate test files** (12 pairs)
   - Action: Merge -simple, -basic, -cleanup variants
   - Estimated Time: 4-6 hours
   - Files affected: BillingWorker, csvRoastService, twitterService, persona tests, etc.

2. **Add missing worker tests** (3 files)
   - PublisherWorker.js
   - ModelAvailabilityWorker.js
   - StyleProfileWorker.js
   - Estimated Time: 6-8 hours per worker

3. **Add critical route tests** (5 routes)
   - guardian.js
   - shield.js
   - webhooks.js
   - approval.js (if active)
   - comments.js (if active)
   - Estimated Time: 2-4 hours per route

### Phase 3: MEDIUM (Next Sprint)
1. **Add missing service tests** (15+ services)
2. **Add missing route tests** (remaining routes)
3. **Document duplicate test purposes**

### Phase 4: NICE-TO-HAVE (Future)
1. **Increase snapshot testing**
2. **Add custom Jest matchers**
3. **Performance benchmarks**
4. **Visual regression tests**

---

## 8. Cleanup Checklist

### Pre-Cleanup
- [ ] Review all 8 roast.test.js skipped tests
- [ ] Understand purpose of each -simple/-basic/-cleanup variant
- [ ] List all console statement locations

### During Cleanup
- [ ] Fix roast.test.js tests
- [ ] Remove console statements with git grep
- [ ] Consolidate duplicate test files
- [ ] Verify all tests still pass

### Post-Cleanup
- [ ] Run full test suite: `npm test`
- [ ] Verify coverage hasn't decreased
- [ ] Update this document with completion status
- [ ] Create PR with cleanup changes
- [ ] Get code review before merge

---

## 9. Estimated Effort Summary

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Investigate roast.test.js skips | P1 | 2-4h | Pending |
| Remove console statements | P1 | 2-3h | Pending |
| Consolidate duplicate tests | P2 | 4-6h | Pending |
| Add PublisherWorker tests | P2 | 6-8h | Pending |
| Add Guardian/Shield route tests | P2 | 4-6h | Pending |
| Add other missing tests | P3 | 16h+ | Pending |

**Total Estimated:** 34-45 hours (1-1.5 sprints)

---

## 10. References

- Main Analysis: `/Users/emiliopostigo/roastr-ai/docs/test-analysis-2025-10-20.md`
- Summary: `/Users/emiliopostigo/roastr-ai/docs/test-analysis-summary.txt`
- Test Directory: `/Users/emiliopostigo/roastr-ai/tests/`
- Skipped Tests File: `/Users/emiliopostigo/roastr-ai/tests/unit/routes/roast.test.js`

