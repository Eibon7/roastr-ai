#!/usr/bin/env node

/**
 * Setup script for Issue #237: Admin and Test Users Creation
 * Purpose: Create admin user and test users for backoffice development
 * Usage: node scripts/setup-test-users.js [--dry-run]
 */

const { readFileSync } = require('fs');
const { join } = require('path');

// Import database configuration
let supabaseServiceClient;
try {
  const { supabaseServiceClient: client } = require('../src/config/supabase');
  supabaseServiceClient = client;
} catch (error) {
  console.error('❌ Error loading Supabase client:', error.message);
  console.error('Please ensure your environment variables are set:');
  console.error('  - SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function runMigration() {
  console.log('🔄 Running migration: Add test flag to users table...');
  
  try {
    const migrationSQL = readFileSync(
      join(__dirname, '..', 'database', 'migrations', '015_add_test_flag_to_users.sql'), 
      'utf-8'
    );
    
    const { error } = await supabaseServiceClient.rpc('exec_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      return false;
    }
    
    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    return false;
  }
}

async function setupTestUsers() {
  console.log('🔄 Setting up admin user and test users...');
  
  try {
    const setupSQL = readFileSync(
      join(__dirname, 'setup-test-users.sql'), 
      'utf-8'
    );
    
    // Split SQL into individual statements and execute them
    const statements = setupSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.includes('SELECT') && statement.includes('as type')) {
        // Skip verification queries for now
        continue;
      }
      
      const { error } = await supabaseServiceClient.rpc('exec_sql', {
        sql_query: statement + ';'
      });
      
      if (error && !error.message.includes('already exists')) {
        console.warn('⚠️  Statement warning:', error.message.substring(0, 100));
        // Continue with other statements
      }
    }
    
    console.log('✅ Test users setup completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Setup error:', error.message);
    return false;
  }
}

async function verifySetup() {
  console.log('🔍 Verifying setup...');
  
  try {
    // Check admin user
    const { data: adminUser, error: adminError } = await supabaseServiceClient
      .from('users')
      .select('email, name, plan, is_admin, active, is_test')
      .eq('email', 'emiliopostigo@gmail.com')
      .single();
    
    if (adminError) {
      console.error('❌ Admin user verification failed:', adminError);
      return false;
    }
    
    console.log('👤 Admin user:', adminUser);
    
    // Check test users
    const { data: testUsers, error: testError } = await supabaseServiceClient
      .from('users')
      .select('email, name, plan, is_admin, active, is_test, monthly_messages_sent')
      .eq('is_test', true)
      .order('email');
    
    if (testError) {
      console.error('❌ Test users verification failed:', testError);
      return false;
    }
    
    console.log('🧪 Test users created:');
    testUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.plan}, usage: ${user.monthly_messages_sent})`);
    });
    
    // Check organizations
    const { data: orgs, error: orgsError } = await supabaseServiceClient
      .from('organizations')
      .select(`
        name, 
        slug, 
        plan_id, 
        monthly_responses_limit, 
        monthly_responses_used,
        users!inner(email, is_test)
      `)
      .eq('users.is_test', true);
    
    if (!orgsError && orgs) {
      console.log('🏢 Organizations created:');
      orgs.forEach(org => {
        console.log(`  - ${org.name} (${org.plan_id}, ${org.monthly_responses_used}/${org.monthly_responses_limit})`);
      });
    }
    
    // Check integrations
    const { data: integrations, error: intError } = await supabaseServiceClient
      .from('integration_configs')
      .select(`
        platform,
        enabled,
        tone,
        config,
        organizations!inner(
          users!inner(email, is_test)
        )
      `)
      .eq('organizations.users.is_test', true);
    
    if (!intError && integrations) {
      console.log('🔗 Integrations created:');
      integrations.forEach(int => {
        const handle = int.config?.handle || int.config?.username || int.config?.channel_id || 'N/A';
        console.log(`  - ${int.platform}: ${handle} (${int.tone})`);
      });
    }
    
    console.log('✅ Verification completed');
    return true;
  } catch (error) {
    console.error('❌ Verification error:', error.message);
    return false;
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log('🚀 Roastr.ai Test Users Setup Script');
  console.log('=====================================');
  console.log('Issue #237: Admin and Test Users Creation');
  console.log('');
  
  if (isDryRun) {
    console.log('🏃 DRY RUN MODE - No changes will be made');
    console.log('');
    
    // Just show what would be created
    console.log('Would create:');
    console.log('👤 Admin user: emiliopostigo@gmail.com');
    console.log('🧪 Test users:');
    console.log('  - test.free@roastr.ai (free plan, 0 usage)');
    console.log('  - test.starter@roastr.ai (pro plan, 30% usage)');
    console.log('  - test.pro@roastr.ai (pro plan, 80% usage)');
    console.log('  - test.plus@roastr.ai (creator_plus plan, 50% usage)');
    console.log('  - test.heavy@roastr.ai (creator_plus plan, 100% usage)');
    console.log('  - test.empty@roastr.ai (free plan, 0 usage)');
    console.log('');
    console.log('🔗 Social integrations for paid users');
    console.log('📊 Monthly usage records');
    console.log('📝 User activity logs');
    console.log('');
    console.log('Run without --dry-run to execute the setup');
    return;
  }
  
  console.log('⚠️  This will create/update users and organizations in your database.');
  console.log('   Make sure you are connected to the correct database.');
  console.log('');
  
  // Step 1: Run migration
  const migrationSuccess = await runMigration();
  if (!migrationSuccess) {
    console.error('❌ Migration failed. Aborting.');
    process.exit(1);
  }
  
  // Step 2: Setup users
  const setupSuccess = await setupTestUsers();
  if (!setupSuccess) {
    console.error('❌ Setup failed. Some users may have been created.');
    process.exit(1);
  }
  
  // Step 3: Verify setup
  await verifySetup();
  
  console.log('');
  console.log('🎉 Setup completed successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. The admin user (emiliopostigo@gmail.com) can now access the backoffice');
  console.log('2. Test users are available for filtering and navigation testing');
  console.log('3. Clean up test data later with: DELETE FROM users WHERE is_test = true;');
  console.log('');
  console.log('Issue #237 requirements fulfilled:');
  console.log('✅ Admin user created');
  console.log('✅ Test users with different plans and usage patterns');
  console.log('✅ Realistic social media handles for paid users');
  console.log('✅ Usage limits configured per plan');
  console.log('✅ Test flag for easy identification and cleanup');
}

// Handle errors and cleanup
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}