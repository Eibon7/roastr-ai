# Issue #639 - Database Security (RLS Policies) - Implementation Plan

**Date:** 2025-11-07
**Epic:** #480 - Test Suite Stabilization (Week 1, Days 3-5)
**Priority:** P1 (High - Security & Multi-tenant Isolation)
**Estimated:** 8 hours
**Status:** 🟡 BLOCKED - Test database configuration required

---

## Executive Summary

**Objective:** Validate all 53 RLS (Row Level Security) policies across 22 tables to ensure multi-tenant data isolation.

**Current Status:**
- **Tests:** 0/16 passing (0%)
- **Blocker:** No test database configured (missing SUPABASE credentials)
- **Root Cause:** Integration tests require real database to validate RLS policies

**Blocker Resolution Required:**
- Configure test Supabase project OR local Supabase instance
- Set environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`
- Deploy schema with RLS policies to test database

---

## Context from FASE 0

### GDD Nodes Resolved
- **Primary:** `multi-tenant.md` (53 RLS policies, 22 tables)
- **Dependency:** `observability.md` (logging, monitoring)

### Baseline Test Results
```bash
# Command: IS_TEST=true npm test -- tests/integration/database/security.test.js
# Result: 0/16 tests passing (100% failure rate)
# Error: "TypeError: fetch failed"
# Cause: No Supabase credentials found - mock mode insufficient for RLS validation
```

**Test Suite Breakdown:**
1. RLS WITH CHECK Policies (4 tests) - Prevent cross-tenant insertion
2. Schema-qualified trigger functions (2 tests) - Security validation
3. Database function security (3 tests) - SQL injection, privilege escalation
4. Multi-tenant isolation (2 tests) - Data leakage prevention
5. Data integrity constraints (3 tests) - Referential integrity
6. Index performance (2 tests) - Query optimization

---

## Root Cause Analysis

### Why Tests Are Failing

**Issue #698 Research** identified this pattern: Integration tests for database features (RLS, triggers, constraints) **cannot be mocked** - they require real database connections.

**Technical Reason:**
- RLS policies are PostgreSQL database-level security features
- Mocking Supabase client doesn't validate actual policy enforcement
- Tests like "should prevent cross-tenant data insertion" need real DB to verify INSERT/SELECT permissions

**Current Test Setup:**
```javascript
// tests/helpers/test-setup.js
const TEST_CONFIG = {
  database: {
    url: process.env.SUPABASE_URL || 'http://localhost:54321',  // ❌ Dummy URL
    serviceKey: process.env.SUPABASE_SERVICE_KEY || 'dummy-service-key',  // ❌ Dummy key
    anonKey: process.env.SUPABASE_ANON_KEY || 'dummy-anon-key'  // ❌ Dummy key
  }
};
```

**Result:** All database operations fail with "fetch failed" because no real server exists at dummy URLs.

---

## Solution: Configure Test Database

### Recommended Approach (from Issue #698)

**Option 1: Supabase Test Project (Cloud)** ⭐ RECOMMENDED

**Why This Option:**
- ✅ Fastest implementation (3-5 hours)
- ✅ Lowest risk (no Docker complexity)
- ✅ CI/CD ready (works in GitHub Actions immediately)
- ✅ Team accessible (all developers use same test project)
- ✅ Real behavior (identical to production Supabase)

**Trade-offs Accepted:**
- ⚠️ Requires internet connection
- ⚠️ Shared test database (managed with cleanup hooks)
- ⚠️ Credentials management (stored in GitHub Secrets for CI)

---

## Implementation Plan

### Phase 1: Test Database Setup (1-2 hours) - BLOCKER RESOLUTION

**Step 1.1: Create Supabase Test Project**
1. Go to https://app.supabase.com
2. Create new project: "roastr-test"
3. Region: Same as production (for consistency)
4. Database password: Generate strong password
5. Wait for project initialization (~2 minutes)

**Step 1.2: Deploy Schema with RLS Policies**
```bash
# Connect to test database using Supabase UI SQL editor
# Or use psql:
psql postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Deploy full schema (includes all 53 RLS policies)
cat database/schema.sql | psql [CONNECTION-STRING]

# Verify RLS policies applied
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

# Expected: 53 policies across 22 tables
```

**Step 1.3: Get Test Credentials**
From Supabase project settings:
- Project URL: `https://[PROJECT-REF].supabase.co`
- Service Role Key: Settings → API → service_role (secret)
- Anon Key: Settings → API → anon (public)

**Step 1.4: Configure Environment**
Create `.env.test` (local development):
```bash
# .env.test - Database Security Test Configuration
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_KEY=[service_role_key]
SUPABASE_ANON_KEY=[anon_key]

# Test mode
NODE_ENV=test
IS_TEST=true

# Enable mock mode for non-database features
ENABLE_MOCK_MODE=true
ENABLE_REAL_OPENAI=false
ENABLE_ROAST_ENGINE=false
ENABLE_PERSPECTIVE_API=false
```

Add to `.gitignore`:
```
.env.test
```

**Step 1.5: Configure CI/CD (GitHub Secrets)**
Add to repository secrets:
- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_SERVICE_KEY`
- `TEST_SUPABASE_ANON_KEY`

Update `.github/workflows/integration-tests.yml`:
```yaml
- name: Run Database Security Tests
  env:
    SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}
    SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
    NODE_ENV: test
    IS_TEST: true
  run: npm test -- tests/integration/database/security.test.js
```

---

### Phase 2: Test Configuration Updates (2-3 hours)

**Step 2.1: Load Test Environment in Jest**

Update `jest.config.js`:
```javascript
module.exports = {
  setupFilesAfterEnv: [
    './tests/setup.js',
    './tests/helpers/loadTestEnv.js'  // Load .env.test
  ],
  // ... rest of config
};
```

Create `tests/helpers/loadTestEnv.js`:
```javascript
/**
 * Load test environment variables
 * Loads .env.test if it exists, otherwise uses process.env
 */
const path = require('path');
const dotenv = require('dotenv');

const testEnvPath = path.resolve(__dirname, '../../.env.test');

// Try to load .env.test (local dev), fallback to process.env (CI)
dotenv.config({ path: testEnvPath });

console.log('✅ Test environment loaded:', {
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  nodeEnv: process.env.NODE_ENV,
  isTest: process.env.IS_TEST
});
```

**Step 2.2: Add Test Data Cleanup Hooks**

Update `tests/integration/database/security.test.js`:
```javascript
describe('Database Security Integration', () => {
    let testStartTime;
    let testUserId;
    let testOrgId;
    let anotherUserId;
    let anotherOrgId;

    beforeAll(async () => {
        testStartTime = new Date().toISOString();
        testUserId = 'test-user-security-123';
        testOrgId = 'test-org-security-456';
        anotherUserId = 'another-user-security-789';
        anotherOrgId = 'another-org-security-012';

        // Verify database connection
        const { data, error } = await supabaseServiceClient
            .from('organizations')
            .select('count')
            .limit(1);

        if (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }

        logger.info('✅ Database connection verified for security tests');
    });

    afterEach(async () => {
        // Clean test data created during this test run
        try {
            await supabaseServiceClient
                .from('roasts_metadata')
                .delete()
                .gte('created_at', testStartTime)
                .in('user_id', [testUserId, anotherUserId]);

            await supabaseServiceClient
                .from('roastr_style_preferences')
                .delete()
                .gte('created_at', testStartTime)
                .in('user_id', [testUserId, anotherUserId]);

            // Clean other tables as needed
        } catch (error) {
            logger.warn('Cleanup error in security tests:', error);
        }
    });

    afterAll(async () => {
        // Final cleanup - remove all test data
        logger.info('🧹 Final cleanup for security tests');
    });

    // ... tests
});
```

**Step 2.3: Verify No Mock Conflicts**

Ensure `tests/integration/database/security.test.js` does NOT mock Supabase:
```javascript
// ✅ CORRECT - No mocking, uses real database
const { supabaseServiceClient } = require('../../../src/config/supabase');

// ❌ WRONG - Don't do this for database security tests
// jest.mock('../../../src/config/supabase');
```

---

### Phase 3: RLS Policy Validation (3-4 hours)

**Step 3.1: Run Tests and Fix Policy Issues**

```bash
# Run with test database configured
npm test -- tests/integration/database/security.test.js --verbose

# Expected initial results: Some failures due to policy mismatches
# Strategy: Fix one test at a time (TDD approach)
```

**Step 3.2: Systematic Test Fixing (TDD)**

For each failing test:

1. **RED:** Run test, observe failure
2. **Analyze:** Check error message for policy name or constraint
3. **Fix:** Update `database/schema.sql` with correct RLS policy
4. **Deploy:** Apply fix to test database
5. **GREEN:** Re-run test, verify pass
6. **Refactor:** Optimize policy if needed
7. **Document:** Add notes to coderabbit-lessons.md if pattern found

**Common RLS Policy Pattern:**
```sql
-- Enable RLS on table
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their organization's data
CREATE POLICY org_isolation ON <table_name>
FOR ALL
USING (
  organization_id IN (
    SELECT o.id
    FROM organizations o
    LEFT JOIN organization_members om ON o.id = om.organization_id
    WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
  )
);

-- WITH CHECK policy (prevents cross-tenant INSERT)
CREATE POLICY org_isolation_insert ON <table_name>
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT o.id
    FROM organizations o
    LEFT JOIN organization_members om ON o.id = om.organization_id
    WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
  )
);
```

**Step 3.3: Validate All 16 Tests**

Target test groups:
1. ✅ RLS WITH CHECK Policies (4 tests)
2. ✅ Schema-qualified trigger functions (2 tests)
3. ✅ Database function security (3 tests)
4. ✅ Multi-tenant isolation (2 tests)
5. ✅ Data integrity constraints (3 tests)
6. ✅ Index performance (2 tests)

---

### Phase 4: Documentation & Evidence (1 hour)

**Step 4.1: Generate Test Evidence**

```bash
# Run final test suite with verbose output
npm test -- tests/integration/database/security.test.js --verbose > docs/test-evidence/issue-639/test-run.log 2>&1

# Capture coverage
npm test -- tests/integration/database/security.test.js --coverage --coverageDirectory=docs/test-evidence/issue-639/coverage
```

**Step 4.2: Create Evidence Summary**

Create `docs/test-evidence/issue-639/SUMMARY.md`:
```markdown
# Issue #639 - Database Security Tests - Evidence

**Date:** [completion-date]
**Status:** ✅ COMPLETE - 16/16 tests passing (100%)

## Test Results

### RLS WITH CHECK Policies
- ✅ should prevent cross-tenant data insertion in roasts_metadata
- ✅ should prevent cross-tenant data insertion in shield_events
- ✅ should allow same-tenant data insertion
- ✅ should enforce WITH CHECK on UPDATE operations

### Schema-qualified trigger functions
- ✅ should use schema-qualified function references
- ✅ should not allow trigger function hijacking

### Database function security
- ✅ should prevent SQL injection in stored procedures
- ✅ should enforce SECURITY DEFINER correctly
- ✅ should validate function permissions

### Multi-tenant isolation
- ✅ should isolate data between organizations
- ✅ should prevent cross-org data access via JOIN

### Data integrity constraints
- ✅ should enforce foreign key constraints
- ✅ should validate required fields
- ✅ should prevent orphaned records

### Index performance
- ✅ should use indexes for org_id queries
- ✅ should optimize multi-tenant queries

## Coverage Impact
- Multi-tenant node: [baseline]% → [final]%
- Security validation: 100%

## RLS Policies Validated
- Total: 53 policies across 22 tables
- All policies tested and confirmed working
```

**Step 4.3: Update GDD Nodes**

Update `docs/nodes/multi-tenant.md`:
```markdown
## Test Coverage

**Integration Tests:** `tests/integration/database/security.test.js`
- ✅ 16/16 tests passing (100%)
- ✅ All 53 RLS policies validated
- ✅ Cross-tenant isolation confirmed
- ✅ Data integrity verified

**Last Validated:** 2025-11-07 (Issue #639)

## Agentes Relevantes
- TestEngineer: RLS policy validation
- Guardian: Security review (if invoked)
```

---

## Acceptance Criteria Verification

### From Issue #639 (EPIC #480):
- [ ] All RLS policies tested (53 policies across 22 tables)
- [ ] Cross-tenant isolation validated (multi-tenant.test.js scenarios)
- [ ] Trigger functions security confirmed (schema-qualified references)
- [ ] 100% passing in database/security.test.js (16/16 tests)

### Quality Standards:
- [ ] 0 CodeRabbit comments pending
- [ ] Test evidence generated in `docs/test-evidence/issue-639/`
- [ ] GDD nodes updated (multi-tenant.md coverage %)
- [ ] Agent receipts generated (TestEngineer minimum)
- [ ] CI/CD passing with test database
- [ ] No conflicts with main branch

---

## Risk Assessment

### High Risk - BLOCKER
- **Test Database Access:** Without credentials, 0 tests can pass
- **Mitigation:** Create test Supabase project ASAP (Phase 1)

### Medium Risk
- **Schema Drift:** Test DB schema may diverge from production
- **Mitigation:** Deploy schema.sql to test DB before each major test run

### Low Risk
- **Cleanup Issues:** Test data may accumulate in shared test DB
- **Mitigation:** Comprehensive afterEach cleanup hooks (Phase 2.2)

---

## Dependencies

### Blockers (MUST resolve before implementation):
- [ ] Test Supabase project created
- [ ] Credentials available (URL, Service Key, Anon Key)
- [ ] Schema deployed to test database

### Prerequisites:
- [x] GDD nodes resolved (multi-tenant.md)
- [x] Baseline tests run (identified 16 failing)
- [x] Root cause identified (no test DB)
- [x] Issue #698 research reviewed (test DB options)

---

## Timeline

### With Test Database Configured:
- **Phase 1:** Test DB Setup - 1-2 hours
- **Phase 2:** Test Configuration - 2-3 hours
- **Phase 3:** RLS Validation - 3-4 hours
- **Phase 4:** Documentation - 1 hour
- **Total:** 7-10 hours (within 8-hour estimate)

### Without Test Database (Current Status):
- **Status:** BLOCKED
- **Action:** Create test Supabase project OR approve local Supabase setup
- **Owner:** Product Owner / DevOps

---

## Next Steps

### Immediate (FASE 1 - Planning Complete):
- [x] Create implementation plan (this document)
- [x] Document blocker clearly
- [x] Identify resolution steps

### Pending (FASE 2 - Implementation):
- [ ] **BLOCKER:** Create test Supabase project
- [ ] Get test database credentials
- [ ] Configure `.env.test` locally
- [ ] Add credentials to GitHub Secrets
- [ ] Proceed with Phase 1-4 implementation

### After Resolution:
- [ ] Run baseline tests with real database
- [ ] Fix RLS policy issues systematically (TDD)
- [ ] Generate test evidence
- [ ] Create PR with agent receipts
- [ ] Merge with 0 CodeRabbit comments

---

## References

- **Issue:** #639 - Database Security (RLS Policies)
- **Epic:** #480 - Test Suite Stabilization
- **Related Issues:**
  - #698 - Test Database Configuration Research
  - #403 - Testing MVP
- **GDD Nodes:**
  - `docs/nodes/multi-tenant.md` - 53 RLS policies
  - `docs/nodes/observability.md` - Logging patterns
- **Test Suite:** `tests/integration/database/security.test.js`
- **Schema:** `database/schema.sql` - RLS policy definitions
- **Research:** `docs/test-evidence/issue-698/test-database-options.md`

---

**Status:** 🟡 BLOCKED - Waiting for test database configuration
**Next Action:** Create test Supabase project to unblock implementation
**ETA:** 7-10 hours after blocker resolved

---

**Author:** Orchestrator (Claude Code)
**Created:** 2025-11-07
**Last Updated:** 2025-11-07
