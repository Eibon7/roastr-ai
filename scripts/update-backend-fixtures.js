#!/usr/bin/env node

/**
 * Update Backend Fixtures Script
 * 
 * Fetches real data from staging backend and updates fixture files
 * Usage: node scripts/update-backend-fixtures.js [--all] [--fixture-name]
 */

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const API_BASE_URL = process.env.REACT_APP_STAGING_API_URL || 'http://localhost:3001';
const FIXTURES_DIR = path.resolve(__dirname, '../tests/integration/backend/fixtures');
const AUTH_TOKEN = process.env.TEST_USER_AUTH_TOKEN;
const TEST_ACCOUNT_ID = process.env.TEST_ACCOUNT_ID || 'acc_staging_default';

const FIXTURES_CONFIG = {
  'accounts.json': {
    endpoint: '/api/social/accounts',
    method: 'GET',
    requiresAuth: true,
    description: 'User social media accounts'
  },
  'roasts.json': {
    endpoint: `/api/social/accounts/${TEST_ACCOUNT_ID}/roasts`,
    method: 'GET',
    requiresAuth: true,
    params: { limit: 10 },
    description: 'Account roasts data'
  },
  'shield.json': {
    endpoint: `/api/social/accounts/${TEST_ACCOUNT_ID}/shield/intercepted`,
    method: 'GET',
    requiresAuth: true,
    params: { limit: 10 },
    description: 'Shield intercepted items'
  },
  'settings.json': {
    endpoint: `/api/social/accounts/${TEST_ACCOUNT_ID}/settings`,
    method: 'GET',
    requiresAuth: true,
    description: 'Account settings configuration'
  }
};

/**
 * Fetch data from API endpoint
 */
async function fetchFromAPI(config) {
  const url = new URL(config.endpoint, API_BASE_URL);
  
  // Add query parameters
  if (config.params) {
    Object.entries(config.params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (config.requiresAuth && AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  console.log(`📡 Fetching: ${url.pathname}${url.search}`);

  try {
    const response = await fetch(url.toString(), {
      method: config.method,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched ${config.description}`);
    
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch ${config.description}: ${error.message}`);
    throw error;
  }
}

/**
 * Update fixture file with new data
 */
async function updateFixtureFile(filename, data) {
  const fixturePath = path.join(FIXTURES_DIR, filename);
  
  try {
    // Add metadata to fixture
    const fixtureData = {
      ...data,
      _metadata: {
        updatedAt: new Date().toISOString(),
        source: 'staging-backend',
        version: '1.0.0'
      }
    };

    const formattedData = JSON.stringify(fixtureData, null, 2);
    await fs.writeFile(fixturePath, formattedData, 'utf-8');
    
    console.log(`💾 Updated fixture: ${filename}`);
    console.log(`📁 Location: ${fixturePath}`);
  } catch (error) {
    console.error(`❌ Failed to update fixture ${filename}: ${error.message}`);
    throw error;
  }
}

/**
 * Validate fixture data structure
 */
function validateFixtureData(filename, data) {
  const validations = {
    'accounts.json': (data) => {
      if (!data.success || !data.data || !Array.isArray(data.data.accounts)) {
        throw new Error('Invalid accounts data structure');
      }
    },
    'roasts.json': (data) => {
      if (!data.success || !data.data || !Array.isArray(data.data.roasts)) {
        throw new Error('Invalid roasts data structure');
      }
    },
    'shield.json': (data) => {
      if (!data.success || !data.data || !Array.isArray(data.data.intercepted)) {
        throw new Error('Invalid shield data structure');
      }
    },
    'settings.json': (data) => {
      if (!data.success || !data.data || !data.data.settings) {
        throw new Error('Invalid settings data structure');
      }
    }
  };

  const validator = validations[filename];
  if (validator) {
    validator(data);
    console.log(`✅ Validated ${filename} structure`);
  } else {
    console.warn(`⚠️  No validator for ${filename}`);
  }
}

/**
 * Check if backend is accessible
 */
async function checkBackendHealth() {
  try {
    console.log(`🏥 Checking backend health: ${API_BASE_URL}`);
    
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    const healthData = await response.json();
    console.log(`✅ Backend is healthy: ${healthData.status || 'OK'}`);
    return true;
  } catch (error) {
    console.error(`❌ Backend health check failed: ${error.message}`);
    return false;
  }
}

/**
 * Create backup of existing fixtures
 */
async function createBackup() {
  const backupDir = path.join(FIXTURES_DIR, 'backup');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, timestamp);

  try {
    await fs.mkdir(backupPath, { recursive: true });

    for (const filename of Object.keys(FIXTURES_CONFIG)) {
      const sourcePath = path.join(FIXTURES_DIR, filename);
      const backupFilePath = path.join(backupPath, filename);

      try {
        await fs.copyFile(sourcePath, backupFilePath);
        console.log(`📦 Backed up: ${filename}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`⚠️  Failed to backup ${filename}: ${error.message}`);
        }
      }
    }

    console.log(`💾 Backup created at: ${backupPath}`);
  } catch (error) {
    console.error(`❌ Failed to create backup: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const updateAll = args.includes('--all') || args.length === 0;
  const specificFixture = args.find(arg => arg.endsWith('.json'));

  console.log('🔄 Backend Fixtures Update Script');
  console.log('================================');
  
  // Validate environment
  if (!AUTH_TOKEN) {
    console.error('❌ TEST_USER_AUTH_TOKEN environment variable is required');
    console.log('💡 Set it to a valid JWT token for the staging backend');
    process.exit(1);
  }

  // Check backend health
  const isHealthy = await checkBackendHealth();
  if (!isHealthy) {
    console.error('❌ Backend is not accessible. Cannot update fixtures.');
    process.exit(1);
  }

  // Create backup
  await createBackup();

  // Determine which fixtures to update
  const fixturesToUpdate = updateAll 
    ? Object.keys(FIXTURES_CONFIG)
    : specificFixture 
      ? [specificFixture]
      : Object.keys(FIXTURES_CONFIG);

  console.log(`🎯 Updating ${fixturesToUpdate.length} fixtures: ${fixturesToUpdate.join(', ')}`);

  let successCount = 0;
  let errorCount = 0;

  // Update each fixture
  for (const filename of fixturesToUpdate) {
    const config = FIXTURES_CONFIG[filename];
    
    if (!config) {
      console.error(`❌ Unknown fixture: ${filename}`);
      errorCount++;
      continue;
    }

    try {
      console.log(`\n📋 Processing: ${filename}`);
      console.log(`📝 Description: ${config.description}`);
      
      // Fetch data from API
      const data = await fetchFromAPI(config);
      
      // Validate data structure
      validateFixtureData(filename, data);
      
      // Update fixture file
      await updateFixtureFile(filename, data);
      
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to update ${filename}: ${error.message}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n📊 Update Summary');
  console.log('================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📁 Fixtures location: ${FIXTURES_DIR}`);

  if (errorCount > 0) {
    console.log('\n💡 Common solutions for failures:');
    console.log('- Check if TEST_USER_AUTH_TOKEN is valid and not expired');
    console.log('- Verify TEST_ACCOUNT_ID exists in staging backend');
    console.log('- Ensure staging backend is running and accessible');
    console.log('- Check network connectivity to staging environment');
    process.exit(1);
  }

  console.log('\n🎉 All fixtures updated successfully!');
  console.log('💡 Run tests with: npm run test:integration-backend:fixtures');
}

// Handle script errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  fetchFromAPI,
  updateFixtureFile,
  validateFixtureData,
  FIXTURES_CONFIG
};