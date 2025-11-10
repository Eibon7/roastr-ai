# Plan: Issue #504 - Add RLS and tenant-level isolation tests

**Issue:** [Tests] Add RLS and tenant-level isolation tests
**Goal:** Recover multi-tenant node coverage (0% → 40%)
**Status:** Planning → Implementation
**Created:** 2025-11-10

## Problem Statement

The multi-tenant node has 0% coverage because it's primarily SQL/RLS-based infrastructure with no measurable JS coverage. We need integration tests that validate Row Level Security policies.

**Current Status:**
- ✅ Test files exist: `tests/integration/multi-tenant-rls-issue-412.test.js`
- ✅ Test utilities exist: `tests/helpers/tenantTestUtils.js`
- ✅ Tests written for AC1, AC2, AC3 (40+ tests)
- ❌ Tests blocked by Supabase connection configuration

## Acceptance Criteria

- [x] Write integration tests in tests/integration/multi-tenant-rls-issue-412.test.js (ALREADY DONE)
- [ ] Test organization isolation policies (EXISTS, needs execution)
- [ ] Validate RLS enforcement via Supabase client (EXISTS, needs execution)
- [ ] Document test coverage estimation
- [ ] Update node metadata in docs/nodes/multi-tenant.md
- [ ] Close issue once integration tests complete

## Estado Actual (Current State)

### Files Already Implemented

1. **tests/integration/multi-tenant-rls-issue-412.test.js** (489 lines)
   - AC1: Listados restringidos por tenant_id (9 tables tested)
   - AC2: Accesos directos por ID verifican tenant_id (6 tests)
   - AC3: Accesos cruzados devuelven 404/forbidden (3 tests)
   - Issue #583 tables: integration_configs, usage_records, monthly_usage, responses, user_behaviors, user_activities
   - Total: 40+ tests

2. **tests/helpers/tenantTestUtils.js** (486 lines)
   - createTestTenants() - Creates 2 orgs with users
   - createTestData(tenantId, type) - Seeds test data
   - setTenantContext(tenantId) - JWT-based RLS switching
   - getTenantContext() - Current context verification
   - cleanupTestData() - FK-safe cleanup
   - JWT secret pattern: SUPABASE_JWT_SECRET → JWT_SECRET → crypto (test) → fail-fast

### Blocker Analysis

**Issue:** "Infrastructure ready, blocked by Supabase connection"

**Root Cause:** Missing Supabase environment variables
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- SUPABASE_ANON_KEY
- SUPABASE_JWT_SECRET (optional, fallback to crypto)

**Evidence:** `tenantTestUtils.js:29-37` throws error if missing

## Implementation Steps

### Phase 1: Environment Verification ⚠️ CURRENT

1. **Check .env file for Supabase configuration**
   - Read .env.example for reference
   - Identify which Supabase vars are configured
   - Document if missing

2. **Decision Point:**
   - **If vars exist:** Run tests → Document coverage → Update node
   - **If vars missing:** Document setup instructions → Skip test execution for now

### Phase 2: Test Execution (if env configured)

1. **Run integration tests**
   ```bash
   npm test -- tests/integration/multi-tenant-rls-issue-412.test.js
   ```

2. **Analyze results**
   - Count passing tests
   - Identify any failures
   - Document coverage estimation

3. **Fix any issues**
   - RLS policy mismatches
   - Schema changes
   - JWT signature issues

### Phase 3: Documentation

1. **Document test coverage estimation**
   - Create: `docs/test-evidence/issue-504/coverage-estimation.md`
   - Include: Test count, tables covered, RLS policies validated
   - Estimate: Coverage % based on tables tested

2. **Update node metadata**
   - Update `docs/nodes/multi-tenant.md`:
     - Coverage: 0% → 40% (estimated)
     - Coverage Source: auto (from coverage-summary.json if available)
     - Status: Update based on test results
     - Tests: Add reference to issue-504 evidence

3. **Create test evidence summary**
   - Create: `docs/test-evidence/issue-504/SUMMARY.md`
   - Content:
     - Test execution results
     - Coverage breakdown by table
     - RLS policies validated
     - Remaining work (if any)

### Phase 4: Validation

1. **Run GDD validation**
   ```bash
   node scripts/validate-gdd-runtime.js --full
   node scripts/score-gdd-health.js --ci
   ```

2. **Verify coverage**
   - Check if coverage-summary.json updated
   - Verify node health score ≥87

3. **Update "Agentes Relevantes"**
   - Add Test Engineer (if not present)
   - Add Documentation Agent (if not present)

## Files to Modify

### Primary
- `docs/nodes/multi-tenant.md` - Update coverage metadata
- `docs/test-evidence/issue-504/coverage-estimation.md` (NEW)
- `docs/test-evidence/issue-504/SUMMARY.md` (NEW)

### Secondary (if tests fail)
- `tests/integration/multi-tenant-rls-issue-412.test.js` - Fix failing tests
- `tests/helpers/tenantTestUtils.js` - Fix utilities if needed

## Risk Assessment

### Low Risk
- ✅ Tests already written and reviewed
- ✅ Utilities follow secure patterns (JWT secret handling)
- ✅ FK-safe cleanup order

### Medium Risk
- ⚠️ Supabase connection may not be configured in dev environment
- ⚠️ Schema changes since tests written may cause failures

### Mitigation
- Check env vars first before running tests
- Document setup instructions if vars missing
- Fix any schema-related test failures

## Success Criteria

1. ✅ Integration tests execute successfully OR
2. ✅ Setup instructions documented if env missing
3. ✅ Coverage estimation documented
4. ✅ Node metadata updated
5. ✅ GDD validation passes (health ≥87)

## Timeline Estimate

- **Environment check:** 5 minutes
- **Test execution (if configured):** 10-15 minutes
- **Documentation:** 15-20 minutes
- **GDD validation:** 5 minutes

**Total:** ~35-45 minutes (if env configured)

## Related Issues

- #412 - Multi-tenant RLS Integration Tests (original issue)
- #583 - RLS tests for new tables (integration_configs, usage_records, etc.)

## Related Nodes

- multi-tenant (primary)
- social-platforms (dependency)
- observability (dependency)

## Agents Involved

- **Test Engineer** - Test execution and validation
- **Documentation Agent** - Coverage estimation and evidence
- **Orchestrator** - Coordination and GDD updates

---

**Next Step:** Check .env configuration for Supabase variables
