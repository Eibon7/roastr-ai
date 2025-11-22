/**
 * Subscriptions (Polar) RLS Tests
 * 
 * Validates that Row Level Security policies correctly enforce
 * subscription access and plan changes.
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

describe('Subscriptions RLS', () => {
  let userAId;
  let userBId;
  let subscriptionAId;
  let subscriptionBId;

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

    // Create active subscription for User A
    const subAResult = await pg.query(`
      INSERT INTO polar_subscriptions (
        id, user_id, polar_subscription_id, plan, status,
        current_period_start, current_period_end
      )
      VALUES (
        gen_random_uuid(), $1, 'polar-sub-a-123', 'pro', 'active',
        NOW(), NOW() + INTERVAL '1 month'
      )
      RETURNING id;
    `, [userAId]);
    subscriptionAId = subAResult.rows[0].id;

    // Create canceled subscription for User B
    const subBResult = await pg.query(`
      INSERT INTO polar_subscriptions (
        id, user_id, polar_subscription_id, plan, status,
        current_period_start, current_period_end, canceled_at
      )
      VALUES (
        gen_random_uuid(), $1, 'polar-sub-b-456', 'starter', 'canceled',
        NOW() - INTERVAL '1 month', NOW(), NOW()
      )
      RETURNING id;
    `, [userBId]);
    subscriptionBId = subBResult.rows[0].id;
  });

  test('Un usuario sin suscripción activa no puede cambiar niveles', async () => {
    // Set context as User B (canceled subscription)
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userBId
    });

    // User B should see their canceled subscription
    const sub = await db.query(`
      SELECT status FROM polar_subscriptions WHERE user_id = $1;
    `, [userBId]);

    expect(sub.rows.length).toBe(1);
    expect(sub.rows[0].status).toBe('canceled');

    // User B should NOT be able to update to active status
    await expect(
      db.query(`
        UPDATE polar_subscriptions
        SET status = 'active', plan = 'pro'
        WHERE user_id = $1;
      `, [userBId])
    ).rejects.toThrow();
  });

  test('Cambio de plan debe reflejarse en DB', async () => {
    // Set context as User A (active subscription)
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId
    });

    // Update plan via service role (simulating webhook)
    await pg.query(`
      UPDATE polar_subscriptions
      SET plan = 'plus', updated_at = NOW()
      WHERE user_id = $1;
    `, [userAId]);

    // Verify plan change is reflected
    const result = await db.query(`
      SELECT plan FROM polar_subscriptions WHERE user_id = $1;
    `, [userAId]);

    expect(result.rows[0].plan).toBe('plus');
  });

  test('Polar webhook genera un registro válido', async () => {
    // Simulate webhook event creation (service role)
    const webhookResult = await pg.query(`
      INSERT INTO polar_webhook_events (
        id, polar_event_id, event_type, payload, processed
      )
      VALUES (
        gen_random_uuid(), 'webhook-123', 'subscription.updated',
        '{"subscription_id": "polar-sub-a-123", "plan": "plus"}'::jsonb,
        false
      )
      RETURNING id, polar_event_id, event_type;
    `);

    expect(webhookResult.rows.length).toBe(1);
    expect(webhookResult.rows[0].event_type).toBe('subscription.updated');
    expect(webhookResult.rows[0].polar_event_id).toBe('webhook-123');

    // Verify webhook event is accessible
    const webhook = await pg.query(`
      SELECT id, processed FROM polar_webhook_events WHERE polar_event_id = 'webhook-123';
    `);

    expect(webhook.rows.length).toBe(1);
    expect(webhook.rows[0].processed).toBe(false);
  });
});

