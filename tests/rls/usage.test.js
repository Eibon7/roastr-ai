/**
 * Usage Tracking RLS Tests - Migrated from integration tests
 *
 * Tests Row Level Security policies for usage tracking tables using supabase-test
 * (10-30x faster than network-based tests)
 *
 * Migrated from: tests/integration/usage-rls.test.js
 * Related Issue: #914 (Migration), #787 (Original RLS implementation)
 * Related Node: multi-tenant.md, cost-control.md
 */

const { getConnections } = require('supabase-test');
const { getTestConfig } = require('../setup/supabase-test.config');
const { createMigrationsSeed } = require('./helpers/load-migrations');

let db;
let pg;
let teardown;

beforeAll(async () => {
  console.log('\n🚀 Setting up Usage RLS test environment (supabase-test)...\n');

  const config = getTestConfig();
  const result = await getConnections(config, [createMigrationsSeed()]);

  db = result.db;
  pg = result.pg;
  teardown = result.teardown;
});

afterAll(async () => {
  console.log('\n🧹 Tearing down Usage RLS test environment...\n');
  await teardown();
  console.log('\n✅ Teardown complete\n');
});

beforeEach(() => {
  db.beforeEach();
});

afterEach(() => {
  db.afterEach();
});

describe('Usage Tracking RLS Tests (Issue #914 Migration)', () => {
  let userAId, userBId;
  let orgAId, orgBId;
  let usageTrackingAId, usageTrackingBId;
  let usageLimitsAId, usageLimitsBId;
  let usageAlertsAId, usageAlertsBId;

  beforeEach(async () => {
    // Create users
    const userAResult = await pg.query(`
      INSERT INTO users (id, email, plan)
      VALUES (gen_random_uuid(), 'user-a-usage@test.com', 'pro')
      RETURNING id;
    `);
    userAId = userAResult.rows[0].id;

    const userBResult = await pg.query(`
      INSERT INTO users (id, email, plan)
      VALUES (gen_random_uuid(), 'user-b-usage@test.com', 'pro')
      RETURNING id;
    `);
    userBId = userBResult.rows[0].id;

    // Create organizations
    const orgAResult = await pg.query(`
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org A Usage', 'org-a-usage', $1, 'pro')
      RETURNING id;
    `, [userAId]);
    orgAId = orgAResult.rows[0].id;

    const orgBResult = await pg.query(`
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org B Usage', 'org-b-usage', $1, 'pro')
      RETURNING id;
    `, [userBId]);
    orgBId = orgBResult.rows[0].id;

    // Create usage_tracking records
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const trackingAResult = await pg.query(`
      INSERT INTO usage_tracking (id, organization_id, resource_type, year, month, day, quantity, cost_cents)
      VALUES (gen_random_uuid(), $1, 'roasts', $2, $3, $4, 10, 100)
      RETURNING id;
    `, [orgAId, year, month, day]);
    usageTrackingAId = trackingAResult.rows[0].id;

    const trackingBResult = await pg.query(`
      INSERT INTO usage_tracking (id, organization_id, resource_type, year, month, day, quantity, cost_cents)
      VALUES (gen_random_uuid(), $1, 'roasts', $2, $3, $4, 20, 200)
      RETURNING id;
    `, [orgBId, year, month, day]);
    usageTrackingBId = trackingBResult.rows[0].id;

    // Create usage_limits records
    const limitsAResult = await pg.query(`
      INSERT INTO usage_limits (id, organization_id, resource_type, monthly_limit, daily_limit, allow_overage, is_active)
      VALUES (gen_random_uuid(), $1, 'roasts', 1000, 50, true, true)
      RETURNING id;
    `, [orgAId]);
    usageLimitsAId = limitsAResult.rows[0].id;

    const limitsBResult = await pg.query(`
      INSERT INTO usage_limits (id, organization_id, resource_type, monthly_limit, daily_limit, allow_overage, is_active)
      VALUES (gen_random_uuid(), $1, 'roasts', 2000, 100, false, true)
      RETURNING id;
    `, [orgBId]);
    usageLimitsBId = limitsBResult.rows[0].id;

    // Create usage_alerts records
    const alertsAResult = await pg.query(`
      INSERT INTO usage_alerts (id, organization_id, resource_type, threshold_percentage, alert_type, is_active)
      VALUES (gen_random_uuid(), $1, 'roasts', 80, 'email', true)
      RETURNING id;
    `, [orgAId]);
    usageAlertsAId = alertsAResult.rows[0].id;

    const alertsBResult = await pg.query(`
      INSERT INTO usage_alerts (id, organization_id, resource_type, threshold_percentage, alert_type, is_active)
      VALUES (gen_random_uuid(), $1, 'roasts', 90, 'email', true)
      RETURNING id;
    `, [orgBId]);
    usageAlertsBId = alertsBResult.rows[0].id;

    console.log('✅ Usage tracking test data created');
  });

  describe('AC3.1: usage_tracking - Listados restringidos por tenant_id', () => {
    test('Tenant A can only see their own usage_tracking records', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`SELECT * FROM usage_tracking;`);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every((record) => record.organization_id === orgAId)).toBe(true);
      expect(result.rows.some((record) => record.id === usageTrackingAId)).toBe(true);
      expect(result.rows.some((record) => record.id === usageTrackingBId)).toBe(false);
    });

    test('Tenant A cannot see Tenant B usage_tracking records', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_tracking WHERE organization_id = $1;`,
        [orgBId]
      );

      expect(result.rows.length).toBe(0);
    });
  });

  describe('AC3.2: usage_tracking - Accesos directos por ID verifican tenant_id', () => {
    test('Tenant A can access their own usage_tracking by ID', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_tracking WHERE id = $1;`,
        [usageTrackingAId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBe(usageTrackingAId);
      expect(result.rows[0].organization_id).toBe(orgAId);
    });

    test('Tenant A cannot access Tenant B usage_tracking by ID', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_tracking WHERE id = $1;`,
        [usageTrackingBId]
      );

      expect(result.rows.length).toBe(0);
    });
  });

  describe('AC3.3: usage_limits - Listados restringidos por tenant_id', () => {
    test('Tenant A can only see their own usage_limits', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`SELECT * FROM usage_limits;`);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every((limit) => limit.organization_id === orgAId)).toBe(true);
      expect(result.rows.some((limit) => limit.id === usageLimitsAId)).toBe(true);
      expect(result.rows.some((limit) => limit.id === usageLimitsBId)).toBe(false);
    });

    test('Tenant A cannot see Tenant B usage_limits', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_limits WHERE organization_id = $1;`,
        [orgBId]
      );

      expect(result.rows.length).toBe(0);
    });
  });

  describe('AC3.4: usage_limits - Accesos directos por ID verifican tenant_id', () => {
    test('Tenant A can access their own usage_limits by ID', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_limits WHERE id = $1;`,
        [usageLimitsAId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBe(usageLimitsAId);
      expect(result.rows[0].organization_id).toBe(orgAId);
    });

    test('Tenant A cannot access Tenant B usage_limits by ID', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_limits WHERE id = $1;`,
        [usageLimitsBId]
      );

      expect(result.rows.length).toBe(0);
    });
  });

  describe('AC3.5: usage_alerts - Listados restringidos por tenant_id', () => {
    test('Tenant A can only see their own usage_alerts', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`SELECT * FROM usage_alerts;`);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every((alert) => alert.organization_id === orgAId)).toBe(true);
      expect(result.rows.some((alert) => alert.id === usageAlertsAId)).toBe(true);
      expect(result.rows.some((alert) => alert.id === usageAlertsBId)).toBe(false);
    });

    test('Tenant A cannot see Tenant B usage_alerts', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_alerts WHERE organization_id = $1;`,
        [orgBId]
      );

      expect(result.rows.length).toBe(0);
    });
  });

  describe('AC3.6: usage_alerts - Accesos directos por ID verifican tenant_id', () => {
    test('Tenant A can access their own usage_alerts by ID', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_alerts WHERE id = $1;`,
        [usageAlertsAId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBe(usageAlertsAId);
      expect(result.rows[0].organization_id).toBe(orgAId);
    });

    test('Tenant A cannot access Tenant B usage_alerts by ID', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `SELECT * FROM usage_alerts WHERE id = $1;`,
        [usageAlertsBId]
      );

      expect(result.rows.length).toBe(0);
    });
  });

  describe('AC3.7: Cross-tenant access blocked', () => {
    test('Tenant A cannot insert usage_tracking for Tenant B', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const now = new Date();
      
      await expect(
        db.query(`
          INSERT INTO usage_tracking (organization_id, resource_type, year, month, day, quantity, cost_cents)
          VALUES ($1, 'roasts', $2, $3, $4, 1, 10)
          RETURNING id;
        `, [orgBId, now.getFullYear(), now.getMonth() + 1, now.getDate()])
      ).rejects.toThrow();
    });

    test('Tenant A cannot update Tenant B usage_limits', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`
        UPDATE usage_limits
        SET monthly_limit = 9999
        WHERE id = $1
        RETURNING id;
      `, [usageLimitsBId]);

      expect(result.rows.length).toBe(0);
    });

    test('Tenant A cannot delete Tenant B usage_alerts', async () => {
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`
        DELETE FROM usage_alerts
        WHERE id = $1
        RETURNING id;
      `, [usageAlertsBId]);

      expect(result.rows.length).toBe(0);
    });
  });
});

