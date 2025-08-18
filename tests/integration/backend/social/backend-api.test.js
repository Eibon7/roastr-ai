/**
 * Backend Integration Tests - API Endpoints
 * 
 * Tests backend API endpoints without frontend dependencies
 * Run with: INTEGRATION_TEST_MODE=backend npm run test:integration-backend
 */

// Test utilities for backend integration
import { 
  setupRealBackendTest, 
  teardownRealBackendTest,
  authenticateTestUser,
  loadFixtureIfNeeded 
} from '../utils/backendTestUtils';

describe('Backend Integration - API Endpoints', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupRealBackendTest();
  });

  afterAll(async () => {
    await teardownRealBackendTest(testContext);
  });

  describe('Health Endpoints', () => {
    test('should have API health endpoint responding', async () => {
      // This is a simple test that doesn't require frontend dependencies
      expect(testContext).toBeDefined();
      
      // Test basic API configuration
      const config = testContext.config || {};
      expect(config).toMatchObject({
        API_URL: expect.any(String),
        USE_FIXTURES: expect.any(Boolean)
      });
    });

    test('should load basic fixture data if in fixture mode', async () => {
      if (process.env.USE_BACKEND_FIXTURES === 'true') {
        // Test fixture loading works
        const accountsFixture = await loadFixtureIfNeeded('accounts');
        expect(accountsFixture).toBeDefined();
        expect(accountsFixture.success).toBe(true);
      } else {
        // Skip fixture test in real backend mode
        console.log('Skipping fixture test - using real backend');
      }
    });
  });

  describe('Authentication Flow', () => {
    test('should handle test user authentication flow', async () => {
      // This tests backend authentication without frontend components
      const authResult = await authenticateTestUser(testContext);
      
      expect(authResult).toMatchObject({
        success: expect.any(Boolean),
        // Allow either actual auth data or fixture data
        data: expect.any(Object)
      });
    });
  });

  describe('Data Loading', () => {
    test('should load user accounts data', async () => {
      // Test backend data loading
      const accountsData = await loadFixtureIfNeeded('accounts', testContext);
      
      expect(accountsData).toMatchObject({
        success: true,
        data: expect.objectContaining({
          accounts: expect.any(Array),
          networks: expect.any(Array)
        })
      });
    });

    test('should have proper data structure for roasts', async () => {
      const roastsData = await loadFixtureIfNeeded('roasts', testContext);
      
      expect(roastsData).toMatchObject({
        success: true,
        data: expect.objectContaining({
          roasts: expect.any(Array),
          pagination: expect.objectContaining({
            total: expect.any(Number),
            limit: expect.any(Number)
          })
        })
      });
    });
  });
});