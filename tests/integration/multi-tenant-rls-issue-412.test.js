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

    tenantBData = await createTestData(tenantB.id, 'all');
    tenantB.posts = tenantBData.posts;
    tenantB.comments = tenantBData.comments;
    tenantB.roasts = tenantBData.roasts;

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

      expect(tenantA.posts.length).toBeGreaterThan(0);
      expect(tenantA.comments.length).toBeGreaterThan(0);
      expect(tenantA.roasts.length).toBeGreaterThan(0);

      expect(tenantB.posts.length).toBeGreaterThan(0);
      expect(tenantB.comments.length).toBeGreaterThan(0);
      expect(tenantB.roasts.length).toBeGreaterThan(0);

      console.log(`  ✅ Tenant A: ${tenantA.posts.length} posts, ${tenantA.comments.length} comments, ${tenantA.roasts.length} roasts`);
      console.log(`  ✅ Tenant B: ${tenantB.posts.length} posts, ${tenantB.comments.length} comments, ${tenantB.roasts.length} roasts`);
    });
  });

  // AC1: Listados restringidos por tenant_id automáticamente
  describe('AC1: Listados restringidos por tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('GET /posts returns only Tenant A posts', async () => {
      const { data, error } = await testClient
        .from('posts')
        .select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(tenantA.posts.length);
      expect(data.every(p => p.organization_id === tenantA.id)).toBe(true);
    });

    test('GET /comments returns only Tenant A comments', async () => {
      const { data, error } = await testClient
        .from('comments')
        .select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(tenantA.comments.length);
      expect(data.every(c => c.organization_id === tenantA.id)).toBe(true);
    });

    test('GET /roasts returns only Tenant A roasts', async () => {
      const { data, error } = await testClient
        .from('roasts')
        .select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(tenantA.roasts.length);
      expect(data.every(r => r.organization_id === tenantA.id)).toBe(true);
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

  describe('RLS Context Verification', () => {
    test('getTenantContext returns current tenant ID', async () => {
      await setTenantContext(tenantA.id);
      expect(getTenantContext()).toBe(tenantA.id);

      await setTenantContext(tenantB.id);
      expect(getTenantContext()).toBe(tenantB.id);
    });
  });
});
