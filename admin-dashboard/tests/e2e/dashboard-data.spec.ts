import { test, expect } from '@playwright/test';

test.describe('Dashboard Data Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should load and display system nodes', async ({ page }) => {
    await page.waitForTimeout(1000);
    const expectedNodes = ['shield', 'roast', 'multi-tenant', 'queue-system', 'cost-control'];
    let foundNodes = 0;
    for (const nodeName of expectedNodes) {
      const nodeElement = page.locator(`text=${nodeName}`).first();
      if (await nodeElement.isVisible().catch(() => false)) {
        foundNodes++;
      }
    }
    expect(foundNodes).toBeGreaterThanOrEqual(3);
  });

  test('should display node metadata', async ({ page }) => {
    const hasStatus = (await page.locator('text=/status|active|production/i').count()) > 0;
    const hasCoverage = (await page.locator('text=/coverage|%/').count()) > 0;
    const hasTimestamp =
      (await page.locator('text=/updated|last modified|\\d{4}-\\d{2}-\\d{2}/').count()) > 0;
    expect(hasStatus || hasCoverage || hasTimestamp).toBeTruthy();
  });

  test('should display dependency relationships', async ({ page }) => {
    const hasDependencies =
      (await page.locator('text=/depends on|dependencies|used by/i').count()) > 0;
    const hasGraphElements = (await page.locator('svg, canvas, [class*="graph"]').count()) > 0;
    expect(hasDependencies || hasGraphElements).toBeTruthy();
  });

  test('should handle missing data gracefully', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
    await expect(page.locator('main, #root, [role="main"]').first()).toBeVisible();
  });
});
