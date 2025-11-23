# Breaking Changes - Issue #942: Zod Migration for Persona Endpoints

**PR:** #969  
**Issue:** #942  
**Date:** 2025-11-23  
**Priority:** P0 - Critical

---

## Overview

This PR introduces **breaking changes** to the Persona API validation behavior. These changes improve security and data integrity but **require frontend coordination**.

---

## Breaking Changes

### 1. XSS Patterns Now Rejected (400)

**Before (express-validator):**

- Input: `<script>alert(1)</script>`
- Behavior: Sanitized using `.escape()` → returned `200 OK` with escaped content
- Stored: `&lt;script&gt;alert(1)&lt;/script&gt;`

**After (Zod + DOMPurify):**

- Input: `<script>alert(1)</script>`
- Behavior: **Rejected with `400 VALIDATION_ERROR`**
- Response:

```json
{
  "success": false,
  "errors": [
    {
      "field": "lo_que_me_define",
      "type": "CUSTOM",
      "message": "XSS_DETECTED: Malicious HTML content is not allowed"
    }
  ],
  "code": "CUSTOM"
}
```

**Impact:**

- Frontend will now receive `400` errors for XSS patterns instead of silently accepting them
- Users attempting to submit malicious HTML will see validation errors
- **Defense-in-depth:** Prevents XSS at validation layer (previously only prevented at encryption/storage layer)

**Additional XSS Patterns Blocked:**

- `<iframe src="malicious.com">`
- `<embed src="malicious.swf">`
- `<img src=x onerror="alert(1)">`
- `<svg onload="alert(1)">`
- Any HTML tags that DOMPurify identifies as malicious

**Allowed:**

- Plain text XSS patterns like `JAVASCRIPT:alert(1)` or `OnErRoR=alert(1)` (not a threat in encrypted/embedding context)

---

### 2. Empty Request Body Now Rejected (400)

**Before (express-validator):**

- Input: `{}`
- Behavior: **Accepted with `200 OK`** (optional validation allowed empty payloads)
- Stored: Empty fields in database

**After (Zod):**

- Input: `{}`
- Behavior: **Rejected with `400 VALIDATION_ERROR`**
- Response:

```json
{
  "success": false,
  "errors": [
    {
      "field": "_general",
      "type": "CUSTOM",
      "message": "At least one persona field must be provided"
    }
  ],
  "code": "CUSTOM"
}
```

**Impact:**

- Frontend must ensure **at least one field** is provided when calling `POST /api/persona`
- Prevents unnecessary API calls with no data
- Improves data integrity

---

### 3. SQL Injection Patterns No Longer Escaped

**Before (express-validator):**

- Input: `Robert'); DROP TABLE users;--`
- Behavior: Escaped using `.escape()` → stored as escaped string
- Protection: Both validation layer + DB layer (parameterized queries)

**After (Zod):**

- Input: `Robert'); DROP TABLE users;--`
- Behavior: **Accepted as-is** (Zod doesn't escape SQL)
- Protection: **Only DB layer** (parameterized queries in `PersonaService`)

**Why This Is Safe:**

- Persona data is encrypted before storage (AES-256-GCM)
- All database queries use parameterized queries (SQL injection impossible)
- Encrypting first prevents SQL patterns from reaching DB
- DB layer is the **proper defense layer** for SQL injection (not validation layer)

**Impact:**

- No frontend changes needed
- Backend continues using parameterized queries
- **Defense-in-depth maintained:** Encryption + Parameterized Queries

---

## Migration Strategy

### Option A: Coordinated Deployment (Recommended)

**Timeline:** Same deployment window

1. **Backend deploys first** (PR #969)
2. **Frontend deploys immediately after** with updated error handling
3. **Validation:**
   - Test XSS patterns return `400` (not `200`)
   - Test empty body returns `400` (not `200`)
   - Verify user-facing error messages

**Frontend Updates Required:**

```javascript
// Before: No error handling needed (always 200)
const response = await fetch('/api/persona', {
  method: 'POST',
  body: JSON.stringify(personaData)
});

// After: Handle 400 validation errors
const response = await fetch('/api/persona', {
  method: 'POST',
  body: JSON.stringify(personaData)
});

if (!response.ok && response.status === 400) {
  const errorData = await response.json();

  // Check for XSS validation
  const xssError = errorData.errors.find((e) => e.message.includes('XSS_DETECTED'));
  if (xssError) {
    showError('El texto contiene patrones no permitidos. Por favor, evita usar HTML.');
  }

  // Check for empty body
  const emptyError = errorData.errors.find((e) => e.message.includes('At least one persona field'));
  if (emptyError) {
    showError('Debes proporcionar al menos un campo de personalidad.');
  }
}
```

---

### Option B: Feature Flag (If Gradual Rollout Needed)

**Only if frontend coordination is difficult:**

1. Add feature flag: `PERSONA_ZOD_VALIDATION=false`
2. Keep `express-validator` alongside Zod temporarily
3. Toggle flag after frontend is ready
4. **Cleanup:** Remove `express-validator` after 100% rollout

**Trade-offs:**

- ✅ Gradual rollout reduces risk
- ❌ Increased complexity (dual validation)
- ❌ Delays security improvements
- ❌ Not recommended for P0 security fixes

---

### Option C: API Versioning (Overkill)

**Not recommended:**

- Complexity outweighs benefit for internal API
- Requires maintaining `/api/v1/persona` and `/api/v2/persona`
- Better to coordinate deployment than maintain two APIs

---

## Rollback Plan

**If issues arise post-deployment:**

1. **Immediate:** Revert PR #969 (restore `express-validator`)
2. **Temporary:** Re-enable old validation behavior
3. **Root cause analysis:** Identify frontend issue
4. **Re-deploy:** After frontend fix is ready

**Rollback command:**

```bash
git revert a4568d5a  # Merge commit
git push origin main
```

---

## Testing Evidence

### Test Coverage:

- ✅ **Unit Tests:** `tests/unit/validators/persona.schema.test.js` (18 tests, 100% passing)
- ✅ **Integration Tests:** `tests/integration/persona-api.test.js` (updated 3 tests for breaking changes)
- ✅ **XSS Detection:** DOMPurify blocks `<script>`, `<iframe>`, `<embed>`, event handlers
- ✅ **Empty Body:** Returns `400` with clear error message
- ✅ **SQL Patterns:** Accepted (DB layer protection verified)

### Test Results:

```bash
PASS tests/unit/validators/persona.schema.test.js (18/18)
PASS tests/unit/validators/formatZodError.test.js (8/8)
PASS tests/integration/persona-api.test.js (all updated tests passing)
```

---

## Security Improvements

**Why This Change Matters:**

1. **Defense-in-depth:** XSS blocked at validation layer (not just encryption layer)
2. **OWASP Recommended:** DOMPurify is industry-standard for HTML sanitization
3. **Broader Coverage:** Regex only caught `<script>`, `javascript:`, `onerror=` → DOMPurify catches **all** HTML-based XSS
4. **Type Safety:** Zod provides TypeScript-level validation (better than `express-validator`)
5. **Data Integrity:** Empty payloads rejected (prevents useless API calls)

**Security Advisory (CodeRabbit):**

- **Before:** Regex insufficient (missed `<iframe>`, `<embed>`, `<img onerror>`, etc.)
- **After:** DOMPurify comprehensive (OWASP recommended, used by GitHub, Facebook, Google)

---

## Stakeholder Sign-Off

**Required approvals:**

- [ ] **Frontend Lead:** Confirmed error handling updated
- [ ] **Product Owner:** Approved breaking changes
- [ ] **Security Team:** Reviewed XSS mitigation upgrade
- [ ] **DevOps:** Deployment window coordinated

**Status:** ⚠️ **PENDING** - Awaiting frontend team confirmation

---

## Recommendation

**✅ Option A: Coordinated Deployment**

- **Why:** P0 security fix should not be delayed
- **Risk:** Low (comprehensive test coverage + clear error messages)
- **Timeline:** Deploy backend + frontend in same window (1 hour)
- **Fallback:** Immediate rollback available if issues arise

**Action Required:**

1. Tag `@frontend-team` for error handling updates
2. Schedule deployment window (recommendation: off-peak hours)
3. Verify frontend changes in staging before production
4. Monitor error logs post-deployment for unexpected `400` responses

---

## References

- **Issue:** #942
- **PR:** #969
- **CodeRabbit Review:** https://github.com/Eibon7/roastr-ai/pull/969#pullrequestreview-3497982135
- **Security Upgrade:** `docs/plan/coderabbit-review-response.md`
- **Test Evidence:** `tests/unit/validators/`, `tests/integration/persona-api.test.js`
