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
  switch (scenarioName) {
    case 'simple':
      return createSimpleScenario();
    case 'multi-org':
      return createMultiOrgScenario();
    case 'enterprise':
      return createEnterpriseScenario();
    case 'mixed-plans':
      return createMixedPlansScenario();
    default:
      return createSimpleScenario();
  }
}

/**
 * Simple scenario: One organization with one admin user
 */
function createSimpleScenario() {
  const org = createMockOrganization({ plan: 'pro' });
  const user = createMockUser(org.id, { role: 'admin' });

  return {
    organizations: [org],
    users: [user],
    scenario: 'simple'
  };
}

/**
 * Multi-organization scenario: Multiple orgs with different users
 */
function createMultiOrgScenario() {
  const org1 = createMockOrganization({ plan: 'starter', name: 'Startup Corp' });
  const org2 = createMockOrganization({ plan: 'pro', name: 'Growing Business' });
  const org3 = createMockOrganization({ plan: 'enterprise', name: 'Enterprise Inc' });

  const users = [
    createMockUser(org1.id, { role: 'admin', email: 'admin@startup.com' }),
    createMockUser(org1.id, { role: 'member', email: 'user@startup.com' }),
    createMockUser(org2.id, { role: 'admin', email: 'admin@growing.com' }),
    createMockUser(org2.id, { role: 'member', email: 'user1@growing.com' }),
    createMockUser(org2.id, { role: 'member', email: 'user2@growing.com' }),
    createMockUser(org3.id, { role: 'admin', email: 'admin@enterprise.com' }),
    createMockUser(org3.id, { role: 'manager', email: 'manager@enterprise.com' }),
    createMockUser(org3.id, { role: 'member', email: 'user@enterprise.com' })
  ];

  return {
    organizations: [org1, org2, org3],
    users,
    scenario: 'multi-org'
  };
}

/**
 * Enterprise scenario: Large organization with multiple roles
 */
function createEnterpriseScenario() {
  const org = createMockOrganization({
    plan: 'enterprise',
    name: 'Enterprise Corporation',
    status: 'active'
  });

  const users = [
    createMockUser(org.id, { role: 'admin', email: 'admin@enterprise.com', name: 'Admin User' }),
    createMockUser(org.id, { role: 'manager', email: 'manager1@enterprise.com', name: 'Manager One' }),
    createMockUser(org.id, { role: 'manager', email: 'manager2@enterprise.com', name: 'Manager Two' }),
    createMockUser(org.id, { role: 'member', email: 'user1@enterprise.com', name: 'User One' }),
    createMockUser(org.id, { role: 'member', email: 'user2@enterprise.com', name: 'User Two' }),
    createMockUser(org.id, { role: 'member', email: 'user3@enterprise.com', name: 'User Three' }),
    createMockUser(org.id, { role: 'viewer', email: 'viewer@enterprise.com', name: 'Viewer User' })
  ];

  return {
    organizations: [org],
    users,
    scenario: 'enterprise'
  };
}

/**
 * Mixed plans scenario: Organizations with different plan types
 */
function createMixedPlansScenario() {
  const freeOrg = createMockOrganization({ plan: 'free', name: 'Free Tier Org' });
  const starterOrg = createMockOrganization({ plan: 'starter', name: 'Starter Org' });
  const proOrg = createMockOrganization({ plan: 'pro', name: 'Pro Org' });
  const enterpriseOrg = createMockOrganization({ plan: 'enterprise', name: 'Enterprise Org' });

  const users = [
    createMockUser(freeOrg.id, { role: 'admin', email: 'admin@free.com' }),
    createMockUser(starterOrg.id, { role: 'admin', email: 'admin@starter.com' }),
    createMockUser(starterOrg.id, { role: 'member', email: 'user@starter.com' }),
    createMockUser(proOrg.id, { role: 'admin', email: 'admin@pro.com' }),
    createMockUser(proOrg.id, { role: 'member', email: 'user1@pro.com' }),
    createMockUser(proOrg.id, { role: 'member', email: 'user2@pro.com' }),
    createMockUser(enterpriseOrg.id, { role: 'admin', email: 'admin@enterprise.com' }),
    createMockUser(enterpriseOrg.id, { role: 'manager', email: 'manager@enterprise.com' }),
    createMockUser(enterpriseOrg.id, { role: 'member', email: 'user@enterprise.com' })
  ];

  return {
    organizations: [freeOrg, starterOrg, proOrg, enterpriseOrg],
    users,
    scenario: 'mixed-plans'
  };
}

/**
 * Create mock platform tokens for testing social media integrations
 */
function createMockPlatformTokens(userId, platforms = ['twitter', 'instagram']) {
  return platforms.map(platform => ({
    id: `token-${crypto.randomUUID()}`,
    user_id: userId,
    platform,
    access_token: `mock_${platform}_token_${Date.now()}`,
    refresh_token: `mock_${platform}_refresh_${Date.now()}`,
    expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    scope: platform === 'twitter' ? 'read,write' : 'basic_access',
    created_at: new Date().toISOString()
  }));
}

/**
 * Create mock usage data for billing tests
 */
function createMockUsageData(organizationId, overrides = {}) {
  return {
    organization_id: organizationId,
    period: overrides.period || new Date().toISOString().slice(0, 7), // YYYY-MM
    roasts_generated: overrides.roasts_generated !== undefined ? overrides.roasts_generated : 25,
    api_calls: overrides.api_calls !== undefined ? overrides.api_calls : 150,
    storage_used: overrides.storage_used !== undefined ? overrides.storage_used : 512, // MB
    bandwidth_used: overrides.bandwidth_used !== undefined ? overrides.bandwidth_used : 2048, // MB
    cost: overrides.cost !== undefined ? Number(overrides.cost) : 12.50,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Get available scenario types
 */
function getAvailableScenarios() {
  return [
    { name: 'simple', description: 'One organization with one admin user' },
    { name: 'multi-org', description: 'Multiple organizations with different users' },
    { name: 'enterprise', description: 'Large organization with multiple roles' },
    { name: 'mixed-plans', description: 'Organizations with different plan types' }
  ];
}

module.exports = {
  createMockOrganization,
  createMockUser,
  createMultiTenantTestScenario,
  createMockPlatformTokens,
  createMockUsageData,
  getAvailableScenarios
};