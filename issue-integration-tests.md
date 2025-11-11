## 🎯 Objective

Add comprehensive integration tests for `CostControlService` using real Supabase database to validate production behavior.

**Context:** Issue #500 achieved 60% unit test coverage with mocks. While this validates business logic, it doesn't guarantee the system works correctly with real Supabase (queries, RPC functions, RLS policies, etc.).

**Priority:** P1 (High) - Critical for production confidence

---

## 📊 Current State vs Target

### Current Coverage (Unit Tests Only)

| Type | Coverage | Confidence in Prod | What it Validates |
|------|----------|-------------------|-------------------|
| **Unit (mocks)** | 60% | 🟡 Medium (40%) | Logic works in theory |

### Target Coverage (Unit + Integration)

| Type | Coverage | Confidence in Prod | What it Validates |
|------|----------|-------------------|-------------------|
| Unit (mocks) | 60% | 🟡 Medium | Business logic |
| **Integration (real DB)** | **50-60%** | 🟢 High (85%) | **Actually works in prod** |
| **TOTAL** | **~70%** | 🟢 High | **Production-ready** |

---

## ⚠️ Why Unit Tests Alone Are Not Enough

**What unit tests with mocks DON'T validate:**
- ❌ SQL queries are syntactically correct
- ❌ Table/column names exist in database
- ❌ RPC functions work as expected
- ❌ RLS policies enforce security correctly
- ❌ Transactions commit properly
- ❌ **System actually works in production**

**Real example:**
```javascript
// Unit test: ✅ PASSES
mockRpc('increment_usage', { org_id, quantity })

// Production: ❌ FAILS  
// Reason: RPC is called 'record_usage', not 'increment_usage'
```

---

## 📋 Acceptance Criteria

### 1. Test Database Setup
- [ ] Test Supabase project configured
- [ ] Seeding scripts for test data
- [ ] Cleanup utilities
- [ ] Environment variables

### 2. Integration Tests for Critical Paths

#### A. Usage Recording & Limits (P0)
- [ ] `recordUsage` → `checkUsageLimit` flow
- [ ] Verify counters via RPC
- [ ] Limits enforced correctly

#### B. Plan Management (P0)
- [ ] `upgradePlan` → limits update
- [ ] Historical data preserved

#### C. Alert System (P1)
- [ ] Alerts created in `app_logs`
- [ ] Cooldown respected
- [ ] Max per day enforced

#### D. RLS Security (P0 - CRITICAL)
- [ ] Multi-tenant isolation
- [ ] Service key bypasses RLS
- [ ] Anon key enforces RLS

### 3. CI/CD Integration
- [ ] Tests run in pipeline
- [ ] Auto seeding/cleanup

---

## 🔧 Implementation Example

```javascript
describe('CostControlService - Integration', () => {
  it('should record usage and enforce limits end-to-end', async () => {
    await costControl.setUsageLimit(testOrgId, 'roasts', 100);
    await costControl.recordUsage(testOrgId, { resourceType: 'roasts', quantity: 50 });
    const result = await costControl.checkUsageLimit(testOrgId, 'roasts');
    
    expect(result.currentUsage).toBe(50); // REAL data
    expect(result.allowed).toBe(true);
  });

  it('should enforce RLS isolation', async () => {
    const { error } = await anonClient
      .from('usage_tracking')
      .select('*')
      .eq('organization_id', otherOrgId);
    
    expect(error).toBeDefined(); // RLS blocks
  });
});
```

---

## ⏱️ Estimation

**Effort:** 2-3 days

---

## 💡 Success Metrics

**Before:** 60% coverage, ~40% confidence  
**After:** ~70% coverage, ~85% confidence

---

**Related:** #500 (unit tests completed)  
**Priority:** P1  
**Labels:** test:integration, priority:P1, area:backend

