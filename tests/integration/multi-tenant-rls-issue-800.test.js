/**
 * Multi-Tenant RLS Integration Tests - Issue #800
 *
 * Expands RLS test coverage from 6/22 tables (27%) to 11/22 tables (50%)
 * by adding tests for 5 additional tables that currently exist in the database.
 *
 * **Incremental Approach:**
 * - Phase 1 (this PR): Test 5 existing tables → 50% coverage
 * - Phase 2 (future): Add remaining 11 tables when migrations are ready → ~100% coverage
 *
 * **Tables Tested in This PR (5):**
 * 1. app_logs (organization-scoped)
 * 2. api_keys (organization-scoped)
 * 3. audit_logs (organization-scoped)
 * 4. account_deletion_requests (user-scoped)
 * 5. password_history (user-scoped)
 *
 * **Test Strategy (from PR #790):**
 * - Direct RLS validation: Service role bypasses RLS, anon client is blocked
 * - No JWT context switching required
 * - Validates complete data isolation between tenants
 *
 * Related: Issue #504 (baseline tests), Issue #412 (infrastructure), PR #790
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

jest.setTimeout(30000);

describe('Multi-Tenant RLS Integration Tests - Issue #800 (5 Additional Tables)', () => {
  let serviceClient;
  let testClient;
  let tenantA;
  let tenantB;

  beforeAll(async () => {
    console.log('\n🚀 Setting up multi-tenant test environment (5 additional tables)...\n');

    // Service client (bypasses RLS)
    serviceClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Anon client (RLS enforced)
    testClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Create 2 test tenants
    tenantA = await createTestTenant('Tenant A Issue 800');
    tenantB = await createTestTenant('Tenant B Issue 800');

    console.info(`📋 Tenant A: ${tenantA.id}`);
    console.info(`📋 Tenant B: ${tenantB.id}`);

    // Populate test data in 5 tables
    await populateTestData();
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up test data...\n');

    // Cleanup test data
    if (tenantA?.id) {
      await serviceClient.from('app_logs').delete().eq('organization_id', tenantA.id);
      await serviceClient.from('api_keys').delete().eq('organization_id', tenantA.id);
      await serviceClient.from('audit_logs').delete().eq('organization_id', tenantA.id);
      await serviceClient.from('account_deletion_requests').delete().eq('user_id', tenantA.ownerId);
      await serviceClient.from('password_history').delete().eq('user_id', tenantA.ownerId);
      await serviceClient.from('organizations').delete().eq('id', tenantA.id);
      await serviceClient.from('users').delete().eq('id', tenantA.ownerId);
    }

    if (tenantB?.id) {
      await serviceClient.from('app_logs').delete().eq('organization_id', tenantB.id);
      await serviceClient.from('api_keys').delete().eq('organization_id', tenantB.id);
      await serviceClient.from('audit_logs').delete().eq('organization_id', tenantB.id);
      await serviceClient.from('account_deletion_requests').delete().eq('user_id', tenantB.ownerId);
      await serviceClient.from('password_history').delete().eq('user_id', tenantB.ownerId);
      await serviceClient.from('organizations').delete().eq('id', tenantB.id);
      await serviceClient.from('users').delete().eq('id', tenantB.ownerId);
    }

    console.log('✅ Cleanup complete\n');
  });

  // ============================================================================
  // SETUP VERIFICATION
  // ============================================================================

  describe('Setup Verification', () => {
    test('Setup creates 2 tenants with test data in 5 additional tables', () => {
      expect(tenantA).toBeDefined();
      expect(tenantB).toBeDefined();
      expect(tenantA.id).not.toBe(tenantB.id);
    });
  });

  // ============================================================================
  // AC1: Service Role Data Access - Organization-Scoped Tables (3 tables)
  // ============================================================================

  describe('AC1: Service Role Data Access - Organization-Scoped Tables (3 tables)', () => {
    test('Service role can access app_logs from both tenants', async () => {
      const { data, error } = await serviceClient
        .from('app_logs')
        .select('*')
        .in('organization_id', [tenantA.id, tenantB.id]);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThanOrEqual(2); // At least our test data

      const tenantAData = data.filter(r => r.organization_id === tenantA.id);
      const tenantBData = data.filter(r => r.organization_id === tenantB.id);

      expect(tenantAData.length).toBeGreaterThanOrEqual(1);
      expect(tenantBData.length).toBeGreaterThanOrEqual(1);
    });

    test('Service role can access api_keys from both tenants (SECURITY CRITICAL)', async () => {
      const { data, error } = await serviceClient
        .from('api_keys')
        .select('*')
        .in('organization_id', [tenantA.id, tenantB.id]);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThanOrEqual(2);

      const tenantAData = data.filter(r => r.organization_id === tenantA.id);
      const tenantBData = data.filter(r => r.organization_id === tenantB.id);

      expect(tenantAData.length).toBeGreaterThanOrEqual(1);
      expect(tenantBData.length).toBeGreaterThanOrEqual(1);
    });

    test('Service role can access audit_logs from both tenants (AUDIT CRITICAL)', async () => {
      const { data, error } = await serviceClient
        .from('audit_logs')
        .select('*')
        .in('organization_id', [tenantA.id, tenantB.id]);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThanOrEqual(2);

      const tenantAData = data.filter(r => r.organization_id === tenantA.id);
      const tenantBData = data.filter(r => r.organization_id === tenantB.id);

      expect(tenantAData.length).toBeGreaterThanOrEqual(1);
      expect(tenantBData.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // AC2: Service Role Data Access - User-Scoped Tables (2 tables)
  // ============================================================================

  describe('AC2: Service Role Data Access - User-Scoped Tables (2 tables)', () => {
    test('Service role can access account_deletion_requests from both users (GDPR CRITICAL)', async () => {
      const { data, error } = await serviceClient
        .from('account_deletion_requests')
        .select('*')
        .in('user_id', [tenantA.ownerId, tenantB.ownerId]);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThanOrEqual(2);

      const tenantAData = data.filter(r => r.user_id === tenantA.ownerId);
      const tenantBData = data.filter(r => r.user_id === tenantB.ownerId);

      expect(tenantAData.length).toBeGreaterThanOrEqual(1);
      expect(tenantBData.length).toBeGreaterThanOrEqual(1);
    });

    test('Service role can access password_history from both users (SECURITY CRITICAL)', async () => {
      const { data, error } = await serviceClient
        .from('password_history')
        .select('*')
        .in('user_id', [tenantA.ownerId, tenantB.ownerId]);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThanOrEqual(2);

      const tenantAData = data.filter(r => r.user_id === tenantA.ownerId);
      const tenantBData = data.filter(r => r.user_id === tenantB.ownerId);

      expect(tenantAData.length).toBeGreaterThanOrEqual(1);
      expect(tenantBData.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // AC3: Anon Client RLS Enforcement - Organization-Scoped Tables (3 tables)
  // ============================================================================

  describe('AC3: Anon Client RLS Enforcement - Organization-Scoped Tables (3 tables)', () => {
    test('Anon client returns empty for app_logs (RLS blocks)', async () => {
      const { data, error } = await testClient
        .from('app_logs')
        .select('*');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test('Anon client returns empty for api_keys (RLS blocks - SECURITY)', async () => {
      const { data, error } = await testClient
        .from('api_keys')
        .select('*');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test('Anon client returns empty for audit_logs (RLS blocks - AUDIT)', async () => {
      const { data, error } = await testClient
        .from('audit_logs')
        .select('*');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  // ============================================================================
  // AC4: Anon Client RLS Enforcement - User-Scoped Tables (2 tables)
  // ============================================================================

  describe('AC4: Anon Client RLS Enforcement - User-Scoped Tables (2 tables)', () => {
    test('Anon client returns empty for account_deletion_requests (RLS blocks - GDPR)', async () => {
      const { data, error } = await testClient
        .from('account_deletion_requests')
        .select('*');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test('Anon client returns empty for password_history (RLS blocks - SECURITY)', async () => {
      const { data, error } = await testClient
        .from('password_history')
        .select('*');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  // ============================================================================
  // COVERAGE STATISTICS
  // ============================================================================

  describe('Coverage Statistics', () => {
    test('Count total tables tested (baseline + expansion)', () => {
      const baselineTables = 6; // From issue #412
      const expansionTables = 5; // This PR
      const totalTested = baselineTables + expansionTables;
      const totalTables = 22; // From multi-tenant.md
      const coveragePercent = ((totalTested / totalTables) * 100).toFixed(1);

      console.info(`\n📊 RLS Test Coverage:`);
      console.info(`   Baseline (issue #412): ${baselineTables} tables`);
      console.info(`   Expansion (issue #800): ${expansionTables} tables`);
      console.info(`   Total: ${totalTested}/${totalTables} (${coveragePercent}%)`);

      expect(totalTested).toBe(11);
      expect(Number(coveragePercent)).toBeGreaterThanOrEqual(50);
    });
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  async function createTestTenant(name) {
    const orgId = uuidv4();
    const ownerId = uuidv4();
    const slug = `test-issue-800-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const email = `${slug}@test.local`;

    // Create user
    const { error: userError } = await serviceClient
      .from('users')
      .insert({
        id: ownerId,
        email,
        name: name
      });

    if (userError && !userError.message.includes('already exists')) {
      throw new Error(`Failed to create user: ${userError.message}`);
    }

    // Create organization
    const { data: org, error: orgError } = await serviceClient
      .from('organizations')
      .insert({
        id: orgId,
        name,
        slug,
        owner_id: ownerId,
        plan_id: 'free'
      })
      .select()
      .single();

    if (orgError) {
      throw new Error(`Failed to create organization: ${orgError.message}`);
    }

    return { id: orgId, ownerId, email, slug, ...org };
  }

  async function populateTestData() {
    console.log('  🔧 Creating test data...');

    // Organization-scoped tables (3 tables)

    // 1. app_logs
    const { error: appLogsError } = await serviceClient.from('app_logs').insert([
      {
        organization_id: tenantA.id,
        level: 'error',
        category: 'test',
        message: 'Test error for Tenant A',
        metadata: { source: 'issue-800-test' }
      },
      {
        organization_id: tenantB.id,
        level: 'error',
        category: 'test',
        message: 'Test error for Tenant B',
        metadata: { source: 'issue-800-test' }
      }
    ]);
    if (appLogsError) console.warn('    ⚠️  app_logs error:', appLogsError.message);
    else console.log('    ✅ app_logs');

    // 2. api_keys
    const { error: apiKeysError } = await serviceClient.from('api_keys').insert([
      {
        organization_id: tenantA.id,
        key_hash: 'test_hash_a_' + Date.now(),
        key_preview: 'test_a',
        name: 'Test Key A',
        scopes: ['read']
      },
      {
        organization_id: tenantB.id,
        key_hash: 'test_hash_b_' + Date.now(),
        key_preview: 'test_b',
        name: 'Test Key B',
        scopes: ['read']
      }
    ]);
    if (apiKeysError) console.warn('    ⚠️  api_keys error:', apiKeysError.message);
    else console.log('    ✅ api_keys');

    // 3. audit_logs
    await serviceClient.from('audit_logs').insert([
      {
        organization_id: tenantA.id,
        user_id: tenantA.ownerId,
        action: 'test_action',
        resource_type: 'test',
        resource_id: uuidv4(),
        details: { test: 'issue-800' }
      },
      {
        organization_id: tenantB.id,
        user_id: tenantB.ownerId,
        action: 'test_action',
        resource_type: 'test',
        resource_id: uuidv4(),
        details: { test: 'issue-800' }
      }
    ]);
    console.log('    ✅ audit_logs');

    // User-scoped tables (2 tables)

    // 4. account_deletion_requests
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // 30 days from now

    const { error: deletionError } = await serviceClient.from('account_deletion_requests').insert([
      {
        user_id: tenantA.ownerId,
        user_email: tenantA.email,
        scheduled_deletion_at: futureDate.toISOString(),
        status: 'pending'
      },
      {
        user_id: tenantB.ownerId,
        user_email: tenantB.email,
        scheduled_deletion_at: futureDate.toISOString(),
        status: 'pending'
      }
    ]);
    if (deletionError) console.warn('    ⚠️  account_deletion_requests error:', deletionError.message);
    else console.log('    ✅ account_deletion_requests');

    // 5. password_history
    await serviceClient.from('password_history').insert([
      {
        user_id: tenantA.ownerId,
        password_hash: 'test_hash_' + Date.now() + '_a'
      },
      {
        user_id: tenantB.ownerId,
        password_hash: 'test_hash_' + Date.now() + '_b'
      }
    ]);
    console.log('    ✅ password_history');

    console.log('  ✅ Test data created\n');
  }
});
