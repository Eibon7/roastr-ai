/**
 * Security RLS Integration Tests - Issue #1093
 *
 * Tests Row Level Security policies for security-critical tables:
 * - plans (public read, admin-only write)
 * - user_activities (admin-only read, user can insert own)
 * - roast_tones (public read, admin-only write)
 *
 * Related Issue: #1093
 * Related PR: #1094
 * Migration: 057_enable_rls_missing_tables.sql
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

describe('Security RLS Integration Tests - Issue #1093', () => {
  let tenantA, tenantB;
  let adminUser, regularUserA, regularUserB;
  let testPlanId;
  let testToneId;

  beforeAll(async () => {
    console.log('\n🚀 Setting up security RLS test environment...\n');

    const tenants = await createTestTenants();
    tenantA = tenants.tenantA;
    tenantB = tenants.tenantB;

    // Get regular users
    regularUserA = tenantA.users.regular;
    regularUserB = tenantB.users.regular;

    // Create admin user
    const { data: newAdminUser, error: adminError } = await serviceClient
      .from('users')
      .insert({
        email: `admin-security-test-${uuidv4()}@example.com`,
        username: `admin_security_${Date.now()}`,
        is_admin: true,
        active: true
      })
      .select()
      .single();

    assertNoError('create admin user', adminError);
    adminUser = newAdminUser;

    console.log('✅ Security RLS test environment setup complete\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up security RLS test data...\n');

    // Clean up test plan if created
    if (testPlanId) {
      await serviceClient.from('plans').delete().eq('id', testPlanId);
    }

    // Clean up test tone if created
    if (testToneId) {
      await serviceClient.from('roast_tones').delete().eq('id', testToneId);
    }

    // Clean up admin user
    if (adminUser) {
      await serviceClient.from('users').delete().eq('id', adminUser.id);
    }

    // Clean up tenants
    await cleanupTestData({ tenantA, tenantB });

    console.log('✅ Security RLS test cleanup complete\n');
  });

  // ============================================================================
  // PLANS TABLE TESTS
  // ============================================================================

  describe('plans table RLS policies', () => {
    describe('SELECT (public read)', () => {
      it('should allow regular user to SELECT plans', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { data, error } = await testClient.from('plans').select('*');

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);

        console.log(`  ✅ Regular user can read ${data.length} plans`);
      });

      it('should allow admin to SELECT plans', async () => {
        await setTenantContext(testClient, adminUser.id);

        const { data, error } = await testClient.from('plans').select('*');

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(Array.isArray(data)).toBe(true);

        console.log(`  ✅ Admin can read ${data.length} plans`);
      });

      it('should allow unauthenticated context to SELECT plans', async () => {
        // Reset context (simulates anonymous/public access)
        const { data, error } = await testClient.from('plans').select('*');

        expect(error).toBeNull();
        expect(data).toBeDefined();

        console.log('  ✅ Public can read plans');
      });
    });

    describe('INSERT (admin-only)', () => {
      it('should prevent regular user from INSERT plans', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { data, error } = await testClient.from('plans').insert({
          id: `test_plan_${Date.now()}`,
          name: 'Test Plan',
          description: 'Test plan for RLS',
          monthly_price_cents: 999,
          yearly_price_cents: 9999,
          monthly_responses_limit: 100,
          integrations_limit: 2,
          shield_enabled: false,
          features: []
        });

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501'); // insufficient_privilege or policy violation
        expect(data).toBeNull();

        console.log('  ✅ Regular user CANNOT insert plans');
      });

      it('should allow admin to INSERT plans', async () => {
        await setTenantContext(testClient, adminUser.id);

        testPlanId = `test_plan_${Date.now()}`;

        const { data, error } = await testClient
          .from('plans')
          .insert({
            id: testPlanId,
            name: 'Test Admin Plan',
            description: 'Admin-created test plan',
            monthly_price_cents: 1999,
            yearly_price_cents: 19999,
            monthly_responses_limit: 500,
            integrations_limit: 5,
            shield_enabled: true,
            features: ['test_feature']
          })
          .select()
          .single();

        assertNoError('admin insert plan', error);
        expect(data).toBeDefined();
        expect(data.id).toBe(testPlanId);

        console.log('  ✅ Admin CAN insert plans');
      });
    });

    describe('UPDATE (admin-only)', () => {
      it('should prevent regular user from UPDATE plans', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { error } = await testClient
          .from('plans')
          .update({ monthly_price_cents: 0 })
          .eq('id', 'free');

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');

        console.log('  ✅ Regular user CANNOT update plans');
      });

      it('should allow admin to UPDATE plans', async () => {
        if (!testPlanId) {
          console.log('  ⏭️  Skipping - no test plan created');
          return;
        }

        await setTenantContext(testClient, adminUser.id);

        const { data, error } = await testClient
          .from('plans')
          .update({ description: 'Updated by admin' })
          .eq('id', testPlanId)
          .select()
          .single();

        assertNoError('admin update plan', error);
        expect(data.description).toBe('Updated by admin');

        console.log('  ✅ Admin CAN update plans');
      });
    });

    describe('DELETE (admin-only)', () => {
      it('should prevent regular user from DELETE plans', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { error } = await testClient.from('plans').delete().eq('id', 'free');

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');

        console.log('  ✅ Regular user CANNOT delete plans');
      });

      it('should allow admin to DELETE plans', async () => {
        if (!testPlanId) {
          console.log('  ⏭️  Skipping - no test plan to delete');
          return;
        }

        await setTenantContext(testClient, adminUser.id);

        const { error } = await testClient.from('plans').delete().eq('id', testPlanId);

        assertNoError('admin delete plan', error);

        // Verify deletion
        const { data } = await testClient.from('plans').select('id').eq('id', testPlanId);
        expect(data).toEqual([]);

        testPlanId = null; // Mark as cleaned up

        console.log('  ✅ Admin CAN delete plans');
      });
    });
  });

  // ============================================================================
  // USER_ACTIVITIES TABLE TESTS
  // ============================================================================

  describe('user_activities table RLS policies', () => {
    let activityIdA, activityIdB;

    afterEach(async () => {
      // Clean up created activities
      if (activityIdA) {
        await serviceClient.from('user_activities').delete().eq('id', activityIdA);
        activityIdA = null;
      }
      if (activityIdB) {
        await serviceClient.from('user_activities').delete().eq('id', activityIdB);
        activityIdB = null;
      }
    });

    describe('SELECT (admin-only)', () => {
      it('should prevent regular user from SELECT user_activities', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { data, error } = await testClient.from('user_activities').select('*');

        expect(error).not.toBeNull();
        // Policy violation - regular users cannot read activities
        expect(data).toBeNull();

        console.log('  ✅ Regular user CANNOT read user_activities');
      });

      it('should allow admin to SELECT all user_activities', async () => {
        // First, create an activity as service
        const { data: activity } = await serviceClient
          .from('user_activities')
          .insert({
            user_id: regularUserA.id,
            organization_id: tenantA.id,
            activity_type: 'test_activity',
            platform: 'test',
            metadata: { test: true }
          })
          .select()
          .single();

        activityIdA = activity.id;

        // Now try to read as admin
        await setTenantContext(testClient, adminUser.id);

        const { data, error } = await testClient
          .from('user_activities')
          .select('*')
          .eq('id', activityIdA);

        assertNoError('admin read user_activities', error);
        expect(data).toBeDefined();
        expect(data.length).toBe(1);

        console.log('  ✅ Admin CAN read user_activities');
      });
    });

    describe('INSERT (user own + admin any)', () => {
      it('should allow user to INSERT their own activity', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { data, error } = await testClient
          .from('user_activities')
          .insert({
            user_id: regularUserA.id,
            organization_id: tenantA.id,
            activity_type: 'login',
            platform: 'web',
            metadata: { test: true }
          })
          .select()
          .single();

        assertNoError('user insert own activity', error);
        expect(data).toBeDefined();
        expect(data.user_id).toBe(regularUserA.id);

        activityIdA = data.id;

        console.log('  ✅ User CAN insert their own activity');
      });

      it('should prevent user from INSERT another user\'s activity', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { data, error } = await testClient.from('user_activities').insert({
          user_id: regularUserB.id, // Different user!
          organization_id: tenantB.id,
          activity_type: 'login',
          platform: 'web',
          metadata: { test: true }
        });

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toBeNull();

        console.log('  ✅ User CANNOT insert another user\'s activity');
      });

      it('should allow admin to INSERT any user\'s activity', async () => {
        await setTenantContext(testClient, adminUser.id);

        const { data, error } = await testClient
          .from('user_activities')
          .insert({
            user_id: regularUserB.id, // Admin can insert for any user
            organization_id: tenantB.id,
            activity_type: 'admin_action',
            platform: 'admin',
            metadata: { admin_created: true }
          })
          .select()
          .single();

        assertNoError('admin insert any user activity', error);
        expect(data).toBeDefined();
        expect(data.user_id).toBe(regularUserB.id);

        activityIdB = data.id;

        console.log('  ✅ Admin CAN insert any user\'s activity');
      });
    });

    describe('UPDATE (admin-only)', () => {
      beforeEach(async () => {
        // Create activity as service for update tests
        const { data } = await serviceClient
          .from('user_activities')
          .insert({
            user_id: regularUserA.id,
            organization_id: tenantA.id,
            activity_type: 'test_update',
            platform: 'test',
            metadata: { original: true }
          })
          .select()
          .single();

        activityIdA = data.id;
      });

      it('should prevent regular user from UPDATE user_activities', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { error } = await testClient
          .from('user_activities')
          .update({ metadata: { modified: true } })
          .eq('id', activityIdA);

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');

        console.log('  ✅ Regular user CANNOT update user_activities');
      });

      it('should allow admin to UPDATE user_activities', async () => {
        await setTenantContext(testClient, adminUser.id);

        const { data, error } = await testClient
          .from('user_activities')
          .update({ metadata: { admin_modified: true } })
          .eq('id', activityIdA)
          .select()
          .single();

        assertNoError('admin update user_activities', error);
        expect(data.metadata).toEqual({ admin_modified: true });

        console.log('  ✅ Admin CAN update user_activities');
      });
    });

    describe('DELETE (admin-only)', () => {
      beforeEach(async () => {
        // Create activity for delete tests
        const { data } = await serviceClient
          .from('user_activities')
          .insert({
            user_id: regularUserA.id,
            organization_id: tenantA.id,
            activity_type: 'test_delete',
            platform: 'test',
            metadata: {}
          })
          .select()
          .single();

        activityIdA = data.id;
      });

      it('should prevent regular user from DELETE user_activities', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { error } = await testClient.from('user_activities').delete().eq('id', activityIdA);

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');

        console.log('  ✅ Regular user CANNOT delete user_activities');
      });

      it('should allow admin to DELETE user_activities', async () => {
        await setTenantContext(testClient, adminUser.id);

        const { error } = await testClient.from('user_activities').delete().eq('id', activityIdA);

        assertNoError('admin delete user_activities', error);

        // Verify deletion
        const { data } = await testClient
          .from('user_activities')
          .select('id')
          .eq('id', activityIdA);
        expect(data).toEqual([]);

        activityIdA = null;

        console.log('  ✅ Admin CAN delete user_activities');
      });
    });
  });

  // ============================================================================
  // ROAST_TONES TABLE TESTS
  // ============================================================================

  describe('roast_tones table RLS policies', () => {
    describe('SELECT (public read)', () => {
      it('should allow regular user to SELECT roast_tones', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { data, error } = await testClient.from('roast_tones').select('*');

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);

        console.log(`  ✅ Regular user can read ${data.length} roast tones`);
      });

      it('should allow admin to SELECT roast_tones', async () => {
        await setTenantContext(testClient, adminUser.id);

        const { data, error } = await testClient.from('roast_tones').select('*');

        expect(error).toBeNull();
        expect(data).toBeDefined();

        console.log(`  ✅ Admin can read ${data.length} roast tones`);
      });
    });

    describe('INSERT (admin-only)', () => {
      it('should prevent regular user from INSERT roast_tones', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { data, error } = await testClient.from('roast_tones').insert({
          name: `test_tone_${Date.now()}`,
          display_name: { es: 'Test', en: 'Test' },
          description: { es: 'Test tone', en: 'Test tone' },
          intensity: 3,
          personality: 'Test personality',
          resources: ['test'],
          restrictions: ['test'],
          examples: [],
          active: true,
          sort_order: 999
        });

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');
        expect(data).toBeNull();

        console.log('  ✅ Regular user CANNOT insert roast_tones');
      });

      it('should allow admin to INSERT roast_tones', async () => {
        await setTenantContext(testClient, adminUser.id);

        const { data, error } = await testClient
          .from('roast_tones')
          .insert({
            name: `admin_test_tone_${Date.now()}`,
            display_name: { es: 'Admin Test', en: 'Admin Test' },
            description: { es: 'Admin test tone', en: 'Admin test tone' },
            intensity: 4,
            personality: 'Admin test personality',
            resources: ['admin_test'],
            restrictions: ['no_test'],
            examples: [],
            active: true,
            sort_order: 1000
          })
          .select()
          .single();

        assertNoError('admin insert roast_tone', error);
        expect(data).toBeDefined();

        testToneId = data.id;

        console.log('  ✅ Admin CAN insert roast_tones');
      });
    });

    describe('UPDATE (admin-only)', () => {
      it('should prevent regular user from UPDATE roast_tones', async () => {
        await setTenantContext(testClient, regularUserA.id);

        // Try to update an existing tone
        const { data: existingTone } = await serviceClient
          .from('roast_tones')
          .select('id')
          .limit(1)
          .single();

        const { error } = await testClient
          .from('roast_tones')
          .update({ intensity: 5 })
          .eq('id', existingTone.id);

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');

        console.log('  ✅ Regular user CANNOT update roast_tones');
      });

      it('should allow admin to UPDATE roast_tones', async () => {
        if (!testToneId) {
          console.log('  ⏭️  Skipping - no test tone created');
          return;
        }

        await setTenantContext(testClient, adminUser.id);

        const { data, error } = await testClient
          .from('roast_tones')
          .update({ intensity: 5 })
          .eq('id', testToneId)
          .select()
          .single();

        assertNoError('admin update roast_tone', error);
        expect(data.intensity).toBe(5);

        console.log('  ✅ Admin CAN update roast_tones');
      });
    });

    describe('DELETE (admin-only)', () => {
      it('should prevent regular user from DELETE roast_tones', async () => {
        await setTenantContext(testClient, regularUserA.id);

        const { data: existingTone } = await serviceClient
          .from('roast_tones')
          .select('id')
          .limit(1)
          .single();

        const { error } = await testClient
          .from('roast_tones')
          .delete()
          .eq('id', existingTone.id);

        expect(error).not.toBeNull();
        expect(error.code).toBe('42501');

        console.log('  ✅ Regular user CANNOT delete roast_tones');
      });

      it('should allow admin to DELETE roast_tones', async () => {
        if (!testToneId) {
          console.log('  ⏭️  Skipping - no test tone to delete');
          return;
        }

        await setTenantContext(testClient, adminUser.id);

        const { error } = await testClient.from('roast_tones').delete().eq('id', testToneId);

        assertNoError('admin delete roast_tone', error);

        // Verify deletion
        const { data } = await testClient.from('roast_tones').select('id').eq('id', testToneId);
        expect(data).toEqual([]);

        testToneId = null;

        console.log('  ✅ Admin CAN delete roast_tones');
      });
    });
  });
});

