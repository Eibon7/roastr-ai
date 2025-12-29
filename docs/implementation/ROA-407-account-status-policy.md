# ROA-407: Account Status Policy Implementation

**Issue:** [ROA-407](https://linear.app/roastrai/issue/ROA-407/a3-auth-policy-wiring-v2)  
**Date:** 2025-12-29  
**Status:** ✅ Implemented

---

## 🎯 Objective

Implement a **complete, production-ready Account Status policy** in the AuthPolicyGate that:
- Consumes existing account/user state (`active`, `suspended`)
- Does NOT introduce new rules or change semantics
- Maps directly to the A3 policy contract
- Fails closed if account status cannot be verified
- Has ZERO TODOs or placeholders

---

## ✅ Implementation

### Account Status Policy Logic

**Location:** `apps/backend-v2/src/auth/authPolicyGate.ts` → `checkAccountStatus()`

**Data Source:** `users` table in Supabase (service role)

**Fields Consumed:**
- `active` (BOOLEAN) - Must be `true` for auth to proceed
- `suspended` (BOOLEAN) - Must be `false` for auth to proceed
- `suspended_reason` (TEXT) - Reason for suspension (shown to user)

**Policy Rules:**

1. **Skip for register action** - No user exists yet
2. **Query user by userId OR email** - Flexible lookup
3. **Fail-closed if query fails** - Cannot verify = block
4. **Allow if user not found** - Let auth service handle (not a policy concern)
5. **Block if suspended = true** - Non-retryable, show reason
6. **Block if active = false** - Non-retryable
7. **Allow if both checks pass** - Account status is good

**Fail Semantics:**
- **Database error** → `allowed: false`, `retryable: true`
- **Exception during check** → `allowed: false`, `retryable: true`
- **Suspended account** → `allowed: false`, `retryable: false`
- **Inactive account** → `allowed: false`, `retryable: false`

---

## 📊 Test Coverage

**Location:** `apps/backend-v2/tests/unit/auth/authPolicyGate.test.ts`

**Total Tests:** 25 (8 new Account Status tests)

**New Tests:**
1. ✅ Should skip account status check for register
2. ✅ Should allow login for active user
3. ✅ Should block login for suspended user
4. ✅ Should block login for inactive user
5. ✅ Should fail-closed if database query fails
6. ✅ Should fail-closed if account status check throws
7. ✅ Should allow if user is found by email (not userId)
8. ✅ Policy order enforcement: Account Status blocks before Rate Limit/Abuse

**Test Results:**
```
Test Files  1 passed (1)
Tests       25 passed (25)
```

---

## 🔑 Key Design Decisions

### 1. Read-Only, No New Rules

- Consumes existing `active` and `suspended` fields
- Does NOT add new account states (banned, locked, deleted)
- Does NOT change existing semantics
- Maps directly to what's in the database

### 2. Fail-Closed by Default

- Cannot verify account status → block
- Database error → block (retryable)
- Exception during check → block (retryable)

### 3. Suspended Reason Exposed

- If `suspended = true`, return `suspended_reason` to user
- Helps users understand why they're blocked
- No security risk (reason is informational, not sensitive)

### 4. Active = false Is Blocking

- `active = false` means account is deactivated
- Blocks auth even if not explicitly suspended
- Retryable = false (user must reactivate account)

---

## 🚫 What Was NOT Implemented

- ❌ New account states (banned, locked, deleted)
- ❌ Subscription-based blocking (handled by other policies)
- ❌ Admin override logic
- ❌ Grace periods or temporary suspension
- ❌ UI or admin panel changes

---

## 📝 Code Changes

### Files Modified:

1. **`apps/backend-v2/src/auth/authPolicyGate.ts`**
   - Implemented complete `checkAccountStatus()` method
   - Added Supabase query for user account status
   - Fail-closed error handling
   - No TODOs or placeholders

2. **`apps/backend-v2/tests/unit/auth/authPolicyGate.test.ts`**
   - Added 8 new tests for Account Status policy
   - Mocked Supabase client for test isolation
   - Verified fail-closed behavior
   - Verified policy order enforcement

### No Breaking Changes:

- Existing tests still pass (25/25)
- No changes to public API
- No changes to existing policies (Feature Flags, Rate Limit, Abuse)
- No changes to auth routes or services

---

## ✅ Acceptance Criteria Met

- [x] Account Status policy implemented (not placeholder)
- [x] Consumes existing account state (active, suspended)
- [x] Does NOT introduce new rules
- [x] Does NOT change semantics
- [x] Maps directly to A3 policy contract
- [x] Fails closed if account status cannot be verified
- [x] Zero TODOs in policy code
- [x] Tests updated and passing (25/25)
- [x] No breaking changes

---

## 🚀 Next Steps

**FASE 5 — Pre-push:**
1. Validate all GDD scripts pass
2. Verify health score
3. Create commit with standard message

**FASE 6 — PR:**
1. Open PR with title: ROA-407: A3 Auth Policy Wiring v2
2. Include this summary in PR description
3. Generate agent receipts if applicable

---

**Status:** ✅ **Implementation Complete - Ready for Review**

