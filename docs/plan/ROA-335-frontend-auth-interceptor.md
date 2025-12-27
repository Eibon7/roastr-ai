# Implementation Plan: ROA-335 - Frontend Auth HTTP Interceptor & Error Handling

**Issue:** ROA-335  
**Priority:** P0 (Critical - Blocker for production)  
**Estimated Time:** 3.5-5 hours (FASE 4 reduced, FASE 5 optimized)  
**Labels:** `auth`, `frontend`, `testing`, `high-priority`  
**Scope:** Frontend ONLY (no backend changes)

---

## 🎯 Objective

Implement frontend HTTP interceptor with automatic token refresh retry and comprehensive error handling UX for authentication flows.

**Key Requirements:**
- Detect 401 responses → trigger refresh token → retry original request (max 1x, blocked if refresh fails, blocked for auth endpoints)
- Map error codes to user-friendly UX (401 → redirect once, 403 → message, 429 → per-action backoff)
- E2E test coverage for critical flows (expired token, failed refresh, concurrent requests)
- Document frontend-backend auth contract (verify compatibility, document mismatches if any)

---

## 📋 Pre-Implementation Assessment

### Current State

**Frontend API Client (`frontend/src/lib/api.ts`):**
- ✅ Basic `ApiClient` class with `request()` method
- ✅ Automatic token injection from `localStorage.getItem('auth_token')`
- ✅ CSRF token handling
- ❌ **NO 401 retry logic**
- ❌ **NO refresh token handling**
- ❌ **NO error code mapping to UX**

**Backend v2 (`apps/backend-v2/src/routes/auth.ts`):**
- ✅ Endpoints: `/api/v2/auth/login`, `/api/v2/auth/refresh`, `/api/v2/auth/logout`
- ✅ Response format: `{ session: { access_token, refresh_token, ... }, message }`
- ✅ Error format: `{ error: { code: 'AUTH_*', message: '...' } }`
- ✅ Rate limiting: 5 attempts / 15min (login), 3 attempts / 1h (magic-link)

**Auth Context (`frontend/src/lib/auth-context.tsx`):**
- ✅ Manages user state
- ✅ Stores token in `localStorage.getItem('auth_token')`
- ❌ **NO refresh token storage**
- ❌ **NO automatic refresh on 401**

**Legacy Code (`public/js/auth.js`):**
- ✅ Has `apiCallWithRetry()` with 401 retry (but legacy, not used in React app)
- ⚠️ Reference implementation only

---

## 📝 Implementation Plan

### FASE 1: Token Storage & Refresh Service (1 hour)

**Objective:** Extend token storage to include refresh_token and create refresh service.

#### Task 1.1: Update Token Storage Strategy
- [ ] **File:** `frontend/src/lib/api.ts` or new `frontend/src/lib/auth/tokenStorage.ts`
- [ ] **Action:** Create token storage utility
- [ ] **Requirements:**
  - **Storage Strategy:**
    - `access_token`: Store in `localStorage.getItem('auth_token')` (persistent, keep existing key for compatibility)
    - `refresh_token`: Store in `localStorage.getItem('refresh_token')` (persistent)
    - **NO in-memory storage** (rely on localStorage for persistence across page reloads)
    - **NO custom token persistence** beyond what Supabase already provides (localStorage is sufficient)
  - **Refresh Token Lifetime Assumptions:**
    - Refresh token TTL: 7 days (as per backend v2 / SSOT v2)
    - Access token TTL: 1 hour (as per backend v2 / SSOT v2)
    - **NO custom expiration logic** - rely on backend validation
    - **NO proactive refresh** - only refresh on 401 response
  - **API Methods:**
    - `getAccessToken(): string | null` - Read from localStorage
    - `getRefreshToken(): string | null` - Read from localStorage
    - `setTokens(accessToken: string, refreshToken: string): void` - Write to localStorage
    - `clearTokens(): void` - Remove from localStorage
  - **Token Validation:**
    - **NO JWT decoding** - rely on backend validation
    - **NO expiration checks** - backend will return 401 if expired

#### Task 1.2: Create Refresh Token Service
- [ ] **File:** `frontend/src/lib/auth/refreshService.ts` (new)
- [ ] **Action:** Implement refresh token service
- [ ] **Requirements:**
  - Function: `refreshAccessToken(): Promise<{ access_token, refresh_token }>`
  - Call `POST /api/v2/auth/refresh` with `{ refresh_token }`
  - Handle response: `{ session: { access_token, refresh_token, ... } }`
  - Update localStorage with new tokens
  - Return new tokens or throw error
  - Handle errors: `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_REVOKED` (from `authErrorTaxonomy.ts`)

#### Task 1.3: Update Auth Context to Store Refresh Token
- [ ] **File:** `frontend/src/lib/auth-context.tsx`
- [ ] **Action:** Update login/logout to handle refresh_token
- [ ] **Requirements:**
  - On login success: Store both `access_token` and `refresh_token` from `session`
  - On logout: Clear both tokens
  - Update `verifyAuth()` to check refresh_token availability

---

### FASE 2: HTTP Interceptor with 401 Retry (1.5 hours)

**Objective:** Implement request interceptor that detects 401, refreshes token, and retries.

#### Task 2.1: Add Retry Logic to ApiClient
- [ ] **File:** `frontend/src/lib/api.ts`
- [ ] **Action:** Enhance `request()` method with 401 retry
- [ ] **Requirements:**
  - **Concurrent Request Handling:**
    - Add private flag `_isRefreshing: boolean` to prevent concurrent refresh calls
    - Add private queue `_pendingRequests: Array<{ resolve, reject, config }>` for requests waiting on refresh
    - **All concurrent 401s must queue behind a single refresh attempt**
  - **Retry Constraints:**
    - **Max 1 retry attempt** per request (hard limit, no exceptions)
    - **Block retry if refresh fails** - immediately reject all queued requests, clear tokens, redirect to login
    - **Block retry for auth endpoints** - skip retry for `/auth/login`, `/auth/signup`, `/auth/refresh`, `/auth/magic-link`, `/auth/reset-password`
  - **On 401 Response:**
    1. Check if endpoint is auth endpoint → **skip retry, throw error immediately**
    2. Check if already refreshing → **queue request** (wait for single refresh to complete)
    3. If not refreshing → start refresh process
    4. On refresh success → update token, **retry original request exactly once** (max 1 retry)
    5. On refresh failure → **reject all queued requests immediately**, clear tokens, redirect to login
  - **Prevent Infinite Loops:**
    - Track retry count per request (max 1 retry per request)
    - Never retry a retry (if retry fails, fail immediately)

#### Task 2.2: Integrate Refresh Service
- [ ] **File:** `frontend/src/lib/api.ts`
- [ ] **Action:** Import and use `refreshAccessToken()` from `refreshService.ts`
- [ ] **Requirements:**
  - Call refresh service when 401 detected
  - Update `getAuthToken()` to use token storage utility
  - Handle refresh errors gracefully (redirect to login on failure)

#### Task 2.3: Handle Auth Endpoints (No Retry)
- [ ] **File:** `frontend/src/lib/api.ts`
- [ ] **Action:** Block 401 retry for auth endpoints
- [ ] **Requirements:**
  - **List of auth endpoints (NO retry):**
    - `/auth/login` (or `/api/v2/auth/login`)
    - `/auth/signup` (or `/api/v2/auth/signup`)
    - `/auth/refresh` (or `/api/v2/auth/refresh`)
    - `/auth/magic-link` (or `/api/v2/auth/magic-link`)
    - `/auth/reset-password` (or `/api/v2/auth/reset-password`)
  - **Behavior:**
    - On 401 for auth endpoints → **skip retry, throw error immediately**
    - These endpoints don't require auth, so 401 means authentication failed (not expired token)
    - Only retry 401 for **protected endpoints** (endpoints that require auth)

#### Task 2.4: Update Request Method to Support Retry
- [ ] **File:** `frontend/src/lib/api.ts`
- [ ] **Action:** Modify `request()` to support retry with new token
- [ ] **Requirements:**
  - After refresh, update `Authorization` header with new token
  - Retry original request with same method, body, headers (except Authorization)
  - Return response from retried request

---

### FASE 3: Error Handling UX Mapping (1 hour)

**Objective:** Map backend error codes to user-friendly UX actions.

#### Task 3.1: Create Error Handler Utility
- [ ] **File:** `frontend/src/lib/auth/errorHandler.ts` (new)
- [ ] **Action:** Implement error code to UX mapping
- [ ] **Requirements:**
  - Import error codes from backend: `AUTH_ERROR_CODES` (reference `apps/backend-v2/src/utils/authErrorTaxonomy.ts`)
  - Function: `handleAuthError(error: ApiError): void`
  - Map error codes:
    - `AUTH_INVALID_CREDENTIALS` → Show message: "Invalid email or password"
    - `AUTH_EMAIL_NOT_VERIFIED` → Show message: "Please verify your email before logging in"
    - `AUTH_RATE_LIMIT_EXCEEDED` → Show message + disable action + exponential backoff
    - `SESSION_EXPIRED` → Redirect to `/login` with message: "Session expired. Please log in again."
    - `TOKEN_EXPIRED` → Redirect to `/login` with message: "Session expired. Please log in again."
    - `TOKEN_INVALID` → Redirect to `/login` with message: "Invalid session. Please log in again."
    - `AUTHZ_INSUFFICIENT_PERMISSIONS` → Show message: "Access denied. You don't have permission for this action."
    - `AUTHZ_ROLE_NOT_ALLOWED` → Show message: "Admin access required."
    - `ACCOUNT_SUSPENDED` → Show message: "Your account has been suspended. Contact support."

#### Task 3.2: Implement 401 UX (Session Expired)
- [ ] **File:** `frontend/src/lib/api.ts` or `errorHandler.ts`
- [ ] **Action:** Handle 401 errors with redirect
- [ ] **Requirements:**
  - **On 401 after refresh failure:**
    1. Clear tokens from localStorage
    2. Clear user from context (if using context)
    3. **Show toast/notification ONCE** (prevent spam on 401 loops)
       - Use flag to track if redirect already initiated
       - Only show message if not already redirecting
    4. Redirect to `/login` (or `/auth/login` depending on routing)
    5. Store intended destination in `sessionStorage` for post-login redirect
  - **Prevent Toast Spam:**
    - Track redirect state: `_isRedirecting: boolean`
    - Only show toast if `!_isRedirecting`
    - Set `_isRedirecting = true` before redirect

#### Task 3.3: Implement 403 UX (Access Denied)
- [ ] **File:** `frontend/src/lib/api.ts` or `errorHandler.ts`
- [ ] **Action:** Handle 403 errors with message
- [ ] **Requirements:**
  - On 403 response:
    1. Extract error code from response: `error.code`
    2. Map to user-friendly message via `errorHandler.ts`
    3. Show toast/notification with message
    4. Do NOT redirect (user is authenticated, just lacks permission)
    5. Optionally disable action button if applicable

#### Task 3.4: Implement 429 UX (Rate Limit)
- [ ] **File:** `frontend/src/lib/api.ts` or `errorHandler.ts`
- [ ] **Action:** Handle 429 errors with per-action backoff
- [ ] **Requirements:**
  - **On 429 response:**
    1. Extract `Retry-After` header (seconds) or use default 60s
    2. Show toast/notification: "Too many requests. Please wait X seconds and try again."
    3. **Per-action backoff (NOT global lock):**
       - Disable **only the specific action/button** that triggered the 429
       - Use action identifier (endpoint + method) to track per-action state
       - Each action has its own backoff timer (independent of other actions)
    4. Wait `Retry-After` seconds before re-enabling that specific action
    5. Show countdown timer if possible (optional UX enhancement)
    6. Re-enable button after backoff period for that specific action
  - **Per-Action State:**
    - Track backoff state per endpoint: `_rateLimitBackoff: Map<string, { disabledUntil: number }>`
    - Key format: `${method}:${endpoint}` (e.g., `POST:/api/v2/auth/login`)
    - Check if action is in backoff before making request

#### Task 3.5: Integrate Error Handler in ApiClient
- [ ] **File:** `frontend/src/lib/api.ts`
- [ ] **Action:** Call error handler for non-401 errors
- [ ] **Requirements:**
  - After 401 retry logic, check for 403, 429 status codes
  - Call `handleAuthError()` for these status codes
  - Still throw error for component-level handling if needed

---

### FASE 4: Verify Frontend-Backend Contract Compatibility (30 min)

**Objective:** Document any mismatches between frontend expectations and backend v2 contracts. **NO endpoint renaming, NO response reshaping.**

#### Task 4.1: Audit Current Frontend Auth API Usage
- [ ] **File:** `frontend/src/lib/api/auth.js` and `frontend/src/lib/api.ts` (authApi)
- [ ] **Action:** Document current endpoints and response handling
- [ ] **Requirements:**
  - List all auth endpoints currently used by frontend
  - Document expected response format for each endpoint
  - Document how responses are currently parsed
  - **NO changes** - only documentation

#### Task 4.2: Compare with Backend v2 Contracts
- [ ] **File:** `docs/flows/frontend-backend-auth-contract.md` (new section: "Current State vs Expected")
- [ ] **Action:** Document any mismatches
- [ ] **Requirements:**
  - Compare frontend expectations with backend v2 actual responses
  - Document mismatches (if any):
    - Endpoint path differences
    - Response format differences
    - Error format differences
  - **NO fixes** - only document mismatches for future reference
  - If no mismatches → document "Frontend already consuming v2 endpoints correctly"

#### Task 4.3: Document Refresh Service Endpoint
- [ ] **File:** `frontend/src/lib/auth/refreshService.ts` (JSDoc)
- [ ] **Action:** Document which endpoint is used for refresh
- [ ] **Requirements:**
  - Document endpoint: `/api/v2/auth/refresh` (or current endpoint if different)
  - Document request format: `{ refresh_token }`
  - Document response format: `{ session: { access_token, refresh_token, ... }, message }`
  - **NO changes** - only document current usage

---

### FASE 5: E2E Test Coverage (1.5 hours)

**Objective:** Create comprehensive E2E tests for auth flows. **Prioritize critical flows, rate-limit test is optional.**

#### Task 5.1: Setup E2E Test Infrastructure
- [ ] **File:** `frontend/src/test/auth/e2e-setup.ts` (new) or use existing test setup
- [ ] **Action:** Configure Playwright/Vitest for E2E auth tests
- [ ] **Requirements:**
  - Use existing test framework (check `frontend/src/test/auth/login-v2.test.tsx`)
  - Mock backend responses or use test backend
  - Setup/teardown: Clear localStorage, reset tokens before each test

#### Task 5.2: Test: Expired Access Token (PRIORITY 1)
- [ ] **File:** `frontend/src/test/auth/e2e-expired-token.test.tsx` (new)
- [ ] **Action:** Test 401 retry with expired token
- [ ] **Requirements:**
  - Test case: "should refresh token and retry request on 401"
  - Steps:
    1. Login successfully
    2. Mock expired access_token (or wait for expiration)
    3. Make authenticated request
    4. Verify 401 detected
    5. Verify refresh token called
    6. Verify original request retried with new token (max 1 retry)
    7. Verify response successful
  - Assertions:
    - Refresh service called exactly once
    - Original request retried exactly once
    - No infinite retry loops
    - Retry blocked if refresh fails

#### Task 5.3: Test: Failed Refresh Token (PRIORITY 2)
- [ ] **File:** `frontend/src/test/auth/e2e-refresh-failure.test.tsx` (new)
- [ ] **Action:** Test behavior when refresh token fails
- [ ] **Requirements:**
  - Test case: "should redirect to login on refresh failure"
  - Steps:
    1. Login successfully
    2. Mock expired access_token
    3. Mock invalid/expired refresh_token
    4. Make authenticated request
    5. Verify refresh fails
    6. Verify tokens cleared
    7. Verify redirect to login
    8. Verify toast shown only once (no spam)
  - Assertions:
    - Tokens cleared from localStorage
    - Redirect to `/login` (or `/auth/login`)
    - Error message shown: "Session expired. Please log in again."
    - No duplicate toasts/redirects

#### Task 5.4: Test: Concurrent Requests with One Refresh (PRIORITY 3)
- [ ] **File:** `frontend/src/test/auth/e2e-concurrent-refresh.test.tsx` (new)
- [ ] **Action:** Test multiple requests during token refresh
- [ ] **Requirements:**
  - Test case: "should queue concurrent requests during refresh"
  - Steps:
    1. Login successfully
    2. Mock expired token
    3. Make 3 concurrent authenticated requests
    4. Verify refresh called only once (single refresh for all requests)
    5. Verify all 3 requests queued
    6. Verify all 3 requests retried after refresh
    7. Verify all 3 responses successful
  - Assertions:
    - Refresh service called exactly once (not 3 times)
    - All requests queued behind single refresh
    - All requests retried after refresh completes
    - No duplicate refresh calls

#### Task 5.5: Test: Rate Limited Login (OPTIONAL - if time permits)
- [ ] **File:** `frontend/src/test/auth/e2e-rate-limit.test.tsx` (new)
- [ ] **Action:** Test 429 rate limit handling
- [ ] **Requirements:**
  - Test case: "should handle rate limit with per-action backoff"
  - Steps:
    1. Mock 5 failed login attempts
    2. Attempt 6th login
    3. Verify 429 response
    4. Verify error message shown
    5. Verify submit button disabled (per-action, not global)
    6. Verify button re-enabled after backoff period
    7. Verify other actions not affected (per-action backoff)
  - Assertions:
    - Error message contains "Too many requests"
    - Button disabled during backoff (only for that action)
    - Button re-enabled after `Retry-After` seconds
    - Other actions not blocked (per-action backoff works)

---

### FASE 6: Documentation Updates (1 hour)

**Objective:** Document frontend auto-refresh strategy and frontend-backend auth contract.

#### Task 6.1: Document Frontend Auto-Refresh Strategy
- [ ] **File:** `docs/flows/login-registration.md` or new `docs/flows/frontend-auth-strategy.md`
- [ ] **Action:** Add section on frontend auto-refresh
- [ ] **Requirements:**
  - Document interceptor flow: 401 → refresh → retry
  - Document token storage: `localStorage.getItem('auth_token')`, `localStorage.getItem('refresh_token')`
  - Document retry logic: max 1 retry, prevent infinite loops
  - Document concurrent request handling: queue during refresh
  - Document anonymous endpoints: skip retry for login/signup/etc.
  - Include sequence diagram (Mermaid)

#### Task 6.2: Document Frontend-Backend Auth Contract
- [ ] **File:** `docs/flows/frontend-backend-auth-contract.md` (new)
- [ ] **Action:** Document API contract between frontend and backend v2
- [ ] **Requirements:**
  - **Current State (from FASE 4 audit):**
    - Document actual endpoints used by frontend
    - Document actual response formats expected by frontend
    - Document any mismatches found (if any)
  - **Expected Backend v2 Contracts:**
    - **Endpoints:**
      - `POST /api/v2/auth/login` → `{ session: { access_token, refresh_token, expires_at, user }, message }`
      - `POST /api/v2/auth/refresh` → `{ session: { access_token, refresh_token, ... }, message }`
      - `POST /api/v2/auth/logout` → `{ message: "Logged out successfully" }`
    - **Request Headers:**
      - `Authorization: Bearer {access_token}` for protected endpoints
      - `Content-Type: application/json`
    - **Response Headers:**
      - `X-New-Access-Token` (optional, if backend implements auto-refresh middleware)
      - `X-New-Refresh-Token` (optional, if backend implements auto-refresh middleware)
    - **Error Format:**
      - `{ error: { code: 'AUTH_*' | 'AUTHZ_*' | 'SESSION_*' | 'TOKEN_*' | 'ACCOUNT_*', message: '...' } }`
  - **Error Codes Reference:**
    - Link to `apps/backend-v2/src/utils/authErrorTaxonomy.ts`
    - List all error codes with HTTP status codes
  - **Mismatches Section:**
    - If FASE 4 found mismatches → document them here
    - If no mismatches → document "Frontend already consuming v2 endpoints correctly"

#### Task 6.3: Update GDD Node with Frontend Integration
- [ ] **File:** `docs/nodes-v2/auth/session-management.md`
- [ ] **Action:** Add frontend integration section
- [ ] **Requirements:**
  - Document frontend token storage
  - Document frontend refresh strategy
  - Document frontend error handling
  - Link to frontend-backend contract doc

#### Task 6.4: Update API Client Documentation
- [ ] **File:** `frontend/src/lib/api.ts` (JSDoc comments)
- [ ] **Action:** Add comprehensive JSDoc for interceptor behavior
- [ ] **Requirements:**
  - Document 401 retry logic
  - Document error handling
  - Document token refresh flow
  - Document anonymous endpoints

---

## ✅ Acceptance Criteria

**This implementation is complete when:**

1. ✅ **401 Retry Works:**
   - Expired token → refresh → retry original request (max 1x)
   - No infinite loops
   - Concurrent requests queued during refresh

2. ✅ **Error Handling UX:**
   - 401 (after refresh failure) → redirect to login with message
   - 403 → show "Access denied" message
   - 429 → show message + disable action + backoff

3. ✅ **E2E Tests Passing:**
   - Expired access token (PRIORITY 1)
   - Failed refresh token (PRIORITY 2)
   - Concurrent requests with one refresh (PRIORITY 3)
   - Rate limited login (OPTIONAL - if time permits)

4. ✅ **Documentation Complete:**
   - Frontend auto-refresh strategy documented
   - Frontend-backend auth contract documented
   - GDD node updated

5. ✅ **No Backend Changes:**
   - All changes are frontend-only
   - No modifications to backend v2 contracts
   - Backend endpoints remain unchanged

---

## 🚨 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Infinite retry loops | Medium | High | Track retry count (max 1), prevent concurrent refresh calls |
| Token storage conflicts | Low | Medium | Use existing `auth_token` key, add `refresh_token` key separately |
| Concurrent request race conditions | Medium | Medium | Queue requests during refresh, single refresh call |
| Backend response format mismatch | Low | Medium | Document mismatches in FASE 4, do not fix |
| Toast spam on 401 loops | Medium | Medium | Track redirect state, show toast only once |
| Global rate limit lock | Low | Medium | Implement per-action backoff, not global |
| E2E tests flaky | Medium | Low | Use proper mocks, clear state between tests |

---

## 📚 References

### Backend v2
- **Auth Routes:** `apps/backend-v2/src/routes/auth.ts`
- **Auth Service:** `apps/backend-v2/src/services/authService.ts`
- **Error Taxonomy:** `apps/backend-v2/src/utils/authErrorTaxonomy.ts`
- **Response Format:** `{ session: { access_token, refresh_token, ... }, message }`

### Frontend
- **API Client:** `frontend/src/lib/api.ts`
- **Auth Context:** `frontend/src/lib/auth-context.tsx`
- **Auth API:** `frontend/src/lib/api/auth.js`

### Documentation
- **GDD Auth Node:** `docs/nodes-v2/auth/session-management.md`
- **Login Flows:** `docs/nodes-v2/auth/login-flows.md`
- **Error Taxonomy:** `docs/nodes-v2/auth/error-taxonomy.md`

### Legacy Reference
- **Legacy Retry:** `public/js/auth.js` (lines 111-231) - Reference implementation only

---

## 📝 Notes

- **Token Storage:** 
  - Persistent storage only (localStorage), no in-memory storage
  - Keep `auth_token` key for compatibility, add `refresh_token` separately
  - No custom token persistence beyond Supabase (localStorage is sufficient)
  - Refresh token lifetime: 7 days (backend assumption, no frontend validation)
- **Backend Endpoints:** 
  - Frontend must already be consuming v2 endpoints
  - No endpoint renaming, no response reshaping
  - Document mismatches only (FASE 4)
- **Retry Constraints:**
  - Max 1 retry attempt (hard limit)
  - Block retry if refresh fails
  - Block retry for auth endpoints themselves
  - Concurrent 401s queue behind single refresh
- **Error Handling:**
  - No global toast spam on 401 loops (track redirect state)
  - 429 handling is per-action, not global lock
- **Error Codes:** Reference `AUTH_ERROR_CODES` from backend v2 taxonomy
- **Testing:** Use existing test framework (Vitest/Playwright) in `frontend/src/test/`
- **No Backend Changes:** This plan assumes backend v2 is production-ready and unchanged

---

**Created:** 2025-12-26  
**Owner:** ROA-335  
**Status:** 📋 Planning Complete - Ready for Implementation

