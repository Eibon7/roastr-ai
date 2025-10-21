# Implementation Plan: Issue #628 - Complete Login & Registration (Pending from #593)

**Issue:** #628
**Parent Issue:** #593 (closed prematurely)
**Priority:** P0 (Blocker for production)
**Estimated Time:** 3-4 hours
**Labels:** `auth`, `frontend`, `backend`, `testing`, `high-priority`

---

## Estado Actual (Assessment)

### Tests Fallando: 9/22 (41% failure rate)

**Root Causes Identified:**

1. **Missing Supabase Client** (1 test)
   - Test: "should complete full registration flow successfully"
   - Error: `ReferenceError: supabaseServiceClient is not defined`
   - Fix: Import `supabaseServiceClient` in test file

2. **Auth Middleware Issues** (3 tests)
   - Tests: "should access protected route", "should logout successfully"
   - Error: Expected 200, got 401
   - Cause: JWT verification or middleware config
   - Fix: Verify `authMiddleware` in test environment

3. **Session Refresh Endpoint Returns 503** (2 tests)
   - Tests: "should refresh access token", "should reject refresh with invalid token"
   - Error: Expected 200/401, got 503
   - Cause: Endpoint disabled or service unavailable
   - Fix: Enable session refresh endpoint or mock properly

4. **Invalid Password NOT Rejected** (1 test)
   - Test: "should reject login with invalid password"
   - Error: Expected 401, got 200
   - Cause: Password validation bypassed
   - Fix: Enable bcrypt comparison in test environment

5. **Email Service Not Called** (1 test)
   - Test: "should send password reset email"
   - Error: `emailService.sendPasswordResetEmail` not called
   - Cause: Mock not set up or endpoint skip email
   - Fix: Verify mock setup and endpoint logic

6. **Rate Limiting Parse Error** (1 test)
   - Test: "should enforce rate limiting on login attempts"
   - Error: `Parse Error: Data after Connection: close`
   - Cause: Middleware issue with multiple requests
   - Fix: Similar to #618 - disable rate limiting in test or fix middleware

7. **Malformed Email Accepted** (1 test)
   - Test: "should handle malformed email"
   - Error: Expected 400, got 201
   - Cause: Email validation not enforced
   - Fix: Enable email format validation

### Frontend Functionality Missing

**NOT implemented in #593:**
- ❌ Auto-refresh 15 minutes before token expiry
- ❌ HTTP interceptor with 401 retry
- ❌ Error handling for 401/403/429

---

## Plan de Implementación

### FASE 3.1: Fix Failing Tests (PRIORITY 1)

**Estimated:** 1.5 hours

**Tasks:**

1. **Fix Supabase Client Import** (5 min)
   - File: `tests/e2e/auth-complete-flow.test.js`
   - Import `supabaseServiceClient` from setup or create inline

2. **Fix Auth Middleware in Tests** (15 min)
   - Files: `tests/setupIntegration.js`, `src/middleware/auth.js`
   - Verify JWT verification enabled in test mode
   - Check mock token generation matches real JWT format

3. **Enable Session Refresh Endpoint** (20 min)
   - File: `src/routes/auth.js`
   - Verify `POST /api/auth/session/refresh` is registered
   - Enable in test environment (check feature flags)
   - Or: Mock endpoint properly in tests

4. **Fix Password Validation** (10 min)
   - File: `src/routes/auth.js` (login endpoint)
   - Verify bcrypt comparison enabled in test mode
   - Check mock user passwords are hashed correctly

5. **Fix Email Service Mock** (10 min)
   - File: `tests/e2e/auth-complete-flow.test.js`
   - Verify `emailService.sendPasswordResetEmail` mock setup
   - Check password reset endpoint actually calls service

6. **Fix Rate Limiting in Tests** (15 min)
   - File: `src/middleware/rateLimiters.js` or auth routes
   - Apply pattern from #618: Disable in test environment
   - Or: Fix superagent connection handling

7. **Fix Email Validation** (10 min)
   - File: `src/routes/auth.js` (register endpoint)
   - Add email format validation (regex or validator library)
   - Return 400 for malformed emails

8. **Re-run Tests** (5 min)
   - `npm test -- tests/e2e/auth-complete-flow.test.js`
   - Verify 22/22 passing (100%)

### FASE 3.2: Implement Frontend Auto-Refresh (PRIORITY 2)

**Estimated:** 1 hour

**Tasks:**

1. **Create `refreshToken()` Function** (20 min)
   - File: `frontend/src/services/authService.js` (or create)
   - Function signature: `async refreshToken(refreshToken): Promise<{token, expiresAt}>`
   - API call: `POST /api/auth/session/refresh`
   - Handle success: Store new token in localStorage
   - Handle failure: Force logout

2. **Implement Proactive Refresh Strategy** (30 min)
   - File: `frontend/src/contexts/AuthContext.jsx` or `frontend/src/App.jsx`
   - Add `useEffect` hook with interval (5 minutes)
   - Check token expiry: `const minutesUntilExpiry = (expiresAt - now) / 1000 / 60`
   - If `minutesUntilExpiry < 15 && minutesUntilExpiry > 0`: Call `refreshToken()`
   - Cleanup interval on unmount

3. **Test Manual** (10 min)
   - Login → Wait 45 minutes → Verify auto-refresh happens at 15 min mark
   - Or: Mock short expiry (5 min token, 2 min refresh) for faster testing

### FASE 3.3: Implement HTTP Interceptor (PRIORITY 2)

**Estimated:** 45 min

**Tasks:**

1. **Create Fetch Interceptor** (30 min)
   - File: `frontend/src/utils/apiClient.js` (create)
   - Wrap native `fetch` or use library (axios has built-in interceptors)
   - Intercept response: If status 401
     - Attempt `refreshToken()` (1 retry max)
     - If refresh succeeds: Re-execute original request with new token
     - If refresh fails: Force logout
   - Prevent infinite loops: Track retry attempts

2. **Replace All fetch Calls** (10 min)
   - Files: `frontend/src/services/*.js`, `frontend/src/pages/auth/*.jsx`
   - Replace `fetch(...)` with `apiClient.fetch(...)`
   - Ensure consistent usage

3. **Test Manual** (5 min)
   - Login → Manually expire token → Make API call → Verify auto-retry

### FASE 3.4: Complete Error Handling (PRIORITY 3)

**Estimated:** 30 min

**Tasks:**

1. **Handle 401 Unauthorized** (10 min)
   - File: `frontend/src/utils/apiClient.js`
   - Show toast: "Session expired, redirecting to login..."
   - Clear localStorage
   - Redirect to `/login`

2. **Handle 403 Forbidden** (5 min)
   - File: `frontend/src/utils/apiClient.js`
   - Show toast: "Access denied"
   - Log event (console.warn or analytics)
   - Do NOT attempt refresh (permission issue)

3. **Handle 429 Rate Limit** (15 min)
   - File: `frontend/src/utils/apiClient.js`
   - Parse `Retry-After` header if present
   - Show toast: "Too many attempts, wait X seconds"
   - Implement exponential backoff: `delay = 500 * attempt`
   - Disable login button temporarily (state management)

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

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tests still fail after fixes | Medium | High | Follow pattern from #618, defensive checks |
| Session refresh endpoint unavailable | Low | Medium | Verify feature flag or mock properly |
| Frontend auto-refresh breaks UX | Low | Medium | Test with short token expiry, add logging |
| HTTP interceptor causes infinite loops | Medium | High | Add retry counter, max 1 retry |
| Rate limiting breaks in test | Low | Low | Disable in test environment (proven fix #618) |

---

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| FASE 3.1: Fix Tests | 1.5h | 1.5h |
| FASE 3.2: Auto-Refresh | 1h | 2.5h |
| FASE 3.3: HTTP Interceptor | 45min | 3.25h |
| FASE 3.4: Error Handling | 30min | 3.75h |
| FASE 4: Validation | 30min | 4.25h |
| FASE 5: Documentation | 45min | 5h |
| FASE 6: PR + CodeRabbit | 1h | **6h total** |

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
