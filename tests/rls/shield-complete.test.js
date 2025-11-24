/**
 * Shield Actions RLS Tests - Migrated from integration tests
 *
 * Tests Row Level Security policies for Shield actions using supabase-test
 * (10-30x faster than network-based tests)
 *
 * Migrated from: tests/integration/shield-rls.test.js
 * Related Issue: #914 (Migration), #787 (Original RLS implementation)
 * Related Node: multi-tenant.md, shield.md
 */

const crypto = require('crypto');
const { getConnections } = require('supabase-test');
const { getTestConfig } = require('../setup/supabase-test.config');
const { createMigrationsSeed } = require('./helpers/load-migrations');

let db;
let pg;
let teardown;

beforeAll(async () => {
  console.log('\n🚀 Setting up Shield RLS test environment (supabase-test)...\n');

  const config = getTestConfig();
  const result = await getConnections(config, [
    createMigrationsSeed() // Load all migrations automatically
  ]);

  db = result.db;
  pg = result.pg;
  teardown = result.teardown;
});

afterAll(async () => {
  console.log('\n🧹 Tearing down Shield RLS test environment...\n');
  await teardown();
  console.log('\n✅ Teardown complete\n');
});

beforeEach(() => {
  db.beforeEach(); // Create savepoint for test isolation
});

afterEach(() => {
  db.afterEach(); // Rollback to savepoint
});

describe('Shield Actions RLS Tests (Issue #914 Migration)', () => {
  let userAId, userBId;
  let orgAId, orgBId;
  let commentAId, commentBId;
  let shieldActionAId, shieldActionBId;

  beforeEach(async () => {
    // Create test users
    const userAResult = await pg.query(`
      INSERT INTO users (id, email, plan)
      VALUES (gen_random_uuid(), 'user-a-shield@test.com', 'pro')
      RETURNING id;
    `);
    userAId = userAResult.rows[0].id;

    const userBResult = await pg.query(`
      INSERT INTO users (id, email, plan)
      VALUES (gen_random_uuid(), 'user-b-shield@test.com', 'pro')
      RETURNING id;
    `);
    userBId = userBResult.rows[0].id;

    // Create organizations
    const orgAResult = await pg.query(
      `
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org A Shield', 'org-a-shield', $1, 'pro')
      RETURNING id;
    `,
      [userAId]
    );
    orgAId = orgAResult.rows[0].id;

    const orgBResult = await pg.query(
      `
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org B Shield', 'org-b-shield', $1, 'pro')
      RETURNING id;
    `,
      [userBId]
    );
    orgBId = orgBResult.rows[0].id;

    // Create comments (required for shield_actions FK)
    const commentAResult = await pg.query(
      `
      INSERT INTO comments (id, organization_id, platform, platform_comment_id, platform_user_id, platform_username, original_text, toxicity_score)
      VALUES (gen_random_uuid(), $1, 'twitter', $2, 'twitter_user_A', '@testuserA', 'Test comment A', 0.95)
      RETURNING id;
    `,
      [orgAId, `tweet_${Date.now()}_A`]
    );
    commentAId = commentAResult.rows[0].id;

    const commentBResult = await pg.query(
      `
      INSERT INTO comments (id, organization_id, platform, platform_comment_id, platform_user_id, platform_username, original_text, toxicity_score)
      VALUES (gen_random_uuid(), $1, $2, 'twitter_user_B', '@testuserB', 'Test comment B', 0.92)
      RETURNING id;
    `,
      [orgBId, `tweet_${Date.now()}_B`]
    );
    commentBId = commentBResult.rows[0].id;

    // Create shield_actions
    const contentHashA = crypto.createHash('sha256').update('Test comment A').digest('hex');
    const contentHashB = crypto.createHash('sha256').update('Test comment B').digest('hex');

    const shieldAResult = await pg.query(
      `
      INSERT INTO shield_actions (
        id, organization_id, platform, action_type, content_hash, content_snippet, reason, metadata
      )
      VALUES (
        gen_random_uuid(), $1, 'twitter', 'block', $2, $3, 'toxic', $4::jsonb
      )
      RETURNING id;
    `,
      [
        orgAId,
        contentHashA,
        'Test comment A',
        JSON.stringify({
          comment_id: commentAId,
          platform_user_id: 'twitter_user_A',
          platform_username: '@testuserA',
          toxicity_score: 0.95,
          severity: 'high'
        })
      ]
    );
    shieldActionAId = shieldAResult.rows[0].id;

    const shieldBResult = await pg.query(
      `
      INSERT INTO shield_actions (
        id, organization_id, platform, action_type, content_hash, content_snippet, reason, metadata
      )
      VALUES (
        gen_random_uuid(), $1, 'twitter', 'mute', $2, $3, 'toxic', $4::jsonb
      )
      RETURNING id;
    `,
      [
        orgBId,
        contentHashB,
        'Test comment B',
        JSON.stringify({
          comment_id: commentBId,
          platform_user_id: 'twitter_user_B',
          platform_username: '@testuserB',
          toxicity_score: 0.92,
          severity: 'medium'
        })
      ]
    );
    shieldActionBId = shieldBResult.rows[0].id;

    console.log('✅ Shield actions test data created');
  });

  describe('AC5.1: shield_actions - Listados restringidos por tenant_id', () => {
    test('Tenant A can only see their own shield_actions', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`
        SELECT * FROM shield_actions;
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every((action) => action.organization_id === orgAId)).toBe(true);
      expect(result.rows.some((action) => action.id === shieldActionAId)).toBe(true);
      expect(result.rows.some((action) => action.id === shieldActionBId)).toBe(false);
    });

    test('Tenant A cannot see Tenant B shield_actions', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `
        SELECT * FROM shield_actions WHERE organization_id = $1;
      `,
        [orgBId]
      );

      expect(result.rows.length).toBe(0); // RLS blocks cross-tenant access
    });
  });

  describe('AC5.2: shield_actions - Accesos directos por ID verifican tenant_id', () => {
    test('Tenant A can access their own shield_actions by ID', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `
        SELECT * FROM shield_actions WHERE id = $1;
      `,
        [shieldActionAId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBe(shieldActionAId);
      expect(result.rows[0].organization_id).toBe(orgAId);
      expect(result.rows[0].action_type).toBe('block');
    });

    test('Tenant A cannot access Tenant B shield_actions by ID', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `
        SELECT * FROM shield_actions WHERE id = $1;
      `,
        [shieldActionBId]
      );

      expect(result.rows.length).toBe(0); // RLS blocks access
    });
  });

  describe('AC5.3: shield_actions - Cross-tenant access blocked', () => {
    test('Tenant A cannot insert shield_actions for Tenant B', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const invalidHash = crypto.createHash('sha256').update('invalid content').digest('hex');

      // Attempt to insert for Tenant B (should fail)
      await expect(
        db.query(
          `
          INSERT INTO shield_actions (
            organization_id, platform, action_type, content_hash, content_snippet, reason, metadata
          )
          VALUES ($1, 'twitter', 'block', $2, 'Invalid content', 'toxic', '{}'::jsonb)
          RETURNING id;
        `,
          [orgBId, invalidHash]
        )
      ).rejects.toThrow(); // RLS policy violation
    });

    test('Tenant A cannot update Tenant B shield_actions', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `
        UPDATE shield_actions
        SET reason = 'spam'
        WHERE id = $1
        RETURNING id;
      `,
        [shieldActionBId]
      );

      expect(result.rows.length).toBe(0); // RLS blocks update
    });

    test('Tenant A cannot delete Tenant B shield_actions', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(
        `
        DELETE FROM shield_actions
        WHERE id = $1
        RETURNING id;
      `,
        [shieldActionBId]
      );

      expect(result.rows.length).toBe(0); // RLS blocks delete
    });
  });

  describe('AC5.4: shield_actions - Filtering by platform and author', () => {
    test('Tenant A can filter shield_actions by platform', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`
        SELECT * FROM shield_actions WHERE platform = 'twitter';
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every((action) => action.platform === 'twitter')).toBe(true);
      expect(result.rows.every((action) => action.organization_id === orgAId)).toBe(true);
    });

    test('Tenant A can filter shield_actions by platform_user_id in metadata', async () => {
      // Set context as User A
      db.setContext({
        role: 'authenticated',
        'jwt.claims.user_id': userAId,
        'jwt.claims.org_id': orgAId
      });

      const result = await db.query(`
        SELECT * FROM shield_actions WHERE metadata->>'platform_user_id' = 'twitter_user_A';
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      expect(
        result.rows.every((action) => {
          const metadata = action.metadata || {};
          return metadata.platform_user_id === 'twitter_user_A';
        })
      ).toBe(true);
      expect(result.rows.every((action) => action.organization_id === orgAId)).toBe(true);
    });
  });
});

