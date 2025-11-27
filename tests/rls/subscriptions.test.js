/**
 * Subscriptions (Polar) RLS Tests
 *
 * Validates that Row Level Security policies correctly enforce
 * subscription access and plan changes.
 */

const { setup, teardown, setupBeforeEach, setupAfterEach } = require('./helpers/rls-test-helpers');

let db;
let pg;
let shouldSkip = false;

beforeAll(async () => {
  const result = await setup();
  if (result.skip) {
    shouldSkip = true;
    return;
  }
  db = result.db;
  pg = result.pg;
});

afterAll(async () => {
  if (!shouldSkip) {
    await teardown();
  }
});

beforeEach(() => {
  setupBeforeEach(db, shouldSkip);
});

afterEach(() => {
  setupAfterEach(db, shouldSkip);
});

describe('Subscriptions RLS', () => {
  let userAId;
  let userBId;
  let subscriptionAId;
  let subscriptionBId;

  beforeEach(async () => {
    if (shouldSkip || !pg || !db) {
      return; // Skip test data setup if tests are skipped
    }

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
    const subAResult = await pg.query(
      `
      INSERT INTO polar_subscriptions (
        id, user_id, polar_subscription_id, plan, status,
        current_period_start, current_period_end
      )
      VALUES (
        gen_random_uuid(), $1, 'polar-sub-a-123', 'pro', 'active',
        NOW(), NOW() + INTERVAL '1 month'
      )
      RETURNING id;
    `,
      [userAId]
    );
    subscriptionAId = subAResult.rows[0].id;

    // Create canceled subscription for User B
    const subBResult = await pg.query(
      `
      INSERT INTO polar_subscriptions (
        id, user_id, polar_subscription_id, plan, status,
        current_period_start, current_period_end, canceled_at
      )
      VALUES (
        gen_random_uuid(), $1, 'polar-sub-b-456', 'starter', 'canceled',
        NOW() - INTERVAL '1 month', NOW(), NOW()
      )
      RETURNING id;
    `,
      [userBId]
    );
    subscriptionBId = subBResult.rows[0].id;
  });

  test('Un usuario sin suscripción activa no puede cambiar niveles', async () => {
    if (shouldSkip || !pg || !db) {
      return; // Skip test if setup failed
    }

    // Set context as User B (canceled subscription)
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userBId
    });

    // User B should see their canceled subscription
    const sub = await db.query(
      `
      SELECT status FROM polar_subscriptions WHERE user_id = $1;
    `,
      [userBId]
    );

    expect(sub.rows.length).toBe(1);
    expect(sub.rows[0].status).toBe('canceled');

    // User B should NOT be able to update to active status
    await expect(
      db.query(
        `
        UPDATE polar_subscriptions
        SET status = 'active', plan = 'pro'
        WHERE user_id = $1;
      `,
        [userBId]
      )
    ).rejects.toThrow();
  });

  test('Cambio de plan debe reflejarse en DB', async () => {
    if (shouldSkip || !pg || !db) {
      return; // Skip test if setup failed
    }

    // Set context as User A (active subscription)
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId
    });

    // Update plan via service role (simulating webhook)
    await pg.query(
      `
      UPDATE polar_subscriptions
      SET plan = 'plus', updated_at = NOW()
      WHERE user_id = $1;
    `,
      [userAId]
    );

    // Verify plan change is reflected
    const result = await db.query(
      `
      SELECT plan FROM polar_subscriptions WHERE user_id = $1;
    `,
      [userAId]
    );

    expect(result.rows[0].plan).toBe('plus');
  });

  test('Polar webhook genera un registro válido', async () => {
    if (shouldSkip || !pg || !db) {
      return; // Skip test if setup failed
    }

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
