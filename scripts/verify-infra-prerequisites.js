#!/usr/bin/env node

/**
 * Verify Infrastructure Prerequisites
 *
 * Generic verifier for infrastructure prerequisites. Currently validates:
 * - admin_settings table (ROA-268)
 *
 * This script performs READ-ONLY checks and does NOT modify the database.
 *
 * @module scripts/verify-infra-prerequisites
 * @requires @supabase/supabase-js
 * @requires dotenv
 * @example
 * // Run from command line:
 * // node scripts/verify-infra-prerequisites.js
 *
 * @description
 * This is a generic infrastructure prerequisites verifier that can be extended
 * with additional checks in the future. Currently only validates admin_settings.
 *
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 *
 * Related: ROA-268
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  console.error('   Add them to your .env file');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Import checks
const { runCheck: runAdminSettingsCheck } = require('./infra-checks/admin-settings.check');

/**
 * List of infrastructure checks to run
 * Add new checks here as they are implemented
 */
const CHECKS = [
  {
    id: 'admin_settings',
    description: 'Verify admin_settings table exists and is secure',
    severity: 'error',
    run: () => runAdminSettingsCheck(supabase)
  }
];

/**
 * Main verification function
 */
async function verifyInfraPrerequisites() {
  console.log('[INFRA] Running prerequisite checks\n');

  const results = [];
  let hasErrors = false;

  // Run all checks sequentially
  for (let i = 0; i < CHECKS.length; i++) {
    const check = CHECKS[i];
    console.log(`[INFRA] Running check ${i + 1}/${CHECKS.length}: ${check.id}`);

    try {
      const result = await check.run();
      results.push(result);

      if (result.passed) {
        console.log(`✔ ${result.message || check.description}\n`);
      } else {
        console.log(`✗ ${result.message || check.description}\n`);

        // Show details if available
        if (result.details) {
          Object.entries(result.details).forEach(([key, detail]) => {
            if (detail.passed) {
              console.log(`  ✓ ${key}: ${detail.message}`);
            } else {
              console.log(`  ✗ ${key}: ${detail.message}`);
            }
          });
          console.log('');
        }

        if (check.severity === 'error') {
          hasErrors = true;
        }
      }
    } catch (error) {
      console.error(`✗ ${check.id}: ${error.message}\n`);
      results.push({
        id: check.id,
        passed: false,
        message: error.message
      });
      hasErrors = true;
    }
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[INFRA] Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  results.forEach((result) => {
    const status = result.passed ? '✔' : '✗';
    console.log(`${status} ${result.id}: ${result.message || 'Check completed'}`);
  });

  console.log(`\n${passedCount}/${totalCount} checks passed`);

  if (hasErrors) {
    console.log('\n❌ Some prerequisite checks failed. Please review the output above.');
    process.exit(1);
  } else {
    console.log('\n✅ All prerequisite checks passed!');
    process.exit(0);
  }
}

// Execute verification
verifyInfraPrerequisites().catch((error) => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});

