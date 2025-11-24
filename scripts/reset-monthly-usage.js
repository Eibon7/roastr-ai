#!/usr/bin/env node

/**
 * Monthly Usage Reset Script
 *
 * This script should be run monthly via cron job to reset usage counters
 * for all organizations. It's designed to be run on the 1st of each month.
 *
 * Usage:
 * node scripts/reset-monthly-usage.js
 *
 * Cron job example (1st of every month at 00:00):
 * 0 0 1 * * node /path/to/roastr-ai/scripts/reset-monthly-usage.js
 */

const CostControlService = require('../src/services/costControl');
const { logger } = require('../src/utils/logger');

/**
 * Main function to reset monthly usage for all organizations
 */
async function resetMonthlyUsage() {
  const startTime = Date.now();

  try {
    logger.info('Starting monthly usage reset process...');

    // Initialize cost control service
    const costControl = new CostControlService();

    // Reset usage for all organizations
    const result = await costControl.resetAllMonthlyUsage();

    const duration = Date.now() - startTime;

    logger.info('Monthly usage reset completed successfully', {
      organizationsReset: result.organizationsReset,
      resetAt: result.resetAt,
      duration: `${duration}ms`
    });

    // Log summary to console for cron job monitoring
    console.log(`✅ Monthly usage reset completed successfully`);
    console.log(`📊 Organizations reset: ${result.organizationsReset}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📅 Reset timestamp: ${result.resetAt}`);

    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Monthly usage reset failed', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    console.error(`❌ Monthly usage reset failed: ${error.message}`);
    console.error(`⏱️  Duration: ${duration}ms`);

    process.exit(1);
  }
}

/**
 * Verify that it's appropriate to run the reset
 */
function verifyResetTiming() {
  const now = new Date();
  const day = now.getDate();
  const hour = now.getHours();

  // Check if it's the 1st of the month
  if (day !== 1) {
    logger.warn('Usage reset typically runs on the 1st of the month', {
      currentDate: now.toISOString(),
      currentDay: day
    });
    console.warn(
      `⚠️  Warning: Running usage reset on day ${day} of the month (typically runs on day 1)`
    );
  }

  // Check if it's early in the day (cron jobs usually run at midnight)
  if (hour >= 12) {
    logger.warn('Usage reset typically runs early in the day', {
      currentTime: now.toISOString(),
      currentHour: hour
    });
    console.warn(`⚠️  Warning: Running usage reset at hour ${hour} (typically runs at midnight)`);
  }
}

/**
 * Display usage information
 */
function displayUsage() {
  console.log(`
🔄 Monthly Usage Reset Script

This script resets monthly usage counters for all organizations.

Usage:
  node scripts/reset-monthly-usage.js [options]

Options:
  --force     Skip timing verification warnings
  --dry-run   Show what would be reset without actually doing it
  --help      Show this help message

Cron job setup (1st of every month at midnight):
  0 0 1 * * cd /path/to/roastr-ai && node scripts/reset-monthly-usage.js

Environment variables required:
  SUPABASE_URL           - Supabase project URL
  SUPABASE_ANON_KEY      - Supabase anonymous key
`);
}

/**
 * Dry run mode - show what would be reset
 */
async function dryRun() {
  try {
    console.log('🔍 DRY RUN MODE - No actual changes will be made\n');

    const costControl = new CostControlService();

    // Get usage stats for preview
    const { data: orgs, error } = await costControl.supabase
      .from('organizations')
      .select('id, name, plan_id, monthly_responses_used')
      .order('name');

    if (error) throw error;

    console.log(`📋 Organizations that would be reset (${orgs.length} total):\n`);

    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name}`);
      console.log(`   Plan: ${org.plan_id}`);
      console.log(`   Current usage: ${org.monthly_responses_used}`);
      console.log(`   Status: Would reset to 0\n`);
    });

    console.log('✨ Dry run completed - no changes made');
  } catch (error) {
    console.error(`❌ Dry run failed: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const forceRun = args.includes('--force');
const dryRunMode = args.includes('--dry-run');
const showHelp = args.includes('--help') || args.includes('-h');

// Main execution
if (showHelp) {
  displayUsage();
  process.exit(0);
} else if (dryRunMode) {
  dryRun();
} else {
  // Verify timing unless forced
  if (!forceRun) {
    verifyResetTiming();
  }

  // Run the reset
  resetMonthlyUsage();
}
