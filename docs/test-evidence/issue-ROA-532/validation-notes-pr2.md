# Validation Notes - PR 2/x (Auth UX Improvements)

**Issue:** ROA-532  
**PR:** #1293 (2/x)  
**Date:** 2026-01-26  
**Status:** ⏳ Pending QA Manual

---

## 💡 Technical Observations & Trade-offs

### 1. Email Regex (Acceptable for Frontend)

**Implementation:**
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

**Analysis:**
- ✅ **Good for frontend UX validation**
  - Blocks obvious errors: `test@`, `test@domain`, `test@.com`
  - Fast, lightweight, no external dependencies
  - Provides immediate feedback to users

- ⚠️ **Known Limitations (Expected)**
  - Doesn't catch edge cases:
    - `user@domain..com` (double dots)
    - `user@@domain.com` (double @)
    - `user@domain` (no TLD)
    - Complex RFC 5322 violations
  
- ✅ **Acceptable Because:**
  - Frontend validation is for **UX only** (immediate feedback)
  - Backend is the **source of truth** for validation
  - Backend should use RFC 5322 compliant validation
  - Edge cases will be caught by backend (400/422 errors)

**Recommendation:**
- ✅ Frontend regex is **sufficient for UX purposes**
- 🔍 **Verify backend validation** (separate test):
  - Backend must validate email format strictly
  - Backend must reject `user@domain..com`, etc.
  - Backend must return clear error codes (`AUTH_INVALID_EMAIL`)

---

### 2. onChange Email Validation (Deliberate UX Choice)

**Implementation:**
```typescript
handleChange('email', value) {
  const emailError = validateEmail(value);
  setFieldErrors(prev => ({ ...prev, email: emailError }));
}
```

**Behavior:**
- Shows error **while typing** (after each character change)
- Example: User types `test@` → Error appears immediately

**Trade-offs:**

| Aspect | Evaluation |
|--------|------------|
| **Pro** | ✅ Immediate feedback (stated requirement) |
| **Pro** | ✅ Prevents invalid submissions early |
| **Pro** | ✅ Submit button disabled instantly |
| **Con** | ⚠️ Can feel "aggressive" to some users |
| **Con** | ⚠️ Error appears before user finishes typing |

**User Experience Analysis:**

**Scenario A: User types slowly**
```
User types: "t" → Error: "Email no válido"
User types: "e" → Error: "Email no válido"
User types: "s" → Error: "Email no válido"
...
User types: "@example.com" → Error disappears ✅
```

**Scenario B: User types fast**
```
User types: "test@example.com" (fast) → Brief flash of error, then clear ✅
```

**Scenario C: User pastes email**
```
User pastes: "test@example.com" → Validates instantly ✅
```

**Verdict:**
- ✅ **Acceptable** - This is a **deliberate UX choice** made to meet P0 requirements
- ✅ Error disappears **immediately** when valid (reactive validation)
- ✅ Submit disabled prevents invalid submissions
- 🔶 **Alternative considered:** Validate only onBlur (less aggressive)
  - **Not chosen** because requirement was "onChange y onBlur"

**Alternative UX (if needed in future):**
```typescript
// Validate onChange only after user has blurred once
const [hasBlurred, setHasBlurred] = useState({ email: false });

handleChange('email', value) {
  setFormData(prev => ({ ...prev, email: value }));
  
  // Only validate onChange if user has already focused away once
  if (hasBlurred.email) {
    const emailError = validateEmail(value);
    setFieldErrors(prev => ({ ...prev, email: emailError }));
  }
}

handleBlur('email') {
  setHasBlurred(prev => ({ ...prev, email: true }));
  const emailError = validateEmail(formData.email);
  setFieldErrors(prev => ({ ...prev, email: emailError }));
}
```

---

### 3. VITE_API_URL Fallback (Correct)

**Implementation:**
```typescript
const apiUrl = import.meta.env.VITE_API_URL || '';
const endpoint = apiUrl 
  ? `${apiUrl}/v2/auth/register`  // Staging/Prod
  : '/api/v2/auth/register';      // Local (proxy)
```

**Analysis:**
- ✅ **Local development:** Uses Vite proxy (`/api` → `localhost:3000`)
- ✅ **Staging:** Uses `VITE_API_URL` from Vercel env vars → Railway backend
- ✅ **Production:** Uses `VITE_API_URL` from Vercel env vars
- ✅ **Correct endpoint:** `/v2/auth/register` (Auth v2)

**Environment Configuration:**

| Environment | VITE_API_URL | Endpoint Used | Backend |
|-------------|--------------|---------------|---------|
| Local | `undefined` | `/api/v2/auth/register` | `localhost:3000` (via proxy) |
| Staging | `https://roastr-backend-staging.railway.app` | `https://.../v2/auth/register` | Railway staging |
| Production | `https://api.roastr.ai` | `https://.../v2/auth/register` | Railway prod |

**Verification Steps:**
1. ✅ Local: Open DevTools → Network → Verify request goes to `localhost:3000`
2. ⏳ Staging: Open DevTools → Network → Verify request goes to Railway backend
3. ⏳ Production: Same verification post-deploy

---

### 4. Legal Pages (Complete & GDPR Compliant)

**Implementation:**
- ✅ `/terms` - Términos y Condiciones (12 sections, ~142 lines)
- ✅ `/privacy` - Política de Privacidad (12 sections, ~153 lines, GDPR)

**Features:**
- ✅ Spanish content, clear tone
- ✅ MVP-complete (no placeholder content)
- ✅ Back buttons to `/login`
- ✅ Cross-links between terms/privacy
- ✅ Opens in new tab from registration form (`target="_blank"`)

**GDPR Compliance Highlights:**
- ✅ Data collection transparency
- ✅ User rights (access, rectification, deletion, portability)
- ✅ Retention policy (30 days post-cancellation)
- ✅ International transfers notice
- ✅ Contact information for data protection

**Testing:**
1. ✅ Navigate to `/terms` → Content renders correctly
2. ✅ Navigate to `/privacy` → Content renders correctly
3. ✅ Click "Volver" → Returns to `/login`
4. ✅ Click cross-links → Navigate between terms/privacy
5. ⏳ From `/register` → Click terms link → Opens in new tab

---

## 🔍 Items NOT in Diff (Requires Separate Verification)

These items are **backend responsibilities** and should be verified separately (not in this frontend PR):

### 1. Backend Email Validation

**What to verify:**
- ✅ Backend validates email format strictly (RFC 5322 compliant)
- ✅ Backend rejects edge cases:
  - `user@domain..com` (double dots)
  - `user@@domain.com` (double @)
  - `user@domain` (no TLD)
  - `user@` (incomplete)
- ✅ Backend returns clear error code: `AUTH_INVALID_EMAIL`
- ✅ Frontend correctly maps error code to message: "Email inválido"

**Testing:**
```bash
# Manual test with curl
curl -X POST https://roastr-backend-staging.railway.app/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@domain..com", "password": "Test123", "terms_accepted": true}'

# Expected response:
# 400 Bad Request
# { "error_code": "AUTH_INVALID_EMAIL", "message": "..." }
```

**Reference:**
- Backend Auth v2 endpoint: `apps/backend-v2/src/routes/auth/register.ts` (if exists)
- Backend validation logic: Should use library like `validator.js` or `email-validator`

---

### 2. Backend Password Validation

**What to verify:**
- ✅ Backend enforces password requirements:
  - Minimum 8 characters
  - At least 1 lowercase letter
  - At least 1 uppercase letter
  - At least 1 number
- ✅ Backend returns clear error code: `AUTH_WEAK_PASSWORD`
- ✅ Frontend correctly maps error code to message

**Testing:**
```bash
# Test weak password
curl -X POST https://roastr-backend-staging.railway.app/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "weak", "terms_accepted": true}'

# Expected response:
# 400 Bad Request
# { "error_code": "AUTH_WEAK_PASSWORD", "message": "..." }
```

---

### 3. Rate Limiting (Backend Enforcement)

**What to verify:**
- ✅ Backend enforces rate limits on `/v2/auth/register`
- ✅ Backend returns `429 Too Many Requests` after threshold
- ✅ Backend includes retry-after header (optional)
- ✅ Frontend correctly handles 429:
  - Shows message: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo"
  - Error code: `AUTH_RATE_LIMIT_EXCEEDED`

**Testing:**
```bash
# Spam registration endpoint
for i in {1..20}; do
  curl -X POST https://roastr-backend-staging.railway.app/v2/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"test$i@example.com\", \"password\": \"Test123\", \"terms_accepted\": true}"
done

# Expected: After ~10-15 requests, receive 429
```

**Note:** Rate limiting is **not a frontend concern** but should be verified for complete Auth flow.

---

### 4. Analytics Events (Not Visible in Frontend Diffs)

**What to verify:**
- ✅ Registration attempt event fires with correct payload
- ✅ Registration success event fires
- ✅ Registration failure event fires with error type
- ✅ Email validation error event fires (optional)

**Expected Events:**
```javascript
// On submit
analytics.track('registration_attempt', {
  email_domain: '@example.com', // No PII
  has_referral: false
});

// On success (201/200)
analytics.track('registration_success', {
  user_id: 'uuid',
  signup_method: 'email'
});

// On failure (4xx/5xx)
analytics.track('registration_failure', {
  error_type: 'invalid_email', // or 'weak_password', 'rate_limit', etc.
  status_code: 400
});
```

**Testing:**
1. Open DevTools → Network → Filter: `amplitude` or `analytics`
2. Attempt registration with invalid email
3. Verify event fires with correct payload
4. Attempt registration with valid credentials
5. Verify success/failure events

**Reference:**
- Analytics implementation: `frontend/src/lib/analytics.ts` (if exists)
- Amplitude integration: Check `VITE_AMPLITUDE_API_KEY` usage

---

## ✅ Summary of Observations

### Acceptable (No Changes Needed)

1. ✅ **Email regex** - Sufficient for frontend UX, backend is source of truth
2. ✅ **onChange validation** - Deliberate UX choice to meet P0 requirements
3. ✅ **VITE_API_URL fallback** - Correctly handles local/staging/prod
4. ✅ **Legal pages** - Complete, GDPR-compliant, MVP-ready

### Requires Separate Verification (Backend/Integration)

1. 🔍 **Backend email validation** (RFC 5322 compliance)
2. 🔍 **Backend password validation** (enforcement)
3. 🔍 **Rate limiting** (backend enforcement)
4. 🔍 **Analytics events** (tracking payload)

### Optional Future Improvements (Not Blocking)

1. 🔶 **Less aggressive email validation** - Validate onChange only after first blur
   - **Current:** Error appears while typing (onChange)
   - **Alternative:** Error appears only after blur, then onChange for subsequent edits
   - **Decision:** Keep current implementation (meets P0 requirements)

2. 🔶 **More robust email regex** - Catch edge cases like `user@domain..com`
   - **Current:** Basic regex for UX
   - **Alternative:** More complex regex (e.g., from `validator.js`)
   - **Decision:** Keep simple regex (backend handles edge cases)

---

## 🚀 QA Testing Checklist

### Frontend Validation (This PR)

- [ ] Email invalid (`.con`) → Error "Email no válido" appears immediately
- [ ] Submit button disabled when email invalid
- [ ] Email valid (`.com`) → Error disappears immediately
- [ ] Password/Confirm mismatch → Error appears
- [ ] Password/Confirm match → Error disappears automatically
- [ ] General error message clears when errors fixed
- [ ] Submit disabled when form invalid
- [ ] Submit enabled when form valid

### Error Handling (This PR)

- [ ] Email duplicado (400) → "Este email ya está registrado" (NOT "conexión")
- [ ] Password débil (400) → Password requirements message
- [ ] Backend 500 → "Error del servidor. Inténtalo más tarde"
- [ ] Network error → "Error de conexión. Verifica tu internet"

### Legal Pages (This PR)

- [ ] `/terms` renders correctly (12 sections)
- [ ] `/privacy` renders correctly (12 sections, GDPR)
- [ ] Back button from `/terms` → `/login`
- [ ] Cross-link `/terms` → `/privacy` works
- [ ] From `/register` → Terms link opens in new tab

### Backend Verification (Separate)

- [ ] Backend rejects `user@domain..com` with `AUTH_INVALID_EMAIL`
- [ ] Backend rejects weak password with `AUTH_WEAK_PASSWORD`
- [ ] Backend rate limits register endpoint (429 after threshold)
- [ ] Analytics events fire correctly (attempt, success, failure)

---

**Ready for:** QA Manual en Staging 🚀  
**PR:** #1293 (2/x)  
**Branch:** `feature/ROA-532-auth-ux-improvements-2`  
**Status:** ✅ Conflictos resueltos, branch sincronizada con main
