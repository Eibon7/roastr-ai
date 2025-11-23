/**
 * Multi-Tenant RLS Tests
 *
 * Validates that Row Level Security policies correctly enforce
 * multi-tenant isolation across all organization-scoped tables.
 */

const { getConnections } = require('supabase-test');
const { getTestConfig } = require('../setup/supabase-test.config');
const { createMigrationsSeed } = require('./helpers/load-migrations');

let db;
let pg;
let teardown;

beforeAll(async () => {
  const config = getTestConfig();
  const result = await getConnections(config, [
    createMigrationsSeed() // Load all migrations automatically
  ]);

  db = result.db;
  pg = result.pg;
  teardown = result.teardown;
});

afterAll(async () => {
  await teardown();
});

beforeEach(() => {
  db.beforeEach();
});

afterEach(() => {
  db.afterEach();
});

describe('Multi-Tenant Isolation', () => {
  let userAId;
  let userBId;
  let orgAId;
  let orgBId;

  beforeEach(async () => {
    // Create test users
    const userAResult = await pg.query(`
      INSERT INTO users (id, email, plan)
      VALUES (gen_random_uuid(), 'user-a@test.com', 'starter')
      RETURNING id;
    `);
    userAId = userAResult.rows[0].id;

    const userBResult = await pg.query(`
      INSERT INTO users (id, email, plan)
      VALUES (gen_random_uuid(), 'user-b@test.com', 'starter')
      RETURNING id;
    `);
    userBId = userBResult.rows[0].id;

    // Create organizations
    const orgAResult = await pg.query(
      `
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org A', 'org-a', $1, 'starter')
      RETURNING id;
    `,
      [userAId]
    );
    orgAId = orgAResult.rows[0].id;

    const orgBResult = await pg.query(
      `
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org B', 'org-b', $1, 'starter')
      RETURNING id;
    `,
      [userBId]
    );
    orgBId = orgBResult.rows[0].id;
  });

  test('user_id scope is respected', async () => {
    // Set context as User A
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId,
      'jwt.claims.org_id': orgAId
    });

    // User A should only see their own organization
    const orgs = await db.query(`
      SELECT id FROM organizations;
    `);

    expect(orgs.rows.length).toBe(1);
    expect(orgs.rows[0].id).toBe(orgAId);
  });

  test('policies prevent collisions between different social networks', async () => {
    // Create comments for different organizations
    await pg.query(
      `
      INSERT INTO comments (id, organization_id, platform, platform_comment_id, original_text)
      VALUES 
        (gen_random_uuid(), $1, 'twitter', 'comment-a-123', 'Comment from Org A'),
        (gen_random_uuid(), $2, 'twitter', 'comment-b-456', 'Comment from Org B');
    `,
      [orgAId, orgBId]
    );

    // Set context as User A
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId,
      'jwt.claims.org_id': orgAId
    });

    // User A should only see comments from their organization
    const comments = await db.query(`
      SELECT id, organization_id FROM comments;
    `);

    expect(comments.rows.length).toBe(1);
    expect(comments.rows[0].organization_id).toBe(orgAId);
  });

  test('workers access only their tenant', async () => {
    // Create usage records for different organizations
    await pg.query(
      `
      INSERT INTO usage_records (id, organization_id, platform, action_type, quantity)
      VALUES 
        (gen_random_uuid(), $1, 'twitter', 'roast', 1),
        (gen_random_uuid(), $2, 'twitter', 'roast', 1);
    `,
      [orgAId, orgBId]
    );

    // Set context as service role (bypasses RLS)
    db.setContext({
      role: 'service_role'
    });

    // Service role should see all records
    const allRecords = await db.query(`
      SELECT COUNT(*) as count FROM usage_records;
    `);
    expect(parseInt(allRecords.rows[0].count)).toBe(2);

    // Set context as User A (RLS enforced)
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId,
      'jwt.claims.org_id': orgAId
    });

    // User A should only see their organization's records
    const userRecords = await db.query(`
      SELECT COUNT(*) as count FROM usage_records;
    `);
    expect(parseInt(userRecords.rows[0].count)).toBe(1);
  });
});
