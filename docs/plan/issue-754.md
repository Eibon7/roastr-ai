# Plan: Issue #754 - Jest Module Cache Issues

**Issue:** Tests pendientes Issue #483 - Jest module cache issues
**Status:** In Progress
**Date:** 2025-11-08
**Branch:** claude/issue-754-jest-module-cache

## Estado Actual

### File 1 (tests/integration/roast.test.js)
✅ **8/8 tests passing (100% COMPLETE)**
- No regression found
- All tests passing in both individual and suite execution

### File 3 (tests/unit/routes/roast-validation-issue364.test.js)
⚠️ **18/22 tests passing (82%)**

**4 tests failing (PASS individually, FAIL in suite):**
1. "should log only metadata, not sensitive content" (GDPR Compliance)
2. "should not include text content in usage recording" (GDPR Compliance)
3. "should respond within reasonable time" (Performance)
4. "should include processing time in response" (Performance)

### Root Cause Analysis

**Confirmed:** Jest module cache issue

**Problem:**
- Module `src/routes/roast.js` is loaded and cached at line 150
- When tests run in sequence, the module retains references to mocks from previous tests
- Tests in "GDPR Compliance" and "Performance" `describe` blocks use `beforeEach` that modifies mocks
- The cached module doesn't see these mock updates

**Evidence:**
- All 4 tests ✅ PASS when executed individually
- All 4 tests ❌ FAIL when executed in full suite
- This proves logic is correct, only module cache is the issue

### Solutions Attempted

#### ❌ Attempt 1: `jest.isolateModules()` in global beforeEach
- **Result:** No effect
- **Reason:** `app` variable outside isolateModules scope still has old references

#### ❌ Attempt 2: `jest.resetModules()` + `delete require.cache`
- **Result:** 15 tests failing instead of 4 (regression)
- **Reason:** Resets ALL modules, breaks other test dependencies

#### ❌ Attempt 3: `mockClear()` instead of `mockReset()` in nested beforeEach
- **Result:** Still 4 tests failing
- **Reason:** Module is already loaded, clearing call history doesn't reload module

#### ❌ Attempt 4: `delete require.cache[roast]` in global beforeEach
- **Result:** Still 4 tests failing
- **Reason:** Roast module's dependencies also cached, partial cache clear insufficient

### Solution Propuesta (Issue #754 Long-term)

**Separate problematic tests into independent file**

**Rationale:**
- Clean separation ensures isolated module loading
- No interference between test suites
- Maintainable and clear intent
- Follows Jest best practices for module isolation

## Implementation Plan

### Step 1: Create new test file
**File:** `tests/unit/routes/roast-validation-gdpr-perf.test.js`
**Contains:**
- GDPR Compliance tests (2 tests)
- Performance tests (2 tests)
- Dedicated mock setup
- No shared state with main test file

### Step 2: Remove from original file
**File:** `tests/unit/routes/roast-validation-issue364.test.js`
**Changes:**
- Remove "GDPR Compliance" describe block
- Remove "Performance" describe block
- Keep all other 18 passing tests
- Update comments

### Step 3: Verification
```bash
# Run original file (should have 18/18 passing)
npm test -- tests/unit/routes/roast-validation-issue364.test.js

# Run new file (should have 4/4 passing)
npm test -- tests/unit/routes/roast-validation-gdpr-perf.test.js

# Run both together (should have 22/22 passing total)
npm test -- tests/unit/routes/roast-validation*
```

### Step 4: Documentation
- Add comment in both files explaining the separation
- Reference Issue #754
- Update coderabbit-lessons.md with this pattern

## Files Affected

- `tests/unit/routes/roast-validation-issue364.test.js` (modify - remove 2 describe blocks)
- `tests/unit/routes/roast-validation-gdpr-perf.test.js` (create new)
- `docs/patterns/coderabbit-lessons.md` (update with pattern)
- `docs/plan/issue-754.md` (this file)

## Expected Outcome

**Before:**
- File 3: 18/22 passing (82%)
- 4 tests fail in suite, pass individually

**After:**
- File 3a: 18/18 passing (100%)
- File 3b: 4/4 passing (100%)
- Total: 22/22 passing (100%)
- **Overall: 30/30 tests passing (100%)** (File 1: 8 + File 3a: 18 + File 3b: 4)

## Pattern for coderabbit-lessons.md

```markdown
### 12. Jest Module Cache - Test File Separation

**Pattern:** Tests that modify module-level state fail in suite but pass individually

**Root Cause:** Jest caches required modules. When tests modify mocks after module is loaded, the module retains old references.

**❌ Mistake:**
```javascript
describe('Suite A', () => {
  beforeEach(() => {
    const routes = require('../src/routes');
    app.use('/api', routes);
  });
  // Tests...
});

describe('Suite B', () => {
  beforeEach(() => {
    // Reset mocks - but module already cached!
    mockService.method.mockReset();
  });
  // Tests FAIL - module has old mock references
});
```

**✅ Fix:**
Separate into different files when tests need different module loading contexts:
- `test-suite-a.test.js` - Suite A tests
- `test-suite-b.test.js` - Suite B tests with different mock setup

**Prevention:**
- If tests pass individually but fail in suite → module cache issue
- Separate test files when different describe blocks need different mock states
- Avoid `mockReset()` in nested beforeEach - signals module reload needed
```

## Next Steps

1. ✅ Document findings (this plan)
2. Create new test file with 4 problematic tests
3. Remove tests from original file
4. Run verification
5. Update coderabbit-lessons.md
6. Commit changes
7. Run full test suite
8. Update GDD nodes
9. Generate agent receipts
