---
name: Follow-up Issue - Plan Name Unification
about: Unify plan naming across codebase (starter_trial → starter)
title: "P1 - Unify Plan Naming Across Codebase (starter_trial → starter)"
labels: ["priority:P1", "area:billing", "area:backend", "type:refactor", "parent:1021"]
assignees: []
---

## 📋 Context

This is a follow-up issue to #1021 (P0 - Type Errors & Validation Issues).

During the resolution of #1021, we identified that **47 files** use inconsistent plan naming (`starter_trial` vs `starter`), which causes ~5-10 test failures due to type mismatches. The scope was too large to address in the original P0 issue, so it was deferred to this follow-up.

**Parent Issue:** #1021  
**Related Work:** Issue #1021 achieved 95% test fix rate, but type mismatches were deferred

---

## 🎯 Problem Statement

### Current State
The codebase uses multiple plan name variations:
- `starter_trial` (legacy name)
- `starter` (expected name)
- Similar issues may exist for other plan tiers

This inconsistency causes:
- ❌ Test failures (~5-10 tests)
- ❌ Potential production bugs (plan tier checks)
- ❌ Confusion for developers (which name to use?)
- ❌ Technical debt accumulation

### Impact
- **Files Affected:** 47 files across services, routes, config, workers
- **Test Failures:** ~5-10 tests checking plan values
- **Risk:** Medium (production plan logic changes required)

---

## 📊 Scope Analysis

### Files by Category

**Services (15 files):**
- `src/services/costControl.js`
- `src/services/authService.js`
- `src/services/billingInterface.js`
- `src/services/subscriptionService.js`
- `src/services/planService.js`
- `src/services/planValidation.js`
- `src/services/tierValidationService.js`
- `src/services/entitlementsService.js`
- `src/services/creditsService.js`
- `src/services/autoApprovalService.js`
- `src/services/styleProfileService.js`
- `src/services/roastEngine.js`
- `src/services/roastGeneratorEnhanced.js`
- `src/services/triageService.js`
- + 1 more

**Routes (10 files):**
- `src/routes/auth.js`
- `src/routes/billing.js`
- `src/routes/billingController.js`
- `src/routes/billingFactory.js`
- `src/routes/plan.js`
- `src/routes/admin.js`
- `src/routes/dashboard.js`
- `src/routes/analytics.js`
- `src/routes/user.js`
- + 1 more

**Config (8 files):**
- `src/config/planMappings.js`
- `src/config/tierConfig.js`
- `src/config/trialConfig.js`
- `src/config/tierMessages.js`
- `src/config/supabase.js`
- + 3 more

**Workers (1 file):**
- `src/workers/BillingWorker.js`

**Validators (1 file):**
- `src/validators/zod/billing.schema.js`

**Other (12 files):**
- Middleware, utils, CLI tools

---

## ✅ Acceptance Criteria

### Must Have (P0)
- [ ] **AC1:** All occurrences of `starter_trial` replaced with `starter` in source code
- [ ] **AC2:** Database migration created to update existing `starter_trial` records
- [ ] **AC3:** All tests updated to expect `starter` instead of `starter_trial`
- [ ] **AC4:** Tests passing (0 failures related to plan names)
- [ ] **AC5:** GDD nodes updated (cost-control, plan-features, multi-tenant)
- [ ] **AC6:** No production crashes or billing errors after deployment

### Should Have (P1)
- [ ] **AC7:** Similar inconsistencies fixed for other plan tiers (if any)
- [ ] **AC8:** Plan name constants centralized in single source of truth
- [ ] **AC9:** Type definitions added (JSDoc or TypeScript) for plan names
- [ ] **AC10:** Documentation updated with correct plan names

### Nice to Have (P2)
- [ ] **AC11:** CI check added to prevent future plan name inconsistencies
- [ ] **AC12:** Legacy `starter_trial` marked as deprecated with warnings

---

## 🔧 Proposed Solution

### Phase 1: Analysis & Planning (1 hour)
1. **Audit all 47 files** for plan name usage patterns
2. **Identify critical paths** (billing, subscriptions, auth)
3. **Check database** for existing `starter_trial` records
4. **Create migration strategy** (code + data)

### Phase 2: Code Refactor (4-6 hours)
1. **Create plan constants file** (single source of truth)
   ```javascript
   // src/config/planConstants.js
   module.exports = {
     PLANS: {
       FREE: 'free',
       STARTER: 'starter',  // Previously: 'starter_trial'
       PRO: 'pro',
       PLUS: 'plus'
     },
     // Legacy mapping for migration period
     LEGACY_PLANS: {
       'starter_trial': 'starter'
     }
   };
   ```

2. **Update services** (15 files)
   - Replace hardcoded strings with constants
   - Add legacy plan mapping where needed

3. **Update routes** (10 files)
   - Replace plan name checks
   - Update validation schemas

4. **Update config files** (8 files)
   - `planMappings.js` - Primary target
   - `tierConfig.js` - Plan tier definitions
   - `trialConfig.js` - Trial logic

5. **Update workers & validators** (2 files)

### Phase 3: Database Migration (2 hours)
```sql
-- database/migrations/XXXX_unify_plan_names.sql

-- Update user_subscriptions table
UPDATE user_subscriptions 
SET plan = 'starter' 
WHERE plan = 'starter_trial';

-- Update any other tables with plan references
UPDATE organizations 
SET plan = 'starter' 
WHERE plan = 'starter_trial';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan 
ON user_subscriptions(plan);
```

### Phase 4: Tests (2 hours)
1. **Update test expectations** (search for `starter_trial` in tests/)
2. **Run full test suite** (`npm test`)
3. **Verify coverage maintained** (`npm run test:coverage`)

### Phase 5: GDD & Documentation (1 hour)
1. **Update GDD nodes:**
   - `docs/nodes/cost-control.md`
   - `docs/nodes/plan-features.md`
   - `docs/nodes/multi-tenant.md`
2. **Update spec.md** (post-merge sync)
3. **Create test evidence** (`docs/test-evidence/issue-XXXX/`)

---

## 🚨 Risks & Mitigation

### Risk 1: Production Data Corruption
**Risk:** Database migration fails or corrupts data  
**Probability:** Low  
**Impact:** CRITICAL  
**Mitigation:**
- ✅ Test migration on staging DB first
- ✅ Create DB backup before migration
- ✅ Add rollback script
- ✅ Monitor Sentry for billing errors post-deploy

### Risk 2: Billing Logic Breaks
**Risk:** Plan checks fail after rename, causing billing issues  
**Probability:** Medium  
**Impact:** HIGH  
**Mitigation:**
- ✅ Add legacy plan mapping during transition
- ✅ Comprehensive test coverage (>=90%)
- ✅ Manual testing of billing flows
- ✅ Gradual rollout (staging → production)

### Risk 3: Tests Still Failing
**Risk:** Some tests hardcode `starter_trial` and we miss them  
**Probability:** Low  
**Impact:** MEDIUM  
**Mitigation:**
- ✅ Global search: `grep -r "starter_trial" tests/`
- ✅ Run full test suite multiple times
- ✅ CI must pass before merge

---

## 📋 Implementation Checklist

### Pre-Implementation
- [ ] Read `docs/patterns/coderabbit-lessons.md`
- [ ] Activate GDD (cost-control, plan-features, multi-tenant)
- [ ] Create worktree: `git worktree add ../issue-XXXX feature/issue-XXXX`
- [ ] Create plan: `docs/plan/issue-XXXX.md`

### Implementation
- [ ] **Phase 1:** Analysis complete (audit.md created)
- [ ] **Phase 2:** Code refactor (47 files updated)
- [ ] **Phase 3:** Database migration (SQL tested on staging)
- [ ] **Phase 4:** Tests passing (0 failures)
- [ ] **Phase 5:** GDD & docs updated

### Validation
- [ ] Tests: `npm test` (100% passing)
- [ ] Coverage: `npm run test:coverage` (>=90%)
- [ ] GDD: `node scripts/validate-gdd-runtime.js --full`
- [ ] Health: `node scripts/score-gdd-health.js --ci` (>=87)
- [ ] Linter: No errors
- [ ] Manual testing: Billing flows work

### Pre-Merge
- [ ] CodeRabbit: 0 comments
- [ ] CI/CD: All checks passing
- [ ] Receipts: Generated for all agents
- [ ] Migration: Tested on staging
- [ ] Rollback plan: Documented

---

## 📊 Effort Estimate

| Phase | Effort | Notes |
|-------|--------|-------|
| Analysis | 1 hour | Audit files, plan strategy |
| Code Refactor | 4-6 hours | 47 files, careful testing |
| DB Migration | 2 hours | Write + test on staging |
| Tests | 2 hours | Update + verify |
| GDD & Docs | 1 hour | Update nodes, evidence |
| **Total** | **10-12 hours** | **~2 days focused work** |

**Complexity:** HIGH (production logic changes)  
**Risk:** MEDIUM (requires careful testing)  
**Priority:** P1 (not blocking, but important)

---

## 🔗 Related Issues & PRs

- **Parent Issue:** #1021 (P0 - Type Errors & Validation Issues)
- **Related:** Any billing or plan-related issues
- **GDD Nodes:** cost-control, plan-features, multi-tenant

---

## 💡 Additional Notes

### Why This Matters
- **Technical Debt:** Inconsistent naming increases cognitive load
- **Test Reliability:** ~5-10 tests currently failing due to this
- **Production Risk:** Potential for billing logic bugs
- **Developer Experience:** Unclear which plan name to use

### Alternative Approaches Considered
1. **Keep both names:** Too confusing, increases debt
2. **Use TypeScript enums:** Good long-term, but requires TS migration first
3. **Gradual migration:** Too slow, prefer atomic change

### Success Criteria
- ✅ All tests passing (0 failures)
- ✅ No production billing errors
- ✅ Single source of truth for plan names
- ✅ GDD health maintained (>=87)

---

**Labels:** `priority:P1`, `area:billing`, `area:backend`, `type:refactor`, `parent:1021`  
**Milestone:** Q1 2025  
**Assignee:** TBD  
**Estimated Effort:** 2 days

