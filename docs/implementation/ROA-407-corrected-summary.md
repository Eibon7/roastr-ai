# ROA-407: A3 Auth Policy Wiring v2 - CORRECTED Implementation

**Issue:** ROA-407  
**Título:** A3-auth-policy-wiring-v2  
**Fecha:** 2025-12-29  
**Estado:** ✅ Implementation Complete (Corrected)

---

## 🎯 Real Objective of A3

Implement a **deterministic Auth Policy Gate (V2)** that decides whether an auth action is allowed **BEFORE** any auth business logic runs.

**Key Principle:**
- **Policies decide** (gate logic)
- **Auth executes** (business logic)
- **Policies are checked BEFORE auth runs**

---

## ✅ What Was Implemented

### 1. AuthPolicyGate (`apps/backend-v2/src/auth/authPolicyGate.ts`)

**Core component** that evaluates policies in order and returns first blocking result.

**Policy Evaluation Order (highest to lowest priority):**

1. **Feature Flags** - Check if action is enabled
   - `enable_user_registration` for register
   - `auth.login.enabled` for login
   - `auth.magic_link.enabled` for magic_link

2. **Rate Limiting** - Check if action is rate limited
   - Uses existing `rateLimitService`
   - Skips for logout and token_refresh (low risk)
   - Identifier: userId > email > IP

3. **Maintenance Mode** - Check if system is in maintenance
   - Blocks all actions except logout
   - Fail-open (allows if check fails)

**API:**
```typescript
interface AuthPolicyContext {
  action: AuthAction; // 'login' | 'register' | 'magic_link' | 'logout' | 'token_refresh' | 'password_recovery'
  ip?: string;
  email?: string;
  userId?: string | null;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

interface AuthPolicyResult {
  allowed: boolean;
  policy?: PolicyType; // 'feature_flag' | 'rate_limit' | 'maintenance' | 'account_status' | 'abuse'
  reason?: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  metadata?: Record<string, unknown>;
}

// Usage
const result = await checkAuthPolicy(context);
if (!result.allowed) {
  // Block action - return error to client
}
// Proceed with auth business logic
```

### 2. Integration with Auth Routes

**All auth endpoints now check policy gate BEFORE executing auth logic:**

#### POST `/api/v2/auth/login`
```typescript
// ✅ A3 POLICY GATE: Check policies BEFORE auth logic
const policyResult = await checkAuthPolicy({
  action: 'login',
  ip,
  email,
  userAgent
});

if (!policyResult.allowed) {
  // Block login - return error
  return sendAuthError(req, res, new AuthError(...));
}

// Policy gate passed - proceed with auth business logic
const session = await authService.login({ email, password, ip });
```

#### POST `/api/v2/auth/register`
```typescript
// ✅ A3 POLICY GATE: Check policies BEFORE auth logic
const policyResult = await checkAuthPolicy({
  action: 'register',
  ip,
  email: normalizedEmail,
  userAgent
});

if (!policyResult.allowed) {
  // Block register - return error
  return sendAuthError(req, res, new AuthError(...));
}

// Policy gate passed - proceed with auth business logic
await authService.register({ email, password });
```

#### POST `/api/v2/auth/magic-link`
```typescript
// ✅ A3 POLICY GATE: Check policies BEFORE auth logic
const policyResult = await checkAuthPolicy({
  action: 'magic_link',
  ip,
  email,
  userAgent
});

if (!policyResult.allowed) {
  // Block magic_link - return error
  return sendAuthError(req, res, new AuthError(...));
}

// Policy gate passed - proceed with auth business logic
const result = await authService.requestMagicLink({ email, ip });
```

---

## 🧪 Tests

### Unit Tests (`tests/unit/auth/authPolicyGate.test.ts`)

**Coverage:**
- Feature flag policy (6 tests)
- Rate limit policy (5 tests)
- Maintenance mode policy (4 tests)
- Policy order/priority (3 tests)

**Total:** 18 test cases

**Scenarios tested:**
- ✅ Allow when all policies pass
- ✅ Block by feature flag
- ✅ Block by rate limit
- ✅ Block by maintenance mode
- ✅ Policy evaluation order (feature flags → rate limit → maintenance)
- ✅ Fail-closed for feature flags
- ✅ Fail-open for maintenance mode
- ✅ Skip rate limit for logout/token_refresh
- ✅ Use IP as fallback for rate limiting

---

## 📐 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Request                           │
│               (POST /api/v2/auth/login)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Route Handler (routes/auth.ts)                 │
│                                                             │
│  1. Validate request (email, password format)               │
│                                                             │
│  2. ✅ A3 POLICY GATE                                       │
│     const result = await checkAuthPolicy({                 │
│       action: 'login',                                     │
│       ip, email, userAgent                                 │
│     });                                                    │
│                                                             │
│     if (!result.allowed) {                                 │
│       return sendAuthError(...);  // ❌ BLOCK              │
│     }                                                      │
│                                                             │
│  3. Auth Business Logic (authService)                      │
│     const session = await authService.login({              │
│       email, password, ip                                  │
│     });                                                    │
│                                                             │
│  4. Return session                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              AuthPolicyGate.check()                         │
│                                                             │
│  Policy 1: Feature Flags (highest priority)                 │
│    - Check: feature_flags.enable_user_registration         │
│    - Check: auth.login.enabled                             │
│    - Check: auth.magic_link.enabled                        │
│    - Fail: closed (block if check fails)                   │
│                                                             │
│  Policy 2: Rate Limiting                                    │
│    - Check: rateLimitService.recordAttempt()               │
│    - Skip: logout, token_refresh                           │
│    - Identifier: userId > email > IP                       │
│                                                             │
│  Policy 3: Maintenance Mode (lowest priority)               │
│    - Check: feature_flags.maintenance_mode                 │
│    - Allow: logout even in maintenance                     │
│    - Fail: open (allow if check fails)                     │
│                                                             │
│  Return: { allowed, policy, reason, retryable }            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Differences from Previous Implementation

### ❌ Previous (Incorrect)
- Focused on **audit logging** (secondary concern)
- No deterministic policy gate
- Policies mixed with business logic
- Feature flag checks scattered in routes

### ✅ Current (Correct)
- **Policy gate** is the core (A3 = Auth Policy Gate)
- Policies checked **BEFORE** auth logic runs
- Centralized policy evaluation
- Clean separation: policies decide, auth executes

---

## 📝 Files Modified/Created

### Created
1. `apps/backend-v2/src/auth/authPolicyGate.ts` - Policy gate implementation
2. `apps/backend-v2/tests/unit/auth/authPolicyGate.test.ts` - Policy gate tests

### Modified
1. `apps/backend-v2/src/routes/auth.ts` - Integrated policy gate in login, register, magic-link

### Kept (from previous implementation)
1. `apps/backend-v2/src/services/auditService.ts` - Audit logging (secondary, kept intact)

---

## 🎯 Acceptance Criteria

- [x] AuthPolicyGate implemented with deterministic policy evaluation
- [x] Policies checked BEFORE auth business logic
- [x] Feature flag policy implemented (highest priority)
- [x] Rate limit policy integrated (uses existing rateLimitService)
- [x] Maintenance mode policy implemented (lowest priority)
- [x] Policy gate integrated in login, register, magic-link endpoints
- [x] Unit tests for policy gate (18 test cases)
- [x] Clean separation: policies decide, auth executes
- [x] No breaking changes to existing API
- [x] AuditService kept intact (not removed)

---

## 🚀 Next Steps

1. **Code Review** - Review policy gate implementation
2. **Integration Tests** - Test full auth flows with policy blocking
3. **Documentation** - Update API docs with policy behavior
4. **Monitoring** - Add metrics for policy blocks
5. **Admin UI** - Create UI to view/manage policies

---

## 📚 References

- **Issue:** ROA-407 - A3 Auth Policy Wiring v2
- **Core File:** `apps/backend-v2/src/auth/authPolicyGate.ts`
- **Tests:** `apps/backend-v2/tests/unit/auth/authPolicyGate.test.ts`
- **Integration:** `apps/backend-v2/src/routes/auth.ts`

---

**Fecha de Completación:** 2025-12-29  
**Status:** ✅ Implementation Complete - Ready for Review

