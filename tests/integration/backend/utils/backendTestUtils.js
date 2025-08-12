/**
 * Backend Integration Test Utilities
 * 
 * Utilities for setting up and managing backend integration tests
 */

const fs = require('fs').promises;
const path = require('path');

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

/**
 * Setup real backend test environment
 * @returns {Object} Test context with authentication and cleanup info
 */
const setupRealBackendTest = async () => {
  const useBackendFixtures = process.env.USE_BACKEND_FIXTURES === 'true';
  const enableMockMode = process.env.ENABLE_MOCK_MODE === 'true';
  const fallbackEnabled = process.env.FALLBACK_TO_FIXTURES_ON_ERROR !== 'false';
  const fallbackTimeout = parseInt(process.env.FALLBACK_TIMEOUT) || 5000;
  
  let apiUrl = process.env.API_BASE_URL || process.env.REACT_APP_API_URL || 'http://localhost:3001';
  if (!apiUrl.includes('/api')) {
    apiUrl = apiUrl.endsWith('/') ? `${apiUrl}api` : `${apiUrl}/api`;
  }
  
  console.log(`🔧 Setting up backend integration tests`);
  console.log(`📡 API URL: ${apiUrl}`);
  console.log(`📁 Use Backend Fixtures: ${useBackendFixtures}`);
  console.log(`🎭 Mock Mode: ${enableMockMode}`);
  console.log(`🔄 Fallback Enabled: ${fallbackEnabled}`);
  
  let actualMode = useBackendFixtures ? 'fixtures' : 'real';
  let backendAccessible = false;
  let healthCheckError = null;
  
  // Verify backend is accessible if not in fixture mode
  if (!useBackendFixtures && !enableMockMode) {
    try {
      console.log(`🔍 Checking backend health at ${apiUrl}/health...`);
      
      // Use Promise.race for timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Health check timeout after ${fallbackTimeout}ms`)), fallbackTimeout)
      );
      
      const healthPromise = fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await Promise.race([healthPromise, timeoutPromise]);
      
      if (!response.ok) {
        throw new Error(`Backend health check failed: ${response.status} ${response.statusText}`);
      }
      
      const healthData = await response.json();
      console.log(`✅ Backend is accessible at ${apiUrl}`, healthData);
      backendAccessible = true;
      
    } catch (error) {
      healthCheckError = error;
      console.warn(`⚠️  Backend not accessible: ${error.message}`);
      
      if (fallbackEnabled) {
        console.log(`🔄 Fallback enabled - switching to fixture mode`);
        actualMode = 'fixtures';
        process.env.USE_BACKEND_FIXTURES = 'true';
      } else {
        console.error(`❌ Fallback disabled - test will use unreachable backend`);
        throw error;
      }
    }
  }

  // Additional setup based on mode
  let testUser = null;
  if (actualMode === 'fixtures') {
    // Setup fixture mode defaults
    testUser = {
      id: 'fixture-user-123',
      email: 'testuser@fixture.example.com',
      token: 'fixture-auth-token-123'
    };
    
    // Mock localStorage if not available
    if (typeof localStorage === 'undefined') {
      global.localStorage = {
        getItem: jest.fn(() => testUser.token),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      };
    }
    
    localStorage.setItem('auth_token', testUser.token);
  }

  return {
    apiUrl,
    actualMode,
    isFixtureMode: actualMode === 'fixtures',
    useBackendFixtures: actualMode === 'fixtures',
    enableMockMode,
    backendAccessible,
    healthCheckError,
    fallbackEnabled,
    testUser,
    testStartTime: Date.now(),
    createdResources: []
  };
};

/**
 * Cleanup after backend integration tests
 * @param {Object} testContext - Context from setupRealBackendTest
 */
const teardownRealBackendTest = async (testContext) => {
  console.log(`🧹 Cleaning up backend integration tests`);
  
  // Cleanup any created resources
  if (testContext.createdResources.length > 0) {
    console.log(`🗑️  Cleaning up ${testContext.createdResources.length} resources`);
    
    for (const resource of testContext.createdResources) {
      try {
        await cleanupResource(resource);
      } catch (error) {
        console.warn(`⚠️  Failed to cleanup ${resource.type}:${resource.id} - ${error.message}`);
      }
    }
  }

  const duration = Date.now() - testContext.testStartTime;
  console.log(`✅ Backend integration tests completed in ${duration}ms`);
};

/**
 * Authenticate test user for backend requests
 * @param {Object} testContext - Test context
 */
const authenticateTestUser = async (testContext) => {
  if (testContext.isFixtureMode) {
    // Mock authentication for fixture mode
    localStorage.setItem('auth_token', 'fixture-mock-token');
    return { token: 'fixture-mock-token', user: { id: 'fixture-user' } };
  }

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  const existingToken = process.env.TEST_USER_AUTH_TOKEN;

  if (existingToken) {
    localStorage.setItem('auth_token', existingToken);
    return { token: existingToken };
  }

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set for backend integration tests');
  }

  try {
    const authResponse = await fetch(`${testContext.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    localStorage.setItem('auth_token', authData.token);
    
    console.log(`🔑 Authenticated test user: ${email}`);
    return authData;
  } catch (error) {
    console.error(`❌ Authentication failed: ${error.message}`);
    throw error;
  }
};

/**
 * Load fixture data or fetch from real API with intelligent fallback
 * @param {string} fixtureName - Name of fixture file
 * @param {Function} apiFetcher - Function to fetch real data
 * @param {Object} testContext - Test context for mode determination
 * @returns {Object} Fixture or real API data
 */
const loadFixtureIfNeeded = async (fixtureName, apiFetcher, testContext = null) => {
  const useBackendFixtures = process.env.USE_BACKEND_FIXTURES === 'true' || 
    (testContext && testContext.useBackendFixtures);
  const fallbackEnabled = process.env.FALLBACK_TO_FIXTURES_ON_ERROR !== 'false';
  
  console.log(`[INTEGRATION TEST] Loading data for: ${fixtureName}`);
  console.log(`[INTEGRATION TEST] Mode: ${useBackendFixtures ? 'fixtures' : 'real backend'}`);
  
  // Try to load fixture first if in fixture mode
  if (useBackendFixtures) {
    try {
      const fixturePath = path.join(FIXTURES_DIR, fixtureName);
      const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
      const fixtureData = JSON.parse(fixtureContent);
      
      // Add metadata to fixture data
      fixtureData._testMetadata = {
        source: 'fixture',
        fixtureName,
        loadedAt: new Date().toISOString(),
        mode: 'backend_fixtures'
      };
      
      console.log(`📁 Loaded fixture: ${fixtureName}`);
      return fixtureData;
    } catch (error) {
      console.warn(`⚠️  Failed to load fixture ${fixtureName}: ${error.message}`);
      
      if (!fallbackEnabled) {
        throw new Error(`Fixture ${fixtureName} not found and fallback disabled`);
      }
      
      console.log(`🔄 Falling back to real API`);
    }
  }

  // Fetch from real API (or fallback to real API from fixture failure)
  try {
    console.log(`📡 Fetching real data for: ${fixtureName}`);
    const realData = await apiFetcher();
    
    // Add metadata to real data
    if (realData && typeof realData === 'object') {
      realData._testMetadata = {
        source: 'real_api',
        fetchedAt: new Date().toISOString(),
        mode: 'backend_real',
        fallback: useBackendFixtures // Indicates if this was a fallback from fixture failure
      };
    }
    
    console.log(`✅ Fetched real data for: ${fixtureName}`);
    
    // Optionally update fixture if AUTO_UPDATE_FIXTURES is enabled
    if (process.env.AUTO_UPDATE_FIXTURES === 'true') {
      console.log(`💾 Auto-updating fixture: ${fixtureName}`);
      await updateFixture(fixtureName, realData);
    }
    
    return realData;
  } catch (error) {
    console.error(`❌ Failed to fetch real data for ${fixtureName}: ${error.message}`);
    
    // Last resort - try fixture if we haven't already
    if (!useBackendFixtures && fallbackEnabled) {
      console.log(`🆘 Last resort - attempting fixture fallback for ${fixtureName}`);
      try {
        const fixturePath = path.join(FIXTURES_DIR, fixtureName);
        const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
        const fixtureData = JSON.parse(fixtureContent);
        
        fixtureData._testMetadata = {
          source: 'fixture_fallback',
          fixtureName,
          loadedAt: new Date().toISOString(),
          mode: 'emergency_fallback',
          originalError: error.message
        };
        
        console.log(`🆘 Emergency fixture fallback successful: ${fixtureName}`);
        return fixtureData;
      } catch (fixtureError) {
        console.error(`❌ Emergency fixture fallback failed: ${fixtureError.message}`);
      }
    }
    
    throw error;
  }
};

/**
 * Create a test account for integration tests
 * @param {Object} testContext - Test context
 * @param {string} network - Social network type
 * @returns {Object} Created account data
 */
const createTestAccount = async (testContext, network = 'twitter') => {
  if (testContext.isFixtureMode) {
    // Return mock account for fixture mode
    return {
      id: `fixture_acc_${network}_${Date.now()}`,
      network,
      handle: `@fixture_${network}_test`,
      status: 'active',
      monthlyRoasts: 100,
      settings: {
        autoApprove: true,
        shieldEnabled: true,
        shieldLevel: 95,
        defaultTone: 'Comico'
      }
    };
  }

  try {
    // Create test account via API
    const createResponse = await fetch(`${testContext.apiUrl}/api/social/test/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({
        network,
        handle: `@test_${network}_${Date.now()}`,
        isTestAccount: true
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create test account: ${createResponse.status}`);
    }

    const accountData = await createResponse.json();
    
    // Track for cleanup
    testContext.createdResources.push({
      type: 'account',
      id: accountData.data.id,
      network
    });

    console.log(`🆕 Created test account: ${accountData.data.handle}`);
    return accountData.data;
  } catch (error) {
    console.error(`❌ Failed to create test account: ${error.message}`);
    throw error;
  }
};

/**
 * Update a fixture file with new data
 * @param {string} fixtureName - Name of fixture file
 * @param {Object} data - Data to save to fixture
 */
const updateFixture = async (fixtureName, data) => {
  try {
    const fixturePath = path.join(FIXTURES_DIR, fixtureName);
    const formattedData = JSON.stringify(data, null, 2);
    
    await fs.writeFile(fixturePath, formattedData, 'utf-8');
    console.log(`💾 Updated fixture: ${fixtureName}`);
  } catch (error) {
    console.error(`❌ Failed to update fixture ${fixtureName}: ${error.message}`);
  }
};

/**
 * Cleanup a created resource
 * @param {Object} resource - Resource to cleanup
 */
const cleanupResource = async (resource) => {
  const token = localStorage.getItem('auth_token');
  const apiUrl = process.env.REACT_APP_API_URL;

  switch (resource.type) {
    case 'account':
      await fetch(`${apiUrl}/api/social/accounts/${resource.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      break;
    
    case 'roast':
      await fetch(`${apiUrl}/api/social/roasts/${resource.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      break;
      
    default:
      console.warn(`Unknown resource type: ${resource.type}`);
  }
};

/**
 * Wait for element to appear in DOM with custom timeout
 * @param {Function} queryFn - Function that queries for element
 * @param {number} timeout - Timeout in ms
 */
const waitForElementWithTimeout = async (queryFn, timeout = 10000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = queryFn();
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Element not found within ${timeout}ms`);
};

/**
 * Generate test data for backend integration tests
 * @param {string} type - Type of test data to generate
 * @param {Object} options - Generation options
 */
const generateTestData = (type, options = {}) => {
  switch (type) {
    case 'roast':
      return {
        id: `test_roast_${Date.now()}`,
        original: options.original || 'Test toxic comment here',
        roast: options.roast || 'Test roast response here',
        status: options.status || 'pending',
        tone: options.tone || 'Comico',
        createdAt: new Date().toISOString(),
        ...options
      };

    case 'shieldItem':
      return {
        id: `test_shield_${Date.now()}`,
        category: options.category || 'Insultos graves',
        action: options.action || 'Bloquear usuario',
        preview: options.preview || '***censurado***',
        toxicityScore: options.toxicityScore || 0.95,
        createdAt: new Date().toISOString(),
        ...options
      };

    default:
      throw new Error(`Unknown test data type: ${type}`);
  }
};

/**
 * Validate API response schema
 * @param {Object} response - API response to validate
 * @param {string} expectedType - Expected response type
 */
const validateResponseSchema = (response, expectedType) => {
  // Common validations
  expect(response).toHaveProperty('success');
  expect(response).toHaveProperty('timestamp');
  expect(typeof response.success).toBe('boolean');
  expect(new Date(response.timestamp)).toBeInstanceOf(Date);

  switch (expectedType) {
    case 'accounts':
      expect(response.data).toHaveProperty('accounts');
      expect(Array.isArray(response.data.accounts)).toBe(true);
      expect(response.data).toHaveProperty('networks');
      break;

    case 'roasts':
      expect(response.data).toHaveProperty('roasts');
      expect(Array.isArray(response.data.roasts)).toBe(true);
      expect(response.data).toHaveProperty('pagination');
      break;

    case 'shield':
      expect(response.data).toHaveProperty('intercepted');
      expect(Array.isArray(response.data.intercepted)).toBe(true);
      expect(response.data).toHaveProperty('summary');
      break;

    case 'settings':
      expect(response.data).toHaveProperty('settings');
      expect(response.data).toHaveProperty('availableOptions');
      break;

    case 'actionSuccess':
      expect(response).toHaveProperty('success', true);
      break;

    default:
      throw new Error(`Unknown response type: ${expectedType}`);
  }
};

module.exports = {
  setupRealBackendTest,
  teardownRealBackendTest,
  authenticateTestUser,
  loadFixtureIfNeeded,
  createTestAccount,
  updateFixture,
  waitForElementWithTimeout,
  generateTestData,
  validateResponseSchema
};