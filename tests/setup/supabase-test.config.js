/**
 * Configuration helper for supabase-test
 * 
 * This file centralizes the configuration for supabase-test to ensure
 * consistent test database setup across all RLS tests.
 * 
 * Usage:
 * ```js
 * const { getTestConfig } = require('./setup/supabase-test.config');
 * const { db, teardown } = await getConnections(getTestConfig());
 * ```
 */

const path = require('path');

/**
 * Get connection options for supabase-test
 * 
 * Configures:
 * - Schema path: ./supabase/migrations
 * - Database connection from SUPABASE_DB_URL or defaults
 * - Extensions: uuid-ossp, pgvector (for embeddings)
 */
function getTestConfig() {
  const migrationsPath = path.resolve(__dirname, '../../supabase/migrations');

  return {
    pg: {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '54322', 10), // Supabase default port
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'postgres'
    },
    db: {
      extensions: ['uuid-ossp', 'pgvector'],
      cwd: migrationsPath,
      connection: {
        user: 'authenticated', // Default role for RLS testing
        password: 'app_password',
        role: 'authenticated'
      },
      prefix: 'rls-test-',
      rootDb: 'postgres'
    }
  };
}

/**
 * Helper to get connection string from environment
 * Falls back to Supabase local defaults if not set
 */
function getConnectionString() {
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || '54322';
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || 'postgres';
  const database = process.env.PGDATABASE || 'postgres';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

module.exports = {
  getTestConfig,
  getConnectionString
};

