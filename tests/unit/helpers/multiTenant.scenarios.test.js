const {
  createMultiTenantTestScenario,
  createMultiTenantMocks
} = require('../../helpers/testUtils');

describe('Multi-tenant test utilities (Issue #281)', () => {
  test('plus preset applies defaults and trims platforms', async () => {
    const scenario = createMultiTenantTestScenario('plus', {
      platforms: ['twitter', 'youtube', 'instagram']
    });

    expect(scenario.organization.plan).toBe('plus');
    expect(scenario.organization.entitlements.monthlyResponsesLimit).toBe(250);
    expect(scenario.organization.settings.enabledPlatforms.length).toBeLessThanOrEqual(2);
  });

  test('agency near-limit scenario flags isNearLimit', async () => {
    const scenario = createMultiTenantTestScenario('agency', {
      entitlements: { monthlyResponsesLimit: 50 },
      quotaScenario: 'near'
    });

    const db = createMultiTenantMocks(scenario);
    const usage = await db.getUsageStats();
    expect(usage.limit).toBe(50);
    expect(usage.roastsThisMonth).toBe(49);
    expect(usage.isNearLimit).toBe(true);
    expect(usage.isOverLimit).toBe(false);
  });

  test('suspended scenario sets status and reason', async () => {
    const scenario = createMultiTenantTestScenario('suspended', {
      suspended: true,
      suspendedReason: 'Manual lock'
    });

    expect(scenario.user.isActive).toBe(false);
    expect(scenario.organization.status).toBe('suspended');
    expect(scenario.organization.suspendedReason).toBe('Manual lock');
  });

  test('over-limit scenario derives overage when requested', async () => {
    const scenario = createMultiTenantTestScenario('pro', {
      entitlements: { monthlyResponsesLimit: 300 },
      // Usage override will be superseded by quotaScenario 'over'
      usage: { roastsThisMonth: 310 },
      quotaScenario: 'over'
    });

    const db = createMultiTenantMocks(scenario);
    const usage = await db.getUsageStats();
    expect(usage.limit).toBe(300);
    expect(usage.roastsThisMonth).toBe(305);
    expect(usage.isOverLimit).toBe(true);
  });

  test('entitlements overrides are honored', () => {
    const scenario = createMultiTenantTestScenario('simple', {
      entitlements: { integrationsLimit: 7, shieldEnabled: false, monthlyResponsesLimit: 42 }
    });
    expect(scenario.organization.entitlements.integrationsLimit).toBe(7);
    expect(scenario.organization.entitlements.shieldEnabled).toBe(false);
    expect(scenario.organization.entitlements.monthlyResponsesLimit).toBe(42);
  });
});

