/**
 * Sponsors RLS Integration Tests - CodeRabbit Review #3483663040
 *
 * Tests Row Level Security policy for sponsors table:
 * - user_sponsors_isolation policy enforcement
 * - User A cannot see/update/delete User B's sponsors
 * - Direct database RLS validation (not service layer)
 *
 * Related Issue: #866 (Brand Safety Integration Tests)
 * Related Migration: supabase/migrations/20251119000001_sponsors_brand_safety.sql
 * Related Pattern: admin-rls.test.js, shield-rls.test.js, usage-rls.test.js
 *
 * CRITICAL: Uses testClient (RLS-enabled) to directly test database policy,
 * NOT SponsorService (which uses service_role and bypasses RLS).
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

describe('Sponsors RLS Integration Tests - CodeRabbit Review #3483663040', () => {
  let tenantA, tenantB;
  let userAId, userBId;
  let sponsorA1, sponsorA2, sponsorB1;

  beforeAll(async () => {
    console.log('\n🚀 Setting up sponsors RLS test environment...\n');

    const tenants = await createTestTenants();
    tenantA = tenants.tenantA;
    tenantB = tenants.tenantB;

    // Get user IDs from tenants
    const { data: orgA } = await serviceClient
      .from('organizations')
      .select('owner_id')
      .eq('id', tenantA.id)
      .single();

    const { data: orgB } = await serviceClient
      .from('organizations')
      .select('owner_id')
      .eq('id', tenantB.id)
      .single();

    assertNoError('get tenant A owner', orgA ? null : { message: 'orgA not found' });
    assertNoError('get tenant B owner', orgB ? null : { message: 'orgB not found' });

    userAId = orgA.owner_id;
    userBId = orgB.owner_id;

    // Create test sponsors using serviceClient (bypass RLS for setup)
    sponsorA1 = {
      id: uuidv4(),
      user_id: userAId,
      name: 'Sponsor A1',
      url: 'https://example-a1.com',
      active: true,
      priority: 1,
      severity: 'medium',
      tone: 'normal'
    };

    sponsorA2 = {
      id: uuidv4(),
      user_id: userAId,
      name: 'Sponsor A2',
      url: 'https://example-a2.com',
      active: true,
      priority: 2,
      severity: 'high',
      tone: 'professional'
    };

    sponsorB1 = {
      id: uuidv4(),
      user_id: userBId,
      name: 'Sponsor B1',
      url: 'https://example-b1.com',
      active: true,
      priority: 1,
      severity: 'low',
      tone: 'normal'
    };

    const { data: createdA1, error: errorA1 } = await serviceClient
      .from('sponsors')
      .insert(sponsorA1)
      .select()
      .single();

    assertNoError('create sponsor A1', errorA1);
    sponsorA1 = createdA1;

    const { data: createdA2, error: errorA2 } = await serviceClient
      .from('sponsors')
      .insert(sponsorA2)
      .select()
      .single();

    assertNoError('create sponsor A2', errorA2);
    sponsorA2 = createdA2;

    const { data: createdB1, error: errorB1 } = await serviceClient
      .from('sponsors')
      .insert(sponsorB1)
      .select()
      .single();

    assertNoError('create sponsor B1', errorB1);
    sponsorB1 = createdB1;

    console.log('✅ Test sponsors created:', {
      userA: { sponsors: [sponsorA1.id, sponsorA2.id] },
      userB: { sponsors: [sponsorB1.id] }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('RLS Policy: user_sponsors_isolation', () => {
    describe('User A can access own sponsors', () => {
      beforeEach(async () => {
        await setTenantContext(tenantA.id);
      });

      test('User A can SELECT own sponsors', async () => {
        const { data, error } = await testClient
          .from('sponsors')
          .select('*')
          .eq('user_id', userAId);

        assertNoError('select user A sponsors', error);
        expect(data).toBeDefined();
        expect(data.length).toBeGreaterThanOrEqual(2);
        expect(data.some((s) => s.id === sponsorA1.id)).toBe(true);
        expect(data.some((s) => s.id === sponsorA2.id)).toBe(true);
        // Should NOT see user B's sponsors
        expect(data.some((s) => s.id === sponsorB1.id)).toBe(false);
      });

      test('User A can SELECT specific own sponsor', async () => {
        const { data, error } = await testClient
          .from('sponsors')
          .select('*')
          .eq('id', sponsorA1.id)
          .single();

        assertNoError('select sponsor A1', error);
        expect(data).toBeDefined();
        expect(data.id).toBe(sponsorA1.id);
        expect(data.user_id).toBe(userAId);
      });

      test('User A can UPDATE own sponsor', async () => {
        const newName = `Updated A1 ${Date.now()}`;
        const { data, error } = await testClient
          .from('sponsors')
          .update({ name: newName })
          .eq('id', sponsorA1.id)
          .select()
          .single();

        assertNoError('update sponsor A1', error);
        expect(data).toBeDefined();
        expect(data.name).toBe(newName);

        // Restore original name
        await serviceClient
          .from('sponsors')
          .update({ name: sponsorA1.name })
          .eq('id', sponsorA1.id);
      });

      test('User A can DELETE own sponsor', async () => {
        // Create temporary sponsor for deletion test
        const tempSponsor = {
          id: uuidv4(),
          user_id: userAId,
          name: 'Temp Sponsor',
          url: 'https://temp.com',
          active: true,
          priority: 5,
          severity: 'low',
          tone: 'normal'
        };

        const { data: created, error: createError } = await serviceClient
          .from('sponsors')
          .insert(tempSponsor)
          .select()
          .single();

        assertNoError('create temp sponsor', createError);

        // Delete via testClient (RLS-enabled)
        const { error: deleteError } = await testClient
          .from('sponsors')
          .delete()
          .eq('id', created.id);

        assertNoError('delete temp sponsor', deleteError);

        // Verify deleted
        const { data: verify, error: verifyError } = await serviceClient
          .from('sponsors')
          .select('*')
          .eq('id', created.id)
          .single();

        expect(verifyError).toBeTruthy(); // Should not exist
        expect(verify).toBeNull();
      });
    });

    describe('User A cannot access User B sponsors', () => {
      beforeEach(async () => {
        await setTenantContext(tenantA.id);
      });

      test('User A cannot SELECT User B sponsors', async () => {
        const { data, error } = await testClient
          .from('sponsors')
          .select('*')
          .eq('id', sponsorB1.id)
          .single();

        // RLS should block access - data should be null
        expect(data).toBeNull();
        // Error may or may not be set depending on Supabase version
      });

      test('User A cannot UPDATE User B sponsor', async () => {
        const newName = `Hacked ${Date.now()}`;
        const { data, error } = await testClient
          .from('sponsors')
          .update({ name: newName })
          .eq('id', sponsorB1.id)
          .select()
          .single();

        // RLS should block update
        expect(data).toBeNull();
        expect(error).toBeTruthy();

        // Verify sponsor B1 unchanged
        const { data: verify } = await serviceClient
          .from('sponsors')
          .select('*')
          .eq('id', sponsorB1.id)
          .single();

        expect(verify.name).toBe(sponsorB1.name);
      });

      test('User A cannot DELETE User B sponsor', async () => {
        // RLS should block deletion; verification happens via serviceClient
        // regardless of whether the client surfaces an error or just 0 affected rows.
        const { data, error } = await testClient
          .from('sponsors')
          .delete()
          .eq('id', sponsorB1.id)
          .select()
          .single(); // Chain .select().single() to capture RLS denial if surfaced

        // Note: We don't assert on error because RLS may silently affect 0 rows
        // The real guarantee is that the sponsor still exists (verified below)

        // Verify sponsor B1 still exists (real guarantee)
        const { data: verify } = await serviceClient
          .from('sponsors')
          .select('*')
          .eq('id', sponsorB1.id)
          .single();

        expect(verify).toBeDefined();
        expect(verify.id).toBe(sponsorB1.id);
      });

      test('User A cannot INSERT sponsor for User B', async () => {
        const maliciousSponsor = {
          id: uuidv4(),
          user_id: userBId, // Trying to create for User B
          name: 'Malicious Sponsor',
          url: 'https://malicious.com',
          active: true,
          priority: 1,
          severity: 'high',
          tone: 'normal'
        };

        const { data, error } = await testClient
          .from('sponsors')
          .insert(maliciousSponsor)
          .select()
          .single();

        // RLS WITH CHECK should block insert
        expect(data).toBeNull();
        expect(error).toBeTruthy();

        // Verify sponsor was NOT created
        const { data: verify } = await serviceClient
          .from('sponsors')
          .select('*')
          .eq('id', maliciousSponsor.id)
          .single();

        expect(verify).toBeNull();
      });
    });

    describe('User B can access own sponsors', () => {
      beforeEach(async () => {
        await setTenantContext(tenantB.id);
      });

      test('User B can SELECT own sponsors', async () => {
        const { data, error } = await testClient
          .from('sponsors')
          .select('*')
          .eq('user_id', userBId);

        assertNoError('select user B sponsors', error);
        expect(data).toBeDefined();
        expect(data.length).toBeGreaterThanOrEqual(1);
        expect(data.some((s) => s.id === sponsorB1.id)).toBe(true);
        // Should NOT see user A's sponsors
        expect(data.some((s) => s.id === sponsorA1.id)).toBe(false);
        expect(data.some((s) => s.id === sponsorA2.id)).toBe(false);
      });

      test('User B cannot SELECT User A sponsors', async () => {
        const { data, error } = await testClient
          .from('sponsors')
          .select('*')
          .eq('id', sponsorA1.id)
          .single();

        // RLS should block access
        expect(data).toBeNull();
      });
    });
  });

  describe('RLS Policy Verification', () => {
    test('Policy enforces USING clause (read access)', async () => {
      await setTenantContext(tenantA.id);

      // User A should only see their own sponsors
      const { data } = await testClient.from('sponsors').select('*');

      expect(data).toBeDefined();
      expect(data.every((s) => s.user_id === userAId)).toBe(true);
      expect(data.some((s) => s.user_id === userBId)).toBe(false);
    });

    test('Policy enforces WITH CHECK clause (write access)', async () => {
      await setTenantContext(tenantA.id);

      // Try to insert with wrong user_id
      const { data, error } = await testClient
        .from('sponsors')
        .insert({
          user_id: userBId, // Wrong user
          name: 'Test',
          url: 'https://test.com',
          active: true,
          priority: 1,
          severity: 'low',
          tone: 'normal'
        })
        .select()
        .single();

      // WITH CHECK should block this
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });
  });
});
