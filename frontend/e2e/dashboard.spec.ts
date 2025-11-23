import { test, expect } from '@playwright/test';

const mockIntegrations = [
  { name: 'twitter', displayName: 'Twitter', icon: '🐦', status: 'connected', importedCount: 120 },
  { name: 'youtube', displayName: 'YouTube', icon: '▶️', status: 'disconnected', importedCount: 0 },
  { name: 'discord', displayName: 'Discord', icon: '💬', status: 'disconnected', importedCount: 0 }
];

const mockUsage = {
  costCents: 1200,
  currency: 'USD',
  aiCalls: 345,
  limits: {
    aiCallsLimit: 1000
  },
  breakdown: {
    roastGeneration: 120,
    toxicityAnalysis: 200,
    platformSync: 25
  }
};

const mockPlan = {
  plan_id: 'plus',
  user: { name: 'QA Dev', email: 'qa@example.com' },
  roasts: 53,
  plan_limits: { aiCallsLimit: 1000 }
};

test.describe('Dashboard integration validation', () => {
  test('Connect page shows connections and allows error guard', async ({ page }) => {
    await page.route('**/api/integrations/platforms', (route) =>
      route.fulfill({ json: { platforms: mockIntegrations } })
    );
    await page.route('**/api/integrations/status', (route) =>
      route.fulfill({ json: { integrations: mockIntegrations } })
    );

    await page.goto('/connect');
    await expect(page.locator('text=Integrations')).toBeVisible();
    await expect(page.locator('text=Connected')).toBeVisible();
    await page.screenshot({
      path: '../../docs/test-evidence/issue-910/connect-loaded.png',
      fullPage: true
    });

    // Force error for status to trigger warning banner
    await page.route('**/api/integrations/status', (route) => route.fulfill({ status: 500 }));
    await page.reload();
    await expect(page.locator('text=Problemas cargando datos')).toBeVisible();
  });

  test('Dashboard shows usage, plan and shields data', async ({ page }) => {
    await page.route('**/api/integrations', (route) =>
      route.fulfill({ json: { integrations: mockIntegrations } })
    );
    await page.route('**/api/usage', (route) => route.fulfill({ json: mockUsage }));
    await page.route('**/api/plan/current', (route) => route.fulfill({ json: mockPlan }));
    await page.route('**/api/user/roasts/recent?limit=10', (route) =>
      route.fulfill({ json: { data: [] } })
    );
    await page.route('**/api/shield/intercepted?limit=5', (route) =>
      route.fulfill({ json: { data: [] } })
    );
    await page.route('**/analytics/summary', (route) =>
      route.fulfill({ json: { data: { summary: 'ok' } } })
    );

    await page.goto('/dashboard');
    await expect(page.locator('text=Usage & Costs')).toBeVisible();
    await expect(page.locator('text=Plan Status')).toBeVisible();
    await page.screenshot({
      path: '../../docs/test-evidence/issue-910/dashboard-loaded.png',
      fullPage: true
    });
  });
});
