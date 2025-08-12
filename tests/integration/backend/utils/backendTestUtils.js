/**
 * Backend Integration Test Utilities
 * 
 * Utilities for setting up and managing backend integration tests
 */

import fs from 'fs/promises';
import path from 'path';
import socialAPI from '../../../../frontend/src/api/social';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

/**
 * Setup real backend test environment
 * @returns {Object} Test context with authentication and cleanup info
 */
export const setupRealBackendTest = async () => {
  const isFixtureMode = process.env.USE_FIXTURES === 'true';
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  console.log(`🔧 Setting up backend integration tests`);
  console.log(`📡 API URL: ${apiUrl}`);
  console.log(`📁 Fixture mode: ${isFixtureMode}`);
  
  // Verify backend is accessible if not in fixture mode
  if (!isFixtureMode) {
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`Backend health check failed: ${response.status}`);
      }
      console.log(`✅ Backend is accessible at ${apiUrl}`);
    } catch (error) {
      console.warn(`⚠️  Backend not accessible: ${error.message}`);
      console.log(`🔄 Falling back to fixture mode`);
      process.env.USE_FIXTURES = 'true';
    }
  }

  return {
    apiUrl,
    isFixtureMode: process.env.USE_FIXTURES === 'true',
    testStartTime: Date.now(),
    createdResources: []
  };
};

/**
 * Cleanup after backend integration tests
 * @param {Object} testContext - Context from setupRealBackendTest
 */
export const teardownRealBackendTest = async (testContext) => {
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
export const authenticateTestUser = async (testContext) => {
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
 * Load fixture data or fetch from real API
 * @param {string} fixtureName - Name of fixture file
 * @param {Function} apiFetcher - Function to fetch real data
 * @returns {Object} Fixture or real API data
 */
export const loadFixtureIfNeeded = async (fixtureName, apiFetcher) => {
  const useFixtures = process.env.USE_FIXTURES === 'true';
  
  if (useFixtures) {
    try {
      const fixturePath = path.join(FIXTURES_DIR, fixtureName);
      const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
      const fixtureData = JSON.parse(fixtureContent);
      
      console.log(`📁 Loaded fixture: ${fixtureName}`);
      return fixtureData;
    } catch (error) {
      console.warn(`⚠️  Failed to load fixture ${fixtureName}: ${error.message}`);
      console.log(`🔄 Falling back to real API`);
    }
  }

  // Fetch from real API
  try {
    const realData = await apiFetcher();
    console.log(`📡 Fetched real data for: ${fixtureName}`);
    
    // Optionally update fixture if AUTO_UPDATE_FIXTURES is enabled
    if (process.env.AUTO_UPDATE_FIXTURES === 'true') {
      await updateFixture(fixtureName, realData);
    }
    
    return realData;
  } catch (error) {
    console.error(`❌ Failed to fetch real data for ${fixtureName}: ${error.message}`);
    throw error;
  }
};

/**
 * Create a test account for integration tests
 * @param {Object} testContext - Test context
 * @param {string} network - Social network type
 * @returns {Object} Created account data
 */
export const createTestAccount = async (testContext, network = 'twitter') => {
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
export const updateFixture = async (fixtureName, data) => {
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
export const waitForElementWithTimeout = async (queryFn, timeout = 10000) => {
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
export const generateTestData = (type, options = {}) => {
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
export const validateResponseSchema = (response, expectedType) => {
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

export default {
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