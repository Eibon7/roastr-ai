/**
 * Helper to load Supabase migrations for RLS tests
 *
 * Automatically loads all migrations from supabase/migrations/ in order
 */

const fs = require('fs');
const path = require('path');
const { seed } = require('supabase-test');

/**
 * Get all migration files sorted by timestamp
 */
function getMigrationFiles() {
  const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.warn(`⚠️  Migrations directory not found: ${migrationsDir}`);
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .filter((file) => {
      // Skip empty files
      const filePath = path.join(migrationsDir, file);
      const stats = fs.statSync(filePath);
      return stats.size > 0;
    })
    .sort() // Sort alphabetically (timestamps ensure correct order)
    .map((file) => path.join(migrationsDir, file));

  return files;
}

/**
 * Create seed adapter for migrations
 */
function createMigrationsSeed() {
  const migrationFiles = getMigrationFiles();

  if (migrationFiles.length === 0) {
    console.warn('⚠️  No migration files found, tests will run without schema');
    return seed.sqlfile([]);
  }

  console.log(`📦 Loading ${migrationFiles.length} migration files for RLS tests`);
  return seed.sqlfile(migrationFiles);
}

module.exports = {
  getMigrationFiles,
  createMigrationsSeed
};
