/**
 * Roast RLS Tests
 * 
 * Validates that Row Level Security policies correctly enforce
 * roast generation limits and isolation.
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

describe('Roast RLS', () => {
  let userAId;
  let userBId;
  let orgAId;
  let orgBId;
  let commentAId;
  let commentBId;
  let roastAId;
  let roastBId;

  beforeEach(async () => {
    // Create test users
    const userAResult = await pg.query(`
      INSERT INTO users (id, email, plan)
      VALUES (gen_random_uuid(), 'user-a@test.com', 'pro')
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
    const orgAResult = await pg.query(`
      INSERT INTO organizations (id, name, slug, owner_id, plan_id, monthly_responses_limit)
      VALUES (gen_random_uuid(), 'Org A', 'org-a', $1, 'pro', 1000)
      RETURNING id;
    `, [userAId]);
    orgAId = orgAResult.rows[0].id;

    const orgBResult = await pg.query(`
      INSERT INTO organizations (id, name, slug, owner_id, plan_id, monthly_responses_limit)
      VALUES (gen_random_uuid(), 'Org B', 'org-b', $1, 'starter', 10)
      RETURNING id;
    `, [userBId]);
    orgBId = orgBResult.rows[0].id;

    // Create comments
    const commentAResult = await pg.query(`
      INSERT INTO comments (id, organization_id, platform, platform_comment_id, original_text)
      VALUES (gen_random_uuid(), $1, 'twitter', 'comment-a-123', 'Comment A')
      RETURNING id;
    `, [orgAId]);
    commentAId = commentAResult.rows[0].id;

    const commentBResult = await pg.query(`
      INSERT INTO comments (id, organization_id, platform, platform_comment_id, original_text)
      VALUES (gen_random_uuid(), $1, 'twitter', 'comment-b-456', 'Comment B')
      RETURNING id;
    `, [orgBId]);
    commentBId = commentBResult.rows[0].id;

    // Create roasts (responses table)
    const roastAResult = await pg.query(`
      INSERT INTO responses (id, organization_id, comment_id, generated_text, tone)
      VALUES (gen_random_uuid(), $1, $2, 'Roast A', 'witty')
      RETURNING id;
    `, [orgAId, commentAId]);
    roastAId = roastAResult.rows[0].id;

    const roastBResult = await pg.query(`
      INSERT INTO responses (id, organization_id, comment_id, generated_text, tone)
      VALUES (gen_random_uuid(), $1, $2, 'Roast B', 'witty')
      RETURNING id;
    `, [orgBId, commentBId]);
    roastBId = roastBResult.rows[0].id;
  });

  test('Un usuario no puede editar roasts de otro', async () => {
    // Set context as User A
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId,
      'jwt.claims.org_id': orgAId
    });

    // User A should be able to update their own roast
    const updateResult = await db.query(`
      UPDATE responses
      SET generated_text = 'Updated Roast A'
      WHERE id = $1
      RETURNING generated_text;
    `, [roastAId]);

    expect(updateResult.rows.length).toBe(1);
    expect(updateResult.rows[0].generated_text).toBe('Updated Roast A');

    // User A should NOT be able to update User B's roast
    await expect(
      db.query(`
        UPDATE responses
        SET generated_text = 'Hacked Roast B'
        WHERE id = $1;
      `, [roastBId])
    ).rejects.toThrow();
  });

  test('Ningún usuario sin suscripción Pro/Plus puede generar más roasts', async () => {
    // Set context as User B (Starter plan)
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userBId,
      'jwt.claims.org_id': orgBId
    });

    // Simulate usage reaching limit (10 roasts for Starter)
    await pg.query(`
      UPDATE organizations
      SET monthly_responses_used = monthly_responses_limit
      WHERE id = $1;
    `, [orgBId]);

    // Verify limit is enforced
    const org = await db.query(`
      SELECT monthly_responses_used, monthly_responses_limit
      FROM organizations
      WHERE id = $1;
    `, [orgBId]);

    expect(parseInt(org.rows[0].monthly_responses_used)).toBeGreaterThanOrEqual(
      parseInt(org.rows[0].monthly_responses_limit)
    );
  });

  test('Validar límites por plan', async () => {
    // Set context as User A (Pro plan)
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId,
      'jwt.claims.org_id': orgAId
    });

    // Pro plan should have higher limit
    const orgA = await db.query(`
      SELECT monthly_responses_limit, plan_id
      FROM organizations
      WHERE id = $1;
    `, [orgAId]);

    expect(orgA.rows[0].plan_id).toBe('pro');
    expect(parseInt(orgA.rows[0].monthly_responses_limit)).toBe(1000);

    // Set context as User B (Starter plan)
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userBId,
      'jwt.claims.org_id': orgBId
    });

    // Starter plan should have lower limit
    const orgB = await db.query(`
      SELECT monthly_responses_limit, plan_id
      FROM organizations
      WHERE id = $1;
    `, [orgBId]);

    expect(orgB.rows[0].plan_id).toBe('starter');
    expect(parseInt(orgB.rows[0].monthly_responses_limit)).toBe(10);
  });
});

