# Module-Level Mocking Attempt - Issue #698

**Date:** 2025-11-03
**Status:** ❌ Failed - Reverted
**Decision:** Proceed with Option 1 (Real Test Database)

---

## What We Tried

Attempted to fix the 4 failing roast integration tests by mocking Supabase at module load time using `jest.mock()` BEFORE the app loads.

### Implementation

```javascript
// CRITICAL: Mock supabase config BEFORE app loads - Issue #698
let mockSupabaseClient;
jest.mock('../../src/config/supabase', () => {
    // Jest requires all imports to be inside the factory to avoid reference errors
    const { createRoastSupabaseMock } = require('../helpers/roastMockFactory');

    // Create a default mock that will be used by routes when they load
    mockSupabaseClient = createRoastSupabaseMock({
        userSubscriptions: [],
        roastUsage: [],
        analysisUsage: []
    });

    return {
        supabaseServiceClient: mockSupabaseClient,
        supabaseAnonClient: mockSupabaseClient
    };
});

// NOW load the app - it will use our mocked client
const { app } = require('../../src/index');
```

---

## Why It Failed

### Error 1: Jest Out-of-Scope Variable Reference
**Initial Problem:**
```
ReferenceError: The module factory of `jest.mock()` is not allowed to reference any out-of-scope variables.
Invalid variable access: createRoastSupabaseMock
```

**Fix Applied:** Moved `require()` inside the jest.mock() factory function (this worked).

### Error 2: All Tests Failing with 401 Unauthorized (Blocker)
**After fixing Error 1, all 8 tests failed:**
```
Expected status: 200/400/402
Actual status: 401 (Unauthorized)
```

**Root Cause:** The module-level mock only provides database methods (`.from()`, `.select()`, `.eq()`, `.single()`, `.insert()`) but **does not include authentication methods** that the auth middleware needs.

### The Catch-22

1. **Without module-level mock:**
   - Routes capture real `supabaseServiceClient` at module load time
   - Tests try to mock in `beforeEach()` - TOO LATE
   - Database calls fail because routes use real client
   - Result: 4 tests fail with 500 errors

2. **With module-level mock (database methods only):**
   - Routes get mocked client with database methods
   - Auth middleware can't find authentication methods on mock
   - All requests fail authentication
   - Result: 8 tests fail with 401 errors (WORSE!)

### Why Adding Auth Methods Doesn't Work

To make this work, we would need to:

1. **Mock all Supabase auth methods:**
   - `.auth.getUser()`
   - `.auth.getSession()`
   - `.auth.signInWithPassword()`
   - `.auth.signOut()`
   - ... and many more

2. **Replicate Supabase's complex JWT logic:**
   - Token validation
   - Session management
   - User context handling
   - Permissions and RLS

3. **Maintain mock in sync with Supabase SDK updates:**
   - Every Supabase SDK update could break our mock
   - Significant ongoing maintenance burden

**Conclusion:** This approach creates a mock so complex that it's essentially reimplementing Supabase's client library - clearly not viable.

---

## Lessons Learned

### 1. Module Loading Order Matters
- Routes import `supabaseServiceClient` at module load time
- This creates an immutable reference to the original export
- Mocking in `beforeEach()` doesn't affect this reference

### 2. Integration Tests Need Real Integrations
- Integration tests are meant to test how components work together
- Mocking everything defeats the purpose of integration testing
- Real database = real confidence in integration behavior

### 3. Mock Complexity Indicates Wrong Approach
- If a mock requires 100+ lines and complex logic, it's a red flag
- The mock becomes harder to maintain than the production code it's testing
- This is a signal to use real dependencies instead

### 4. Jest Mock Factory Limitations
- Can't reference out-of-scope variables
- Must require dependencies inside factory function
- This makes dynamic mock configuration more difficult

---

## Why Option 1 (Real Test Database) Is Better

### Pros of Real Database:
1. ✅ **Complete API Surface:** All Supabase methods work (database + auth)
2. ✅ **No Maintenance:** No need to update mocks when Supabase SDK changes
3. ✅ **Real Behavior:** Tests actual integration, not mocked approximation
4. ✅ **Simpler Tests:** No complex mock setup, just seed data
5. ✅ **Industry Standard:** Most integration tests use real databases

### Cons of Real Database:
1. ⚠️ **Setup Required:** Need Supabase test project + credentials
2. ⚠️ **CI Configuration:** Need test database in CI environment
3. ⚠️ **Slower Tests:** Database calls slower than mocks (still <10s acceptable)

### Decision:
**Proceed with Option 1 - Real Supabase Test Database**

The one-time setup cost is far lower than the ongoing maintenance cost of a comprehensive mock.

---

## Next Steps

1. ✅ Revert module-level mocking changes
2. ⏳ Set up Supabase test database
3. ⏳ Configure test environment variables
4. ⏳ Update test configuration
5. ⏳ Verify all 8 tests pass

---

## Related Documentation

- Issue #698: https://github.com/roastr-ai/roastr/issues/698
- Implementation Plan: `docs/plan/issue-698.md`
- Root Cause Analysis: `docs/test-evidence/issue-698/ROOT-CAUSES.md`
- Mock Factory: `tests/helpers/roastMockFactory.js`

---

**Conclusion:** This attempt validated the original investigation's recommendation. Real test database is the right solution for integration tests.
