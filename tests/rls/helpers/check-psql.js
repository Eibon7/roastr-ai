/**
 * Helper to check if psql is available
 * Used to skip RLS tests when PostgreSQL client tools are not installed
 */

const { spawn } = require('child_process');

/**
 * Check if psql command is available
 * @returns {Promise<boolean>} True if psql is available
 */
function checkPsqlAvailable() {
  return new Promise((resolve) => {
    const psql = spawn('psql', ['--version'], {
      stdio: 'pipe',
      shell: true
    });

    psql.on('close', (code) => {
      resolve(code === 0);
    });

    psql.on('error', () => {
      resolve(false);
    });

    // Timeout after 2 seconds
    setTimeout(() => {
      psql.kill();
      resolve(false);
    }, 2000);
  });
}

/**
 * Skip tests if psql is not available
 * Usage: beforeAll(async () => { await skipIfPsqlNotAvailable(); });
 */
async function skipIfPsqlNotAvailable() {
  const available = await checkPsqlAvailable();
  if (!available) {
    console.warn(
      '⚠️  psql not found in PATH. RLS tests require PostgreSQL client tools.'
    );
    console.warn('   Install PostgreSQL client tools or skip RLS tests.');
    console.warn('   On macOS: brew install postgresql');
    console.warn('   On Ubuntu: sudo apt-get install postgresql-client');
    console.warn('   Skipping RLS tests...');
    return true; // Indicates tests should be skipped
  }
  return false; // Indicates tests can run
}

module.exports = {
  checkPsqlAvailable,
  skipIfPsqlNotAvailable
};

