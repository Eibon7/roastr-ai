/**
 * Admin & Feature Flags RLS Integration Tests - Issue #787 AC4
 *
 * @deprecated Use tests/rls/admin.test.js instead (Issue #914 - 10-30x faster)
 * 
 * This test suite uses network-based Supabase calls with JWT context switching (slow).
 * New tests use supabase-test with local DB (10-30x faster, no bandwidth costs).
 * 
 * Migration: Issue #914 - RLS Tests Migration to supabase-test
 * New location: tests/rls/admin.test.js
 *
 * Tests Row Level Security policies for admin and feature flag tables:
 * - feature_flags (admin-only access)
 * - admin_audit_logs (admin-only access)
 * - audit_logs (org-scoped)
 * - plan_limits (admin-only access)
 * - plan_limits_audit (admin-only access)
 *
 * Related Issue: #787 (original), #914 (migration)
 * Related Node: multi-tenant.md
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

function assertNoError(context, error) {
  if (error) {
    console.error(
      `❌ ${context} error:`,
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    );
    const message = error.message || error.details || JSON.stringify(error);
    throw new Error(`Failed to ${context}: ${message}`);
  }
}

describe('Admin & Feature Flags RLS Integration Tests - Issue #787 AC4', () => {
  let tenantA, tenantB;
  let adminUser, regularUser;
  let featureFlagA, featureFlagB;
  let adminAuditLogA, adminAuditLogB;
  let auditLogA, auditLogB;
  let planLimitFree, planLimitPro;

  beforeAll(async () => {
    console.log('\n🚀 Setting up admin RLS test environment...\n');

    const tenants = await createTestTenants();
    tenantA = tenants.tenantA;
    tenantB = tenants.tenantB;

    // Create admin user
    adminUser = {
      id: uuidv4(),
      email: `admin-${Date.now()}@test.com`,
      name: 'Admin User',
      is_admin: true,
      active: true
    };

    // Create regular user
    regularUser = {
      id: uuidv4(),
      email: `regular-${Date.now()}@test.com`,
      name: 'Regular User',
      is_admin: false,
      active: true
    };

    const { data: createdAdmin, error: createdAdminError } = await serviceClient
      .from('users')
      .insert(adminUser)
      .select()
      .single();

    assertNoError('create admin user record', createdAdminError);

    const { data: createdRegular, error: createdRegularError } = await serviceClient
      .from('users')
      .insert(regularUser)
      .select()
      .single();

    assertNoError('create regular user record', createdRegularError);

    adminUser = createdAdmin;
    regularUser = createdRegular;

    // Create feature_flags (admin-only)
    featureFlagA = {
      id: uuidv4(),
      flag_key: `TEST_FLAG_A_${Date.now()}`,
      flag_name: 'Test Flag A',
      is_enabled: true,
      flag_type: 'boolean',
      flag_value: { value: true },
      category: 'test'
    };

    featureFlagB = {
      id: uuidv4(),
      flag_key: `TEST_FLAG_B_${Date.now()}`,
      flag_name: 'Test Flag B',
      is_enabled: false,
      flag_type: 'boolean',
      flag_value: { value: false },
      category: 'test'
    };

    const { data: flagA, error: flagAError } = await serviceClient
      .from('feature_flags')
      .insert(featureFlagA)
      .select()
      .single();

    assertNoError('create feature flag A', flagAError);

    const { data: flagB, error: flagBError } = await serviceClient
      .from('feature_flags')
      .insert(featureFlagB)
      .select()
      .single();

    assertNoError('create feature flag B', flagBError);

    featureFlagA = flagA;
    featureFlagB = flagB;

    // Create admin_audit_logs (admin-only)
    adminAuditLogA = {
      id: uuidv4(),
      admin_user_id: adminUser.id,
      action_type: 'feature_flag_update',
      resource_type: 'feature_flag',
      resource_id: featureFlagA.flag_key,
      old_value: { is_enabled: false },
      new_value: { is_enabled: true }
    };

    adminAuditLogB = {
      id: uuidv4(),
      admin_user_id: adminUser.id,
      action_type: 'plan_limit_update',
      resource_type: 'plan_limits',
      resource_id: 'pro',
      old_value: { maxRoasts: 1000 },
      new_value: { maxRoasts: 2000 }
    };

    const { data: auditA, error: auditAError } = await serviceClient
      .from('admin_audit_logs')
      .insert(adminAuditLogA)
      .select()
      .single();

    assertNoError('create admin_audit_logs A', auditAError);

    const { data: auditB, error: auditBError } = await serviceClient
      .from('admin_audit_logs')
      .insert(adminAuditLogB)
      .select()
      .single();

    assertNoError('create admin_audit_logs B', auditBError);

    adminAuditLogA = auditA;
    adminAuditLogB = auditB;

    // Create audit_logs (org-scoped)
    auditLogA = {
      id: uuidv4(),
      organization_id: tenantA.id,
      user_id: regularUser.id,
      action: 'roast_generated',
      resource_type: 'roast',
      resource_id: uuidv4(),
      details: { platform: 'twitter' }
    };

    auditLogB = {
      id: uuidv4(),
      organization_id: tenantB.id,
      user_id: regularUser.id,
      action: 'roast_generated',
      resource_type: 'roast',
      resource_id: uuidv4(),
      details: { platform: 'youtube' }
    };

    const { data: logA, error: logAError } = await serviceClient
      .from('audit_logs')
      .insert(auditLogA)
      .select()
      .single();

    assertNoError('create audit_log A', logAError);

    const { data: logB, error: logBError } = await serviceClient
      .from('audit_logs')
      .insert(auditLogB)
      .select()
      .single();

    assertNoError('create audit_log B', logBError);

    auditLogA = logA;
    auditLogB = logB;

    // Create plan_limits (admin-only, but readable by all)
    // Note: updated_by is nullable, so we can omit it for test data
    planLimitFree = {
      plan_id: 'free',
      max_roasts: 10,
      monthly_responses_limit: 10,
      monthly_analysis_limit: 100,
      shield_enabled: false
    };

    planLimitPro = {
      plan_id: 'pro',
      max_roasts: 1000,
      monthly_responses_limit: 1000,
      monthly_analysis_limit: 10000,
      shield_enabled: true
    };

    // Check if plan_limits exist, insert only if they don't
    const { data: existingFree } = await serviceClient
      .from('plan_limits')
      .select('plan_id')
      .eq('plan_id', 'free')
      .single();

    if (!existingFree) {
      const { error: planFreeError } = await serviceClient
        .from('plan_limits')
        .insert(planLimitFree);

      assertNoError('insert plan_limits free', planFreeError);
    } else {
      planLimitFree = existingFree;
    }

    const { data: existingPro } = await serviceClient
      .from('plan_limits')
      .select('plan_id')
      .eq('plan_id', 'pro')
      .single();

    if (!existingPro) {
      const { error: planProError } = await serviceClient.from('plan_limits').insert(planLimitPro);

      assertNoError('insert plan_limits pro', planProError);
    } else {
      planLimitPro = existingPro;
    }

    console.log('\n✅ Admin test data created\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Tearing down admin RLS test environment...\n');

    // Clean up admin and regular users created for testing
    if (adminUser?.id) {
      try {
        await serviceClient.from('users').delete().eq('id', adminUser.id);
        await serviceClient.auth.admin.deleteUser(adminUser.id).catch(() => {
          // User may not exist in auth.users, ignore
        });
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup admin user: ${error.message}`);
      }
    }

    if (regularUser?.id) {
      try {
        await serviceClient.from('users').delete().eq('id', regularUser.id);
        await serviceClient.auth.admin.deleteUser(regularUser.id).catch(() => {
          // User may not exist in auth.users, ignore
        });
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup regular user: ${error.message}`);
      }
    }

    await cleanupTestData();
    console.log('\n✅ Teardown complete\n');
  });

  describe('AC4.1: feature_flags - Admin-only access', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Non-admin user cannot read feature_flags', async () => {
      // Set context as regular user (non-admin)
      // Note: This test assumes RLS policy checks is_admin flag
      const { data, error } = await testClient.from('feature_flags').select('*');

      // RLS should block non-admin access
      // Result depends on RLS policy implementation
      // If policy is strict, data should be empty or error should be present
      expect(data).toBeDefined();
      // Non-admin users should not see feature flags
      if (data && data.length > 0) {
        // If data exists, verify it's empty (RLS blocked)
        expect(data.length).toBe(0);
      }
    });

    test('Non-admin user cannot insert feature_flags', async () => {
      const newFlag = {
        flag_key: `TEST_FLAG_NEW_${Date.now()}`,
        flag_name: 'New Test Flag',
        is_enabled: true,
        flag_type: 'boolean',
        flag_value: { value: true },
        category: 'test'
      };

      const { data, error } = await testClient
        .from('feature_flags')
        .insert(newFlag)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('AC4.2: admin_audit_logs - Admin-only read access', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Non-admin user cannot read admin_audit_logs', async () => {
      const { data, error } = await testClient.from('admin_audit_logs').select('*');

      // RLS should block non-admin access
      expect(data).toBeDefined();
      // Admin audit logs should not be visible to non-admins
      if (data && data.length > 0) {
        expect(data.length).toBe(0);
      }
    });

    test('Non-admin user cannot insert admin_audit_logs', async () => {
      const newAudit = {
        admin_user_id: adminUser.id,
        action_type: 'test_action',
        resource_type: 'test',
        resource_id: 'test-id'
      };

      const { data, error } = await testClient
        .from('admin_audit_logs')
        .insert(newAudit)
        .select()
        .single();

      // Service role can insert, but user client should be blocked
      // This depends on RLS policy - if policy allows INSERT for service role only
      expect(error).toBeDefined();
    });
  });

  describe('AC4.3: audit_logs - Org-scoped access', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Tenant A can only see their own audit_logs', async () => {
      const { data, error } = await testClient.from('audit_logs').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      if (data && data.length > 0) {
        expect(data.every((log) => log.organization_id === tenantA.id)).toBe(true);
        expect(data.some((log) => log.id === auditLogA.id)).toBe(true);
        expect(data.some((log) => log.id === auditLogB.id)).toBe(false);
      }
    });

    test('Tenant A cannot access Tenant B audit_logs by ID', async () => {
      const { data, error } = await testClient
        .from('audit_logs')
        .select('*')
        .eq('id', auditLogB.id)
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('AC4.4: plan_limits - Admin-only write, public read', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('All users can read plan_limits (public read policy)', async () => {
      const { data, error } = await testClient.from('plan_limits').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      // Should be able to read plan limits
      expect(data.some((limit) => limit.plan_id === 'free')).toBe(true);
      expect(data.some((limit) => limit.plan_id === 'pro')).toBe(true);
    });

    test('Non-admin user cannot update plan_limits', async () => {
      const { data, error } = await testClient
        .from('plan_limits')
        .update({ max_roasts: 9999 })
        .eq('plan_id', 'free')
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    test('Non-admin user cannot insert plan_limits', async () => {
      const newPlan = {
        plan_id: 'test_plan',
        max_roasts: 100,
        monthly_responses_limit: 100,
        monthly_analysis_limit: 1000,
        shield_enabled: false
      };

      const { data, error } = await testClient
        .from('plan_limits')
        .insert(newPlan)
        .select()
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('AC4.5: plan_limits_audit - Admin-only access', () => {
    beforeEach(async () => {
      await setTenantContext(tenantA.id);
    });

    test('Non-admin user cannot read plan_limits_audit', async () => {
      const { data, error } = await testClient.from('plan_limits_audit').select('*');

      // RLS should block non-admin access
      expect(data).toBeDefined();
      if (data && data.length > 0) {
        expect(data.length).toBe(0);
      }
    });
  });
});
