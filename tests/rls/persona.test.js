/**
 * Persona RLS Tests
 *
 * Validates that Row Level Security policies correctly enforce
 * persona data isolation and encryption requirements.
 */

const { getConnections } = require('supabase-test');
const { getTestConfig } = require('../setup/supabase-test.config');
const { createMigrationsSeed } = require('./helpers/load-migrations');
const { skipIfPsqlNotAvailable } = require('./helpers/check-psql');

let db;
let pg;
let teardown;
let shouldSkip = false;

beforeAll(async () => {
  // Check if psql is available
  shouldSkip = await skipIfPsqlNotAvailable();
  if (shouldSkip) {
    return; // Skip test setup
  }

  try {
    const config = getTestConfig();
    const result = await getConnections(config, [
      createMigrationsSeed() // Load all migrations automatically
    ]);

    db = result.db;
    pg = result.pg;
    teardown = result.teardown;
  } catch (error) {
    if (error.message && error.message.includes('psql')) {
      console.warn('⚠️  psql not found, skipping RLS tests');
      shouldSkip = true;
    } else {
      throw error;
    }
  }
});

afterAll(async () => {
  if (shouldSkip || !teardown || typeof teardown !== 'function') {
    return;
  }
  try {
    await teardown();
  } catch (error) {
    // Ignore teardown errors if psql is not available
    if (!error.message || !error.message.includes('psql')) {
      throw error;
    }
  }
});

beforeEach(() => {
  if (shouldSkip || !db) {
    return;
  }
  if (db && typeof db.beforeEach === 'function') {
    db.beforeEach();
  }
});

afterEach(() => {
  if (shouldSkip || !db) {
    return;
  }
  if (db && typeof db.afterEach === 'function') {
    db.afterEach();
  }
});

describe('Persona RLS', () => {
  let userAId;
  let userBId;

  beforeEach(async () => {
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

    await pg.query(
      `
      UPDATE users
      SET lo_que_me_define_encrypted = 'encrypted-identity-a'
      WHERE id = $1;
    `,
      [userAId]
    );

    await pg.query(
      `
      UPDATE users
      SET lo_que_me_define_encrypted = 'encrypted-identity-b'
      WHERE id = $1;
    `,
      [userBId]
    );
  });

  test('Usuario A no puede leer la persona de Usuario B', async () => {
    db.setContext({
      role: 'authenticated',
      'jwt.claims.user_id': userAId
    });

    const personaA = await db.query(
      `
      SELECT lo_que_me_define_encrypted
      FROM users WHERE id = $1;
    `,
      [userAId]
    );

    expect(personaA.rows.length).toBe(1);
    expect(personaA.rows[0].lo_que_me_define_encrypted).toBe('encrypted-identity-a');

    const personaB = await db.query(
      `
      SELECT lo_que_me_define_encrypted
      FROM users WHERE id = $1;
    `,
      [userBId]
    );

    expect(personaB.rows.length).toBe(0);
  });
});
