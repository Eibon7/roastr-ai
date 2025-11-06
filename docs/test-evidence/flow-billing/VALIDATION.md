# Flow Validation: Billing & Plan Limits Enforcement

**Related Issue:** #489
**Script:** `scripts/validate-flow-billing.js`
**Status:** ✅ Ready for Execution (Blocked by Supabase credentials)
**Date Created:** 2025-11-06
**Last Updated:** 2025-11-06 (Free → Starter Trial migration)

---

## 🎯 Validation Objective

Validate that plan limits are correctly enforced and users cannot exceed their monthly quotas.

---

## 🧪 Test Scenarios

### Scenario 1: Starter Trial Plan (10 roasts/month)
**Setup:**
- Create user with Starter Trial plan
- Set current usage to 10/10 (at limit)

**Test:**
- Attempt to generate 11th roast → should be BLOCKED

**Expected Result:**
✅ Request rejected with proper error
✅ Usage counter does not increment
✅ Error includes upgrade CTA

---

### Scenario 2: Pro Plan (1000 roasts/month)
**Setup:**
- Create user with Pro plan
- Set current usage to 5/1000 (well under limit)

**Test:**
- Generate roast → should SUCCEED

**Expected Result:**
✅ Roast generated successfully
✅ Usage counter increments atomically (+1)
✅ Check execution time < 1s

---

### Scenario 3: Plus Plan (5000 roasts/month)
**Setup:**
- Create user with Plus plan (creator_plus)
- Set current usage to 100/5000

**Test:**
- Generate roast → should SUCCEED

**Expected Result:**
✅ Roast generated successfully
✅ Usage counter increments correctly
✅ High limit allows power users

---

## ✅ Success Criteria

### Functional
1. ✅ **Limits Enforced** - All plan limits respected (10/1000/5000)
2. ✅ **Usage Tracked** - Counter increments correctly after each operation
3. ✅ **403 on Exceed** - Proper HTTP status (not 500) when limit hit
4. ✅ **Atomic Operations** - Usage increment in transaction
5. ✅ **Race Condition Safe** - Concurrent requests don't bypass limit

### Plan Features Matrix
| Plan | Price | Accounts | Analysis/Month | Roasts/Month | Shield |
|------|-------|----------|----------------|--------------|--------|
| Starter Trial | €0 (30 days) | 1 | 1,000 | 10 | ✅ |
| Starter | €5/mo | 1 | 1,000 | 10 | ✅ |
| Pro | €15/mo | 2 | 10,000 | 1,000 | ✅ |
| Plus | €50/mo | 2 | 100,000 | 5,000 | ✅ |

### Performance
1. ✅ **Fast Checks** - Usage validation < 50ms
2. ✅ **No N+1 Queries** - Usage fetched once per request
3. ✅ **Indexed** - `(organization_id, action_type, created_at)` indexed

---

## 📊 Technical Implementation

### Service: CostControlService
**File:** `src/services/costControl.js`

**Key Method:** `checkUsageLimit(organizationId)`
- Fetches current usage from `monthly_usage` table
- Compares against plan limit
- Returns: `{ canUse, currentUsage, limit, percentage, isNearLimit }`

### Database Tables
- `organizations` - Contains `plan_id`, `monthly_responses_limit`, `monthly_responses_used`
- `monthly_usage` - Tracks monthly usage per organization
- `user_activities` - Logs individual roast/analysis operations

---

## 🚫 Blockers

**Current Status:** ⚠️ **BLOCKED**

**Required Environment Variables:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci... (service_role key)
```

**Optional (for webhook testing):**
```bash
STRIPE_SECRET_KEY=sk_test_... (Stripe integration)
POLAR_API_KEY=polar_... (Polar integration)
```

**Action Required:**
User must provide Supabase credentials before execution.

---

## 🎬 Execution Instructions

### Prerequisites
1. Supabase project configured
2. Environment variables set
3. Database tables with plan limits

### Run Validation
```bash
# Execute billing validation
node scripts/validate-flow-billing.js

# Expected output:
# 🚀 Starting Billing Limits Enforcement Flow Validation
# ...
# 📊 VALIDATION REPORT
# Total tests: 3
# ✅ Passed: 3
# ❌ Failed: 0
# 🎉 ALL VALIDATIONS PASSED
```

### Expected Execution Time
- Total: ~5-8 seconds
- Per test: ~2-3 seconds
- Includes user creation, org setup, usage testing, and cleanup

---

## 📸 Evidence

**To be captured after execution:**
1. ✅ Terminal output showing all 3 tests passing
2. ✅ Database dump of `monthly_usage` table showing usage increments
3. ✅ SQL traces showing atomic operations
4. ✅ Screenshot of test execution

---

## 🔗 Related

- **Issue:** #489 (Flow Validation: Billing & Plan Limits Enforcement)
- **Issue:** #678 (Free → Starter Trial Migration - COMPLETED)
- **Service:** `src/services/costControl.js`
- **Service:** `src/services/entitlementsService.js`
- **Middleware:** `src/middleware/tierValidation.js`
- **Node:** docs/nodes/billing.md
- **Node:** docs/nodes/plan-features.md

---

## 🎉 Recent Changes

**2025-11-06: Free Plan Elimination**
- ✅ Replaced "Free" plan with "Starter Trial" (30-day free trial)
- ✅ Updated test scenarios to use `starter_trial` instead of `free`
- ✅ Updated documentation to reflect new plan structure
- ✅ All references to deprecated "Free" plan removed

**Migration Reference:** #678, Migration 025
