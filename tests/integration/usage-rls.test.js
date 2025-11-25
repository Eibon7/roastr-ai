/**
 * Usage Tracking RLS Integration Tests - Issue #787 AC3
 *
 * Tests Row Level Security policies for usage tracking tables:
 * - usage_tracking (org-scoped)
 * - usage_limits (org-scoped)
 * - usage_alerts (org-scoped)
 *
 * Related Issue: #787
 * Related Node: multi-tenant.md, cost-control.md
 * Related PR: #769
 */

const {
  createTestTenants,
  setTenantContext,
  cleanupTestData,
  testClient,
  serviceClient
} = require('../helpers/tenantTestUtils');
const { v4: uuidv4 } = require('uuid');

jest.setTimeout(30000);

describe('Usage Tracking RLS Integration Tests - Issue #787 AC3', () => {
  let tenantA, tenantB;
  let usageTrackingA, usageTrackingB;
  let usageLimitsA, usageLimitsB;
  let usageAlertsA, usageAlertsB;

  beforeAll(async () => {
    console.log('\n🚀 Setting up usage tracking RLS test environment...\n');

    const tenants = await createTestTenants();
    tenantA = tenants.tenantA;
    tenantB = tenants.tenantB;

    // Create usage_tracking records
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    usageTrackingA = {
      id: uuidv4(),
      organization_id: tenantA.id,
      resource_type: 'roasts',
      year,
      month,
      day,
      quantity: 10,
      cost_cents: 100
    };

    usageTrackingB = {
      id: uuidv4(),
      organization_id: tenantB.id,
      resource_type: 'roasts',
      year,
      month,
      day,
      quantity: 20,
      cost_cents: 200
    };

    const { data: trackingA } = await serviceClient
      .from('usage_tracking')
      .insert(usageTrackingA)
      .select()
      .single();

    const { data: trackingB } = await serviceClient
      .from('usage_tracking')
      .insert(usageTrackingB)
      .select()
      .single();

    usageTrackingA = trackingA;
    usageTrackingB = trackingB;

    // Create usage_limits records
    usageLimitsA = {
      id: uuidv4(),
      organization_id: tenantA.id,
      resource_type: 'roasts',
      monthly_limit: 1000,
      daily_limit: 50,
      allow_overage: true,
      is_active: true
    };

    usageLimitsB = {
      id: uuidv4(),
      organization_id: tenantB.id,
      resource_type: 'roasts',
      monthly_limit: 2000,
      daily_limit: 100,
      allow_overage: false,
      is_active: true
    };

    const { data: limitsA } = await serviceClient
      .from('usage_limits')
      .insert(usageLimitsA)
      .select()
      .single();

    const { data: limitsB } = await serviceClient
      .from('usage_limits')
      .insert(usageLimitsB)
      .select()
      .single();

    usageLimitsA = limitsA;
    usageLimitsB = limitsB;

    // Create usage_alerts records
    usageAlertsA = {
      id: uuidv4(),
      organization_id: tenantA.id,
      resource_type: 'roasts',
      threshold_percentage: 80,
      alert_type: 'email',
      is_active: true
    };

    usageAlertsB = {
      id: uuidv4(),
      organization_id: tenantB.id,
      resource_type: 'roasts',
      threshold_percentage: 90,
      alert_type: 'email',
      is_active: true
    };

    const { data: alertsA } = await serviceClient
      .from('usage_alerts')
      .insert(usageAlertsA)
      .select()
      .single();

    const { data: alertsB } = await serviceClient
      .from('usage_alerts')
      .insert(usageAlertsB)
      .select()
      .single();

    usageAlertsA = alertsA;
    usageAlertsB = alertsB;

    console.log('\n✅ Usage tracking test data created\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Tearing down usage tracking test environment...\n');
    await cleanupTestData();
    console.log('\n✅ Teardown complete\n');
  });

  describe('AC3.1: usage_tracking - Listados restringidos por tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can only see their own usage_tracking records', async () => {
      const { data, error } = await testClient.from('usage_tracking').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((record) => record.organization_id === tenantA.id)).toBe(true);
      expect(data.some((record) => record.id === usageTrackingA.id)).toBe(true);
      expect(data.some((record) => record.id === usageTrackingB.id)).toBe(false);
    });

    test('Tenant A cannot see Tenant B usage_tracking records', async () => {
      const { data, error } = await testClient
        .from('usage_tracking')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS blocks cross-tenant access
    });
  });

  describe('AC3.2: usage_tracking - Accesos directos por ID verifican tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can access their own usage_tracking by ID', async () => {
      const { data, error } = await testClient
        .from('usage_tracking')
        .select('*')
        .eq('id', usageTrackingA.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(usageTrackingA.id);
      expect(data.organization_id).toBe(tenantA.id);
    });

    test('Tenant A cannot access Tenant B usage_tracking by ID', async () => {
      const { data, error } = await testClient
        .from('usage_tracking')
        .select('*')
        .eq('id', usageTrackingB.id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('AC3.3: usage_limits - Listados restringidos por tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can only see their own usage_limits', async () => {
      const { data, error } = await testClient.from('usage_limits').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((limit) => limit.organization_id === tenantA.id)).toBe(true);
      expect(data.some((limit) => limit.id === usageLimitsA.id)).toBe(true);
      expect(data.some((limit) => limit.id === usageLimitsB.id)).toBe(false);
    });

    test('Tenant A cannot see Tenant B usage_limits', async () => {
      const { data, error } = await testClient
        .from('usage_limits')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  describe('AC3.4: usage_limits - Accesos directos por ID verifican tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can access their own usage_limits by ID', async () => {
      const { data, error } = await testClient
        .from('usage_limits')
        .select('*')
        .eq('id', usageLimitsA.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(usageLimitsA.id);
      expect(data.organization_id).toBe(tenantA.id);
    });

    test('Tenant A cannot access Tenant B usage_limits by ID', async () => {
      const { data, error } = await testClient
        .from('usage_limits')
        .select('*')
        .eq('id', usageLimitsB.id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('AC3.5: usage_alerts - Listados restringidos por tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can only see their own usage_alerts', async () => {
      const { data, error } = await testClient.from('usage_alerts').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((alert) => alert.organization_id === tenantA.id)).toBe(true);
      expect(data.some((alert) => alert.id === usageAlertsA.id)).toBe(true);
      expect(data.some((alert) => alert.id === usageAlertsB.id)).toBe(false);
    });

    test('Tenant A cannot see Tenant B usage_alerts', async () => {
      const { data, error } = await testClient
        .from('usage_alerts')
        .select('*')
        .eq('organization_id', tenantB.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  describe('AC3.6: usage_alerts - Accesos directos por ID verifican tenant_id', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can access their own usage_alerts by ID', async () => {
      const { data, error } = await testClient
        .from('usage_alerts')
        .select('*')
        .eq('id', usageAlertsA.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(usageAlertsA.id);
      expect(data.organization_id).toBe(tenantA.id);
    });

    test('Tenant A cannot access Tenant B usage_alerts by ID', async () => {
      const { data, error } = await testClient
        .from('usage_alerts')
        .select('*')
        .eq('id', usageAlertsB.id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('AC3.7: Cross-tenant access blocked', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A cannot insert usage_tracking for Tenant B', async () => {
      const now = new Date();
      const invalidRecord = {
        organization_id: tenantB.id,
        resource_type: 'roasts',
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        quantity: 1,
        cost_cents: 10
      };

      const { data, error } = await testClient
        .from('usage_tracking')
        .insert(invalidRecord)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('Tenant A cannot update Tenant B usage_limits', async () => {
      const { data, error } = await testClient
        .from('usage_limits')
        .update({ monthly_limit: 9999 })
        .eq('id', usageLimitsB.id)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('Tenant A cannot delete Tenant B usage_alerts', async () => {
      const { data, error } = await testClient
        .from('usage_alerts')
        .delete()
        .eq('id', usageAlertsB.id)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });
});
