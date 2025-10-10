/**
 * Authentication Helper for Integration Tests
 * Provides mock authentication tokens for testing admin endpoints
 */

/**
 * Create a mock admin user for testing
 * @returns {Object} Mock admin user data
 */
function createMockAdminUser() {
  return {
    id: 'test-admin-id-123',
    email: 'admin@test.com',
    name: 'Test Admin',
    is_admin: true,
    active: true
  };
}

/**
 * Create a mock non-admin user for testing
 * @returns {Object} Mock regular user data
 */
function createMockRegularUser() {
  return {
    id: 'test-user-id-456',
    email: 'user@test.com',
    name: 'Test User',
    is_admin: false,
    active: true
  };
}

/**
 * Get mock admin authorization header for tests
 * Note: In real tests with database, this would generate a valid JWT token
 * For now, returns a mock Bearer token that the test environment accepts
 *
 * @returns {Object} Authorization header object
 */
function getMockAdminAuthHeader() {
  // In test environment, isAdminMiddleware might be bypassed or mocked
  // This is a placeholder for proper JWT token generation
  return {
    Authorization: 'Bearer mock-admin-token-for-testing'
  };
}

/**
 * Get mock regular user authorization header for tests
 * @returns {Object} Authorization header object
 */
function getMockUserAuthHeader() {
  return {
    Authorization: 'Bearer mock-user-token-for-testing'
  };
}

module.exports = {
  createMockAdminUser,
  createMockRegularUser,
  getMockAdminAuthHeader,
  getMockUserAuthHeader
};
