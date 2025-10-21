# Test-Fixing Session #10 - "Cannot read '0'" Error Analysis (IN PROGRESS)

**Date:** 2025-10-21
**Branch:** test/stabilization-infrastructure
**Issue:** #618 - Jest Compatibility Fixes
**Status:** ⏸️ PAUSED - Complex route mocking required

---

## 🎯 Objective

Fix "Cannot read properties of undefined (reading '0')" errors (12 occurrences) - highest priority remaining error pattern.

---

## 🔧 Problem Analysis

**Error:** `TypeError: Cannot read properties of undefined (reading '0')`
**Frequency:** 12 occurrences
**Pattern:** Tests accessing array[0] or mock.calls[0] without validation

### Root Causes Identified

**1. Mock Call Tracking Mismatch** (roastr-persona.test.js)
- Tests check `.update.mock.calls[0][0]`
- Route refactored to use `.rpc('update_roastr_persona_transactional', ...)`
- Result: `.update()` never called → `.mock.calls[0]` undefined

**2. Missing Feature Flags** (roastr-persona.test.js)
- Route code wrapped in `if (flags.isEnabled('ENABLE_SUPABASE'))`
- Test didn't mock feature flags
- Result: Route logic skipped, mocks never called

**3. Missing Service Mocks** (roastr-persona.test.js)
- Route requires: PersonaInputSanitizer, SafeUtils, EmbeddingsService, rate limiters
- Test only mocked: Supabase, logger, auth
- Result: Route execution fails with 500 error

---

## ✅ Fixes Applied (Partial)

### 1. Added RPC Mock to Supabase Client

**File:** `tests/unit/routes/roastr-persona.test.js`

```javascript
// BEFORE (line 21-28):
const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),  // ← Route doesn't use this
    insert: jest.fn()
};

// AFTER (Issue #618):
const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn(),
    rpc: jest.fn().mockResolvedValue({  // ← Added for transactional updates
        data: {
            success: true,
            updated_fields: {
                lo_que_me_define_encrypted: null,
                lo_que_no_tolero_encrypted: null,
                lo_que_me_da_igual_encrypted: null
            }
        },
        error: null
    })
};
```

### 2. Updated Test Assertions

**File:** `tests/unit/routes/roastr-persona.test.js` (lines 249, 264, 282)

```javascript
// BEFORE (WRONG):
const updateCall = mockSupabaseServiceClient.update.mock.calls[0][0];
expect(updateCall.lo_que_me_define_encrypted).toBe(null);

// AFTER (CORRECT):
// Issue #618 - Check rpc call instead of update (route uses .rpc() transactional update)
const rpcCall = mockSupabaseServiceClient.rpc.mock.calls[0];
expect(rpcCall).toBeDefined();
const updateData = rpcCall[1].p_update_data;
expect(updateData.lo_que_me_define_encrypted).toBe(null);
```

**Lines fixed:** 3 test cases (249, 264, 282)

### 3. Added Feature Flags Mock

**File:** `tests/unit/routes/roastr-persona.test.js` (after line 54)

```javascript
// Issue #618 - Mock feature flags to enable ENABLE_SUPABASE
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn((flag) => flag === 'ENABLE_SUPABASE')
    }
}));
```

---

## ⚠️ Current Blocker

**Status:** Tests return 500 error instead of 200
**Cause:** Missing service mocks cause route execution to fail

**Route Dependencies (src/routes/user.js):**
```javascript
const { logger, SafeUtils } = require('../utils/logger');
const encryptionService = require('../services/encryptionService');
const EmbeddingsService = require('../services/embeddingsService');
const PersonaInputSanitizer = require('../services/personaInputSanitizer');
const transparencyService = require('../services/transparencyService');
// + rate limiters
```

**Missing Mocks in Test:**
- `PersonaInputSanitizer.sanitizePersonaInput()` → used at route lines 1948, 1984, 2020
- `SafeUtils.safeUserIdPrefix()` → used for logging
- `EmbeddingsService` → called via `generateEmbeddingsForPersona()` at line 2232
- Rate limiter middlewares → `roastrPersonaWriteLimiter`

---

## 📊 Impact Assessment

**Progress:**
- ✅ Fixed mock configuration (added .rpc())
- ✅ Fixed test assertions (check .rpc.mock.calls)
- ✅ Fixed feature flag gating (enabled ENABLE_SUPABASE)
- ⏸️ **BLOCKED:** Need extensive service mocking

**Complexity Level:** 🔴 HIGH
- Route has 14+ dependencies (see user.js imports)
- Transactional RPC pattern (not simple CRUD)
- Encryption, sanitization, embeddings, rate limiting layers

**Recommendation:**
1. **Option A:** Complete all service mocks (time-intensive, affects only this test file)
2. **Option B:** Move to simpler error patterns first, return to roastr-persona later
3. **Option C:** Mark roastr-persona tests as `.skip` temporarily, revisit after other fixes

---

## 🎓 Lessons Learned

### Mock Interface Must Match Implementation

**CRITICAL PATTERN:**
```javascript
// Route code (production):
const { data, error } = await userClient.rpc('update_roastr_persona_transactional', {...});

// Test mock (MUST MATCH):
rpc: jest.fn().mockResolvedValue({
    data: { success: true, updated_fields: {...} },
    error: null
})
```

### Feature Flag Mocking

When routes use feature flags, tests MUST mock them:

```javascript
// Route gating:
if (flags.isEnabled('ENABLE_SUPABASE')) {
    // ...Supabase logic
}

// Test mock requirement:
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn((flag) => flag === 'ENABLE_SUPABASE')
    }
}));
```

### Route Complexity = Test Complexity

Routes with many dependencies require proportional test setup:
- 14 imports = 14 potential mocks
- Transactional patterns = complex mock return values
- Middleware layers = additional mocking surface

**Mitigation:** Consider integration tests vs unit tests for complex routes.

---

## 🔄 Next Steps

**Decision Point:**

Given Session #10 time investment and roastr-persona complexity, recommend:

1. **Pause roastr-persona fixes** (document current state)
2. **Move to simpler "Cannot read '0'" instances:**
   - style-profile.test.js line 212 (array access)
   - shield tests (API response structure)
3. **Return to roastr-persona after** simpler patterns are fixed and pattern established

**Rationale:**
- Systematic approach: simple → complex
- Learn patterns from easier fixes
- May discover shared solutions
- Avoid overinvestment in single test file

---

**Status:** ⏸️ Session #10 PAUSED
**Files Modified:** 1 (tests/unit/routes/roastr-persona.test.js) - PARTIAL
**Errors Fixed:** 0 (blocked on service mocks)
**Method:** RPC mock pattern established, awaiting service mock completion
**Next Focus:** Simpler instances of same error pattern

