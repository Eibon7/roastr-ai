# Issue #698: Root Cause Analysis

## Current Status: 4/8 Tests Passing (50% → 50%)

**Progress:**
- ✅ **Test 2 FIXED**: "should handle validation errors" - NOW PASSING!
- ❌ Tests 1, 3, 4, 5 still failing (require further investigation)

---

## Fixed Issues

### ✅ Test 2: "should handle validation errors"

**Root Cause:** Empty string validation order

**Problem:**
```javascript
// Original (WRONG)
if (!text || typeof text !== 'string') {
    errors.push('Text is required and must be a string');  // Triggers for empty string!
} else if (text.trim().length === 0) {
    errors.push('Text cannot be empty');  // Never reached
}
```

When sending `text: ''` (empty string):
- Empty string is falsy in JavaScript
- `!text` evaluates to `true`
- First condition triggers, returning wrong message
- Second condition never runs

**Fix Applied (src/routes/roast.js:119-126):**
```javascript
// Fixed (CORRECT)
if (typeof text !== 'string') {
    errors.push('Text is required and must be a string');
} else if (!text || text.trim().length === 0) {  // Check empty AFTER type check
    errors.push('Text cannot be empty');
}
```

**Result:** ✅ Test now passes consistently

---

## Attempted Fixes

### ⚠️ Test 1,3: PerspectiveService Mock Issue

**Hypothesis:** `perspectiveService` was `null` because `ENABLE_PERSPECTIVE_API` flag was disabled in tests

**Fix Attempted (tests/integration/roast.test.js:78-79):**
```javascript
case 'ENABLE_PERSPECTIVE_API':
    return true; // Changed from false to enable PerspectiveService initialization
```

**Result:** Tests still failing with 500 errors

**Analysis:** While enabling the flag should help (allows perspectiveService to be instantiated with mocked methods), the 500 errors persist, indicating additional root causes.

---

## Remaining Failures - Root Cause Hypotheses

### ❌ Test 1: "should generate roast preview successfully" (500 error)

**Symptoms:**
- Expected: 200 OK
- Actual: 500 Internal Server Error
- Execution time: 1982ms (extremely slow - possible timeout/retry)

**Potential Root Causes:**

1. **Multiple Database Calls Not Mocked Properly**

   Preview endpoint makes MULTIPLE sequential database calls:
   ```javascript
   // Line 478: First call
   const analysisCheck = await checkAnalysisCredits(userId, userPlan.plan);
   // → Queries 'analysis_usage' table

   // Line 481: Second call
   const userPlan = await getUserPlanInfo(userId);
   // → Queries 'user_subscriptions' table

   // Line 482: Third call
   const roastCheck = await checkUserCredits(userId, userPlan.plan);
   // → Queries 'roast_usage' table

   // Line 485: Fourth call (INSERT)
   await recordAnalysisUsage(userId, metadata);
   // → Inserts into 'analysis_usage' table
   ```

   **Current Test Mock (lines 123-131):**
   ```javascript
   mockServiceClient.from = jest.fn((tableName) => {
       if (tableName === 'user_subscriptions') {
           return mockServiceClient._createBuilder({
               data: { plan: 'creator', status: 'active' },
               error: null
           });
       }
       // Returns null for analysis_usage and roast_usage!
       return mockServiceClient._createBuilder({ data: null, error: null });
   });
   ```

   **Issue:** Only `user_subscriptions` is mocked. Other tables return `null`, which may cause unexpected behavior.

2. **`.single()` Query Pattern Issue**

   Both `checkAnalysisCredits` and `checkUserCredits` use:
   ```javascript
   const { data: usage, error } = await supabaseServiceClient
       .from('analysis_usage')  // or 'roast_usage'
       .select('count')
       .eq('user_id', userId)
       .gte('created_at', startOfMonth.toISOString())
       .single();  // Expects EXACTLY one row
   ```

   **Problem:** `.single()` fails if:
   - Zero rows match the filter (no usage records)
   - Multiple rows match the filter (multiple usage events)

   These are usage tracking tables with multiple rows per user. Using `.single()` is likely incorrect.

   **Current Handling:**
   ```javascript
   const currentUsage = usage?.count || 0;  // Falls back to 0
   ```

   This falls back gracefully, so shouldn't cause 500 error. But if `.single()` throws instead of returning `{error}`, it could propagate.

3. **modelAvailabilityService Dependency**

   Line 559 in preview endpoint:
   ```javascript
   const selectedModel = await getModelForPlan(userPlan.plan);
   ```

   This requires `modelAvailabilityService` (lines 284-288). Has try-catch with fallback, but might be throwing before reaching it.

4. **Module Loading Order Issue**

   - Route module loads ONCE when `require('../../src/index')` runs (test line 24)
   - At load time, services are initialized (perspectiveService, roastGenerator, etc.)
   - Individual tests modify mocks AFTER module is loaded
   - Some module-level state might not be mockable post-load

**Recommended Investigation Steps:**
1. Add console.log to see actual error response body
2. Check if modelAvailabilityService can be initialized in test environment
3. Mock ALL three tables (user_subscriptions, analysis_usage, roast_usage) properly
4. Consider if `.single()` usage is correct for usage tracking tables

---

### ❌ Test 3: "should reject high toxicity content" (500 error)

**Symptoms:**
- Expected: 400 Bad Request (toxicity rejection)
- Actual: 500 Internal Server Error

**Potential Root Causes:**

Same as Test 1, plus:

1. **PerspectiveService Mock Not Being Used**

   Test sets up mock (lines 199-204):
   ```javascript
   PerspectiveService.prototype.analyzeText = jest.fn().mockResolvedValue({
       toxicity: 0.8,  // High toxicity
       safe: false,
       categories: ['toxicity', 'insult']
   });
   ```

   But if `analyzeContent()` hits an error path before calling `perspectiveService.analyzeText()`, the mock never runs and defaults are returned instead.

2. **Error Handling Path Not Returning 400**

   If toxicity check fails (throws error), it might hit the catch block at line 585:
   ```javascript
   } catch (error) {
       logger.error('Enhanced roast preview generation failed', ...);
       res.status(500).json({...});  // Returns 500, not 400
   }
   ```

   The 400 response is only returned if the code successfully analyzes content, determines it's unsafe, and returns at line 500-509. If anything throws before that, it's a 500.

**Recommended Fix:**
- Ensure all database calls are mocked properly (same as Test 1)
- Verify perspectiveService.analyzeText is being called with enabled flag
- Add defensive checks to prevent errors before toxicity check

---

### ❌ Test 4: "should generate roast and consume credits" (402 error)

**Symptoms:**
- Expected: 200 OK with roast + credit consumption
- Actual: 402 Payment Required (Insufficient credits)

**Root Cause:**

Test mocks database calls (lines 231-244):
```javascript
let callCount = 0;
mockServiceClient.from = jest.fn((tableName) => {
    callCount++;

    // First call: user_subscriptions lookup
    if (callCount === 1 && tableName === 'user_subscriptions') {
        return mockServiceClient._createBuilder({
            data: { plan: 'creator', status: 'active' },
            error: null
        });
    }

    // Second call: analysis_usage
    if (callCount === 2 && tableName === 'analysis_usage') {
        return mockServiceClient._createBuilder({
            data: { count: 5 },  // Low usage
            error: null
        });
    }

    // Default
    return mockServiceClient._createBuilder({ data: null, error: null });
});
```

**Problem:** The `/generate` endpoint doesn't just query tables - it calls `consumeRoastCredits()` (line 686):

```javascript
const creditResult = await consumeRoastCredits(userId, userPlan.plan, usageMetadata);
```

This function (lines 353-359) calls a **Postgres RPC function**:
```javascript
const { data: result, error } = await supabaseServiceClient
    .rpc('consume_roast_credits', {
        p_user_id: userId,
        p_plan: plan,
        p_monthly_limit: monthlyLimit,
        p_metadata: metadata
    });
```

**Issue:** The test doesn't mock `.rpc()` calls! Only `.from()` is mocked.

When `consumeRoastCredits` fails (because RPC isn't mocked), it returns (line 370-378):
```javascript
return {
    success: false,
    hasCredits: false,
    remaining: 0,
    limit: 50,
    used: 0,
    unlimited: false,
    error: error.message
};
```

Then the endpoint returns 402 (line 690-699).

**Recommended Fix:**
```javascript
// Add to test setup
mockServiceClient.rpc = jest.fn().mockResolvedValue({
    data: {
        success: true,
        hasCredits: true,
        remaining: 45,
        limit: 50,
        used: 5
    },
    error: null
});
```

---

### ❌ Test 5: "should return user credit status" (wrong data)

**Symptoms:**
- Expected: `{ plan: 'creator', used: 15 }`
- Actual: `{ plan: 'free', used: 0 }`

**Root Cause:**

Same as Test 4 - mock data not being used. The test sets up sequential mocks (lines 350-371):

```javascript
let callCount = 0;
mockServiceClient.from = jest.fn((tableName) => {
    callCount++;

    // First call: user_subscriptions
    if (callCount === 1 && tableName === 'user_subscriptions') {
        return mockServiceClient._createBuilder({
            data: { plan: 'creator', status: 'active' },
            error: null
        });
    }

    // Second call: roast_usage
    if (callCount === 2 && tableName === 'roast_usage') {
        return mockServiceClient._createBuilder({
            data: { count: 15 },
            error: null
        });
    }

    return mockServiceClient._createBuilder({ data: null, error: null });
});
```

But the endpoint returns defaults (`plan: 'free', used: 0`), suggesting the mocks aren't being applied.

**Possible Issues:**

1. **Module Caching:** The `supabaseServiceClient` reference in roast.js was captured at module load time. Even though the test mutates `mockServiceClient.from`, the route might have a stale reference.

   However, #680 specifically addressed this with the "mutate methods, don't replace objects" pattern (from commit message). So this should work.

2. **Call Order Mismatch:** The `callCount` assumes calls happen in a specific order:
   - Call 1: user_subscriptions
   - Call 2: roast_usage

   But what if there are additional calls we're not aware of? Or calls happen in a different order?

   `/credits` endpoint (line 789-822) calls:
   ```javascript
   const userPlan = await getUserPlanInfo(userId);        // Call 1: user_subscriptions ✓
   const creditCheck = await checkUserCredits(userId, userPlan.plan);  // Call 2: roast_usage ✓
   ```

   This matches the expected order. But maybe `getUserPlanInfo` makes multiple calls?

3. **Authentication Middleware:** Before the endpoint runs, `authenticateToken` middleware runs. Does it query the database? If so, it would throw off the `callCount`.

**Recommended Investigation:**
- Add logging to see what order `.from()` is called with what table names
- Check if `authenticateToken` middleware makes database calls
- Verify `getUserPlanInfo` only makes one call to `user_subscriptions`

---

## Summary of Findings

### What Works ✅
- Test mocking infrastructure (Jest, supertest, mocks)
- Basic request/response cycle
- Error handling tests (no database dependencies)
- Validation logic (after fix)

### What Doesn't Work ❌
- Multiple sequential database mocks with precise call counting
- RPC function mocking (`.rpc()` not set up)
- Complex endpoint flows with 3-4 database interactions

### Key Insights

1. **Mock Isolation Works**: Tests fail consistently (not intermittently), proving mock isolation from #680 is functional

2. **Production Code Complexity**: Preview/generate endpoints have complex flows:
   - Multiple database queries (3-4 per request)
   - RPC calls (stored procedures)
   - External service dependencies (perspectiveService, modelAvailabilityService)

3. **Test Setup Incomplete**: Tests mock some database calls but not all:
   - ✅ Mocked: `.from(tableName)` for specific tables
   - ❌ Not mocked: `.rpc()` calls
   - ❌ Partially mocked: Only 1-2 tables out of 3-4 needed

4. **`.single()` Usage Questionable**: Using `.single()` on usage tracking tables (which have multiple rows per user) seems architecturally wrong. Should probably use aggregation or remove `.single()`.

---

## Recommended Next Steps

### Immediate (To Fix Remaining Tests)

1. **Mock ALL Database Interactions:**
   ```javascript
   mockServiceClient.from = jest.fn((tableName) => {
       if (tableName === 'user_subscriptions') {
           return createBuilder({ data: { plan: 'creator', status: 'active' }, error: null });
       }
       if (tableName === 'analysis_usage') {
           return createBuilder({ data: { count: 5 }, error: null });  // Low usage
       }
       if (tableName === 'roast_usage') {
           return createBuilder({ data: { count: 10 }, error: null });  // Some usage
       }
       return createBuilder({ data: null, error: null });  // Default for unknown tables
   });

   // Add RPC mock
   mockServiceClient.rpc = jest.fn((functionName, params) => {
       if (functionName === 'consume_roast_credits') {
           return Promise.resolve({
               data: {
                   success: true,
                   hasCredits: true,
                   remaining: 40,
                   limit: 50,
                   used: 10
               },
               error: null
           });
       }
       return Promise.resolve({ data: null, error: { message: 'RPC not mocked' } });
   });
   ```

2. **Add Actual Error Logging in Tests:**
   ```javascript
   const response = await request(app).post('/api/roast/preview')...;

   if (response.status !== 200) {
       console.error('Test failed with response:', JSON.stringify(response.body, null, 2));
   }

   expect(response.status).toBe(200);
   ```

3. **Simplify Call Count Logic:**

   Instead of using `callCount` which is fragile, use table-name-based mocking (as shown in step 1). This is more robust and doesn't depend on call order.

### Medium-Term (Architecture Improvements)

1. **Fix `.single()` Usage:**

   Usage tracking tables should either:
   - Use SUM/COUNT aggregation instead of `.single()`
   - Have a separate aggregation table with one row per user per month

   Current pattern will fail in production with multiple usage records.

2. **Add Integration Tests with Real Database:**

   Consider using Supabase local instance or test database for true integration tests, rather than mocking everything.

3. **Simplify Endpoint Dependencies:**

   Preview endpoint has too many dependencies:
   - 3-4 database queries
   - 2 external services
   - Complex credit checking logic

   Consider refactoring into smaller, testable units.

### Long-Term (Testing Strategy)

1. **Create Test Factories:**

   Instead of ad-hoc mocks in each test, create reusable factories:
   ```javascript
   const mockDatabaseForUser = (userId, plan, roastUsage, analysisUsage) => {
       // Returns properly configured mockServiceClient
   };
   ```

2. **Use Test Database:**

   Run integration tests against actual Supabase test instance with seeded data.

3. **Add Contract Tests:**

   Verify mock behavior matches real Supabase responses.

---

## Conclusion

**Progress:** 1 test fixed (Test 2) ✅

**Remaining Work:** 4 tests require:
- Complete database mock setup (all tables + RPC)
- Possible architecture fixes (`.single()` usage)
- Better error visibility (logging actual responses)

**Time Estimate:** 3-4 hours to fix remaining tests + validate

**Blocker Risk:** Medium - Tests are consistently failing, indicating systematic issues rather than flaky tests. Root causes are understood, but fixes require careful coordination of multiple mocks.
