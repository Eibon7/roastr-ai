#!/usr/bin/env node
/**
 * Update Backend Fixtures Utility
 * 
 * Fetches fresh data from staging backend and updates fixture files
 * Usage: npm run fixtures:update:all
 */

const fs = require('fs').promises;
const path = require('path');

// Load environment variables for staging backend
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env.test.real') });

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const API_BASE_URL = process.env.API_BASE_URL || 'https://staging.roastr.ai/api';

/**
 * Fixture configurations
 */
const FIXTURE_CONFIGS = {
  'accounts.json': {
    url: '/social/accounts',
    description: 'User social media accounts',
    requiresAuth: true
  },
  'roasts.json': {
    url: '/social/roasts',
    description: 'Generated roasts list',
    requiresAuth: true,
    params: { limit: 10, offset: 0 }
  },
  'settings.json': {
    url: '/social/settings',
    description: 'Social network settings',
    requiresAuth: true
  },
  'shield.json': {
    url: '/social/shield/intercepted',
    description: 'Shield intercepted items',
    requiresAuth: true,
    params: { limit: 10 }
  }
};

/**
 * Authenticate with staging backend
 */
async function authenticateWithBackend() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  
  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test.real');
  }
  
  console.log(`🔐 Authenticating with staging backend as ${email}...`);
  
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Authentication failed: ${response.status} ${errorData}`);
  }
  
  const authData = await response.json();
  console.log(`✅ Authentication successful`);
  
  return authData.token || authData.data?.token;
}

/**
 * Fetch data from staging backend
 */
async function fetchDataFromBackend(config, token) {
  let url = `${API_BASE_URL}${config.url}`;
  
  // Add query parameters if specified
  if (config.params) {
    const searchParams = new URLSearchParams(config.params);
    url += `?${searchParams.toString()}`;
  }
  
  console.log(`📡 Fetching ${config.description} from ${url}...`);
  
  const headers = { 'Content-Type': 'application/json' };
  if (config.requiresAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${config.description}: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`✅ Fetched ${config.description}`);
  
  return data;
}

/**
 * Save fixture data to file
 */
async function saveFixture(filename, data) {
  try {
    const fixturePath = path.join(FIXTURES_DIR, filename);
    
    // Add metadata to the fixture
    const fixtureData = {
      ...data,
      _fixtureMetadata: {
        generatedAt: new Date().toISOString(),
        source: 'staging_backend',
        apiBaseUrl: API_BASE_URL,
        version: '1.0.0',
        checksum: generateChecksum(data)
      }
    };
    
    const formattedData = JSON.stringify(fixtureData, null, 2);
    await fs.writeFile(fixturePath, formattedData, 'utf-8');
    
    console.log(`💾 Saved fixture: ${filename} (${Math.round(formattedData.length / 1024)}KB)`);
    
    return {
      filename,
      size: formattedData.length,
      checksum: fixtureData._fixtureMetadata.checksum
    };
  } catch (error) {
    console.error(`❌ Failed to save fixture ${filename}: ${error.message}`);
    throw error;
  }
}

/**
 * Generate simple checksum for data integrity
 */
function generateChecksum(data) {
  const str = JSON.stringify(data, null, 0);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Validate backend connectivity
 */
async function validateBackendConnectivity() {
  console.log(`🔍 Validating backend connectivity to ${API_BASE_URL}...`);
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const healthData = await response.json();
    console.log(`✅ Backend is healthy:`, healthData);
    
    return true;
  } catch (error) {
    console.error(`❌ Backend connectivity validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Main function to update all fixtures
 */
async function updateAllFixtures() {
  console.log('🚀 Starting backend fixtures update process...');
  console.log(`📡 Target backend: ${API_BASE_URL}`);
  
  try {
    // Ensure fixtures directory exists
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
    
    // Validate backend connectivity
    const isConnected = await validateBackendConnectivity();
    if (!isConnected) {
      throw new Error('Cannot connect to staging backend');
    }
    
    // Authenticate
    const token = await authenticateWithBackend();
    
    // Update each fixture
    const results = [];
    
    for (const [filename, config] of Object.entries(FIXTURE_CONFIGS)) {
      try {
        console.log(`\n📝 Updating fixture: ${filename}`);
        
        const data = await fetchDataFromBackend(config, token);
        const result = await saveFixture(filename, data);
        
        results.push({ ...result, status: 'success', config });
        
      } catch (error) {
        console.error(`❌ Failed to update ${filename}: ${error.message}`);
        results.push({ 
          filename, 
          status: 'error', 
          error: error.message, 
          config 
        });
      }
    }
    
    // Generate summary report
    const summaryReport = {
      timestamp: new Date().toISOString(),
      backendUrl: API_BASE_URL,
      totalFixtures: Object.keys(FIXTURE_CONFIGS).length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results: results
    };
    
    // Save summary report
    const summaryPath = path.join(FIXTURES_DIR, 'update-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summaryReport, null, 2));
    
    // Print summary
    console.log('\n📊 Update Summary:');
    console.log(`✅ Successful: ${summaryReport.successful}/${summaryReport.totalFixtures}`);
    console.log(`❌ Failed: ${summaryReport.failed}/${summaryReport.totalFixtures}`);
    
    if (summaryReport.failed > 0) {
      console.log('\n❌ Failed fixtures:');
      results.filter(r => r.status === 'error').forEach(result => {
        console.log(`   - ${result.filename}: ${result.error}`);
      });
    }
    
    console.log(`\n📋 Full report saved to: ${summaryPath}`);
    console.log('✅ Fixtures update completed!');
    
    process.exit(summaryReport.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Fixtures update failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * CLI handling
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Backend Fixtures Update Utility

Usage:
  node update-backend-fixtures.js [options]
  npm run fixtures:update:all

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be updated without making changes
  --verbose, -v  Show detailed output

Environment:
  Requires .env.test.real to be configured with staging backend credentials.

Examples:
  npm run fixtures:update:all
  node tests/integration/backend/utils/update-backend-fixtures.js --dry-run
    `);
    process.exit(0);
  }
  
  if (args.includes('--dry-run')) {
    console.log('🔍 DRY RUN MODE - No files will be modified');
    console.log('\nFixtures that would be updated:');
    Object.entries(FIXTURE_CONFIGS).forEach(([filename, config]) => {
      console.log(`  📄 ${filename} - ${config.description}`);
      console.log(`     URL: ${API_BASE_URL}${config.url}`);
      console.log(`     Auth required: ${config.requiresAuth ? 'Yes' : 'No'}`);
    });
    process.exit(0);
  }
  
  updateAllFixtures();
}