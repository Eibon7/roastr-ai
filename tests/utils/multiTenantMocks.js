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
 * Create a complete multi-tenant test scenario (Issue #277 - Enhanced with parametrization)
 * @param {string|Object} scenarioNameOrConfig - Scenario name ('simple', 'multi-org', etc.) or custom config object
 * @param {Object} customConfig - Custom configuration for parametrized scenarios
 * @param {string} customConfig.plan - Plan type ('free', 'starter', 'pro', 'enterprise', etc.)
 * @param {string[]} customConfig.roles - Array of roles to create ('admin', 'member', 'viewer', etc.)
 * @param {string[]} customConfig.platforms - Array of platforms to configure ('twitter', 'instagram', etc.)
 * @param {number} customConfig.userCount - Number of users to create per organization
 * @param {number} customConfig.orgCount - Number of organizations to create (for multi-org scenarios)
 * @returns {Object} Test scenario with organizations, users, and metadata
 */
function createMultiTenantTestScenario(scenarioNameOrConfig = 'simple', customConfig = {}) {
  // Handle custom config object (Issue #277)
  if (typeof scenarioNameOrConfig === 'object' && scenarioNameOrConfig !== null) {
    return createCustomScenario(scenarioNameOrConfig);
  }

  const scenarioName = scenarioNameOrConfig;

  // If custom config provided with named scenario, merge it
  if (Object.keys(customConfig).length > 0) {
    return createCustomScenario({ ...customConfig, baseScenario: scenarioName });
  }

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
    createMockUser(org.id, {
      role: 'manager',
      email: 'manager1@enterprise.com',
      name: 'Manager One'
    }),
    createMockUser(org.id, {
      role: 'manager',
      email: 'manager2@enterprise.com',
      name: 'Manager Two'
    }),
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
  const freeOrg = createMockOrganization({ plan: 'starter_trial', name: 'Starter Trial Org' });
  const starterOrg = createMockOrganization({ plan: 'starter', name: 'Starter Org' });
  const proOrg = createMockOrganization({ plan: 'pro', name: 'Pro Org' });
  const enterpriseOrg = createMockOrganization({ plan: 'enterprise', name: 'Enterprise Org' });

  const users = [
    createMockUser(freeOrg.id, { role: 'admin', email: 'admin@trial.com' }),
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
  return platforms.map((platform) => ({
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
    cost: overrides.cost !== undefined ? Number(overrides.cost) : 12.5,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Validate scenario configuration (Issue #277 - CodeRabbit fix: align plans and harden typing)
 * @param {Object} config - Configuration object to validate
 * @throws {Error} If configuration is invalid
 */
function validateScenarioConfig(config) {
  // Align with DB CHECK constraint (Issue #277 - CodeRabbit fix)
  // Note: 'free' plan was removed in PR #870 (migration 20251118193202_remove_free_plan.sql)
  // DB CHECK constraint only allows: 'starter_trial', 'starter', 'pro', 'plus'
  // 'creator_plus' and 'custom' are application-level aliases that require normalization before DB insertion
  const validPlans = ['starter_trial', 'starter', 'pro', 'plus'];
  const validRoles = ['admin', 'member', 'viewer', 'manager', 'owner'];
  const validPlatforms = [
    'twitter',
    'youtube',
    'instagram',
    'facebook',
    'discord',
    'twitch',
    'reddit',
    'tiktok',
    'bluesky'
  ];

  if (config.plan && !validPlans.includes(config.plan)) {
    throw new Error(`Invalid plan: ${config.plan}. Valid plans: ${validPlans.join(', ')}`);
  }

  // Harden roles validation: must be array if provided (Issue #277 - CodeRabbit fix)
  if (config.roles !== undefined && !Array.isArray(config.roles)) {
    throw new Error('roles must be an array of strings');
  }
  if (Array.isArray(config.roles)) {
    const invalidRoles = config.roles.filter((role) => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      throw new Error(
        `Invalid roles: ${invalidRoles.join(', ')}. Valid roles: ${validRoles.join(', ')}`
      );
    }
  }

  // Harden platforms validation: must be array if provided (Issue #277 - CodeRabbit fix)
  if (config.platforms !== undefined && !Array.isArray(config.platforms)) {
    throw new Error('platforms must be an array of strings');
  }
  if (Array.isArray(config.platforms)) {
    const invalidPlatforms = config.platforms.filter(
      (platform) => !validPlatforms.includes(platform)
    );
    if (invalidPlatforms.length > 0) {
      throw new Error(
        `Invalid platforms: ${invalidPlatforms.join(', ')}. Valid platforms: ${validPlatforms.join(', ')}`
      );
    }
  }

  if (
    config.userCount !== undefined &&
    (typeof config.userCount !== 'number' || config.userCount < 1)
  ) {
    throw new Error(`Invalid userCount: ${config.userCount}. Must be a positive number`);
  }

  if (
    config.orgCount !== undefined &&
    (typeof config.orgCount !== 'number' || config.orgCount < 1)
  ) {
    throw new Error(`Invalid orgCount: ${config.orgCount}. Must be a positive number`);
  }
}

/**
 * Create custom parametrized scenario (Issue #277)
 * @param {Object} config - Custom configuration
 * @returns {Object} Test scenario
 */
function createCustomScenario(config) {
  // Validate configuration
  try {
    validateScenarioConfig(config);
  } catch (error) {
    throw new Error(`Invalid scenario configuration: ${error.message}`);
  }

  const plan = config.plan || 'pro';
  // Ensure roles is a non-empty array (Issue #277 - CodeRabbit fix)
  const roles =
    Array.isArray(config.roles) && config.roles.length > 0 ? config.roles : ['admin', 'member'];
  // Normalize platforms: must be array (Issue #277 - CodeRabbit fix)
  const platforms = Array.isArray(config.platforms) ? config.platforms : [];
  // Set userCount to roles.length only when omitted, not when 0 (Issue #277 - CodeRabbit fix)
  const userCount =
    typeof config.userCount === 'number' && config.userCount > 0 ? config.userCount : roles.length;
  const orgCount = config.orgCount || 1;

  const organizations = [];
  const users = [];

  // Create organizations
  for (let i = 0; i < orgCount; i++) {
    const org = createMockOrganization({
      plan,
      name: config.orgName || `Test Organization ${i + 1}`
    });
    organizations.push(org);

    // Create users for this organization (Issue #277 - CodeRabbit fix: removed Math.min cap)
    for (let j = 0; j < userCount; j++) {
      const role = roles[j % roles.length]; // Rotate roles for any userCount
      const user = createMockUser(org.id, {
        role,
        email: `user${j + 1}@org${i + 1}.com`
      });
      users.push(user);

      // Add platform tokens if platforms specified
      if (platforms.length > 0) {
        const tokens = createMockPlatformTokens(user.id, platforms);
        user.platformTokens = tokens;
      }
    }
  }

  return {
    organizations,
    users,
    scenario: 'custom',
    config: {
      plan,
      roles,
      platforms,
      userCount,
      orgCount
    }
  };
}

/**
 * Get available scenario types (Issue #277 - Enhanced)
 */
function getAvailableScenarios() {
  return [
    { name: 'simple', description: 'One organization with one admin user' },
    { name: 'multi-org', description: 'Multiple organizations with different users' },
    { name: 'enterprise', description: 'Large organization with multiple roles' },
    { name: 'mixed-plans', description: 'Organizations with different plan types' },
    { name: 'custom', description: 'Parametrized scenario with custom plan, roles, and platforms' }
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
