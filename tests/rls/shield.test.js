/**
 * Shield RLS Tests
 * 
 * Validates that Row Level Security policies correctly enforce
 * Shield moderation actions isolation.
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

describe('Shield RLS', () => {
  let userAId;
  let userBId;
  let orgAId;
  let orgBId;
  let commentAId;
  let commentBId;
  let shieldActionAId;
  let shieldActionBId;

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
      VALUES (gen_random_uuid(), 'user-b@test.com', 'pro')
      RETURNING id;
    `);
    userBId = userBResult.rows[0].id;

    // Create organizations
    const orgAResult = await pg.query(`
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org A', 'org-a', $1, 'pro')
      RETURNING id;
    `, [userAId]);
    orgAId = orgAResult.rows[0].id;

    const orgBResult = await pg.query(`
      INSERT INTO organizations (id, name, slug, owner_id, plan_id)
      VALUES (gen_random_uuid(), 'Org B', 'org-b', $1, 'pro')
      RETURNING id;
    `, [userBId]);
    orgBId = orgBResult.rows[0].id;

    // Create comments
    const commentAResult = await pg.query(`
      INSERT INTO comments (id, organization_id, platform, platform_comment_id, original_text)
      VALUES (gen_random_uuid(), $1, 'twitter', 'comment-a-123', 'Toxic comment A')
      RETURNING id;
    `, [orgAId]);
    commentAId = commentAResult.rows[0].id;

    const commentBResult = await pg.query(`
      INSERT INTO comments (id, organization_id, platform, platform_comment_id, original_text)
      VALUES (gen_random_uuid(), $1, 'twitter', 'comment-b-456', 'Toxic comment B')
      RETURNING id;
    `, [orgBId]);
    commentBId = commentBResult.rows[0].id;

    // Create shield actions
    const shieldAResult = await pg.query(`
      INSERT INTO shield_actions (id, organization_id, action_type, content_hash, platform, reason)
      VALUES (gen_random_uuid(), $1, 'block', 'hash-a', 'twitter', 'toxic')
      RETURNING id;
    `, [orgAId]);
    shieldActionAId = shieldAResult.rows[0].id;

    const shieldBResult = await pg.query(`
      INSERT INTO shield_actions (id, organization_id, action_type, content_hash, platform, reason)
      VALUES (gen_random_uuid(), $1, 'block', 'hash-b', 'twitter', 'toxic')
      RETURNING id;
    `, [orgBId]);
    shieldActionBId = shieldBResult.rows[0].id;
  });

  test('Shield solo puede eliminar/comentar items asociados al owner', async () => {
    // Set context as User A
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId,
      'jwt.claims.org_id': orgAId
    });

    // User A should see their own shield actions
    const actionsA = await db.query(`
      SELECT id FROM shield_actions WHERE organization_id = $1;
    `, [orgAId]);

    expect(actionsA.rows.length).toBe(1);
    expect(actionsA.rows[0].id).toBe(shieldActionAId);

    // User A should NOT see User B's shield actions
    const actionsB = await db.query(`
      SELECT id FROM shield_actions WHERE organization_id = $1;
    `, [orgBId]);

    expect(actionsB.rows.length).toBe(0);
  });

  test('No debe poder acceder a publicaciones ajenas', async () => {
    // Set context as User A
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId,
      'jwt.claims.org_id': orgAId
    });

    // User A should see their own comments
    const commentsA = await db.query(`
      SELECT id FROM comments WHERE organization_id = $1;
    `, [orgAId]);

    expect(commentsA.rows.length).toBe(1);
    expect(commentsA.rows[0].id).toBe(commentAId);

    // User A should NOT see User B's comments
    const commentsB = await db.query(`
      SELECT id FROM comments WHERE organization_id = $1;
    `, [orgBId]);

    expect(commentsB.rows.length).toBe(0);
  });

  test('Publicación filtrada → debe estar correctamente marcada en DB', async () => {
    // Set context as User A
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId,
      'jwt.claims.org_id': orgAId
    });

    // Mark comment as filtered
    await db.query(`
      UPDATE comments
      SET status = 'processed', metadata = jsonb_build_object('shield_filtered', true)
      WHERE id = $1;
    `, [commentAId]);

    // Verify comment is marked correctly
    const result = await db.query(`
      SELECT status, metadata->>'shield_filtered' as shield_filtered
      FROM comments
      WHERE id = $1;
    `, [commentAId]);

    expect(result.rows[0].status).toBe('processed');
    expect(result.rows[0].shield_filtered).toBe('true');
  });
});

