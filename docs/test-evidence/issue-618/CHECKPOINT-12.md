# Session #12 - Fix "TypeError: argument handler must be a function" Errors

**Issue:** #618 - Jest Compatibility Fixes
**Session Duration:** ~8 minutes
**Date:** October 22, 2025

## Summary

Fixed all 10 "TypeError: argument handler must be a function" errors in `tests/unit/routes/roast-preview-issue326.test.js` by adding missing `optionalAuth` middleware mock.

## Error Pattern

**Error Count:** 10 occurrences
**Error Message:**
```
TypeError: argument handler must be a function
    at Route.<computed> [as get] (node_modules/express/lib/router/route.js:202:15)
    at Router.<computed> [as get] (node_modules/express/lib/router/index.js:535:15)
    at Object.<anonymous> (src/routes/roast.js:1150:8)
```

**Affected Test File:**
- `tests/unit/routes/roast-preview-issue326.test.js`

## Root Cause Analysis

### Primary Issue
The route at `src/routes/roast.js:1150` uses TWO middleware functions:
```javascript
router.get('/styles', publicRateLimit, optionalAuth, async (req, res) => {
```

### Investigation Steps
1. Initially suspected `publicRateLimit` was undefined
2. Added `express-rate-limit` mock at top of file - **FAILED**
3. Realized route uses TWO middleware: `publicRateLimit` AND `optionalAuth`
4. Checked test mocks - `optionalAuth` was NOT mocked
5. Found `optionalAuth` is imported from `../middleware/auth` at line 9

### Auth Mock Status
**Before Fix:**
```javascript
jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user-123' };
        next();
    }
}));
```
Only mocked `authenticateToken`, leaving `optionalAuth` undefined.

**After Fix:**
```javascript
jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user-123' };
        next();
    },
    optionalAuth: (req, res, next) => {
        // Optional auth - may or may not set req.user
        next();
    }
}));
```
Added `optionalAuth` mock to match route requirements.

## Fix Implementation

### File Modified
- `tests/unit/routes/roast-preview-issue326.test.js` (lines 15-24)

### Changes Made
1. Added `optionalAuth` function to auth middleware mock
2. Mock signature: `(req, res, next) => { next(); }`
3. Mock behavior: Pass-through middleware (doesn't set req.user)

### Fix Reasoning
- `optionalAuth` is optional authentication middleware (doesn't require user)
- Route uses it for public endpoints that work with or without auth
- Mock must exist but doesn't need to authenticate
- Simple pass-through is sufficient for test purposes

## Results

### Before Fix
```
Test Suites: 1 failed, 1 total
Tests:       10 failed, 10 total
```

All 10 tests failing with "argument handler must be a function".

### After Fix
```
PASS unit-tests tests/unit/routes/roast-preview-issue326.test.js
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

✅ **100% success rate** - All 10 tests now passing.

## Pattern Established

**Rule:** When route uses multiple middleware, ALL must be mocked in tests.

**Middleware Mocking Checklist:**
1. Identify ALL middleware used in route (not just first one)
2. Find where each middleware is imported from
3. Mock each middleware with appropriate behavior
4. Verify mock signature matches middleware signature
5. Test to confirm all middleware properly mocked

**Common Mistake:** Only mocking one middleware when route uses multiple.

**Example:**
```javascript
// ❌ WRONG - Only mocks first middleware
router.get('/path', middleware1, middleware2, handler);
// Test only mocks middleware1

// ✅ CORRECT - Mocks all middleware
router.get('/path', middleware1, middleware2, handler);
// Test mocks both middleware1 AND middleware2
```

## Test Coverage

All 10 test cases in `roast-preview-issue326.test.js` now passing:
1. ✅ Handle new request format with styleProfile, persona, and platform
2. ✅ Return Issue #326 compliant response format
3. ✅ Validate platform parameter
4. ✅ Validate persona parameter type
5. ✅ Validate styleProfile parameter type
6. ✅ Handle insufficient analysis credits (placeholder)
7. ✅ Fallback to mock on OpenAI API failure (placeholder)
8. ✅ Default to correct platform and parameters
9. ✅ Record analysis usage with correct metadata
10. ✅ Handle all supported platforms

## Comparison to Previous Sessions

### Session #11 Comparison
- **Similarity:** Simple fix after root cause analysis
- **Complexity:** Similar (single file, small change)
- **Duration:** ~8 min (slightly faster than Session #11's 12 min)
- **Pattern:** Missing mock component (auth mock vs response structure)

### Session #10 Comparison
- **Complexity:** Much simpler (1 file vs 6 files)
- **Duration:** Much faster (8 min vs 45 min)
- **Root Cause:** 1 missing mock vs 3 different mock.calls patterns

### Overall Trend
- **Efficiency improving:** 45 min → 12 min → 8 min
- **Pattern recognition faster:** Identified missing middleware quickly
- **Documentation consistent:** Maintaining quality regardless of speed

## Key Learnings

1. **Read Route Signatures Completely**
   - Don't stop at first middleware
   - Check ALL parameters between route path and handler

2. **Middleware Dependencies**
   - Routes can use multiple middleware
   - Each middleware must be mocked independently
   - Mocks must match middleware signature

3. **Error Message Analysis**
   - "argument handler must be a function" = undefined middleware
   - Check route definition for ALL middleware used
   - Verify each middleware is properly mocked

4. **Testing Middleware Behavior**
   - `authenticateToken`: Sets req.user (authentication required)
   - `optionalAuth`: Pass-through (authentication optional)
   - Mock behavior should match middleware purpose

## Files Modified

### Test File
- `tests/unit/routes/roast-preview-issue326.test.js`
  - Lines 15-24: Added `optionalAuth` to auth mock

### Related Files (No changes needed)
- `src/routes/roast.js` (line 1150: route definition)
- `src/middleware/auth.js` (defines optionalAuth)

## Commit Information

**Commit Message:**
```
fix(tests): Add missing optionalAuth middleware mock - Issue #618

- Added optionalAuth mock to auth middleware mock in roast-preview-issue326.test.js
- Root cause: Route at line 1150 uses TWO middleware: publicRateLimit + optionalAuth
- Previous mock only had authenticateToken, leaving optionalAuth undefined
- Eliminated all 10 'TypeError: argument handler must be a function' errors
```

**Branch:** `fix/jest-compatibility-618`
**PR:** #630

## Next Steps

1. ✅ Session #12 completed - all 10 errors eliminated
2. ⏭️ Run global test sweep to identify next highest frequency error pattern
3. 🔄 Continue systematic error elimination (Session #13)

## Impact

- **Errors Eliminated:** 10
- **Files Modified:** 1
- **Lines Changed:** 5 (added optionalAuth mock)
- **Test Success Rate:** 100% (10/10 passing)
- **Pattern Established:** Complete middleware mocking checklist

---

**Status:** ✅ Complete
**Quality:** High (100% success, clear pattern)
**Efficiency:** Excellent (~8 minutes total)
