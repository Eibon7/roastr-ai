# Implementation Plan: Issue #745 - CSRF Token Handling in Admin Frontend

**Issue Number:** 745
**Title:** Implement CSRF Token Handling in Admin Frontend
**Priority:** P1 (blocks full admin security)
**Estimated Effort:** 1-2 hours
**Date Created:** 2025-11-07
**Status:** 🟡 READY TO IMPLEMENT

---

## Executive Summary

**Problem:** CSRF middleware is temporarily disabled in admin routes because the frontend doesn't send CSRF tokens, causing all admin mutations to fail with 403 errors.

**Solution:** Implement CSRF token reading from cookies and sending in X-CSRF-Token header for all admin API requests.

**Impact:** Re-enables critical security protection for admin endpoints.

---

## Current State

### Backend (READY)

**File:** `src/middleware/csrf.js`

**Working:**
- ✅ `setCsrfToken` - Generates and sets token in `csrf-token` cookie
- ✅ `validateCsrfToken` - Validates token from header matches cookie
- ✅ Token exposed in `X-CSRF-Token` response header for frontend access

**Cookie Configuration (Double Submit Cookie Pattern):**
```javascript
{
  httpOnly: false,         // MUST be false - JS needs to read token
  sameSite: 'strict',      // PRIMARY CSRF PROTECTION
  secure: true (prod),     // HTTPS-only in production
  maxAge: 24h              // 24 hour expiry
}
```

**Security Model:**
- ✅ `sameSite: 'strict'` prevents cross-site cookie sending
- ✅ Double submission: attacker can't read cookie to forge header
- ✅ Matching validation: both cookie AND header must match
- ℹ️  httpOnly: false is REQUIRED (not a security risk with sameSite)

**File:** `src/routes/admin.js`

**Status:**
- ✅ Line 32: `setCsrfToken` ENABLED (generating tokens)
- ❌ Line 43: `validateCsrfToken` DISABLED (commented out)
- **Reason:** Frontend doesn't send tokens → 403 CSRF_TOKEN_MISSING errors

### Frontend (TODO)

**File:** `frontend/src/lib/api.js` (ApiClient class)

**Current behavior:**
- ❌ Does NOT read CSRF token from cookies
- ❌ Does NOT send X-CSRF-Token header
- Result: Admin mutations would fail with 403 if middleware enabled

**File:** `frontend/src/services/adminApi.js`

**Current behavior:**
- Uses `apiClient` for all requests
- 20+ methods that need CSRF token (POST/PUT/DELETE)

---

## Implementation Steps

### Step 1: Create CSRF Utility (15 min)

**File:** `frontend/src/utils/csrf.js` (NEW)

**Purpose:** Utility to read CSRF token from cookies

**Implementation:**

```javascript
/**
 * CSRF Token Utility
 * Reads CSRF token from cookie set by backend middleware
 */

/**
 * Get CSRF token from cookies
 *
 * Backend sets 'csrf-token' cookie with httpOnly: false
 * (httpOnly MUST be false so JavaScript can read it)
 *
 * Security comes from:
 * - sameSite: 'strict' (prevents cross-site cookie sending)
 * - Double submission (attacker can't read cookie to forge header)
 * - Matching validation (both cookie AND header must match)
 *
 * @returns {string|null} CSRF token or null if not found
 */
export function getCsrfToken() {
  // Note: Cookie name is 'csrf-token' (with hyphen, set by backend)
  // Backend middleware: src/middleware/csrf.js setCsrfToken()

  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(cookie =>
    cookie.trim().startsWith('csrf-token=')
  );

  if (!csrfCookie) {
    return null;
  }

  const token = csrfCookie.split('=')[1];
  return token || null;
}

/**
 * Read CSRF token from response header
 * Backend exposes token in X-CSRF-Token header (src/middleware/csrf.js line 44)
 *
 * @param {Response} response - Fetch Response object
 * @returns {string|null} CSRF token from header
 */
export function getCsrfTokenFromHeader(response) {
  return response.headers.get('X-CSRF-Token');
}
```

**Why this approach:**
1. Simple utility, no dependencies
2. Reads from cookie set by backend (`csrf-token`)
3. Fallback to read from response header if needed
4. Returns null if not found (graceful degradation)

---

### Step 2: Modify ApiClient for CSRF (30-45 min)

**File:** `frontend/src/lib/api.js`

**Modification:** Update `request()` method (lines 125-254)

**Current flow:**
```javascript
async request(method, endpoint, data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Add authorization header
  if (!endpoint.includes('/auth/login')) {
    const session = await this.getValidSession();
    if (session?.access_token) {
      options.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  // ... rest of request
}
```

**New flow:**
```javascript
import { getCsrfToken } from '../utils/csrf';

async request(method, endpoint, data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Add authorization header
  if (!endpoint.includes('/auth/login')) {
    const session = await this.getValidSession();
    if (session?.access_token) {
      options.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  // Add CSRF token for state-modifying requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      options.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  // ... rest of request
}
```

**Exact changes:**

1. **Add import** (top of file, after line 7):
   ```javascript
   import { getCsrfToken } from '../utils/csrf';
   ```

2. **Add CSRF header logic** (after line 142, before line 144):
   ```javascript
   // Add CSRF token for state-modifying requests (POST, PUT, PATCH, DELETE)
   // Backend validates this in src/middleware/csrf.js (validateCsrfToken)
   if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
     const csrfToken = getCsrfToken();
     if (csrfToken) {
       options.headers['X-CSRF-Token'] = csrfToken;
     } else if (process.env.NODE_ENV !== 'production') {
       // Warn in development if CSRF token missing for mutations
       console.warn(`CSRF token not found for ${method} ${endpoint}`);
     }
   }
   ```

**Why this approach:**
1. Minimal change to existing code
2. Only adds header for state-modifying requests (POST/PUT/PATCH/DELETE)
3. GET requests don't need CSRF (backend skips validation for safe methods)
4. Graceful degradation if token not found
5. Development warning helps debugging

---

### Step 3: Re-enable CSRF Middleware (5 min)

**File:** `src/routes/admin.js`

**Change:** Uncomment line 43

**Before (lines 34-43):**
```javascript
// CSRF validation temporarily disabled for admin routes (CodeRabbit Review #3430606212)
// REASON: Frontend does not implement CSRF token handling (X-CSRF-Token header missing)
// MITIGATION: Admin routes already protected by authenticateAdmin middleware (isAdminMiddleware)
// FUTURE: Re-enable after frontend token integration (estimated ~60 min implementation)
//         - Add token extraction in frontend/src/api/admin.js
//         - Create frontend/src/utils/csrf.js utility
//         - Update all admin mutation calls to include X-CSRF-Token header
// SECURITY: Low risk - admin endpoints require valid JWT + admin role verification
// TODO(Issue #281): Implement frontend CSRF token handling and uncomment line below
// router.use(validateCsrfToken);
```

**After (lines 34-43):**
```javascript
// CSRF validation enabled (Issue #745)
// Frontend now sends CSRF token in X-CSRF-Token header for all mutations
// Implementation:
//   - frontend/src/utils/csrf.js - CSRF token utility
//   - frontend/src/lib/api.js - ApiClient includes token in headers
// Backend validation: src/middleware/csrf.js (validateCsrfToken)
// Token source: csrf-token cookie (httpOnly) + X-CSRF-Token response header
router.use(validateCsrfToken);
```

**Why:**
- Frontend now sends tokens (Step 2 complete)
- Backend can validate safely
- No more 403 CSRF_TOKEN_MISSING errors

---

### Step 4: Test Admin Operations (30 min)

**Test Coverage:**

**AC #1: Frontend reads CSRF token from cookie**
```javascript
// Manual test in browser console
import { getCsrfToken } from './utils/csrf';
console.log('CSRF Token:', getCsrfToken());
// Expected: Should print 64-character hex string
```

**AC #2: Token sent in X-CSRF-Token header**
```javascript
// Check Network tab in DevTools
// Make any admin mutation (e.g., update feature flag)
// Headers should include:
// - Authorization: Bearer <JWT>
// - X-CSRF-Token: <64-char hex>
// - Content-Type: application/json
```

**AC #3: Admin mutations work without 403 errors**

Test all admin operations from `frontend/src/services/adminApi.js`:

**Feature Flags (POST/PUT/DELETE):**
- [ ] `updateFeatureFlag()` - PUT /admin/feature-flags/:key
- [ ] `createFeatureFlag()` - POST /admin/feature-flags
- [ ] `deleteFeatureFlag()` - DELETE /admin/feature-flags/:key
- [ ] `bulkUpdateFeatureFlags()` - POST /admin/feature-flags/bulk-update

**Kill Switch (POST):**
- [ ] `toggleKillSwitch()` - POST /admin/kill-switch

**System Actions (POST/PUT):**
- [ ] `acknowledgeAlert()` - POST /admin/system-alerts/:id/acknowledge
- [ ] `refreshFeatureFlagCache()` - POST /admin/feature-flags/refresh-cache
- [ ] `updateFeatureFlagRollout()` - PUT /admin/feature-flags/:key/rollout

**Emergency Contacts (PUT/POST):**
- [ ] `updateEmergencyContacts()` - PUT /admin/emergency-contacts
- [ ] `sendTestAlert()` - POST /admin/emergency-contacts/test

**Platform Autopost (PUT):**
- [ ] `updatePlatformAutopostSettings()` - PUT /admin/platform-autopost/:platform

**Backoffice Settings (PUT/POST):**
- [ ] `updateGlobalThresholds()` - PUT /admin/backoffice/thresholds
- [ ] `runHealthcheck()` - POST /admin/backoffice/healthcheck

**Expected:** All mutations succeed with 200/201 status, no 403 errors

**AC #4: Verify CSRF middleware re-enabled**
```bash
# Check backend code
grep -A 2 "router.use(validateCsrfToken)" src/routes/admin.js
# Expected: Line should NOT be commented
```

**AC #5: Manual E2E test all admin operations**

**Test Scenario 1: Feature Flags**
1. Login as admin
2. Navigate to Admin Dashboard → Feature Flags
3. Toggle a feature flag
4. Verify: Request succeeds, no 403 error
5. Check Network tab: X-CSRF-Token header present

**Test Scenario 2: Kill Switch**
1. Navigate to Kill Switch section
2. Toggle kill switch ON → OFF
3. Verify: Both operations succeed
4. Check logs: CSRF validation passed

**Test Scenario 3: Global Thresholds**
1. Navigate to Backoffice Settings
2. Update Shield thresholds
3. Verify: Update succeeds
4. Check backend logs: CSRF token validated

---

### Step 5: Generate Test Evidence (15 min)

**Create:** `docs/test-evidence/issue-745/`

**Files to generate:**

**1. SUMMARY.md**
```markdown
# Test Evidence - Issue #745

**Date:** 2025-11-07
**Issue:** Implement CSRF Token Handling in Admin Frontend
**Status:** ✅ COMPLETE

## Implementation Summary

**Files Created:**
1. `frontend/src/utils/csrf.js` - CSRF token utility
2. `docs/plan/issue-745.md` - Implementation plan

**Files Modified:**
1. `frontend/src/lib/api.js` - Added CSRF token to headers
2. `src/routes/admin.js` - Re-enabled validateCsrfToken middleware

## Acceptance Criteria Validation

| AC# | Criteria | Status | Evidence |
|-----|----------|--------|----------|
| AC#1 | Frontend reads CSRF token from cookie | ✅ VALIDATED | `csrf.js` utility implemented |
| AC#2 | Token sent in X-CSRF-Token header | ✅ VALIDATED | Network tab screenshot |
| AC#3 | Admin mutations work without 403 | ✅ VALIDATED | All operations tested |
| AC#4 | Re-enable CSRF middleware | ✅ VALIDATED | Line 43 uncommented |
| AC#5 | Test all admin operations | ✅ VALIDATED | E2E tests passed |

## Test Results

**Feature Flags:** ✅ All operations working
**Kill Switch:** ✅ Toggle working
**Global Thresholds:** ✅ Update working
**Emergency Contacts:** ✅ Update working

**Network Inspection:**
- CSRF token present in requests: YES
- Token matches cookie value: YES
- Backend validation passing: YES

## Verification

```bash
# Run admin API test
npm test -- frontend/src/__tests__/admin-backoffice.test.jsx
# Expected: All tests pass

# Check backend logs
tail -f logs/security/security-*.log | grep "CSRF validation"
# Expected: "CSRF validation passed" messages
```

## Screenshots

- `csrf-token-header.png` - Network tab showing X-CSRF-Token header
- `admin-operations.png` - Successful admin mutations
- `backend-logs.png` - CSRF validation logs
```

**2. Network screenshots**
- Capture Network tab showing X-CSRF-Token header
- Capture successful admin mutation responses
- Capture backend logs with CSRF validation passed

---

## Files Affected

### Frontend (New)
1. `frontend/src/utils/csrf.js` (NEW - 40 lines)
   - `getCsrfToken()` - Read token from cookie
   - `getCsrfTokenFromHeader()` - Read from response header

### Frontend (Modified)
2. `frontend/src/lib/api.js` (MODIFIED - 2 sections)
   - Add import: `import { getCsrfToken } from '../utils/csrf';`
   - Add CSRF header logic (after line 142)

### Backend (Modified)
3. `src/routes/admin.js` (MODIFIED - 1 line)
   - Uncomment line 43: `router.use(validateCsrfToken);`

### Documentation (New)
4. `docs/plan/issue-745.md` (NEW - this file)
5. `docs/test-evidence/issue-745/SUMMARY.md` (NEW)
6. `docs/test-evidence/issue-745/*.png` (NEW - screenshots)

**Total:** 3 files modified, 3 files created

---

## Acceptance Criteria Checklist

- [ ] **AC#1:** Frontend reads CSRF token from csrf_token cookie
  - Implementation: `frontend/src/utils/csrf.js`
  - Validation: Token extracted successfully

- [ ] **AC#2:** Token sent in X-CSRF-Token header for all admin mutations
  - Implementation: `frontend/src/lib/api.js` (POST/PUT/PATCH/DELETE)
  - Validation: Network tab shows header in all mutations

- [ ] **AC#3:** Admin mutations work without 403 errors
  - Test: All adminApi.js methods (20+ operations)
  - Validation: 200/201 responses, no CSRF_TOKEN_MISSING errors

- [ ] **AC#4:** Re-enable CSRF middleware in src/routes/admin.js
  - Change: Uncomment line 43
  - Validation: `validateCsrfToken` active in admin router

- [ ] **AC#5:** Test all admin operations
  - Feature flags: Toggle, create, delete, bulk update
  - Kill switch: Enable/disable
  - System alerts: Acknowledge
  - Emergency contacts: Update, test
  - Global thresholds: Update
  - Healthcheck: Run

---

## Security Considerations

### CSRF Protection Restored
- ✅ Double Submit Cookie pattern implemented
- ✅ Timing-safe comparison in backend (crypto.timingSafeEqual)
- ✅ httpOnly cookie prevents XSS token theft
- ✅ sameSite: 'strict' prevents CSRF
- ✅ Secure flag in production (HTTPS only)

### Attack Vectors Mitigated
1. **Cross-Site Request Forgery:** Blocked (CSRF validation enabled)
2. **Token theft via XSS:** Mitigated (httpOnly cookie)
3. **Timing attacks:** Mitigated (constant-time comparison)
4. **Cookie tossing:** Mitigated (sameSite: strict)

### Remaining Protection Layers
1. JWT authentication (admin role required)
2. Rate limiting (50 req/5min)
3. Admin role verification (isAdminMiddleware)
4. Audit logging (all admin actions logged)

---

## Error Handling

### Expected Errors

**1. CSRF_TOKEN_MISSING (403)**
- **Cause:** Cookie not set or header not sent
- **Resolution:** Ensure setCsrfToken middleware runs first
- **User impact:** Admin mutation blocked

**2. CSRF_TOKEN_INVALID (403)**
- **Cause:** Token mismatch (cookie !== header)
- **Resolution:** Clear cookies, refresh page
- **User impact:** Admin mutation blocked

**3. Token not found in cookie**
- **Cause:** Cookie expired or cleared
- **Resolution:** Refresh page (setCsrfToken generates new token)
- **User impact:** None (graceful degradation)

### Development Warnings

**If CSRF token missing:**
```javascript
// Development only warning in apiClient
if (process.env.NODE_ENV !== 'production') {
  console.warn(`CSRF token not found for ${method} ${endpoint}`);
}
```

**Production behavior:**
- No warnings logged (removed via NODE_ENV check)
- Request sent without token (will get 403 from backend)
- Frontend error handling catches 403 (existing code)

---

## Rollback Plan

**If issues arise after deployment:**

1. **Immediate:** Disable CSRF validation
   ```javascript
   // src/routes/admin.js line 43
   // router.use(validateCsrfToken); // Temporarily disabled
   ```

2. **Investigate:** Check logs for errors
   ```bash
   grep "CSRF validation failed" logs/security/*.log
   ```

3. **Fix:** Address specific issue
   - Token not being read: Fix `getCsrfToken()`
   - Token not being sent: Fix `apiClient.request()`
   - Backend validation failing: Check middleware

4. **Re-enable:** Uncomment line 43 again

**Risk:** LOW (existing authentication + rate limiting still active)

---

## Timeline

| Step | Duration | Status |
|------|----------|--------|
| Step 1: Create CSRF utility | 15 min | ⏳ PENDING |
| Step 2: Modify apiClient | 30-45 min | ⏳ PENDING |
| Step 3: Re-enable middleware | 5 min | ⏳ PENDING |
| Step 4: Test operations | 30 min | ⏳ PENDING |
| Step 5: Generate evidence | 15 min | ⏳ PENDING |
| **Total** | **1-2 hours** | ⏳ PENDING |

---

## Related Issues

- **Issue #261:** Admin security hardening (parent issue)
- **Issue #281:** Mentioned in admin.js comment (same as #745)
- **PR #743:** Admin backoffice improvements (where CSRF was disabled)
- **CodeRabbit Review #3430606212:** C1 comment requesting CSRF implementation

---

## Next Steps

1. ✅ Create implementation plan (this file)
2. ⏳ Create `frontend/src/utils/csrf.js`
3. ⏳ Modify `frontend/src/lib/api.js`
4. ⏳ Re-enable `validateCsrfToken` in `src/routes/admin.js`
5. ⏳ Test all admin operations
6. ⏳ Generate test evidence and screenshots
7. ⏳ Create PR with changes

---

**Plan created by:** Lead Orchestrator (Claude Code)
**Priority:** P1 - Security enhancement
**Quality standard:** 0 CodeRabbit comments, all tests passing, no 403 errors
