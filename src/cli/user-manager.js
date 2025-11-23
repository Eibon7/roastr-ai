#!/usr/bin/env node

const { program } = require('commander');
const authService = require('../services/authService');
const { checkConnection } = require('../config/supabase');
const { logger } = require('../utils/logger');

// Configure commander
program.name('user-manager').description('CLI tool for managing Roastr.ai users').version('1.0.0');

// Check database connection command
program
  .command('health')
  .description('Check database connection and system health')
  .action(async () => {
    console.log('🔍 Checking system health...\n');

    try {
      const result = await checkConnection();

      if (result.connected) {
        console.log('✅ Database connection: OK');
      } else {
        console.log('❌ Database connection: FAILED');
        console.log('📄 Error:', result.error);
      }

      console.log('\n🏥 Health check completed.');
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    }
  });

// List users command
program
  .command('list')
  .description('List all users')
  .option('-l, --limit <number>', 'Maximum number of users to return', '50')
  .option('-o, --offset <number>', 'Number of users to skip', '0')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      console.log('📋 Fetching users...\n');

      const users = await authService.listUsers(parseInt(options.limit), parseInt(options.offset));

      if (options.json) {
        console.log(JSON.stringify(users, null, 2));
        return;
      }

      if (users.length === 0) {
        console.log('📭 No users found.');
        return;
      }

      console.log(`👥 Found ${users.length} users:\n`);

      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name || 'Not set'}`);
        console.log(`   Plan: ${user.plan}`);
        console.log(`   Admin: ${user.is_admin ? 'Yes' : 'No'}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);

        if (user.organizations && user.organizations.length > 0) {
          const org = user.organizations[0];
          console.log(`   Organization: ${org.name} (${org.plan_id})`);
          console.log(`   Usage: ${org.monthly_responses_used || 0} responses`);
        }

        console.log('');
      });
    } catch (error) {
      console.error('❌ Failed to list users:', error.message);
      process.exit(1);
    }
  });

// Create user command
program
  .command('create')
  .description('Create a new user')
  .requiredOption('-e, --email <email>', 'User email address')
  .option('-n, --name <name>', 'User full name')
  .option('-p, --password <password>', 'User password (will generate random if not provided)')
  .option('--plan <plan>', 'User plan', 'starter_trial')
  .option('--admin', 'Make user an admin')
  .action(async (options) => {
    try {
      console.log('👤 Creating new user...\n');

      const result = await authService.createUserManually({
        email: options.email,
        password: options.password,
        name: options.name,
        plan: options.plan,
        isAdmin: options.admin || false
      });

      console.log('✅ User created successfully!');
      console.log(`📧 Email: ${result.user.email}`);
      console.log(`👤 Name: ${result.user.name || 'Not set'}`);
      console.log(`📋 Plan: ${result.user.plan}`);
      console.log(`🔑 Admin: ${result.user.is_admin ? 'Yes' : 'No'}`);

      if (result.temporaryPassword) {
        console.log(`🔐 Temporary Password: ${result.temporaryPassword}`);
        console.log('⚠️  Please share this password securely with the user.');
      }
    } catch (error) {
      console.error('❌ Failed to create user:', error.message);
      process.exit(1);
    }
  });

// Delete user command
program
  .command('delete')
  .description('Delete a user')
  .requiredOption('-u, --user-id <userId>', 'User ID to delete')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.confirm) {
        console.log('⚠️  This action will permanently delete the user and all associated data.');
        console.log('📧 User ID:', options.userId);

        // In a real CLI, you'd use inquirer or similar for interactive confirmation
        console.log('\n🔥 Use --confirm flag to proceed with deletion.');
        return;
      }

      console.log('🗑️  Deleting user...\n');

      await authService.deleteUser(options.userId);

      console.log('✅ User deleted successfully!');
      console.log(`🆔 Deleted user ID: ${options.userId}`);
    } catch (error) {
      console.error('❌ Failed to delete user:', error.message);
      process.exit(1);
    }
  });

// Search users command
program
  .command('search')
  .description('Search users by email')
  .requiredOption('-q, --query <query>', 'Search query (email)')
  .action(async (options) => {
    try {
      console.log(`🔍 Searching users for: ${options.query}\n`);

      // Get all users and filter (in a real app, you'd do this in the database)
      const users = await authService.listUsers(1000, 0);

      const matches = users.filter((user) =>
        user.email.toLowerCase().includes(options.query.toLowerCase())
      );

      if (matches.length === 0) {
        console.log('📭 No users found matching your search.');
        return;
      }

      console.log(`👥 Found ${matches.length} matching users:\n`);

      matches.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name || 'Not set'}`);
        console.log(`   Plan: ${user.plan}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Failed to search users:', error.message);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show user statistics')
  .action(async () => {
    try {
      console.log('📊 Generating user statistics...\n');

      const users = await authService.listUsers(10000, 0); // Get all users

      const stats = {
        total: users.length,
        byPlan: {},
        admins: 0,
        recentSignups: 0
      };

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      users.forEach((user) => {
        // Count by plan
        stats.byPlan[user.plan] = (stats.byPlan[user.plan] || 0) + 1;

        // Count admins
        if (user.is_admin) stats.admins++;

        // Count recent signups
        if (new Date(user.created_at) > oneWeekAgo) {
          stats.recentSignups++;
        }
      });

      console.log(`📈 Total Users: ${stats.total}`);
      console.log(`👑 Admins: ${stats.admins}`);
      console.log(`🆕 New Users (last 7 days): ${stats.recentSignups}`);
      console.log('\n📋 Users by Plan:');

      Object.entries(stats.byPlan).forEach(([plan, count]) => {
        const percentage = ((count / stats.total) * 100).toFixed(1);
        console.log(`   ${plan}: ${count} users (${percentage}%)`);
      });
    } catch (error) {
      console.error('❌ Failed to generate stats:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
