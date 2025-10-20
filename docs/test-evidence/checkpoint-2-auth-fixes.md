# Checkpoint 2: Auth/Mock Fixes

**Date:** 2025-10-20
**Branch:** test/stabilization-infrastructure
**Time Invested:** ~1 hour
**Related:** PR #618, Issue #480

---

## Summary

Fixed authentication module loading order issue affecting integration tests. Resolved 2 test failures in roast.test.js by removing unnecessary mocking and using built-in mock mode.

---

## Problem Identified

### Symptoms
- Integration tests failing with 401 (Unauthorized) errors
- Tests expecting authenticated requests were being rejected
- Pattern affected ~50 tests across multiple files (per Checkpoint 1 analysis)

### Root Cause
**Module Loading Order Issue:**

1. `const { app } = require('../../src/index')` loaded app at module scope
2. App imported real supabase config with real auth middleware
3. `jest.mock('../../src/config/supabase')` created blank mock AFTER app loaded
4. `beforeEach()` tried to mock auth middleware AFTER routes configured
5. Auth middleware had references to real supabase, blank mock broke it

**Code Example (Before):**
```javascript
const request = require('supertest');
const { app } = require('../../src/index');  // <-- Loads real config
const { supabaseServiceClient } = require('../../src/config/supabase');

// Mock dependencies
jest.mock('../../src/config/supabase');  // <-- Too late, app already loaded
jest.mock('../../src/services/roastGeneratorEnhanced');

beforeEach(() => {
    // Mock authentication middleware
    const authMiddleware = require('../../src/middleware/auth');
    authMiddleware.authenticateToken = jest.fn((req, res, next) => {
        req.user = { id: testUserId };
        next();
    });  // <-- Doesn't work, routes already configured
});
```

---

## Solution Implemented

### Changes Made

**1. Removed Unnecessary Supabase Mock**
- supabase config has **built-in mock mode** via `NODE_ENV=test`
- setupIntegration.js already sets NODE_ENV to 'test'
- getUserFromToken() automatically returns mock user in test mode
- No need to mock the entire module

**2. Removed Manual Auth Middleware Mock**
- Auth middleware uses getUserFromToken() internally
- With NODE_ENV=test, getUserFromToken() returns mock user
- Manual mock was unnecessary and broken

**3. Reordered Mock Declarations**
- Moved jest.mock() calls BEFORE app import
- Added comments explaining why mocking order matters

**Code Example (After):**
```javascript
const request = require('supertest');

// IMPORTANT: Mock service dependencies BEFORE requiring the app
// Don't mock supabase - it has built-in mock mode via NODE_ENV
jest.mock('../../src/services/roastGeneratorEnhanced');
jest.mock('../../src/services/roastGeneratorMock');
jest.mock('../../src/services/perspectiveService');

// Now require the app - supabase will use mock mode from setupIntegration.js
const { app } = require('../../src/index');
const { supabaseServiceClient } = require('../../src/config/supabase');
const flags = require('../../src/config/flags');

beforeEach(() => {
    jest.clearAllMocks();

    // ... other setup ...

    // Authentication is handled by built-in mock mode from setupIntegration.js
    // getUserFromToken() returns mock user when NODE_ENV=test
});
```

---

## Results

### roast.test.js
**Before Fix:**
- 0 passing
- 8 failing (all with 401 errors)

**After Fix:**
- 2 passing ✅
- 6 failing (different issue - response format mismatches, not auth)

**Tests Now Passing:**
- ✓ should reject when user has insufficient credits
- ✓ should handle database errors gracefully

**Remaining Failures (Not Auth-Related):**
- should generate roast preview successfully (response format mismatch)
- should handle validation errors (validation format changed)
- should reject high toxicity content (mock mode toxicity filtering)
- should generate roast and consume credits (response format)
- should return user credit status (response format)
- should handle roast generation errors (error injection not working)

---

## Pattern Identified

### Tests with Same Issue
Other integration tests may have the same problem if they:
1. Mock supabase with blank `jest.mock()` (no factory function)
2. Try to mock auth middleware in `beforeEach`
3. Load app at module scope before setting up mocks

### Candidates for Same Fix
```bash
# Found via: grep -r "jest.mock.*supabase" tests/integration/*.test.js

tests/integration/plan-change-flow.test.js
tests/integration/roastr-persona-flow.test.js
```

**Note:** Checked both - not showing auth failures:
- plan-change-flow: 10/11 passing
- roastr-persona-flow: 1/11 passing (500 errors, not 401)

---

## Files Modified

- `tests/integration/roast.test.js`
  - Removed `jest.mock('../../src/config/supabase')`
  - Removed manual auth middleware mock in beforeEach
  - Reordered mocks before app import
  - Added explanatory comments

---

## Commits

**Commit:** 58453c4e
**Message:** test: Fix auth module loading order in roast.test.js

---

## Next Steps

### Immediate (PR 1.2)
1. Fix remaining 6 test failures in roast.test.js (response format issues)
2. Apply same pattern to other tests with auth issues
3. Document auth/mock best practices for future tests

### Short Term (PR 1.3)
- Fix response format mismatches (~20 tests per Checkpoint 1)
- Fix toxicity filtering in mock mode
- Fix validation error format differences

### Long Term
- Create test helper for consistent auth setup
- Document built-in mock mode in testing guide
- Add linting rule to catch module loading order issues

---

## Key Learnings

### Built-in Mock Mode Exists
- supabase config has built-in mock mode via NODE_ENV
- getUserFromToken() returns mock user when NODE_ENV=test
- Don't need to mock the entire module

### Module Loading Order Matters
- jest.mock() must come BEFORE requiring the module
- App loads all dependencies at import time
- Mocking in beforeEach is too late for route middleware

### Unnecessary Mocking is Harmful
- Blank jest.mock() breaks built-in features
- Always check if module has built-in test/mock mode
- Use real implementation when it supports testing

---

## Test Evidence

### Before Fix
```
Test Suites: 1 failed, 1 total
Tests:       8 failed, 8 total
Time:        3.925 s

All tests failing with:
Expected: 200
Received: 401
```

### After Fix
```
Test Suites: 1 failed, 1 total
Tests:       6 failed, 2 passed, 8 total
Time:        3.627 s

✓ should reject when user has insufficient credits
✓ should handle database errors gracefully
```

---

## Metrics

| Metric | Value |
|--------|-------|
| Tests Fixed | 2 |
| Tests Still Failing | 6 (different issue) |
| Time Invested | ~1 hour |
| Lines Changed | +9, -11 |
| Pattern Identified | Module loading order |
| Reusable | Yes (can apply to other tests) |

---

**Status:** ✅ Auth pattern fixed, ready to tackle response format issues
**Next Checkpoint:** After fixing response format mismatches
