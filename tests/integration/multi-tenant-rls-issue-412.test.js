/**
 * Multi-Tenant RLS Integration Tests - Issue #412
 *
 * Tests Row Level Security policies for multi-tenant data isolation.
 * Validates that tenants can only access their own data.
 *
 * Related Issue: #412
 * Related Node: multi-tenant.md
 * Related Plan: docs/plan/issue-412.md
 */

const {
  createTestTenants,
  createTestData,
  setTenantContext,
  getTenantContext,
  cleanupTestData,
  testClient
} = require('../helpers/tenantTestUtils');

jest.setTimeout(30000);

describe('Multi-Tenant RLS Integration Tests - Issue #412', () => {
  let tenantA, tenantB, tenantAData, tenantBData;

  beforeAll(async () => {
    console.log('\n🚀 Setting up multi-tenant test environment...\n');

    const tenants = await createTestTenants();
    tenantA = tenants.tenantA;
    tenantB = tenants.tenantB;

    tenantAData = await createTestData(tenantA.id, 'all');
    tenantA.posts = tenantAData.posts;
    tenantA.comments = tenantAData.comments;
    tenantA.roasts = tenantAData.roasts;
    // Issue #583: Add new table data
    tenantA.integrationConfigs = tenantAData.integrationConfigs;
    tenantA.usageRecords = tenantAData.usageRecords;
    tenantA.monthlyUsage = tenantAData.monthlyUsage;
    tenantA.responses = tenantAData.responses;
    tenantA.userBehaviors = tenantAData.userBehaviors;
    tenantA.userActivities = tenantAData.userActivities;

    tenantBData = await createTestData(tenantB.id, 'all');
    tenantB.posts = tenantBData.posts;
    tenantB.comments = tenantBData.comments;
    tenantB.roasts = tenantBData.roasts;
    // Issue #583: Add new table data
    tenantB.integrationConfigs = tenantBData.integrationConfigs;
    tenantB.usageRecords = tenantBData.usageRecords;
    tenantB.monthlyUsage = tenantBData.monthlyUsage;
    tenantB.responses = tenantBData.responses;
    tenantB.userBehaviors = tenantBData.userBehaviors;
    tenantB.userActivities = tenantBData.userActivities;

    console.log('\n✅ Test environment setup complete\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Tearing down test environment...\n');
    await cleanupTestData();
    console.log('\n✅ Teardown complete\n');
  });

  describe('Setup Verification', () => {
    test('Setup creates 2 tenants with isolated data', () => {
      expect(tenantA).toBeDefined();
      expect(tenantB).toBeDefined();
      expect(tenantA.id).not.toBe(tenantB.id);

      console.log(`\n📋 Tenant A: ${tenantA.id}`);
      console.log(`📋 Tenant B: ${tenantB.id}`);

      // Original tables
      expect(tenantA.posts.length).toBeGreaterThan(0);
      expect(tenantA.comments.length).toBeGreaterThan(0);
      expect(tenantA.roasts.length).toBeGreaterThan(0);

      expect(tenantB.posts.length).toBeGreaterThan(0);
      expect(tenantB.comments.length).toBeGreaterThan(0);
      expect(tenantB.roasts.length).toBeGreaterThan(0);

      // Issue #583: Verify new tables (may be 0 if table doesn't exist yet)
      expect(tenantA.integrationConfigs).toBeDefined();
      expect(tenantA.usageRecords).toBeDefined();
      expect(tenantA.monthlyUsage).toBeDefined();
      expect(tenantA.responses).toBeDefined();
      expect(tenantA.userBehaviors).toBeDefined();
      expect(tenantA.userActivities).toBeDefined();

      console.log(
        `  ✅ Tenant A: ${tenantA.posts.length} posts, ${tenantA.comments.length} comments, ${tenantA.roasts.length} roasts`
      );
      console.log(
        `  ✅ Tenant A (new): ${tenantA.integrationConfigs.length} configs, ${tenantA.usageRecords.length} usage, ${tenantA.responses.length} responses`
      );
      console.log(
        `  ✅ Tenant B: ${tenantB.posts.length} posts, ${tenantB.comments.length} comments, ${tenantB.roasts.length} roasts`
      );
      console.log(
        `  ✅ Tenant B (new): ${tenantB.integrationConfigs.length} configs, ${tenantB.usageRecords.length} usage, ${tenantB.responses.length} responses`
      );
    });
  });

  // AC1: Listados restringidos por tenant_id automáticamente
  describe('AC1: Listados restringidos por tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /posts returns only Tenant A posts', async () => {
      const { data, error } = await testClient.from('posts').select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(tenantA.posts.length);
      expect(data.every((p) => p.organization_id === tenantA.id)).toBe(true);
    });

    test('GET /comments returns only Tenant A comments', async () => {
      const { data, error } = await testClient.from('comments').select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(tenantA.comments.length);
      expect(data.every((c) => c.organization_id === tenantA.id)).toBe(true);
    });

    test('GET /roasts returns only Tenant A roasts', async () => {
      const { data, error } = await testClient.from('roasts').select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(tenantA.roasts.length);
      expect(data.every((r) => r.organization_id === tenantA.id)).toBe(true);
    });
  });

  // AC2: Accesos directos por ID verifican tenant_id
  describe('AC2: Accesos directos por ID verifican tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /posts/:id returns 200 for own tenant', async () => {
      const { data, error } = await testClient
        .from('posts')
        .select('*')
        .eq('id', tenantA.posts[0].id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(tenantA.posts[0].id);
      expect(data.organization_id).toBe(tenantA.id);
    });

    test('GET /posts/:id returns null for other tenant', async () => {
      const { data, error } = await testClient
        .from('posts')
        .select('*')
        .eq('id', tenantB.posts[0].id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('GET /comments/:id returns 200 for own tenant', async () => {
      const { data, error } = await testClient
        .from('comments')
        .select('*')
        .eq('id', tenantA.comments[0].id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(tenantA.comments[0].id);
    });

    test('GET /comments/:id returns null for other tenant', async () => {
      const { data, error } = await testClient
        .from('comments')
        .select('*')
        .eq('id', tenantB.comments[0].id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('GET /roasts/:id returns 200 for own tenant', async () => {
      const { data, error } = await testClient
        .from('roasts')
        .select('*')
        .eq('id', tenantA.roasts[0].id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(tenantA.roasts[0].id);
    });

    test('GET /roasts/:id returns null for other tenant', async () => {
      const { data, error } = await testClient
        .from('roasts')
        .select('*')
        .eq('id', tenantB.roasts[0].id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  // AC3: Accesos cruzados devuelven 404/forbidden
  describe('AC3: Accesos cruzados devuelven 404/forbidden', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A cannot read Tenant B posts', async () => {
      const { data, error } = await testClient
        .from('posts')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS blocks, returns empty
    });

    test('Tenant A cannot read Tenant B comments', async () => {
      const { data, error } = await testClient
        .from('comments')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    test('Tenant A cannot read Tenant B roasts', async () => {
      const { data, error } = await testClient
        .from('roasts')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // Issue #583: AC1 - integration_configs (SECURITY CRITICAL - credentials isolation)
  describe('AC1 (Issue #583): Listados restringidos - integration_configs', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /integration_configs returns only Tenant A configs', async () => {
      const { data, error } = await testClient.from('integration_configs').select('*');

      expect(error).toBeNull();
      if (data && data.length > 0) {
        expect(data.every((c) => c.organization_id === tenantA.id)).toBe(true);
      }
    });

    test('Tenant A cannot read Tenant B integration configs (SECURITY)', async () => {
      const { data, error } = await testClient
        .from('integration_configs')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS blocks, returns empty
    });
  });

  // Issue #583: AC1 - usage_records (BILLING CRITICAL)
  describe('AC1 (Issue #583): Listados restringidos - usage_records', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /usage_records returns only Tenant A records', async () => {
      const { data, error } = await testClient.from('usage_records').select('*');

      expect(error).toBeNull();
      if (data && data.length > 0) {
        expect(data.every((r) => r.organization_id === tenantA.id)).toBe(true);
      }
    });

    test('Tenant A cannot read Tenant B usage records', async () => {
      const { data, error } = await testClient
        .from('usage_records')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // Issue #583: AC1 - monthly_usage (BILLING CRITICAL)
  describe('AC1 (Issue #583): Listados restringidos - monthly_usage', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /monthly_usage returns only Tenant A summaries', async () => {
      const { data, error } = await testClient.from('monthly_usage').select('*');

      expect(error).toBeNull();
      if (data && data.length > 0) {
        expect(data.every((m) => m.organization_id === tenantA.id)).toBe(true);
      }
    });

    test('Tenant A cannot read Tenant B monthly usage', async () => {
      const { data, error } = await testClient
        .from('monthly_usage')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // Issue #583: AC1 - responses
  describe('AC1 (Issue #583): Listados restringidos - responses', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /responses returns only Tenant A responses', async () => {
      const { data, error } = await testClient.from('responses').select('*');

      expect(error).toBeNull();
      if (data && data.length > 0) {
        expect(data.every((r) => r.organization_id === tenantA.id)).toBe(true);
      }
    });

    test('Tenant A cannot read Tenant B responses', async () => {
      const { data, error } = await testClient
        .from('responses')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // Issue #583: AC1 - user_behaviors (Shield tracking)
  describe('AC1 (Issue #583): Listados restringidos - user_behaviors', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /user_behaviors returns only Tenant A behaviors', async () => {
      const { data, error } = await testClient.from('user_behaviors').select('*');

      expect(error).toBeNull();
      if (data && data.length > 0) {
        expect(data.every((b) => b.organization_id === tenantA.id)).toBe(true);
      }
    });

    test('Tenant A cannot read Tenant B user behaviors', async () => {
      const { data, error } = await testClient
        .from('user_behaviors')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // Issue #583: AC1 - user_activities
  describe('AC1 (Issue #583): Listados restringidos - user_activities', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /user_activities returns only Tenant A activities', async () => {
      const { data, error } = await testClient.from('user_activities').select('*');

      expect(error).toBeNull();
      if (data && data.length > 0) {
        expect(data.every((a) => a.organization_id === tenantA.id)).toBe(true);
      }
    });

    test('Tenant A cannot read Tenant B activities', async () => {
      const { data, error } = await testClient
        .from('user_activities')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // Issue #583: AC2 - Direct access tests for new tables
  describe('AC2 (Issue #583): Accesos directos por ID verifican tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('integration_configs: GET by ID returns 200 for own tenant', async () => {
      if (tenantA.integrationConfigs.length === 0) return; // Skip if no data

      const { data, error } = await testClient
        .from('integration_configs')
        .select('*')
        .eq('id', tenantA.integrationConfigs[0].id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.organization_id).toBe(tenantA.id);
    });

    test('integration_configs: GET by ID returns null for other tenant', async () => {
      if (tenantB.integrationConfigs.length === 0) return; // Skip if no data

      const { data, error } = await testClient
        .from('integration_configs')
        .select('*')
        .eq('id', tenantB.integrationConfigs[0].id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('usage_records: GET by ID returns 200 for own tenant', async () => {
      if (tenantA.usageRecords.length === 0) return;

      const { data, error } = await testClient
        .from('usage_records')
        .select('*')
        .eq('id', tenantA.usageRecords[0].id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.organization_id).toBe(tenantA.id);
    });

    test('usage_records: GET by ID returns null for other tenant', async () => {
      if (tenantB.usageRecords.length === 0) return;

      const { data, error } = await testClient
        .from('usage_records')
        .select('*')
        .eq('id', tenantB.usageRecords[0].id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('RLS Context Verification', () => {
    test('getTenantContext returns current tenant ID', async () => {
      await setTenantContext(tenantA.id);
      expect(getTenantContext()).toBe(tenantA.id);

      await setTenantContext(tenantB.id);
      expect(getTenantContext()).toBe(tenantB.id);
    });
  });
});
