# Egress Analysis - Issue #894

**Date:** 2025-11-21  
**Critical Issue:** Supabase Egress at 287% (14.365 GB / 5 GB)  
**Impact:** Project blocked (Error 522), tests failing, potential cost overrun

---

## Problem Statement

Supabase project consuming 14.3GB bandwidth in free tier (5GB limit) **WITHOUT REAL USERS**.

This suggests:

- Continuous polling/requests to database
- Tests running against live Supabase repeatedly
- Workers making excessive DB queries
- Retry loops without backoff
- Telemetry/logging sending excessive data

---

## Investigation Steps

### 1. Check for Running Processes

**Workers:**

- Queue workers polling constantly?
- Fetch workers hitting Supabase in loop?
- Shield workers checking DB repeatedly?

**Cron Jobs:**

- `cron_integrations.sh` - runs every 5 min?
- `cron_twitter.sh` - polling frequency?

**Tests:**

- Integration tests running in CI constantly?
- Local test runs hitting Supabase (not mocked)?

### 2. Check Configuration Files

**Environment:**

```bash
# Check if NODE_ENV=production is using real DB in tests
grep -E "NODE_ENV|SUPABASE_URL" .env

# Check worker intervals
grep -E "INTERVAL|POLLING|CRON" .env
```

**Package.json scripts:**

```json
{
  "scripts": {
    "workers:start": "...", // Check if auto-restarts
    "start": "...", // Check if runs workers by default
    "dev": "..." // Check if polls DB constantly
  }
}
```

### 3. Identify Top Bandwidth Consumers

**Likely Culprits (ordered by probability):**

1. **Integration Tests** (`tests/integration/*.test.js`)
   - Running against live Supabase instead of mocks
   - CI/CD running tests repeatedly
   - Each test suite creates/deletes data (INSERT/DELETE bandwidth)

2. **Queue Workers** (`src/workers/*.js`)
   - `FetchCommentsWorker` - polls platforms every X seconds
   - `AnalyzeToxicityWorker` - queries comments repeatedly
   - No backoff on empty queues

3. **Cron Jobs** (`cron_*.sh`)
   - Running too frequently (every minute instead of hourly?)
   - No rate limiting

4. **Development Server** (`npm run dev`)
   - Auto-reload hitting DB on every file change
   - Logger sending all logs to Supabase

---

## Findings

### Tests Consuming Real Supabase

**Evidence from logs:**

```
console.info: 🔐 Loaded test credentials from: .env, ../../roastr-ai/.env
```

Tests are loading REAL Supabase credentials and hitting production database!

**Files affected:**

- `tests/integration/multi-tenant-rls-issue-801-crud.test.js`
- `tests/integration/multi-tenant-rls-issue-504-direct.test.js`
- `tests/integration/multi-tenant-rls-issue-412.test.js`

**Why this is a problem:**

- Integration tests create/delete tenants, users, posts, comments
- Each test run = multiple INSERT/DELETE operations
- Running in CI + locally = 10x-100x bandwidth usage

---

## Solutions (Priority Order)

### 🔥 IMMEDIATE (Stop the bleeding)

1. **Stop all workers and cron jobs**

   ```bash
   pkill -f "node.*worker"
   pkill -f cron_integrations
   pkill -f cron_twitter
   ```

2. **Disable integration tests in CI temporarily**

   ```yaml
   # .github/workflows/*.yml
   # Comment out integration test jobs until mocked
   ```

3. **Use mocks for all integration tests**
   - Create mock Supabase client
   - Tests validate RLS logic WITHOUT hitting real DB
   - Save 99% of bandwidth

### ⚠️ SHORT-TERM (Prevent recurrence)

1. **Environment-based DB selection**

   ```javascript
   // tests/setupIntegration.js
   const SUPABASE_URL =
     process.env.NODE_ENV === 'test'
       ? 'http://localhost:54321' // Local Supabase (free)
       : process.env.SUPABASE_URL; // Real Supabase (only in production)
   ```

2. **Mock all integration tests**
   - Use `jest.mock()` for Supabase client
   - Simulate RLS behavior in mocks
   - Validate error codes (42501) without real DB

3. **Add bandwidth monitoring**
   ```javascript
   // Track DB calls in tests
   let dbCallCount = 0;
   beforeEach(() => {
     dbCallCount = 0;
   });
   afterEach(() => {
     if (dbCallCount > 100) {
       throw new Error(`Test exceeded bandwidth limit: ${dbCallCount} calls`);
     }
   });
   ```

### ✅ LONG-TERM (Best practices)

1. **Local Supabase for development**
   - Use Docker Compose with Supabase local
   - Free unlimited bandwidth
   - Faster tests (no network latency)

2. **Separate test database**
   - Use separate Supabase project for tests
   - Or PostgreSQL Docker container with RLS

3. **CI/CD optimization**
   - Run integration tests only on main branch
   - Use test database with higher limits
   - Cache test data between runs

---

## Recommended Actions (NOW)

### Step 1: Create Mock Supabase for Tests

**File:** `tests/helpers/supabaseMock.js`

```javascript
/**
 * Mock Supabase client for integration tests
 * Simulates RLS behavior without network calls
 */
class MockSupabaseClient {
  constructor() {
    this.data = {
      users: [],
      organizations: [],
      comments: [],
      responses: []
    };
    this.currentUserId = null;
  }

  // Simulate RLS: only return data for current user's orgs
  from(table) {
    return {
      select: (columns) => ({
        eq: (column, value) => {
          // Simulate RLS filtering
          const filtered = this.data[table].filter((row) => {
            // Check if user has access to this org
            return row.organization_id === this.currentOrg;
          });
          return Promise.resolve({ data: filtered, error: null });
        },
        insert: (rows) => {
          // Simulate RLS INSERT check
          if (rows.organization_id !== this.currentOrg) {
            return Promise.resolve({
              data: null,
              error: { code: '42501', message: 'RLS policy violation' }
            });
          }
          this.data[table].push(rows);
          return Promise.resolve({ data: rows, error: null });
        }
      })
    };
  }

  setContext(userId, orgId) {
    this.currentUserId = userId;
    this.currentOrg = orgId;
  }
}

module.exports = { MockSupabaseClient };
```

### Step 2: Update tenantTestUtils.js

Replace real Supabase client with mock:

```javascript
// tests/helpers/tenantTestUtils.js
const USE_MOCK = process.env.USE_MOCK_SUPABASE !== 'false'; // Default to mock

const serviceClient = USE_MOCK
  ? new MockSupabaseClient()
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

### Step 3: Update Integration Tests

Add environment check:

```javascript
// tests/integration/multi-tenant-rls-issue-801-crud.test.js
describe('Multi-Tenant RLS CRUD Tests - Issue #801', () => {
  beforeAll(() => {
    if (!process.env.USE_MOCK_SUPABASE) {
      console.warn('⚠️  Using MOCK Supabase to avoid bandwidth costs');
    }
  });
  // ... rest of tests
});
```

---

## Expected Impact

### Before (Real Supabase):

- **Bandwidth per test run:** ~50MB (create/delete 2 orgs, 10 users, 50 comments)
- **Test runs per day:** ~50 (CI + local development)
- **Daily bandwidth:** 2.5GB
- **Monthly bandwidth:** 75GB ❌ **EXCEEDS FREE TIER**

### After (Mocked Supabase):

- **Bandwidth per test run:** ~0MB (no network calls)
- **Test runs per day:** unlimited
- **Daily bandwidth:** ~10MB (only production traffic)
- **Monthly bandwidth:** <300MB ✅ **WELL UNDER FREE TIER**

---

## Validation

After implementing mocks:

```bash
# 1. Run tests with mocks
USE_MOCK_SUPABASE=true npm test -- tests/integration/

# 2. Check that no Supabase calls were made
# (Add network monitoring in tests)

# 3. Wait 24 hours and check Supabase dashboard
# Egress should drop to <1% of daily limit
```

---

## Status

- [ ] Investigation complete
- [ ] Mock Supabase created
- [ ] Integration tests updated
- [ ] CI/CD configured for mocks
- [ ] Bandwidth usage validated (<1GB/month)
- [ ] Documentation updated

**Next Steps:** Implement mock solution immediately (Issue #894)
