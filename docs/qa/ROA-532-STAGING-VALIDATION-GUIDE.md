# ROA-532 - Staging Validation Guide

**Fecha:** 2026-01-30
**PR:** [#1308](https://github.com/Eibon7/roastr-ai/pull/1308)
**Status:** ✅ Ready for merge → deployment → validation

---

## 🚀 Post-Merge Deployment Steps

### 1. Merge PR

```bash
gh pr merge 1308 --squash
```

### 2. Monitor Auto-Deploy

**Railway (Backend):**
- URL: https://railway.app/project/[your-project]/deployments
- Wait for "Deployed" status
- Duration: ~2-3 min

**Vercel (Frontend):**
- URL: https://vercel.com/[your-team]/roastr-frontend-staging
- Wait for "Ready" status
- Duration: ~1-2 min

### 3. Restart Backend (MANDATORY)

**⚠️ CRITICAL: Backend must restart to load new feature flags**

**Option A - Railway Dashboard:**
```text
1. Go to Railway project
2. Click on backend service
3. Settings → Deploy
4. Click "Restart" button
5. Wait for service to be "Active"
```

**Option B - Railway CLI:**
```bash
railway up --detach
```

### 4. Verify Feature Flags Loaded

**Check backend logs:**
```bash
# Railway: View logs in dashboard
# Or CLI:
railway logs --service backend

# Expected log entry:
# ✅ "Loaded admin-controlled settings"
# ✅ "Auth flags loaded: {auth_enable_login:true, auth_enable_register:true, ...}"
```

### 5. Run Smoke Tests

**API Level:**
```bash
# Test register endpoint
curl -X POST https://api-staging.roastr.ai/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Expected: 200 OK with session (NOT 500)

# Test login endpoint
curl -X POST https://api-staging.roastr.ai/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'

# Expected: 401 with error.slug = "AUTH_INVALID_CREDENTIALS" (NOT 500)
```

---

## 🎯 Manual Validation Checklist

### Login Flow (https://staging.roastr.ai/login-v2)

**Test 1: Incorrect Credentials**
```text
1. Navigate to staging login
2. Enter email: testuser@example.com
3. Enter incorrect password
4. Click "Iniciar sesión"

Expected:
- ✅ Error message: "El email o la contraseña no son correctos"
- ❌ NO mostrar: "Load failed"
- ✅ Error displayed with Alert component (red background)
- ✅ No console errors in DevTools
```

**Test 2: Password Toggle Visibility**
```text
1. Focus on password field
2. Verify Eye icon button visible on the right

Expected:
- ✅ Eye icon visible (gray color)
- ✅ Click Eye → changes to EyeOff
- ✅ Password field type changes: password → text
- ✅ Click EyeOff → changes to Eye
- ✅ aria-label changes: "Mostrar contraseña" ↔ "Ocultar contraseña"
```

**Test 3: Successful Login**
```text
1. Enter correct credentials
2. Click "Iniciar sesión"

Expected:
- ✅ Navigates to /app or /dashboard
- ✅ Tokens stored (check localStorage/cookies)
- ✅ No errors in console
```

**Test 4: Theme Support**
```text
1. Test in light mode
2. Test in dark mode
3. Test in system mode

Expected:
- ✅ UI respects theme preference
- ✅ Password toggle visible in all themes
- ✅ Error messages visible in all themes
```

---

### Register Flow (https://staging.roastr.ai/register)

**Test 1: Successful Registration**
```text
1. Navigate to staging register
2. Enter email: newemail@example.com
3. Enter password: Test123! (8+ chars, lowercase, digit, uppercase OR symbol)
4. Confirm password: Test123!
5. Accept terms checkbox
6. Click "Crear cuenta"

Expected:
- ✅ Welcome email sent to inbox
- ✅ Navigates to /dashboard
- ✅ Tokens stored
- ✅ No errors in console
- ✅ Amplitude event sent (check dashboard)
```

**Test 2: Password Toggle Visibility**
```text
1. Focus on password field
2. Focus on confirm password field

Expected:
- ✅ Both fields have Eye icon button
- ✅ Toggles work independently
- ✅ aria-labels correct on both
```

**Test 3: Password Validation (Real-time)**
```text
1. Start typing password
2. Observe password requirements list

Expected:
- ✅ "Mínimo 8 caracteres" → green when ≥8
- ✅ "Una letra minúscula" → green when [a-z]
- ✅ "Un número" → green when [0-9]
- ✅ "Sin espacios" → green when no spaces
- ✅ "Una mayúscula o símbolo" → green when [A-Z] OR [!@#$...]
```

**Test 4: Confirm Password Validation**
```text
1. Enter password: Test123!
2. Enter confirmPassword: Test456!
3. Blur field

Expected:
- ✅ Error below confirm field: "Las contraseñas no coinciden"
- ✅ Error clears when passwords match
```

**Test 5: Email Validation**
```text
1. Enter invalid email: "usuario.com" (missing @)
2. Blur field

Expected:
- ✅ Error: "El email no es válido"
- ✅ Submit button disabled or error on submit
```

**Test 6: Terms Checkbox**
```text
1. Fill all fields correctly
2. Do NOT check terms
3. Click "Crear cuenta"

Expected:
- ✅ Error near checkbox: "Debes aceptar los términos y condiciones"
- ✅ aria-describedby connects error to checkbox
```

**Test 7: Error Mapping (Generic Messages)**
```text
1. Try register with existing email

Expected:
- ✅ Generic message: "No se pudo completar el registro. Inténtalo de nuevo"
- ❌ NO revelar: "Este email ya está registrado" (anti-enumeration)
```

---

### Rate Limiting (Login + Register)

**Test 1: Login Rate Limit (5 Failed Attempts)**
```text
1. Navigate to staging login
2. Enter email: testuser@example.com
3. Enter wrong password: "wrongpass1"
4. Click "Iniciar sesión"
5. Repeat steps 3-4 four more times (total: 5 failed attempts)

Expected (Frontend - Attempt 1-5):
- ✅ User-facing message: "El email o la contraseña no son correctos"
- ✅ No indication of rate limiting yet
- ✅ Form remains usable

Expected (Backend - Attempt 1-5):
- ✅ Log entry for each failed attempt
- ✅ Slug: AUTH_INVALID_CREDENTIALS
- ✅ Backend log fields include:
  - auth_action: "login"
  - email: (masked or truncated)
  - attempt_number: 1, 2, 3, 4, 5

Expected (Attempt 6 - Rate Limited):
- ✅ User-facing message: "Demasiados intentos. Inténtalo de nuevo en unos minutos"
- ✅ Slug: AUTH_RATE_LIMITED
- ✅ Backend log fields include:
  - retryable: true
  - auth_action: "login"
  - request_id: (unique identifier)
  - retry_after: (seconds or timestamp)
- ✅ Submit button disabled or request blocked
- ❌ NO reveal specific user existence

Expected (After Wait Period):
- ✅ Wait ~60 seconds (or configured retry_after)
- ✅ Attempt with correct credentials → Success
- ✅ Login proceeds normally
```

**Test 2: Register Rate Limit**
```text
1. Navigate to staging register
2. Attempt to register with invalid data (e.g., weak password)
3. Fix one issue, submit again (still invalid)
4. Repeat 5+ times with different validation errors

Expected (Frontend - Attempts 1-5):
- ✅ Validation error messages displayed
- ✅ Form remains usable
- ✅ No rate limit message yet

Expected (Backend - Attempts 1-5):
- ✅ Log entry for each invalid attempt
- ✅ Backend logs include:
  - auth_action: "register"
  - validation_errors: (array of errors)
  - request_id: (unique per request)

Expected (Attempt 6+ - Rate Limited):
- ✅ User-facing message: "Demasiados intentos de registro. Inténtalo de nuevo más tarde"
- ✅ Slug: AUTH_RATE_LIMITED
- ✅ Backend log fields include:
  - retryable: true
  - auth_action: "register"
  - request_id: (unique identifier)
  - rate_limit_window: (e.g., "5_minutes")
- ✅ Submit button disabled or request blocked

Expected (After Wait Period):
- ✅ Wait for configured window (e.g., 5 minutes)
- ✅ Attempt with valid data → Success
- ✅ Registration proceeds normally
- ✅ Welcome email sent
```

**Test 3: Rate Limit Per-User vs Global**
```text
Purpose: Confirm if rate limits are per-user (email), per-IP, or global

Setup:
- User A: testuser1@example.com
- User B: testuser2@example.com
- Same IP address (same browser/network)

Test Steps:
1. With User A:
   - Make 5 failed login attempts
   - Observe rate limiting on 6th attempt

2. Immediately after, with User B:
   - Attempt login with User B credentials (correct password)

Expected (Per-User Rate Limiting):
- ✅ User B login succeeds (different email, not rate limited)
- ✅ User A still rate limited
- ✅ Backend logs show:
  - rate_limit_key: includes email or user_id
  - User A: blocked
  - User B: allowed

Expected (Per-IP Rate Limiting):
- ❌ User B also blocked (same IP)
- ⚠️ May indicate IP-based limiting (verify if intended)
- ✅ Backend logs show:
  - rate_limit_key: includes IP address
  - Both users: blocked

Backend Verification:
- ✅ Check logs for rate_limit_key field
- ✅ Verify rate limiting strategy matches product spec
- ✅ Confirm request_id is unique per request
- ✅ Verify retryable: true for all rate limit responses
```

**Test 4: Rate Limit Message Consistency**
```text
1. Trigger rate limit on login (5+ failed attempts)
2. Note the exact error message
3. Trigger rate limit on register (5+ invalid attempts)
4. Note the exact error message

Expected:
- ✅ Both show AUTH_RATE_LIMITED slug
- ✅ Messages are user-friendly (no technical details)
- ✅ Messages may differ slightly by context:
  - Login: "Demasiados intentos. Inténtalo de nuevo en unos minutos"
  - Register: "Demasiados intentos de registro. Inténtalo de nuevo más tarde"
- ✅ Backend logs include consistent fields:
  - retryable: true
  - auth_action: "login" | "register"
  - request_id: (present in all)
  - retry_after: (present in all)

Backend Log Example (Expected):
{
  "timestamp": "2026-01-30T18:00:00Z",
  "level": "warn",
  "message": "Rate limit exceeded",
  "error": {
    "slug": "AUTH_RATE_LIMITED",
    "message": "Too many attempts"
  },
  "retryable": true,
  "auth_action": "login",
  "request_id": "req_abc123xyz",
  "rate_limit_key": "login:testuser@example.com",
  "retry_after": 60,
  "attempts": 6
}
```

---

## 🛡️ Security Verification

### Production Logs Check

```bash
# Verify NO debug logs in production
# Open DevTools Console on staging

Expected:
- ❌ NO fetch to http://127.0.0.1:7242/ingest/...
- ❌ NO "Register attempt started" messages
- ✅ Only generic messages: "Login succeeded", "Register failed: {errorSlug}"
```

### Network Tab Verification

```text
1. Open DevTools → Network tab
2. Submit login/register forms
3. Inspect request/response

Expected:
- ✅ Requests to /v2/auth/login, /v2/auth/register
- ✅ Responses are JSON structured (NOT text/plain)
- ✅ Error responses have: { error: { slug: "...", message: "..." } }
- ❌ NO debug fetch requests to localhost:7242
```

---

## 📊 Success Criteria

### Must Pass (Blocking):

- [ ] Backend restart completed
- [ ] Feature flags loaded (verified in logs)
- [ ] Login with incorrect credentials → UX correct message
- [ ] Register new account → Email sent + navigation works
- [ ] Password toggle buttons visible on both forms
- [ ] No "Load failed" errors
- [ ] No HTTP 500 errors
- [ ] No debug logs in production console
- [ ] Rate limiting: 5+ failed login attempts → AUTH_RATE_LIMITED
- [ ] Rate limiting: Backend logs include retryable=true + auth_action + request_id

### Should Pass (Important):

- [ ] Password validation real-time feedback working
- [ ] Confirm password validation reactive
- [ ] Email validation working
- [ ] Terms checkbox validation working
- [ ] Theme support (light/dark/system)
- [ ] All error messages are UX-friendly (no technical details)
- [ ] Anti-enumeration maintained (generic register errors)
- [ ] Rate limiting: Per-user strategy confirmed (User A blocked, User B allowed)
- [ ] Rate limiting: retry_after field present in backend logs
- [ ] Rate limiting: Success after wait period

### Nice to Have:

- [ ] Amplitude events firing correctly
- [ ] Tokens stored securely
- [ ] Navigation smooth (no flicker)
- [ ] UI responsive (mobile/tablet/desktop)

---

## 🚨 Troubleshooting

### If Login Still Shows "Load failed":

1. **Check backend logs for:**
   - Feature flags loaded confirmation
   - No "AUTH_DISABLED" errors
   
2. **Check Network tab:**
   - Response should be JSON (not text/plain)
   - Status should be 401 (not 500)
   - Response has `error.slug`

3. **If still failing:**
   - Backend may not have restarted
   - Feature flags may not have loaded
   - Check: `railway logs | grep "admin-controlled"`

### If Register Still Fails:

1. **Check Resend dashboard:**
   - API key valid
   - Email domain verified
   - No rate limits

2. **Check backend logs:**
   - No errors in register endpoint
   - Email service working
   - Supabase connection OK

3. **Check frontend console:**
   - errorSlug extracted correctly
   - apiClient returning structured error

---

## 📝 Post-Validation Actions

### If All Tests Pass:

1. **Update ROA-532 issue:**
   ```bash
   gh issue comment 532 --body "✅ Rev3/x validation: All tests passing in staging
   
   - Login: UX correct errors ✅
   - Register: Email + navigation ✅
   - Password toggle: Visible ✅
   - Security: No debug logs in prod ✅
   
   Status: Ready for next QA round"
   ```

2. **Create cleanup PR:**
   ```bash
   git checkout -b chore/ROA-532-remove-debug-logs
   # Remove #region agent log blocks from:
   # - apps/backend-v2/src/routes/auth.ts
   # - frontend/src/pages/auth/login-v2.tsx
   # - frontend/src/components/auth/register-form.tsx
   # - frontend/src/lib/api/client.js
   git commit -m "chore(ROA-532): Remove debug instrumentation after verification"
   gh pr create
   ```

3. **Document findings:**
   - Update `docs/qa/auth-v2-qa-fixes-rev3.md` with validation results
   - Add screenshots if needed
   - Note any edge cases discovered

### If Tests Fail:

1. **Capture evidence:**
   - Backend logs (full error stack)
   - Network tab (request/response JSON)
   - Console errors (screenshot)
   - UI screenshots showing errors

2. **Analyze logs:**
   - Check if debug instrumentation captured the failure
   - If not, add more specific logs
   - Generate new hypotheses

3. **Create follow-up issue:**
   ```bash
   gh issue create --title "ROA-532 Rev3 - [Specific failure]" \
     --body "Validation failed in staging. Evidence: ..." \
     --label "qa:failed-validation,priority:P1"
   ```

4. **DO NOT close ROA-532** until all validations pass

---

## 🔗 Referencias

- **PR:** [#1308](https://github.com/Eibon7/roastr-ai/pull/1308)
- **Issue:** [ROA-532](https://linear.app/roastrai/issue/ROA-532/manual-testing)
- **Debug Summary:** `docs/qa/ROA-532-DEBUG-SESSION-SUMMARY.md`
- **Final Status:** `docs/qa/ROA-532-FINAL-STATUS.md`
- **QA Checklist:** `docs/qa/auth-v2-qa-fixes-rev3.md`

---

**Preparado por:** Debug Mode Agent
**Última actualización:** 2026-01-30 17:53 UTC
**Estado:** ✅ Ready for validation
