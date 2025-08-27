/**
 * Multi-tenant test utilities for Issue 82 - Phase 4
 * Provides reusable mocks for organizations, users, and tenant-scoped data
 */

const crypto = require('crypto');

/**
 * Generate test organization data
 */
function createMockOrganization(overrides = {}) {
  const orgId = overrides.id || `org-${crypto.randomUUID()}`;
  
  return {
    id: orgId,
    name: overrides.name || `Test Organization ${orgId.slice(-4)}`,
    plan: overrides.plan || 'pro',
    status: overrides.status || 'active',
    created_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Generate test user data with organization scope
 */
function createMockUser(organizationId, overrides = {}) {
  const userId = overrides.id || `user-${crypto.randomUUID()}`;
  
  return {
    id: userId,
    organization_id: organizationId,
    email: overrides.email || `test-user-${userId.slice(-8)}@example.com`,
    name: overrides.name || `Test User ${userId.slice(-4)}`,
    role: overrides.role || 'member',
    status: overrides.status || 'active',
    created_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create a complete multi-tenant test scenario
 */
function createMultiTenantTestScenario(scenarioName = 'simple') {
  const org = createMockOrganization({ plan: 'pro' });
  const user = createMockUser(org.id, { role: 'admin' });

  return {
    organizations: [org],
    users: [user]
  };
}

module.exports = {
  createMockOrganization,
  createMockUser,
  createMultiTenantTestScenario
};