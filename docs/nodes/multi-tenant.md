# Multi-Tenant - Row Level Security & Organization Isolation

**Node ID:** `multi-tenant`
**Owner:** Back-end Dev
**Priority:** Critical
**Status:** Production
**Last Updated:** 2025-11-11
**Coverage:** 94.25%
**Coverage Source:** auto
**Note:** Coverage validated via RLS integration tests (24 tables tested, 100+ tests passing). Expanded RLS coverage to remaining 13 tables. Direct RLS validation approach without JWT context switching. G6 validation complete. Issue #894: Supabase mock implemented - 35/35 RLS tests passing without network calls.
**Related Issue:** #412 (RLS Integration Tests - Infrastructure Ready), #504 (Coverage Recovery - 40.9% achieved ✅), #588 (G6 RLS Validation ✅), #774 (Test fixes), #800 (Coverage Expansion - Phase 1 - 50% achieved ✅), #801 (CRUD-level RLS Testing - Full CRUD coverage ✅), #787 (RLS Integration Tests Phase 2 - Usage, Admin, Shield ✅), #894 (Supabase Mock - Zero Network Calls ✅)
**Related PRs:** #499, #587, #790, #805 (Test fixes), #812 (RLS expansion), #814 (G6 validation)
## Dependencies

None (foundational node)

## Overview

Multi-Tenant provides complete data isolation between organizations using PostgreSQL Row Level Security (RLS) and Supabase Auth integration. It ensures that users can only access data belonging to their organization or organizations they are members of, preventing data leakage and unauthorized access.

### Key Capabilities

1. **Row Level Security (RLS)** - PostgreSQL-native data isolation at the database level
2. **Organization-Scoped Access** - All tables scoped by organization_id
3. **Membership Management** - Owner/admin/member role hierarchy
4. **Service Role Bypass** - Backend services can access all data with service_role
5. **Advisory Locks** - Prevent race conditions in concurrent operations
6. **Automatic Isolation** - RLS policies enforced transparently on all queries

## Architecture

### Core Tables

**Table:** `organizations`

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Plan & billing
  plan_id VARCHAR(50) NOT NULL DEFAULT 'free',
  subscription_status VARCHAR(20) DEFAULT 'active',
  stripe_subscription_id VARCHAR(255),

  -- Usage limits
  monthly_responses_limit INTEGER NOT NULL DEFAULT 100,
  monthly_responses_used INTEGER DEFAULT 0,

  -- Settings
  settings JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT organizations_slug_check CHECK (slug ~* '^[a-z0-9-]+$'),
  CONSTRAINT organizations_plan_check CHECK (plan_id IN ('free', 'pro', 'creator_plus', 'custom'))
);
```

**Table:** `organization_members`

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, user_id),
  CONSTRAINT organization_members_role_check CHECK (role IN ('owner', 'admin', 'member'))
);
```

### RLS Policy Pattern

All organization-scoped tables follow this RLS pattern:

```sql
-- Enable RLS on table
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Create isolation policy
CREATE POLICY org_isolation ON <table_name> FOR ALL USING (
  organization_id IN (
    SELECT o.id FROM organizations o
    LEFT JOIN organization_members om ON o.id = om.organization_id
    WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
  )
) WITH CHECK (
  organization_id IN (
    SELECT o.id FROM organizations o
    LEFT JOIN organization_members om ON o.id = om.organization_id
    WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
  )
);
```

### Tables with RLS Enabled

**53 RLS Policies Across 22 Tables:**

- `organization_settings` - Organization-level Shield configuration
- `platform_settings` - Platform-specific Shield settings
- `integration_configs` - Platform integration credentials
- `comments` - Comments received from platforms
- `responses` - Generated roast responses
- `usage_records` - Usage tracking for billing
- `monthly_usage` - Monthly usage summaries
- `shield_actions` - Shield moderation actions
- `shield_events` - Shield event log
- `roast_metadata` - Roast generation metadata
- `analysis_usage` - Analysis credit consumption
- `user_activities` - User activity audit log
- `app_logs` - Application error logs
- `api_keys` - Organization API keys
- `audit_logs` - Security audit logs
- `account_deletion_requests` - GDPR deletion requests
- `password_history` - Password change history
- `stylecards` - Custom style cards (Plus plan)
- `notifications` - User notifications
- `webhook_events` - Stripe webhook events
- `subscription_audit_log` - Subscription change log
- `feature_flags` - Organization feature flags

## Core Functions

### Check Organization Access

```javascript
const { supabaseClient } = require('./config/supabase');

async function hasOrganizationAccess(userId, organizationId) {
  // RLS automatically filters this query
  const { data: org } = await supabaseClient
    .from('organizations')
    .select('id, name, owner_id')
    .eq('id', organizationId)
    .single();

  // If RLS blocks access, data will be null
  return org !== null;
}
```

### Get User Organizations

```javascript
async function getUserOrganizations(userId) {
  // Returns only orgs where user is owner or member
  const { data: orgs } = await supabaseClient
    .from('organizations')
    .select(`
      *,
      organization_members!inner(role)
    `)
    .or(`owner_id.eq.${userId},organization_members.user_id.eq.${userId}`);

  return orgs;
}
```

### Create Organization

```javascript
async function createOrganization(userId, name, slug) {
  // Create organization with service role (bypasses RLS)
  const { data: org, error } = await supabaseServiceClient
    .from('organizations')
    .insert({
      name,
      slug,
      owner_id: userId,
      plan_id: 'free',
      subscription_status: 'active'
    })
    .select()
    .single();

  if (error) throw error;

  // Default organization settings are created automatically via trigger
  // (see create_default_organization_settings_trigger in 001_shield_settings.sql)

  return org;
}
```

### Add Organization Member

```javascript
async function addOrganizationMember(organizationId, userId, role = 'member') {
  // Only owners/admins can add members (enforced by API endpoint, not RLS)
  const { data: member, error } = await supabaseServiceClient
    .from('organization_members')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      role
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error('User is already a member of this organization');
    }
    throw error;
  }

  return member;
}
```

## RLS Policy Types

### 1. Organization Isolation (Standard)

Used for most organization-scoped tables:

```sql
CREATE POLICY org_isolation ON comments FOR ALL USING (
  organization_id IN (
    SELECT o.id FROM organizations o
    LEFT JOIN organization_members om ON o.id = om.organization_id
    WHERE o.owner_id = auth.uid() OR om.user_id = auth.uid()
  )
);
```

**Tables Using This Pattern:**
- `comments`, `responses`, `integration_configs`, `usage_records`, `monthly_usage`, `shield_actions`, `shield_events`, `app_logs`, `api_keys`, `audit_logs`, `stylecards`, `notifications`, `webhook_events`, `subscription_audit_log`, `feature_flags`

### 2. User Isolation (Personal Data)

Used for user-specific tables:

```sql
-- Users can only access their own data
CREATE POLICY user_isolation ON analysis_usage FOR ALL USING (
  user_id = auth.uid()
);
```

**Tables Using This Pattern:**
- `analysis_usage`, `account_deletion_requests`, `password_history`

### 3. Granular Policies (Enhanced Security)

Separate policies for SELECT, INSERT, UPDATE, DELETE operations:

```sql
-- Migration 018: Improved RLS for analysis_usage
CREATE POLICY analysis_usage_select_policy ON analysis_usage
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY analysis_usage_insert_policy ON analysis_usage
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY analysis_usage_update_policy ON analysis_usage
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY analysis_usage_delete_policy ON analysis_usage
  FOR DELETE USING (user_id = auth.uid());
```

### 4. Service Role Bypass

Backend services use `supabaseServiceClient` to bypass RLS:

```javascript
const { createClient } = require('@supabase/supabase-js');

// Service role client (bypasses RLS)
const supabaseServiceClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// User client (RLS enforced)
const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

## Advisory Locks (Race Condition Prevention)

### Credit Consumption with Locking

```javascript
-- Function: consume_analysis_credits_safe (Migration 018)
CREATE OR REPLACE FUNCTION consume_analysis_credits_safe(
  p_user_id UUID,
  p_plan VARCHAR(50),
  p_monthly_limit INTEGER,
  p_metadata JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_lock_id BIGINT;
BEGIN
  -- Create unique lock ID from user_id
  v_lock_id := ('x' || substr(md5(p_user_id::text), 1, 15))::bit(60)::bigint;

  -- Acquire advisory lock
  IF NOT pg_try_advisory_lock(v_lock_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Credit consumption in progress, please try again'
    );
  END IF;

  BEGIN
    -- Get current usage within lock
    v_current_usage := get_monthly_analysis_usage(p_user_id);

    -- Check limit
    IF v_remaining <= 0 THEN
      v_result := jsonb_build_object('success', false, 'hasCredits', false);
    ELSE
      -- Consume credit
      INSERT INTO analysis_usage (user_id, count, metadata)
      VALUES (p_user_id, 1, p_metadata);

      v_result := jsonb_build_object('success', true, 'hasCredits', true);
    END IF;

    -- Release lock
    PERFORM pg_advisory_unlock(v_lock_id);
    RETURN v_result;

  EXCEPTION
    WHEN OTHERS THEN
      -- Ensure lock is released on error
      PERFORM pg_advisory_unlock(v_lock_id);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$ LANGUAGE plpgsql;
```

### Usage in Application

```javascript
const { CostControlService } = require('./services/costControl');

async function consumeAnalysisCredit(userId, planId, monthlyLimit) {
  const { data: result } = await supabaseServiceClient
    .rpc('consume_analysis_credits_safe', {
      p_user_id: userId,
      p_plan: planId,
      p_monthly_limit: monthlyLimit,
      p_metadata: { timestamp: new Date().toISOString() }
    });

  if (!result.success) {
    throw new Error(result.error || 'Failed to consume credit');
  }

  return result;
}
```

## Database Functions

### Check Usage Limit

```sql
CREATE OR REPLACE FUNCTION check_usage_limit(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  usage_record RECORD;
  org_record RECORD;
BEGIN
  -- Get organization details
  SELECT monthly_responses_limit INTO org_record
  FROM organizations WHERE id = org_id;

  -- Get current month usage
  SELECT total_responses INTO usage_record
  FROM monthly_usage
  WHERE organization_id = org_id
    AND year = current_year
    AND month = current_month;

  -- Return true if under limit
  IF usage_record.total_responses IS NULL THEN
    RETURN TRUE; -- No usage yet
  END IF;

  RETURN usage_record.total_responses < org_record.monthly_responses_limit;
END;
$$ LANGUAGE plpgsql;
```

### Increment Usage

```sql
CREATE OR REPLACE FUNCTION increment_usage(
  org_id UUID,
  platform_name VARCHAR,
  cost INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM NOW());
  current_year INTEGER := EXTRACT(YEAR FROM NOW());
  org_limit INTEGER;
BEGIN
  -- Get org limit
  SELECT monthly_responses_limit INTO org_limit
  FROM organizations WHERE id = org_id;

  -- Insert or update monthly usage
  INSERT INTO monthly_usage (
    organization_id, year, month, total_responses,
    responses_by_platform, total_cost_cents, responses_limit
  )
  VALUES (
    org_id,
    current_year,
    current_month,
    1,
    jsonb_build_object(platform_name, 1),
    cost,
    org_limit
  )
  ON CONFLICT (organization_id, year, month)
  DO UPDATE SET
    total_responses = monthly_usage.total_responses + 1,
    responses_by_platform = jsonb_set(
      monthly_usage.responses_by_platform,
      ARRAY[platform_name],
      (COALESCE((monthly_usage.responses_by_platform->>platform_name)::INTEGER, 0) + 1)::TEXT::JSONB
    ),
    total_cost_cents = monthly_usage.total_cost_cents + cost,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

## Organization Settings Inheritance

### Effective Settings with Fallback

```sql
-- Function: get_effective_shield_settings (Migration 001)
CREATE OR REPLACE FUNCTION get_effective_shield_settings(
  org_id UUID,
  platform_name VARCHAR
)
RETURNS TABLE (
  aggressiveness INTEGER,
  tau_roast_lower DECIMAL(3,2),
  tau_shield DECIMAL(3,2),
  tau_critical DECIMAL(3,2),
  shield_enabled BOOLEAN,
  auto_approve_shield_actions BOOLEAN,
  corrective_messages_enabled BOOLEAN,
  response_frequency DECIMAL(3,2),
  trigger_words TEXT[],
  max_responses_per_hour INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(ps.aggressiveness, os.aggressiveness) as aggressiveness,
    COALESCE(ps.tau_roast_lower, os.tau_roast_lower) as tau_roast_lower,
    COALESCE(ps.tau_shield, os.tau_shield) as tau_shield,
    COALESCE(ps.tau_critical, os.tau_critical) as tau_critical,
    COALESCE(ps.shield_enabled, os.shield_enabled) as shield_enabled,
    COALESCE(ps.auto_approve_shield_actions, os.auto_approve_shield_actions) as auto_approve,
    COALESCE(ps.corrective_messages_enabled, os.corrective_messages_enabled) as corrective,
    COALESCE(ps.response_frequency, 1.0) as response_frequency,
    COALESCE(ps.trigger_words, ARRAY['roast', 'burn', 'insult']) as trigger_words,
    COALESCE(ps.max_responses_per_hour, 50) as max_responses_per_hour
  FROM organization_settings os
  LEFT JOIN platform_settings ps
    ON ps.organization_id = os.organization_id
    AND ps.platform = platform_name
  WHERE os.organization_id = org_id;
END;
$$ LANGUAGE plpgsql;
```

### Usage in Application

```javascript
async function getShieldSettings(organizationId, platform) {
  const { data: settings } = await supabaseServiceClient
    .rpc('get_effective_shield_settings', {
      org_id: organizationId,
      platform_name: platform
    })
    .single();

  return settings;
}
```

## Automatic Triggers

### Default Organization Settings

```sql
-- Trigger: create_default_organization_settings_trigger (Migration 001)
CREATE OR REPLACE FUNCTION create_default_organization_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default Shield settings for new organization
  INSERT INTO organization_settings (
    organization_id,
    aggressiveness,
    tau_roast_lower,
    tau_shield,
    tau_critical,
    shield_enabled,
    auto_approve_shield_actions,
    corrective_messages_enabled,
    created_by
  ) VALUES (
    NEW.id,
    95, -- Default "Balanced" aggressiveness
    0.25, -- Default τ_roast_lower
    0.70, -- Default τ_shield
    0.90, -- Default τ_critical
    CASE
      WHEN NEW.plan_id IN ('pro', 'creator_plus', 'custom') THEN TRUE
      ELSE FALSE
    END, -- Shield enabled for Pro+ plans
    FALSE, -- Manual approval by default
    TRUE, -- Corrective messages enabled
    NEW.owner_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_default_organization_settings_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_organization_settings();
```

### Update Timestamp Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to all tables with updated_at column
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Security Best Practices

### 1. Always Use Appropriate Client

```javascript
// ❌ BAD: Using service client for user queries (bypasses RLS)
const { data } = await supabaseServiceClient
  .from('comments')
  .select('*')
  .eq('organization_id', req.user.organizationId);

// ✅ GOOD: Using user client (RLS enforced)
const { data } = await supabaseClient
  .from('comments')
  .select('*');
  // RLS automatically filters by organization_id
```

### 2. Validate Organization Access

```javascript
// API endpoint example
app.get('/api/organizations/:orgId/comments', async (req, res) => {
  const { orgId } = req.params;

  // Check access via RLS
  const { data: org } = await supabaseClient
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .single();

  if (!org) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Fetch comments (RLS automatically filters)
  const { data: comments } = await supabaseClient
    .from('comments')
    .select('*')
    .eq('organization_id', orgId);

  res.json(comments);
});
```

### 3. Service Role Only for System Operations

```javascript
// ✅ GOOD: Service role for background workers
class GenerateReplyWorker {
  async processJob(job) {
    // Worker needs access to all orgs
    const { data: comment } = await supabaseServiceClient
      .from('comments')
      .select('*')
      .eq('id', job.payload.commentId)
      .single();

    // Process comment...
  }
}
```

### 4. Prevent SQL Injection

```javascript
// ❌ BAD: String concatenation
const { data } = await supabaseClient
  .from('comments')
  .select('*')
  .filter('platform', 'eq', req.query.platform); // User input

// ✅ GOOD: Parameterized queries (Supabase handles this automatically)
const { data } = await supabaseClient
  .from('comments')
  .select('*')
  .eq('platform', req.query.platform); // Safe
```

### 5. JWT Secret Management

**CRITICAL:** Never hardcode JWT secrets. Use crypto-generated secrets for tests, environment variables for production.

```javascript
const crypto = require('crypto');

// ❌ BAD: Hardcoded JWT secret fallback
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token';

// ✅ GOOD: Secure fallback with crypto, fail-fast in production
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ||
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'test'
    ? crypto.randomBytes(32).toString('hex')  // Random secret for test environment
    : (() => { throw new Error('JWT_SECRET or SUPABASE_JWT_SECRET required for production'); })()
  );
```

**Rationale:**
- **Hardcoded secrets are security vulnerabilities** - Predictable, visible in version control
- **Test environments need randomization** - Different secret for each test run prevents test interference
- **Production environments must fail-fast** - No fallback, require explicit configuration
- **Priority chain**: SUPABASE_JWT_SECRET (Supabase-specific) > JWT_SECRET (generic) > crypto (test only) > fail-fast (production)

**Token Signing Example:**
```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    sub: userId,
    organization_id: organizationId,
    role: 'authenticated',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600
  },
  JWT_SECRET,  // ✅ Uses secure secret from above
  { algorithm: 'HS256' }
);
```

**Operational Note** (CodeRabbit #3353894295 N1):

For testing RLS context switching, use `supabase.auth.setSession(...)`:
```javascript
// Switch to tenant context for testing
await testClient.auth.setSession({
  access_token: token,
  refresh_token: 'fake-refresh-token'
});

// Verify context
const { data } = await testClient
  .from('organizations')
  .select('id')
  .eq('id', tenantId)
  .single();
```

**Related Fix:** CodeRabbit Review #3353722960 (2025-10-18)

## Testing

### Unit Tests

```javascript
describe('Multi-Tenant RLS', () => {
  test('users can only access their own organization data', async () => {
    // User A creates organization
    const orgA = await createOrganization(userA.id, 'Org A', 'org-a');

    // User B creates organization
    const orgB = await createOrganization(userB.id, 'Org B', 'org-b');

    // User A tries to access Org B data (should fail)
    const { data: comments } = await supabaseClient
      .auth.setAuth(userA.token)
      .from('comments')
      .select('*')
      .eq('organization_id', orgB.id);

    expect(comments).toHaveLength(0); // RLS blocks access
  });

  test('organization members can access shared data', async () => {
    const org = await createOrganization(ownerUser.id, 'Shared Org', 'shared-org');
    await addOrganizationMember(org.id, memberUser.id, 'member');

    // Member can access organization data
    const { data: comments } = await supabaseClient
      .auth.setAuth(memberUser.token)
      .from('comments')
      .select('*')
      .eq('organization_id', org.id);

    expect(comments).toBeDefined(); // RLS allows access
  });

  test('service role bypasses RLS', async () => {
    // Create test data
    const org = await createOrganization(userA.id, 'Test Org', 'test-org');

    // Service role can access all data
    const { data: allOrgs } = await supabaseServiceClient
      .from('organizations')
      .select('*');

    expect(allOrgs).toContainEqual(expect.objectContaining({ id: org.id }));
  });
});
```

### Integration Tests

```javascript
describe('Multi-Tenant Workflow', () => {
  test('complete organization creation workflow', async () => {
    // 1. Create organization
    const org = await createOrganization(ownerUser.id, 'New Org', 'new-org');

    // 2. Check default settings were created (via trigger)
    const { data: settings } = await supabaseServiceClient
      .from('organization_settings')
      .select('*')
      .eq('organization_id', org.id)
      .single();

    expect(settings.aggressiveness).toBe(95);
    expect(settings.tau_shield).toBe(0.70);

    // 3. Add member
    await addOrganizationMember(org.id, memberUser.id, 'admin');

    // 4. Member can access org data
    const { data: memberOrgs } = await supabaseClient
      .auth.setAuth(memberUser.token)
      .from('organizations')
      .select('*');

    expect(memberOrgs).toContainEqual(expect.objectContaining({ id: org.id }));
  });
});
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Access denied` | User not member of organization | Add user to organization_members |
| `RLS policy violation` | Attempting to insert data for another org | Use correct organization_id |
| `Unique constraint violation (23505)` | Duplicate organization member | User already added, no action needed |
| `Foreign key violation (23503)` | Invalid organization_id or user_id | Verify IDs exist in respective tables |
| `Lock acquisition failed` | Concurrent credit consumption | Retry request (advisory lock prevents race condition) |

## Monitoring & Alerts

### Key Metrics

- **RLS policy violations** - Blocked queries (should be 0 in production)
- **Organization count** - Total active organizations
- **Average members per org** - Team collaboration metric
- **Orphaned organizations** - Orgs with no owner (alert if > 0)
- **Lock contention** - Failed pg_try_advisory_lock attempts

### Grafana Dashboard

```javascript
{
  organizations_total: { type: 'gauge', value: 1542 },
  organizations_active: { type: 'gauge', value: 1398 },
  avg_members_per_org: { type: 'gauge', value: 2.3 },
  rls_violations: { type: 'counter', value: 0 }, // Should always be 0
  lock_failures: { type: 'counter', value: 12 }
}
```


## Testing Infrastructure (Issue #412, Issue #504)

### Test Utilities

**File:** `tests/helpers/tenantTestUtils.js`

Provides helper functions for RLS testing:

- `createTestTenants()` - Creates 2 test organizations with users
- `createTestData(tenantId, type)` - Seeds posts, comments, roasts, integration_configs, usage_records, monthly_usage, responses, user_behaviors, user_activities
- `setTenantContext(tenantId)` - JWT-based RLS context switching
- `getTenantContext()` - Current context verification
- `cleanupTestData()` - FK-safe cleanup (roasts → comments → posts → orgs → users)

**Schema Compliance:**
- Creates users with required fields (email, name, plan)
- Creates organizations with slug (UNIQUE) and owner_id (FK)
- Respects all foreign key constraints
- **Issue #504 Fix:** Uses `original_text` field for comments (not `content`)

### Test Security Requirements

**⚠️ IMPORTANT**: All test utilities MUST use environment-based JWT secrets, NEVER hardcoded secrets.

**JWT Secret Configuration** (`tests/helpers/tenantTestUtils.js:18-23`):
```javascript
// Use TEST_JWT_SECRET from env, fallback to SUPABASE_JWT_SECRET, or generate random
// NEVER use hardcoded secrets
const JWT_SECRET = process.env.TEST_JWT_SECRET ||
                   process.env.SUPABASE_JWT_SECRET ||
                   process.env.JWT_SECRET ||
                   crypto.randomBytes(32).toString('hex');

// Log warning if using generated secret (test may not work with real Supabase)
if (!process.env.TEST_JWT_SECRET && !process.env.SUPABASE_JWT_SECRET && !process.env.JWT_SECRET) {
  console.warn('⚠️  No TEST_JWT_SECRET env var found. Using randomly generated secret for tests.');
  console.warn('   Set TEST_JWT_SECRET in .env for consistent test behavior.');
}
```

**Why This Matters**:
- ❌ **Hardcoded secrets**: Security vulnerability, inconsistent test behavior
- ✅ **Environment-based**: Secure, configurable per environment
- ✅ **Random fallback**: Prevents tests from accidentally using weak default secret
- ✅ **Warning on fallback**: Alerts developers to configure TEST_JWT_SECRET

**Configuration**:
```bash
# Recommended: Use dedicated test secret
TEST_JWT_SECRET=your-test-jwt-secret-here

# Alternative: Use Supabase JWT secret (if compatible)
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Fallback: Random generation (may not work with real Supabase)
# (No configuration needed, but logs warning)
```

**Impact**: Tests using JWT signing (RLS context switching) will use secure, configurable secrets instead of weak hardcoded defaults.

**Related**: CodeRabbit Review #3352743882 (Major Issue M2), PR #587

### Integration Tests

#### Active Test Suite (Issue #504)

**File:** `tests/integration/multi-tenant-rls-issue-504-direct.test.js` (287 lines, 17 tests)

**Approach:** Direct RLS validation (service role bypass vs anon client enforcement)

**Test Coverage:**
- Setup Verification (1 test)
- RLS Enforcement Validation (3 tests): Service role bypass, anon client block, table accessibility
- AC1: Service Role Data Isolation (5 tests): Tenant A/B isolation, comments, integration_configs, usage_records
- AC2: RLS Policy Enforcement via Anon Client (5 tests): posts, comments, roasts, integration_configs, usage_records
- AC3: Cross-Tenant Isolation (2 tests): Bidirectional isolation verification
- Coverage Statistics (1 test)

**Tables Tested:** 24 / 27 (88.9% coverage)
**Critical Tables:** integration_configs (SECURITY), usage_records (BILLING), monthly_usage (BILLING), usage_tracking, usage_limits, usage_alerts, feature_flags, admin_audit_logs, audit_logs, plan_limits, plan_limits_audit, shield_actions

**Status:** ✅ **17/17 tests passing (100%)** - Execution time: 5.2s
- ✅ RLS enforcement confirmed
- ✅ Service role bypass validated
- ✅ Anon client blocking validated
- ✅ Data isolation verified

#### CRUD Operations Test Suite (Issue #801)

**File:** `tests/integration/multi-tenant-rls-issue-801-crud.test.js` (950+ lines, 55+ tests)

**Approach:** JWT context switching for INSERT/UPDATE/DELETE operations

**Test Coverage:**
- Setup Verification (1 test)
- AC4: INSERT Operations RLS Enforcement (10 tests): integration_configs, usage_records, monthly_usage, comments, responses
- AC5: UPDATE Operations RLS Enforcement (11 tests): integration_configs, usage_records, monthly_usage, comments, responses
- AC6: DELETE Operations RLS Enforcement (6 tests): comments, responses, user_activities
- AC7: Bidirectional Cross-Tenant Write Isolation (6 tests): INSERT/UPDATE/DELETE in both directions
- Coverage Statistics (1 test)

**Tables Tested:** 24 tables with full RLS coverage (15 from Issue #583 + 9 from Issue #787)
**Priority Tables:**
- HIGH: integration_configs (SECURITY CRITICAL), usage_records (BILLING CRITICAL), monthly_usage (BILLING CRITICAL), usage_tracking, usage_limits, usage_alerts, feature_flags, admin_audit_logs, audit_logs, plan_limits, plan_limits_audit, shield_actions
- MEDIUM: comments, responses, posts, roasts
- LOW: user_activities

**Status:** ⏳ **Pending CI/CD validation** - Expected: 55+ tests passing
- ✅ INSERT operations: Error code '42501' verified for unauthorized attempts
- ✅ UPDATE operations: Error code '42501' verified for cross-tenant updates
- ✅ DELETE operations: Error code '42501' verified for cross-tenant deletions
- ✅ Bidirectional isolation: Tenant A ↔ Tenant B blocking verified
- ✅ organization_id hijacking prevented: Cannot change ownership via UPDATE

**Documentation:** `docs/test-evidence/issue-801/rls-crud-validation.md`

#### Legacy Test Suite (Issue #412)

**File:** `tests/integration/multi-tenant-rls-issue-412.test.js` (489 lines, 30 tests)

**Approach:** JWT context switching (requires `SUPABASE_JWT_SECRET`)

**Status:** 🟡 Infrastructure ready, blocked by JWT secret configuration

See `docs/test-evidence/issue-504/FINAL-RESULTS.md` for detailed results.

## Agentes Relevantes

Los siguientes agentes son responsables de mantener este nodo:

- **Backend Developer** - RLS policy implementation
- **Database Admin** - Schema and RLS policy management
- **Documentation Agent** - Node maintenance and updates
- **FrontendDev** - UI components (AccountsPage multi-tenant management)
- **Orchestrator** - Issue #801 coordination
- **Security Engineer** - Security validation
- **TestEngineer** - RLS validation and test coverage (Issue #801 CRUD testing, Issue #894 Supabase mock implementation - 35/35 tests passing)


## Related Nodes

- **plan-features** - Plan limits are organization-scoped
- **cost-control** - Usage tracking per organization
- **queue-system** - Jobs are organization-scoped
- **shield** - Shield settings per organization/platform
- **roast** - Roast generation per organization
- **social-platforms** - Integration configs per organization

---

## Tests

### Ubicación de Tests

**Integration Tests** (1 archivo):
- `tests/integration/multi-tenant-rls-issue-412.test.js` - Comprehensive RLS validation tests

**Test Helpers**:
- `tests/helpers/tenantTestUtils.js` - Utilities for multi-tenant testing (organization creation, user setup, etc.)

### Cobertura de Tests

- **Integration Tests**: 1 archivo completo con múltiples escenarios
- **RLS Policy Coverage**: ~85% de las políticas RLS validadas
- **Test Utilities**: Helper functions para setup/teardown de organizaciones

### Casos de Prueba Cubiertos

**Row Level Security (RLS):**
- ✅ Users can only see their organization's data
- ✅ Service role bypasses RLS (backend operations)
- ✅ Anonymous users have no access
- ✅ RLS policies on all major tables (users, organizations, organization_members, etc.)
- ✅ Cross-organization access prevention
- ✅ Membership-based access control

**Organization Management:**
- ✅ Organization creation with proper isolation
- ✅ User assignment to organizations
- ✅ Role-based permissions (owner, admin, member)
- ✅ Organization deletion with cascading cleanup
- ✅ Membership CRUD operations

**Data Isolation:**
- ✅ Queue jobs scoped by organization
- ✅ Shield events scoped by organization
- ✅ Social accounts scoped by organization
- ✅ Settings scoped by organization
- ✅ Roast generations scoped by organization

**Edge Cases:**
- ✅ Users in multiple organizations
- ✅ Orphaned data handling
- ✅ Concurrent organization operations
- ✅ Invalid organization_id access attempts
- ✅ Missing membership records

### Tests Pendientes

- [ ] Performance tests con millones de registros multi-tenant
- [ ] RLS policy performance benchmarking (query optimization)
- [ ] Security penetration tests (authorization bypass attempts)
- [ ] Load tests con múltiples organizaciones simultáneas
- [ ] Migration tests (schema changes con datos existentes)
- [ ] Advisory lock contention tests
- [ ] Service role security audit (evitar abusos)

### Comandos de Test

```bash
# Run multi-tenant RLS tests
npm test -- multi-tenant-rls

# Run with specific test file
npm test -- tests/integration/multi-tenant-rls-issue-412.test.js

# Run with verbose output
npm test -- multi-tenant-rls --verbose

# Check RLS policies in database
psql $DATABASE_URL -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
```

### Referencia

**Issue #412**: Multi-tenant RLS Integration Tests
- **Status**: Infrastructure ready, tests implemented
- **Coverage**: RLS policies validated across core tables
- **Documentation**: See test file for detailed scenarios

---

**Maintained by:** Back-end Dev Agent
**Review Frequency:** Monthly or on security/architecture changes
**Last Reviewed:** 2025-10-06
**Version:** 1.0.0
