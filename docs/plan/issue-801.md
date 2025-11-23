# Implementation Plan: Issue #801 - Granular CRUD-level RLS Policy Testing

**Issue:** #801
**Title:** test(multi-tenant): Add granular CRUD-level RLS policy testing
**Status:** In Progress
**Assignee:** Eibon7
**Priority:** P1 (Security Critical)
**Estimated Effort:** 1-2 hours (Medium Complexity)

---

## Estado Actual

### Existing RLS Test Coverage

- **File:** `tests/integration/multi-tenant-rls-issue-504-direct.test.js`
- **Status:** ✅ 17/17 tests passing (100%)
- **Coverage:** SELECT operations only across 9 tables
- **Gap:** INSERT/UPDATE/DELETE operations not tested

### Test Infrastructure

- ✅ Helper utilities exist: `tests/helpers/tenantTestUtils.js`
- ✅ JWT context switching implemented: `setTenantContext()`
- ✅ Two-client architecture: service client (RLS bypass) + anon client (RLS enforced)
- ✅ Test data seeding: 9 tables with tenant A/B isolation

### Tables Currently Tested (SELECT only)

1. `comments` - Platform comments
2. `responses` - Generated roast responses
3. `integration_configs` ⚠️ SECURITY CRITICAL
4. `usage_records` ⚠️ BILLING CRITICAL
5. `monthly_usage` ⚠️ BILLING CRITICAL
6. `posts` - Social media posts (test data)
7. `roasts` - Generated roasts (test data)
8. `user_behaviors` - User behavior tracking
9. `user_activities` - Activity audit log

---

## Pasos de Implementación

### Step 1: Extend Existing Test File ✅ RECOMMENDED

**File:** `tests/integration/multi-tenant-rls-issue-504-direct.test.js`
**Action:** Add 3 new test suites for INSERT/UPDATE/DELETE operations

**Rationale:**

- Keeps related tests together
- Reuses existing setup/cleanup infrastructure
- Follows existing patterns

**Alternative:** Create new file `multi-tenant-rls-issue-801-crud.test.js` if file becomes too large (>1000 lines)

---

### Step 2: Implement INSERT Operation Tests

**Test Suite:** `AC4: INSERT Operations RLS Enforcement`

**Tables Priority:**

1. **HIGH** (Security/Billing):
   - `integration_configs` - Credential isolation
   - `usage_records` - Billing data isolation
   - `monthly_usage` - Billing summary isolation

2. **MEDIUM** (Core Features):
   - `comments` - Platform comments
   - `responses` - Generated responses

3. **LOW** (Optional):
   - `user_behaviors`
   - `user_activities`

**Test Cases per Table:**

1. ✅ Own org INSERT succeeds
2. ❌ Cross-tenant INSERT fails with error code '42501'
3. ❌ Invalid organization_id INSERT fails

**Expected Behavior:**

```javascript
// Success case
const { data, error } = await testClient
  .from('comments')
  .insert({ organization_id: tenantA.id, ... })
  .select();

expect(error).toBeNull();
expect(data).toHaveLength(1);
expect(data[0].organization_id).toBe(tenantA.id);

// Failure case (cross-tenant)
const { data, error } = await testClient
  .from('comments')
  .insert({ organization_id: tenantB.id, ... })
  .select();

expect(error).not.toBeNull();
expect(error.code).toBe('42501'); // Permission denied
expect(data).toBeNull();
```

**Estimated Tests:** 15-21 test cases (3 per table × 5-7 tables)

---

### Step 3: Implement UPDATE Operation Tests

**Test Suite:** `AC5: UPDATE Operations RLS Enforcement`

**Test Cases per Table:**

1. ✅ Own org UPDATE succeeds
2. ❌ Cross-tenant UPDATE fails with error code '42501'
3. ❌ Attempt to change organization_id fails

**Expected Behavior:**

```javascript
// Success case
const { data, error } = await testClient
  .from('comments')
  .update({ toxicity_score: 0.9 })
  .eq('id', tenantA.comments[0].id)
  .select();

expect(error).toBeNull();
expect(data).toHaveLength(1);

// Failure case (cross-tenant)
const { data, error } = await testClient
  .from('comments')
  .update({ toxicity_score: 0.9 })
  .eq('id', tenantB.comments[0].id)
  .select();

expect(error).not.toBeNull();
expect(error.code).toBe('42501');
expect(data).toEqual([]); // RLS blocks
```

**Estimated Tests:** 15-21 test cases (3 per table × 5-7 tables)

---

### Step 4: Implement DELETE Operation Tests

**Test Suite:** `AC6: DELETE Operations RLS Enforcement`

**Test Cases per Table:**

1. ✅ Own org DELETE succeeds
2. ❌ Cross-tenant DELETE fails with error code '42501'

**Expected Behavior:**

```javascript
// Success case
const { error } = await testClient.from('comments').delete().eq('id', tenantA.comments[0].id);

expect(error).toBeNull();

// Failure case (cross-tenant)
const { error } = await testClient.from('comments').delete().eq('id', tenantB.comments[0].id);

expect(error).not.toBeNull();
expect(error.code).toBe('42501');
```

**Estimated Tests:** 10-14 test cases (2 per table × 5-7 tables)

---

### Step 5: Cross-Tenant Isolation Verification

**Test Suite:** `AC7: Bidirectional Write Isolation`

**Test Cases:**

1. ❌ Tenant A cannot INSERT for Tenant B
2. ❌ Tenant B cannot INSERT for Tenant A
3. ❌ Tenant A cannot UPDATE Tenant B data
4. ❌ Tenant B cannot UPDATE Tenant A data
5. ❌ Tenant A cannot DELETE Tenant B data
6. ❌ Tenant B cannot DELETE Tenant A data

**Estimated Tests:** 6 test cases (bidirectional testing)

---

### Step 6: Documentation Updates

**Files to Update:**

1. **Test Evidence:** Create `docs/test-evidence/issue-801/rls-crud-validation.md`
   - Document all error codes observed
   - Capture test execution screenshots
   - List tables tested per operation

2. **GDD Node:** Update `docs/nodes/multi-tenant.md`
   - Add "RLS CRUD Testing" section
   - Reference issue #801 and related PRs
   - Update "Agentes Relevantes" to include TestEngineer

3. **README:** Update test documentation
   - Add section on RLS CRUD testing
   - Document how to run RLS tests
   - Explain error code expectations

---

## Archivos a Modificar

### Core Implementation

1. `tests/integration/multi-tenant-rls-issue-504-direct.test.js` - Add 3 new test suites

### Documentation

1. `docs/test-evidence/issue-801/rls-crud-validation.md` - NEW
2. `docs/nodes/multi-tenant.md` - Update with CRUD testing info
3. `README.md` or `docs/TESTING-GUIDE.md` - Add RLS test documentation

### Agent Receipts (MANDATORY)

1. `docs/agents/receipts/<pr>-TestEngineer.md` - Test implementation receipt
2. `docs/agents/receipts/<pr>-Guardian.md` - Security validation receipt

---

## Validation Steps

### Pre-Flight Checklist

- [ ] Read `docs/patterns/coderabbit-lessons.md` ✅
- [ ] All tests pass locally
- [ ] Coverage ≥90% for new code
- [ ] Error codes verified (42501 for RLS violations)
- [ ] Cross-tenant isolation bidirectionally verified
- [ ] Documentation updated

### Test Execution

```bash
# Run specific RLS test suite
npm test -- tests/integration/multi-tenant-rls-issue-504-direct.test.js

# Run all integration tests
npm test -- tests/integration/

# Check coverage
npm run test:coverage
```

### Success Criteria

- ✅ All INSERT tests pass (15-21 tests)
- ✅ All UPDATE tests pass (15-21 tests)
- ✅ All DELETE tests pass (10-14 tests)
- ✅ Cross-tenant isolation verified (6 tests)
- ✅ Error code '42501' verified for unauthorized operations
- ✅ CI/CD pipeline passes
- ✅ Coverage ≥90%
- ✅ 0 CodeRabbit comments

---

## Agentes Relevantes

**Primary:**

- **TestEngineer** - Implement integration tests for CRUD operations
- **Guardian** - Validate security implications of RLS policies

**Supporting:**

- **Backend Developer** - Review RLS policy correctness
- **Orchestrator** - Coordinate agent workflow and receipt generation

---

## Risk Analysis

### High Risk

- **Security:** RLS violations could leak sensitive data between tenants
- **Billing:** Unauthorized access to usage_records/monthly_usage could expose billing data

### Medium Risk

- **Test Data:** Foreign key constraints may require careful cleanup order
- **JWT Context:** Incorrect context switching could lead to false positives

### Mitigation

- ✅ Test high-priority tables first (integration_configs, usage_records, monthly_usage)
- ✅ Verify error code '42501' explicitly in all failure cases
- ✅ Use existing cleanup helpers that respect FK constraints
- ✅ Bidirectional testing ensures no context switching bugs

---

## Dependencies

### GDD Nodes

- `multi-tenant.md` - RLS policies and organization isolation
- `observability.md` - Test coverage tracking
- `shield.md` - Security-related concerns (user_behaviors table)

### Related Issues

- Issue #504 - Base RLS integration tests (PR #790)
- Issue #583 - RLS policy updates

### External Dependencies

- Supabase RLS policies must be deployed
- Test environment must have valid JWT_SECRET
- Database must have test data seeding enabled

---

## Time Estimates

| Task                         | Estimated Time | Status  |
| ---------------------------- | -------------- | ------- |
| Research existing patterns   | 15 min         | ✅ DONE |
| Create implementation plan   | 15 min         | ✅ DONE |
| Implement INSERT tests       | 20 min         | Pending |
| Implement UPDATE tests       | 20 min         | Pending |
| Implement DELETE tests       | 15 min         | Pending |
| Cross-tenant isolation tests | 10 min         | Pending |
| Documentation                | 15 min         | Pending |
| Test execution & debugging   | 15 min         | Pending |
| Agent receipts               | 10 min         | Pending |

**Total:** ~2 hours

---

## Notes

- Keep test file under 1000 lines (current: 314 lines, adding ~200 lines = 514 lines total)
- Reuse existing `tenantTestUtils.js` helpers for setup/cleanup
- Follow existing test pattern for consistency
- Priority: Security tables first (integration_configs, usage_records, monthly_usage)
- Document any RLS policy bugs discovered during testing

---

**Plan Created:** 2025-11-10
**Plan Author:** Orchestrator (Claude)
**Issue:** #801
**Branch:** `claude/issue-801-gdd-activation-011CUzBuiHyEpDUBSmejaKsS`
