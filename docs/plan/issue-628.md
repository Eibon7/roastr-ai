# Implementation Plan: Issue #628 - Complete Login & Registration (Pending from #593)

**Issue:** #628
**Parent Issue:** #593 (closed prematurely)
**Priority:** P0 (Blocker for production)
**Estimated Time:** 3-4 hours
**Labels:** `auth`, `frontend`, `backend`, `testing`, `high-priority`

---

## Estado Actual (Updated Assessment - 2025-10-22)

### ✅ Tests: 22/22 PASSING (100%)

**Backend completamente funcional:**

- All E2E auth flow tests passing
- `/api/auth/refresh` endpoint working
- Session management functional
- Password reset working
- Rate limiting working
- Email validation working

### ✅ Auto-Refresh Already Implemented

**Location:** `public/js/auth.js:409-463`

**Functions:**

- `setupTokenRefresh()` - Configures proactive refresh
- `refreshAuthToken()` - Calls `/api/auth/refresh` endpoint
- Refresh happens 5 minutes BEFORE expiry (not 15 as specified in issue)
- Auto-logout on refresh failure
- Re-configures next refresh after success

### ❌ Frontend Functionality PENDING

**What's Missing:**

1. **HTTP Interceptor with 401 auto-retry** (CRITICAL)
   - Current: `apiCall()` does NOT retry on 401
   - Needed: Detect 401 → refresh token → retry request (1x max)
   - Prevent infinite loops

2. **Enhanced Error Handling**:
   - 401: Add "Session expired" message + auto-redirect
   - 403: Add specific "Access denied" handling
   - 429: Add exponential backoff + disable button

3. **Documentation**:
   - Document auto-refresh strategy in `docs/flows/`
   - Update GDD node `multi-tenant.md` with frontend integration

---

## Plan de Implementación (Actualizado)

### FASE 3: Implement HTTP Interceptor + Error Handling

**Estimated:** 1 hour total

**File:** `public/js/auth.js`

#### Task 1: Create `apiCallWithRetry()` Function (30 min)

**Location:** After existing `apiCall()` (line 82)

**Implementation:**

```javascript
/**
 * Enhanced API call with 401 retry and comprehensive error handling
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {object} data - Request body
 * @param {boolean} isRetry - Internal flag to prevent infinite loop
 */
async function apiCallWithRetry(endpoint, method = 'POST', data = null, isRetry = false) {
  // Implementation details in plan below
}
```

**Key Features:**

- Add Authorization header if token exists
- Detect 401 → attempt `refreshAuthToken()` → retry request once
- Detect 403 → throw specific error
- Detect 429 → parse Retry-After → throw with delay info
- Prevent infinite loops with `isRetry` flag

#### Task 2: Modify `refreshAuthToken()` to Return Boolean (10 min)

**Current:** Returns `void`, throws on error
**New:** Returns `boolean` (true/false)

**Changes:**

- Line 447: Return `true` on success
- Line 454: Return `false` on error (instead of redirecting)
- Caller decides whether to redirect

#### Task 3: Update Error Handling in `showMessage()` (10 min)

**Add support for:**

- `type='warning'` for 429 rate limits (orange color)
- Auto-redirect after 2 seconds for 401 errors
- Different auto-hide timers per type

#### Task 4: Replace `apiCall()` with `apiCallWithRetry()` (10 min)

**Files affected:**

- Lines 168, 207, 227, 246, 295, 366 in `auth.js`

**Keep original** `apiCall()` for internal use (e.g., in `refreshAuthToken`)

---

## FASE 4: Validation

**Tasks:**

1. **Run Full Test Suite** (10 min)
   - `npm test` → Verify 100% passing
   - `npm test -- tests/e2e/auth-complete-flow.test.js` → 22/22 passing

2. **Validate GDD** (5 min)
   - `node scripts/validate-gdd-runtime.js --full`
   - `node scripts/compute-gdd-health.js --threshold=87`

3. **Manual Testing** (15 min)
   - Register new user → Verify welcome email
   - Login → Verify session works
   - Wait for auto-refresh → Verify token updated
   - Logout → Verify token invalid
   - Password reset → Verify email sent

---

## FASE 5: Documentation & Evidence

**Tasks:**

1. **Update Documentation** (20 min)
   - File: `docs/flows/login-registration.md`
   - Add "Auto-Refresh Strategy" section
   - Add "HTTP Interceptor" section
   - Add "Error Handling" section with 401/403/429 flows

2. **Update GDD Node** (10 min)
   - File: `docs/nodes/multi-tenant.md`
   - Update coverage (auto-generated)
   - Add "Agentes Relevantes" if agents invoked

3. **Generate Test Evidence** (15 min)
   - Directory: `docs/test-evidence/issue-628/`
   - `tests-passing.txt` (npm test output)
   - `coverage-report.json` (if coverage run)
   - `SUMMARY.md` (using `docs/templates/SUMMARY-template.md`)

---

## FASE 6: PR Creation

**Tasks:**

1. **Create Branch** (1 min)
   - `git checkout -b fix/complete-login-registration-628`

2. **Commit Changes** (5 min)
   - `git add .`
   - `git commit` with proper message

3. **Push & Create PR** (5 min)
   - `git push origin fix/complete-login-registration-628`
   - `gh pr create` with template

4. **CodeRabbit Review Cycle** (iterative)
   - Fix ALL CodeRabbit comments
   - Re-push → Inspect PR → Repeat until 0 comments

---

## Files Affected

### Backend (7 files)

- `src/routes/auth.js` (password validation, email validation, refresh endpoint)
- `src/middleware/auth.js` (JWT verification in tests)
- `src/middleware/rateLimiters.js` (disable in test environment)
- `tests/setupIntegration.js` (auth middleware config)
- `tests/e2e/auth-complete-flow.test.js` (fix 9 tests)

### Frontend (5 files)

- `frontend/src/services/authService.js` (refreshToken function)
- `frontend/src/utils/apiClient.js` (HTTP interceptor, error handling)
- `frontend/src/contexts/AuthContext.jsx` (auto-refresh strategy)
- `frontend/src/pages/auth/Login.jsx` (use apiClient)
- `frontend/src/pages/auth/Register.jsx` (use apiClient)

### Documentation (3 files)

- `docs/flows/login-registration.md` (new sections)
- `docs/nodes/multi-tenant.md` (updated coverage)
- `docs/test-evidence/issue-628/SUMMARY.md` (evidence)

---

## Acceptance Criteria

**This issue is 100% complete when:**

1. ✅ All 22 E2E tests passing (100%, not 59%)
2. ✅ Frontend auto-refresh implemented and tested
3. ✅ HTTP interceptor handles 401 with retry
4. ✅ Error handling 401/403/429 fully implemented
5. ✅ Backend endpoints verified functional
6. ✅ Documentation updated
7. ✅ GDD validation passing
8. ✅ CI/CD all jobs green
9. ✅ CodeRabbit 0 comments
10. ✅ Pre-Flight Checklist complete

---

## Risk Assessment

| Risk                                   | Likelihood | Impact | Mitigation                                    |
| -------------------------------------- | ---------- | ------ | --------------------------------------------- |
| Tests still fail after fixes           | Medium     | High   | Follow pattern from #618, defensive checks    |
| Session refresh endpoint unavailable   | Low        | Medium | Verify feature flag or mock properly          |
| Frontend auto-refresh breaks UX        | Low        | Medium | Test with short token expiry, add logging     |
| HTTP interceptor causes infinite loops | Medium     | High   | Add retry counter, max 1 retry                |
| Rate limiting breaks in test           | Low        | Low    | Disable in test environment (proven fix #618) |

---

## Timeline

| Phase                      | Duration | Cumulative   |
| -------------------------- | -------- | ------------ |
| FASE 3.1: Fix Tests        | 1.5h     | 1.5h         |
| FASE 3.2: Auto-Refresh     | 1h       | 2.5h         |
| FASE 3.3: HTTP Interceptor | 45min    | 3.25h        |
| FASE 3.4: Error Handling   | 30min    | 3.75h        |
| FASE 4: Validation         | 30min    | 4.25h        |
| FASE 5: Documentation      | 45min    | 5h           |
| FASE 6: PR + CodeRabbit    | 1h       | **6h total** |

**Buffer:** +2h for unexpected issues = **8h max**

---

## Lessons from #593

**What went wrong:**

- Issue closed with 59% tests passing (violated CLAUDE.md rule)
- Auto-refresh NOT implemented (scope incomplete)
- HTTP interceptor NOT implemented (scope incomplete)
- Error handling incomplete

**What we'll do differently:**

- ✅ Fix ALL tests BEFORE moving to next phase
- ✅ Verify 100% passing with `npm test`
- ✅ Implement full scope (auto-refresh, interceptor, error handling)
- ✅ Do NOT close until acceptance criteria 100% met
- ✅ Follow CLAUDE.md: "Tests MUST PASS 100%"

---

**Next Step:** Start FASE 3.1 - Fix Failing Tests

**Quality > Speed:** This time we do it right.
