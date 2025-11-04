# Test Database Options - Issue #698

**Date:** 2025-11-03
**Status:** ⏳ Research Phase
**Goal:** Configure real Supabase database for integration tests

---

## Current Situation

### What We Have
- Integration tests currently use mock (`tests/helpers/roastMockFactory.js`)
- 4/8 tests passing (50%)
- 4 tests fail due to module loading order issues with mocks
- Built-in mock mode in `src/config/supabase.js` (lines 10-151)

### What We Need
- Real Supabase database for integration tests
- All 8 tests passing
- Tests run in CI/CD
- No production data risk

---

## Option 1: Supabase Test Project (Cloud)

### Description
Create a dedicated Supabase project specifically for testing.

### Pros
1. ✅ **Zero Setup Complexity:** Same as production Supabase
2. ✅ **Real Behavior:** Identical API to production
3. ✅ **CI/CD Ready:** Works immediately in GitHub Actions
4. ✅ **Team Access:** All developers can use same test project
5. ✅ **Database Migrations:** Use same migration scripts as production
6. ✅ **Free Tier:** Supabase free tier sufficient for tests

### Cons
1. ⚠️ **Shared Resource:** Tests across branches may conflict
2. ⚠️ **Cleanup Required:** Need test data cleanup between runs
3. ⚠️ **Internet Required:** Can't run tests offline
4. ⚠️ **Credentials Management:** Test credentials in `.env.test`

### Implementation Steps
```bash
# 1. Create test Supabase project at https://app.supabase.com
# 2. Run schema migrations on test project
# 3. Add credentials to .env.test:
SUPABASE_URL=https://YOUR-TEST-PROJECT.supabase.co
SUPABASE_SERVICE_KEY=YOUR-TEST-SERVICE-KEY
SUPABASE_ANON_KEY=YOUR-TEST-ANON-KEY

# 4. Update jest config to load .env.test
# 5. Add cleanup hooks in tests (afterEach)
```

### Estimated Time
- Setup: 1-2 hours
- Test Updates: 2-3 hours
- **Total: 3-5 hours**

---

## Option 2: Local Supabase with Docker

### Description
Run Supabase locally using `supabase/cli` and Docker.

### Pros
1. ✅ **Offline Tests:** No internet required
2. ✅ **Full Isolation:** Each developer has own instance
3. ✅ **Fast Reset:** `supabase db reset` cleans everything
4. ✅ **Free:** No cloud costs

### Cons
1. ❌ **Complex Setup:** Requires Docker + Supabase CLI
2. ❌ **CI Configuration:** More complex GitHub Actions setup
3. ❌ **Resource Heavy:** Docker containers consume CPU/RAM
4. ❌ **Team Variability:** Different setups across developer machines

### Implementation Steps
```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Initialize local Supabase
supabase init

# 3. Start local instance
supabase start

# 4. Get local credentials
supabase status

# 5. Update .env.test with local URLs
# 6. Configure CI to run `supabase start` before tests
```

### Estimated Time
- Setup: 3-4 hours (incl. Docker troubleshooting)
- CI Configuration: 2-3 hours
- **Total: 5-7 hours**

---

## Option 3: Hybrid Approach (Local + Test Project)

### Description
Local Supabase for development, cloud test project for CI.

### Pros
1. ✅ **Best of Both:** Fast local, reliable CI
2. ✅ **Developer Friendly:** Offline development possible
3. ✅ **CI Simplicity:** No Docker in GitHub Actions

### Cons
1. ⚠️ **Two Setups:** More configuration to maintain
2. ⚠️ **Potential Divergence:** Local and CI might differ

### Implementation Steps
```bash
# Local: Use Option 2 (Docker)
# CI: Use Option 1 (Test Project)

# .env.test.local (developers use this)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=<local-service-key>

# .env.test (CI uses this, from secrets)
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_SERVICE_KEY=<from-github-secrets>
```

### Estimated Time
- Setup: 4-6 hours
- **Total: 4-6 hours**

---

## Option 4: SQLite + Supabase Adapter

### Description
Use SQLite locally with compatibility layer, Supabase for CI.

### Pros
1. ✅ **Super Fast:** SQLite is extremely fast
2. ✅ **Simple Setup:** Just a file, no services

### Cons
1. ❌ **Compatibility Risk:** Supabase-specific features may break
2. ❌ **Maintenance:** Need to maintain adapter layer
3. ❌ **Not Real:** Doesn't test actual Supabase integration

### Status
**❌ REJECTED** - Too much complexity for marginal benefit

---

## Recommended Approach

###  **Option 1: Supabase Test Project (Cloud)**

**Rationale:**
1. **Fastest Implementation:** 3-5 hours vs 5-7 hours
2. **Lowest Risk:** No Docker complexity or version drift
3. **Team Ready:** Works for all developers immediately
4. **CI Native:** Zero additional configuration
5. **Real Integration:** Tests actual Supabase behavior

**Trade-offs Accepted:**
- Need internet for tests (acceptable for integration tests)
- Shared test database (manageable with cleanup hooks)

---

## Implementation Plan (Option 1)

### Phase 1: Setup Test Project (1-2 hours)
1. Create new Supabase project named "roastr-test"
2. Run database migrations from `database/schema.sql`
3. Verify schema matches production
4. Get credentials (URL, Service Key, Anon Key)

### Phase 2: Configure Tests (2-3 hours)
1. Create `.env.test` file:
```bash
# .env.test - Test database credentials
SUPABASE_URL=https://roastr-test.supabase.co
SUPABASE_SERVICE_KEY=<service-key>
SUPABASE_ANON_KEY=<anon-key>
NODE_ENV=test
```

2. Update `jest.config.js` to load `.env.test`:
```javascript
setupFilesAfterEnv: [
  './tests/helpers/setupTest Env.js'
]
```

3. Create `tests/helpers/setupTestEnv.js`:
```javascript
// Load test environment variables
require('dotenv').config({ path: '.env.test' });
```

4. Remove Supabase mocks from `tests/integration/roast.test.js`:
```javascript
// REMOVE: jest.mock('../../src/config/supabase')
// REMOVE: Mock factory references
```

5. Add cleanup hooks:
```javascript
afterEach(async () => {
  // Clean test data
  await supabaseServiceClient
    .from('roast_usage')
    .delete()
    .gte('created_at', testStartTime);

  await supabaseServiceClient
    .from('analysis_usage')
    .delete()
    .gte('created_at', testStartTime);
});
```

### Phase 3: CI Configuration (30 min)
1. Add secrets to GitHub Actions:
   - `TEST_SUPABASE_URL`
   - `TEST_SUPABASE_SERVICE_KEY`
   - `TEST_SUPABASE_ANON_KEY`

2. Update `.github/workflows/ci.yml`:
```yaml
- name: Run tests
  env:
    SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}
    SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY}}
    NODE_ENV: test
  run: npm test
```

### Phase 4: Validation (30 min)
1. Run tests locally: `npm test tests/integration/roast.test.js`
2. Verify all 8 tests pass
3. Run 3 consecutive times to verify consistency
4. Commit and push - verify CI passes

---

## Security Considerations

### Credentials Management
- ✅ `.env.test` in `.gitignore` (don't commit credentials)
- ✅ Use GitHub Secrets for CI
- ✅ Test project has separate credentials from production
- ✅ Test project restricted to test data only

### Data Isolation
- ✅ Completely separate Supabase project
- ✅ No production data in test database
- ✅ Test data cleaned up after each test
- ✅ Can be reset/destroyed without impact

---

## Next Steps

1. ✅ Research complete - documented all options
2. ⏳ Get approval for Option 1
3. ⏳ Create Supabase test project
4. ⏳ Configure test environment
5. ⏳ Update integration tests
6. ⏳ Verify all tests pass
7. ⏳ Configure CI/CD
8. ⏳ Document setup for team

---

## Decision Log

**2025-11-03:** Investigated 4 options, recommending Option 1 (Supabase Test Project)
- **Why:** Fastest, lowest risk, team-ready, CI-native
- **Next:** Await user approval to proceed with implementation

---

## Related Documentation
- Issue #698: https://github.com/roastr-ai/roastr/issues/698
- Implementation Plan: `docs/plan/issue-698.md`
- Module Mocking Attempt: `docs/test-evidence/issue-698/module-level-mocking-attempt.md`
- Current Config: `src/config/supabase.js`
