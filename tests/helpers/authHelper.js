/**
 * Authentication Helper for Integration Tests
 * Provides mock authentication tokens for testing admin endpoints
 */

const jwt = require('jsonwebtoken');

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

/**
 * Generate a valid JWT test token for integration tests
 * 
 * Issue #944: Required for toggle endpoint integration tests
 * 
 * @param {string} userId - User ID for the token
 * @param {string} organizationId - Organization ID for the token
 * @returns {string} JWT token string
 * 
 * @example
 * const token = generateTestToken('user-123', 'org-456');
 * // Use in Authorization header: `Bearer ${token}`
 */
function generateTestToken(userId, organizationId) {
  const secret = process.env.JWT_SECRET || 'test-secret-key';
  
  const payload = {
    id: userId,
    organizationId: organizationId,
    email: `test-${userId}@example.com`
  };
  
  // Generate token with 1 hour expiry for tests
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

module.exports = {
  createMockAdminUser,
  createMockRegularUser,
  getMockAdminAuthHeader,
  getMockUserAuthHeader,
  generateTestToken
};
