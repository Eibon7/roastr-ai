#!/usr/bin/env node

/**
 * @file clear-demo-data.js
 * @description Clears demo mode data from the database
 *
 * Usage:
 *   node scripts/clear-demo-data.js [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run    Preview what would be deleted without making changes
 *   --verbose    Show detailed information about deletion process
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error occurred
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  const colors = { red: '\x1b[31m', reset: '\x1b[0m' };
  console.error(`${colors.red}Error: Missing required environment variables${colors.reset}`);
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  console.error('Copy .env.example to .env and configure your credentials');
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

/**
 * Count records matching demo criteria
 * @param {string} table - Table name
 * @param {Object} filter - Filter criteria
 * @returns {Promise<number>} Record count
 */
async function countRecords(table, filter) {
  try {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });

    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { count, error } = await query;

    if (error) throw error;
    return count || 0;

  } catch (error) {
    console.error(`${colors.red}Error counting ${table}: ${error.message}${colors.reset}`);
    return 0;
  }
}

/**
 * Delete records matching demo criteria
 * @param {string} table - Table name
 * @param {Object} filter - Filter criteria
 * @returns {Promise<number>} Number of records deleted
 */
async function deleteRecords(table, filter) {
  try {
    let query = supabase.from(table).delete();

    // Apply filters
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query.select();

    if (error) throw error;
    return data ? data.length : 0;

  } catch (error) {
    console.error(`${colors.red}Error deleting from ${table}: ${error.message}${colors.reset}`);
    return 0;
  }
}

/**
 * Clear demo organizations and cascade delete related data
 * @returns {Promise<Object>} Deletion summary
 */
async function clearDemoOrganizations() {
  const results = {
    organizations: 0,
    users: 0,
    comments: 0,
    responses: 0
  };

  try {
    // Find demo organizations (name starts with "Demo:")
    const { data: demoOrgs, error: findError } = await supabase
      .from('organizations')
      .select('id, name')
      .like('name', 'Demo:%');

    if (findError) throw findError;

    if (!demoOrgs || demoOrgs.length === 0) {
      if (verbose) {
        console.log(`${colors.dim}  No demo organizations found${colors.reset}`);
      }
      return results;
    }

    const demoOrgIds = demoOrgs.map(org => org.id);

    if (verbose) {
      console.log(`\n${colors.cyan}Found ${demoOrgs.length} demo organizations:${colors.reset}`);
      demoOrgs.forEach(org => {
        console.log(`  ${colors.dim}- ${org.name} (${org.id})${colors.reset}`);
      });
    }

    if (dryRun) {
      // Count what would be deleted
      for (const orgId of demoOrgIds) {
        results.users += await countRecords('users', { organization_id: orgId });
        results.comments += await countRecords('comments', { organization_id: orgId });
        results.responses += await countRecords('responses', { organization_id: orgId });
      }
      results.organizations = demoOrgs.length;

    } else {
      // Delete in correct order (children first, then parents)

      // 1. Delete responses
      for (const orgId of demoOrgIds) {
        const deleted = await deleteRecords('responses', { organization_id: orgId });
        results.responses += deleted;
        if (verbose && deleted > 0) {
          console.log(`${colors.green}  ✓ Deleted ${deleted} responses from org ${orgId}${colors.reset}`);
        }
      }

      // 2. Delete comments
      for (const orgId of demoOrgIds) {
        const deleted = await deleteRecords('comments', { organization_id: orgId });
        results.comments += deleted;
        if (verbose && deleted > 0) {
          console.log(`${colors.green}  ✓ Deleted ${deleted} comments from org ${orgId}${colors.reset}`);
        }
      }

      // 3. Delete users
      for (const orgId of demoOrgIds) {
        const deleted = await deleteRecords('users', { organization_id: orgId });
        results.users += deleted;
        if (verbose && deleted > 0) {
          console.log(`${colors.green}  ✓ Deleted ${deleted} users from org ${orgId}${colors.reset}`);
        }
      }

      // 4. Delete organizations
      const { data: deletedOrgs, error: deleteError } = await supabase
        .from('organizations')
        .delete()
        .like('name', 'Demo:%')
        .select();

      if (deleteError) throw deleteError;
      results.organizations = deletedOrgs ? deletedOrgs.length : 0;

      if (verbose && results.organizations > 0) {
        console.log(`${colors.green}  ✓ Deleted ${results.organizations} organizations${colors.reset}`);
      }
    }

  } catch (error) {
    console.error(`${colors.red}Error clearing demo organizations: ${error.message}${colors.reset}`);
    throw error;
  }

  return results;
}

/**
 * Clear demo users (users with email ending in @demo.roastr.ai)
 * @returns {Promise<Object>} Deletion summary
 */
async function clearDemoUsers() {
  const results = {
    users: 0,
    comments: 0,
    responses: 0
  };

  try {
    // Find demo users by email pattern
    const { data: demoUsers, error: findError } = await supabase
      .from('users')
      .select('id, email')
      .like('email', '%@demo.roastr.ai');

    if (findError) throw findError;

    if (!demoUsers || demoUsers.length === 0) {
      if (verbose) {
        console.log(`${colors.dim}  No standalone demo users found${colors.reset}`);
      }
      return results;
    }

    const demoUserIds = demoUsers.map(user => user.id);

    if (verbose) {
      console.log(`\n${colors.cyan}Found ${demoUsers.length} standalone demo users:${colors.reset}`);
      demoUsers.forEach(user => {
        console.log(`  ${colors.dim}- ${user.email}${colors.reset}`);
      });
    }

    if (dryRun) {
      // Count what would be deleted
      for (const userId of demoUserIds) {
        results.comments += await countRecords('comments', { user_id: userId });
        results.responses += await countRecords('responses', { user_id: userId });
      }
      results.users = demoUsers.length;

    } else {
      // Delete in correct order (children first, then parents)

      // 1. Delete responses
      for (const userId of demoUserIds) {
        const deleted = await deleteRecords('responses', { user_id: userId });
        results.responses += deleted;
        if (verbose && deleted > 0) {
          console.log(`${colors.green}  ✓ Deleted ${deleted} responses from user ${userId}${colors.reset}`);
        }
      }

      // 2. Delete comments
      for (const userId of demoUserIds) {
        const deleted = await deleteRecords('comments', { user_id: userId });
        results.comments += deleted;
        if (verbose && deleted > 0) {
          console.log(`${colors.green}  ✓ Deleted ${deleted} comments from user ${userId}${colors.reset}`);
        }
      }

      // 3. Delete users
      const { data: deletedUsers, error: deleteError } = await supabase
        .from('users')
        .delete()
        .like('email', '%@demo.roastr.ai')
        .select();

      if (deleteError) throw deleteError;
      results.users = deletedUsers ? deletedUsers.length : 0;

      if (verbose && results.users > 0) {
        console.log(`${colors.green}  ✓ Deleted ${results.users} users${colors.reset}`);
      }
    }

  } catch (error) {
    console.error(`${colors.red}Error clearing demo users: ${error.message}${colors.reset}`);
    throw error;
  }

  return results;
}

/**
 * Main cleanup function
 */
async function main() {
  try {
    console.log(`\n${colors.bright}=== Demo Data Cleanup ===${colors.reset}\n`);

    if (dryRun) {
      console.log(`${colors.yellow}DRY RUN MODE - No changes will be made${colors.reset}\n`);
    }

    // Clear demo organizations (includes their users, comments, responses)
    console.log(`${colors.cyan}Clearing demo organizations...${colors.reset}`);
    const orgResults = await clearDemoOrganizations();

    // Clear standalone demo users (not associated with demo orgs)
    console.log(`\n${colors.cyan}Clearing standalone demo users...${colors.reset}`);
    const userResults = await clearDemoUsers();

    // Combine results
    const totalResults = {
      organizations: orgResults.organizations,
      users: orgResults.users + userResults.users,
      comments: orgResults.comments + userResults.comments,
      responses: orgResults.responses + userResults.responses
    };

    // Print summary
    console.log(`\n${colors.cyan}${colors.bright}Summary:${colors.reset}`);
    console.log(`  Organizations: ${totalResults.organizations}`);
    console.log(`  Users: ${totalResults.users}`);
    console.log(`  Comments: ${totalResults.comments}`);
    console.log(`  Responses: ${totalResults.responses}`);
    console.log(`  ${colors.dim}Total records: ${Object.values(totalResults).reduce((a, b) => a + b, 0)}${colors.reset}`);

    if (dryRun) {
      console.log(`\n${colors.yellow}This was a dry run. Run without --dry-run to delete data.${colors.reset}\n`);
    } else {
      console.log(`\n${colors.green}${colors.bright}✓ Demo data cleared successfully!${colors.reset}\n`);
    }

    process.exit(0);

  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Fatal error: ${error.message}${colors.reset}`);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { clearDemoOrganizations, clearDemoUsers };
