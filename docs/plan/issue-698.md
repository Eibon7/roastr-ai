# Implementation Plan: Issue #698 - Fix 4 Failing Roast Integration Tests

**Issue:** #698
**Branch:** test/issue-698
**Priority:** P1 (High Priority)
**Status:** In Progress
**Created:** 2025-11-03

---

## Context

### Current State

**Test Results:** 4 passed, 4 failed (50%)

**✅ Passing Tests:**

- should handle validation errors
- should reject when user has insufficient credits
- should handle database errors gracefully
- should handle roast generation errors

**❌ Failing Tests:**

1. should generate roast preview successfully (500 error)
2. should reject high toxicity content (500 error)
3. should generate roast and consume credits (402 error)
4. should return user credit status (wrong data)

### Previous Investigation Summary

**Root Cause Identified** (from commit history):

- Module loading order issue: Routes capture `supabaseServiceClient` reference at module load time BEFORE test mocks are applied
- Tests load app at line 24 (module load), then try to mock in `beforeEach()` - **TOO LATE**
- The "mutate methods" pattern from #680 doesn't work here because mocks are applied after routes have already captured references

**Work Already Done:**

- ✅ Mock isolation achieved (#680)
- ✅ Fixed validation error messages (src/routes/roast.js:119-126)
- ✅ Added comprehensive mocking (user_subscriptions, analysis_usage, roast_usage, RPC)
- ✅ Enabled ENABLE_PERSPECTIVE_API flag
- ✅ Implemented table-based mocking (not call counting)

---

## Solution Options (From Previous Investigation)

### Option 1: Use Real Test Database ⭐ **RECOMMENDED**

- **Effort:** 1-2 days
- **Risk:** Low
- **Reliability:** ⭐⭐⭐⭐⭐
- **Rationale:** Most appropriate for integration tests
- **Impact:** HIGH - Solves module loading issue permanently

###Option 2: Restructure Test Architecture

- **Effort:** 3-5 days
- **Risk:** Medium
- **Complexity:** High
- **Impact:** MEDIUM - Complex refactor required

### Option 3: Use jest.doMock() + Dynamic Imports

- **Effort:** 2-3 days
- **Risk:** Medium-High
- **Compatibility:** Concerns with Node.js module system

### Option 4: Refactor Production Code (Dependency Injection)

- **Effort:** 1-2 weeks
- **Risk:** High
- **Impact:** Best long-term solution but too invasive for this issue

---

## Recommended Approach

**Decision: Proceed with Option 1 - Mock Supabase at Module Load Time**

Instead of setting up a real test database (which requires infrastructure), we'll use a **hybrid approach**:

- Mock Supabase BEFORE app loads (using jest.mock)
- Restructure test to apply mocks at module-level, not in beforeEach
- This gives us the benefits of Option 1 without infrastructure setup

### Implementation Steps

#### Step 1: Restructure Test Mocking Strategy

**File:** `tests/integration/roast.test.js`

**Changes:**

```javascript
// BEFORE app loads, set up module-level mocks
jest.mock('../../src/config/supabase', () => {
  const { createRoastSupabaseMock } = require('../helpers/roastMockFactory');

  const defaultMock = createRoastSupabaseMock({
    userSubscriptions: [...],
    roastUsage: [...],
    analysisUsage: [...]
  });

  return {
    supabaseServiceClient: defaultMock,
    supabaseAnonClient: defaultMock
  };
});

// NOW load the app - it will use mocked supabase
const { app } = require('../../src/index');
```

#### Step 2: Add .insert() Mock Support

**File:** `tests/helpers/roastMockFactory.js`

**Add missing operation:**

- Currently supports: .from(), .select(), .eq(), .gte(), .single()
- Need to add: .insert() for usage recording

#### Step 3: Fix Individual Test Cases

**Test 1 & 3 (500 errors):**

- Ensure all database queries have mock responses
- Add .insert() mock for recordAnalysisUsage()
- Verify perspectiveService mock returns correct format

**Test 4 (402 error):**

- Add .rpc('consume_roast_credits') mock
- Return success response with updated credit count

**Test 5 (wrong data):**

- Fix mock data retrieval
- Ensure used count is calculated correctly

#### Step 4: Validation

- Run tests 3 times consecutively
- Verify 8/8 passing
- Check execution time < 5s
- Confirm no test pollution

---

## Files to Modify

### Primary Files

1. ✅ `tests/integration/roast.test.js` - Restructure mocking
2. ✅ `tests/helpers/roastMockFactory.js` - Add .insert() + .rpc() support
3. ✅ `src/routes/roast.js` - Verify no additional fixes needed

### Documentation

4. ✅ `docs/test-evidence/issue-698/SOLUTION.md` - Document solution
5. ✅ `docs/patterns/coderabbit-lessons.md` - Add new pattern if discovered

---

## Success Criteria

- [ ] All 8 tests in roast.test.js pass
- [ ] Tests pass consistently (3 consecutive runs)
- [ ] No regressions in other test suites
- [ ] Execution time < 5s
- [ ] Root cause documented
- [ ] Pattern added to coderabbit-lessons.md if new

---

## Risk Assessment

**Technical Risks:**

- ⚠️ Module-level mocking may affect other tests → Mitigation: Isolate with jest.isolateModules()
- ⚠️ Mock complexity increases → Mitigation: Keep factory functions well-documented

**Business Risks:**

- ✅ LOW - Tests don't affect production code
- ✅ LOW - No changes to business logic

---

## Rollback Plan

If approach fails:

1. Revert changes to roast.test.js
2. Keep roastMockFactory improvements (.insert, .rpc)
3. Document findings in issue
4. Escalate to Product Owner for architectural decision

---

## Next Steps

1. ✅ Create implementation plan (this file)
2. ⏳ Implement Step 1: Restructure mocking
3. ⏳ Implement Step 2: Add .insert() support
4. ⏳ Implement Step 3: Fix individual tests
5. ⏳ Validate solution
6. ⏳ Generate test evidence
7. ⏳ Create PR

---

**Est. Time:** 2-3 hours
**Confidence:** HIGH (based on root cause analysis)
