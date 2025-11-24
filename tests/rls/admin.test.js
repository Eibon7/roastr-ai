/**
 * Admin & Feature Flags RLS Tests - Migrated from integration tests
 *
 * Tests Row Level Security policies for admin and feature flag tables using supabase-test
 * (10-30x faster than network-based tests)
 *
 * Migrated from: tests/integration/admin-rls.test.js
 * Related Issue: #914 (Migration), #787 (Original RLS implementation)
 * Related Node: multi-tenant.md
 */

const { getConnections } = require('supabase-test');
const { getTestConfig } = require('../setup/supabase-test.config');
const { createMigrationsSeed } = require('./helpers/load-migrations');

let db;
let pg;
let teardown;

beforeAll(async () => {
  console.log('\n🚀 Setting up Admin RLS test environment (supabase-test)...\n');

  const config = getTestConfig();
  const result = await getConnections(config, [createMigrationsSeed()]);

  db = result.db;
  pg = result.pg;
  teardown = result.teardown;
});

afterAll(async () => {
  console.log('\n🧹 Tearing down Admin RLS test environment...\n');
  await teardown();
  console.log('\n✅ Teardown complete\n');
});

beforeEach(() => {
  db.beforeEach(); // Create savepoint
});

afterEach(() => {
  db.afterEach(); // Rollback to savepoint
});

describe('Admin & Feature Flags RLS Tests (Issue #914 Migration)', () => {
  let adminUserId, regularUserId;
  let orgAId, orgBId;
  let featureFlagAId, featureFlagBId;
  let adminAuditLogAId, adminAuditLogBId;
  let auditLogAId, auditLogBId;

  beforeEach(async () => {
    // Create admin user
    const adminResult = await pg.query(
      `
      INSERT INTO users (id, email, name, is_admin, active, plan)
      VALUES (gen_random_uuid(), $1, 'Admin User', true, true, 'pro')
      RETURNING id;
    `,
      [`admin-${Date.now()}@test.com`]
    );
    adminUserId = adminResult.rows[0].id;

    // Create regular user
    const regularResult = await pg.query(
      `
      INSERT INTO users (id, email, name, is_admin, active, plan)
      VALUES (gen_random_uuid(), $1, 'Regular User', false, true, 'pro')
      RETURNING id;
    `,
      [`regular-${Date.now()}@test.com`]
    );
    regularUserId = regularResult.rows[0].id;

    // Create organizations
    const orgAResult = await pg.query(
      `
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org A Admin', 'org-a-admin', $1, 'pro')
      RETURNING id;
    `,
      [regularUserId]
    );
    orgAId = orgAResult.rows[0].id;

    const orgBResult = await pg.query(
      `
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org B Admin', 'org-b-admin', $1, 'pro')
      RETURNING id;
    `,
      [regularUserId]
    );
    orgBId = orgBResult.rows[0].id;

    // Create feature_flags (admin-only)
    const flagAResult = await pg.query(
      `
      INSERT INTO feature_flags (id, flag_key, flag_name, is_enabled, flag_type, flag_value, category)
      VALUES (gen_random_uuid(), $1, 'Test Flag A', true, 'boolean', $2::jsonb, 'test')
      RETURNING id;
    `,
      [`TEST_FLAG_A_${Date.now()}`, JSON.stringify({ value: true })]
    );
    featureFlagAId = flagAResult.rows[0].id;

    const flagBResult = await pg.query(
      `
      INSERT INTO feature_flags (id, flag_key, flag_name, is_enabled, flag_type, flag_value, category)
      VALUES (gen_random_uuid(), $1, 'Test Flag B', false, 'boolean', $2::jsonb, 'test')
      RETURNING id;
    `,
      [`TEST_FLAG_B_${Date.now()}`, JSON.stringify({ value: false })]
    );
    featureFlagBId = flagBResult.rows[0].id;

    // Create admin_audit_logs (admin-only)
    const adminAuditAResult = await pg.query(
      `
      INSERT INTO admin_audit_logs (id, admin_user_id, action_type, resource_type, resource_id, old_value, new_value)
      VALUES (gen_random_uuid(), $1, 'feature_flag_update', 'feature_flag', $2, $3::jsonb, $4::jsonb)
      RETURNING id;
    `,
      [
        adminUserId,
        `TEST_FLAG_A_${Date.now()}`,
        JSON.stringify({ is_enabled: false }),
        JSON.stringify({ is_enabled: true })
      ]
    );
    adminAuditLogAId = adminAuditAResult.rows[0].id;

    const adminAuditBResult = await pg.query(
      `
      INSERT INTO admin_audit_logs (id, admin_user_id, action_type, resource_type, resource_id, old_value, new_value)
      VALUES (gen_random_uuid(), $1, 'plan_limit_update', 'plan_limits', 'pro', $2::jsonb, $3::jsonb)
      RETURNING id;
    `,
      [adminUserId, JSON.stringify({ maxRoasts: 1000 }), JSON.stringify({ maxRoasts: 2000 })]
    );
    adminAuditLogBId = adminAuditBResult.rows[0].id;

    // Create audit_logs (org-scoped)
    const auditLogAResult = await pg.query(
      `
      INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id, details)
      VALUES (gen_random_uuid(), $1, $2, 'roast_generated', 'roast', gen_random_uuid(), $3::jsonb)
      RETURNING id;
    `,
      [orgAId, regularUserId, JSON.stringify({ platform: 'twitter' })]
    );
    auditLogAId = auditLogAResult.rows[0].id;

    const auditLogBResult = await pg.query(
      `
      INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id, details)
      VALUES (gen_random_uuid(), $1, $2, 'roast_generated', 'roast', gen_random_uuid(), $3::jsonb)
      RETURNING id;
    `,
      [orgBId, regularUserId, JSON.stringify({ platform: 'youtube' })]
    );
    auditLogBId = auditLogBResult.rows[0].id;

    // Ensure plan_limits exist (admin-only write, public read)
    await pg.query(`
      INSERT INTO plan_limits (plan_id, max_roasts, monthly_responses_limit, monthly_analysis_limit, shield_enabled)
      VALUES ('free', 10, 10, 100, false)
      ON CONFLICT (plan_id) DO NOTHING;
    `);

    await pg.query(`
      INSERT INTO plan_limits (plan_id, max_roasts, monthly_responses_limit, monthly_analysis_limit, shield_enabled)
      VALUES ('pro', 1000, 1000, 10000, true)
      ON CONFLICT (plan_id) DO NOTHING;
    `);

    console.log('✅ Admin test data created');
  });

  describe('AC4.1: feature_flags - Admin-only access', () => {
    test('Non-admin user cannot read feature_flags', async () => {
      // Set context as regular user (non-admin)
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.is_admin': false
      });

      const result = await db.query(`SELECT * FROM feature_flags;`);

      // RLS should block non-admin access
      expect(result.rows.length).toBe(0);
    });

    test('Non-admin user cannot insert feature_flags', async () => {
      // Set context as regular user (non-admin)
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.is_admin': false
      });

      // Attempt to insert (should fail)
      await expect(
        db.query(
          `
          INSERT INTO feature_flags (flag_key, flag_name, is_enabled, flag_type, flag_value, category)
          VALUES ($1, 'New Test Flag', true, 'boolean', '{"value": true}'::jsonb, 'test')
          RETURNING id;
        `,
          [`TEST_FLAG_NEW_${Date.now()}`]
        )
      ).rejects.toThrow(); // RLS policy violation
    });
  });

  describe('AC4.2: admin_audit_logs - Admin-only read access', () => {
    test('Non-admin user cannot read admin_audit_logs', async () => {
      // Set context as regular user (non-admin)
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.is_admin': false
      });

      const result = await db.query(`SELECT * FROM admin_audit_logs;`);

      // RLS should block non-admin access
      expect(result.rows.length).toBe(0);
    });

    test('Non-admin user cannot insert admin_audit_logs', async () => {
      // Set context as regular user (non-admin)
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.is_admin': false
      });

      // Attempt to insert (should fail)
      await expect(
        db.query(
          `
          INSERT INTO admin_audit_logs (admin_user_id, action_type, resource_type, resource_id)
          VALUES ($1, 'test_action', 'test', 'test-id')
          RETURNING id;
        `,
          [adminUserId]
        )
      ).rejects.toThrow(); // RLS policy violation
    });
  });

  describe('AC4.3: audit_logs - Org-scoped access', () => {
    test('Tenant A can only see their own audit_logs', async () => {
      // Set context as Tenant A owner
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`SELECT * FROM audit_logs;`);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every((log) => log.organization_id === orgAId)).toBe(true);
      expect(result.rows.some((log) => log.id === auditLogAId)).toBe(true);
      expect(result.rows.some((log) => log.id === auditLogBId)).toBe(false);
    });

    test('Tenant A cannot access Tenant B audit_logs by ID', async () => {
      // Set context as Tenant A owner
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`SELECT * FROM audit_logs WHERE id = $1;`, [auditLogBId]);

      expect(result.rows.length).toBe(0); // RLS blocks access
    });
  });

  describe('AC4.4: plan_limits - Admin-only write, public read', () => {
    test('All users can read plan_limits (public read policy)', async () => {
      // Set context as regular user (non-admin)
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.is_admin': false
      });

      const result = await db.query(`SELECT * FROM plan_limits;`);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.some((limit) => limit.plan_id === 'free')).toBe(true);
      expect(result.rows.some((limit) => limit.plan_id === 'pro')).toBe(true);
    });

    test('Non-admin user cannot update plan_limits', async () => {
      // Set context as regular user (non-admin)
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.is_admin': false
      });

      const result = await db.query(`
        UPDATE plan_limits
        SET max_roasts = 9999
        WHERE plan_id = 'free'
        RETURNING plan_id;
      `);

      expect(result.rows.length).toBe(0); // RLS blocks update
    });

    test('Non-admin user cannot insert plan_limits', async () => {
      // Set context as regular user (non-admin)
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.is_admin': false
      });

      // Attempt to insert (should fail)
      await expect(
        db.query(`
          INSERT INTO plan_limits (plan_id, max_roasts, monthly_responses_limit, monthly_analysis_limit, shield_enabled)
          VALUES ('test_plan', 100, 100, 1000, false)
          RETURNING plan_id;
        `)
      ).rejects.toThrow(); // RLS policy violation
    });
  });

  describe('AC4.5: plan_limits_audit - Admin-only access', () => {
    test('Non-admin user cannot read plan_limits_audit', async () => {
      // Set context as regular user (non-admin)
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': regularUserId,
        'jwt.claims.is_admin': false
      });

      const result = await db.query(`SELECT * FROM plan_limits_audit;`);

      // RLS should block non-admin access
      expect(result.rows.length).toBe(0);
    });
  });
});
