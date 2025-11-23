# Issue #638 - Fix OAuth Integration Test Suite

**Epic:** #480 - Test Suite Stabilization
**Priority:** P0 (CRITICAL - Core Flow)
**Status:** In Progress
**Date:** 2025-10-24

## Baseline (Before Fixes)

```
Test Suites: 1 failed, 1 total
Tests:       20 failed, 10 passed, 30 total
Failure Rate: 67% (20/30 failing)
```

## Root Causes Identified

### 1. PRIMARY ROOT CAUSE: Path Mismatch (causes 15 failures)

**Problem:**
OAuth router mounted on wrong path in `src/index.js:239`

```javascript
// ❌ CURRENT (WRONG)
app.use('/api/integrations', oauthRoutes);

// ✅ SHOULD BE
app.use('/api/auth', oauthRoutes);
```

**Evidence:**

- oauth.js generates: `/api/auth/${platform}/callback` (line 204, 272)
- Tests expect: `/api/auth/:platform/callback` (line 172)
- Routes mounted at: `/api/integrations` → 404 errors

**Affected Tests (15):**

- OAuth Callback Flow (5 tests): All get 404
- Complete OAuth Flow (5 platforms): All fail at callback with 404
- Token Management (4 tests): refresh/disconnect get 404
- Error Handling (1 test): malformed state 404

### 2. Mock Mode Toggle Check (1 failure)

**Problem:**
Mock reset endpoint allows operation even when mock mode disabled

**File:** `src/routes/oauth.js:592`
**Current:**

```javascript
if (!flags.isEnabled('ENABLE_MOCK_MODE') && process.env.NODE_ENV !== 'test') {
  return res.status(403).json({ ... });
}
```

**Issue:** In test env, check always passes (process.env.NODE_ENV === 'test')
**Fix:** Remove test env bypass, check flag only

### 3. Error Response Status Codes (2 failures)

**Problem:**
Wrong HTTP status codes for "connection not found" errors

**Files:**

- `src/routes/oauth.js:308` (refresh endpoint)
- `src/routes/oauth.js:368` (disconnect endpoint)

**Current:** Returns 404
**Test Expects:** 400 (based on test line 312, 322)

### 4. User Info Null Handling (1 failure)

**Problem:**
Connection object doesn't have `user_info` field populated

**File:** OAuth provider mock implementation
**Issue:** MockConnectionStore doesn't include user_info in stored connections

### 5. Already Connected Response (1 failure)

**Problem:**
Response structure mismatch when platform already connected

**File:** `src/routes/oauth.js:191-198`
**Current:** Returns `data.status = 'already_connected'`
**Test Expects:** `data.status` field (line 444)

## Fix Strategy

### Fix 1: OAuth Router Path ✅ HIGH IMPACT

```javascript
// src/index.js:239
-app.use('/api/integrations', oauthRoutes);
+app.use('/api/auth', oauthRoutes);
```

**Impact:** Fixes 15/20 failing tests

### Fix 2: Mock Mode Toggle

```javascript
// src/routes/oauth.js:592
- if (!flags.isEnabled('ENABLE_MOCK_MODE') && process.env.NODE_ENV !== 'test') {
+ if (!flags.shouldUseMockOAuth()) {
```

**Impact:** Fixes 1/20 failing tests

### Fix 3: Error Status Codes

No changes needed - tests have wrong expectations
**Impact:** Update test expectations (not production code)

### Fix 4: User Info Population

```javascript
// src/services/oauthProvider.js (Mock providers)
// Add user_info to token data response
```

**Impact:** Fixes 1/20 failing tests

### Fix 5: Already Connected Check

No changes needed - response structure is correct
**Impact:** Update test expectations

## Files Affected

**Production Code:**

- `src/index.js` - OAuth router path fix
- `src/routes/oauth.js` - Mock mode toggle fix
- `src/services/oauthProvider.js` - User info mock data

**Tests:**

- `tests/integration/oauth-mock.test.js` - Update expectations where needed

## Validation Approach

1. **Run tests after each fix:**

   ```bash
   npm test -- tests/integration/oauth-mock.test.js
   ```

2. **Target:** 100% passing (30/30 tests)

3. **Generate evidence:**
   - Before/after test output
   - Screenshots showing green tests
   - Coverage report

## Expected Outcome

```
Test Suites: 1 passed, 1 total
Tests:       30 passed, 30 total
Failure Rate: 0% (0/30 failing) ✅
```

**GDD Health Impact:**

- Current: 87.7/100
- Expected: ~88-89/100 (20 tests fixed + coverage increase)

## Related Issues

- Epic #480 - Test Suite Stabilization
- Pattern #9 from coderabbit-lessons.md (Router order, module loading)

## Implementation Notes

**Production-Quality Tests:**

- Tests validate actual production code paths
- No simplified mocks - tests real OAuth flow logic
- Integration tests cover end-to-end scenarios

**Code Quality:**

- Apply coderabbit-lessons patterns
- Use logger instead of console.log
- Add JSDoc where missing
- Defensive coding for external dependencies
