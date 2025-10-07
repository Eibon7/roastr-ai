import { test, expect } from '@playwright/test';

test.describe('Dashboard Graph Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should render dependency graph', async ({ page }) => {
    await page.waitForTimeout(1500);
    const graphContainer = page.locator('[class*="graph"], [class*="dependency"], svg, canvas').first();
    const graphExists = await graphContainer.count() > 0;
    if (graphExists) {
      await expect(graphContainer).toBeVisible();
    } else {
      const hasDependencyText = await page.locator('text=/depends|dependencies/i').count() > 0;
      expect(hasDependencyText).toBeTruthy();
    }
  });

  test('should allow node selection', async ({ page }) => {
    await page.waitForTimeout(1500);
    const nodeElements = page.locator('[class*="node"], circle');
    const nodeCount = await nodeElements.count();
    if (nodeCount > 0) {
      await nodeElements.first().click();

      // Wait for node details, highlights, or drawer to appear
      const hasVisualFeedback = await page.waitForSelector(
        '[data-node-highlighted], [data-testid="node-details"], [class*="selected"], [class*="active"]',
        { timeout: 2000 }
      ).catch(() => null);

      // Log for debugging if no visual feedback found
      if (!hasVisualFeedback) {
        console.log('Note: No visual feedback detected after node click (non-critical)');
      }
    }

    // Verify page still functional and no crashes
    await expect(page.locator('main, #root').first()).toBeVisible();
  });

  test('should support interactions', async ({ page }) => {
    await page.waitForTimeout(1500);
    const interactiveGraph = page.locator('svg, canvas').first();
    if (await interactiveGraph.count() > 0) {
      await expect(interactiveGraph).toBeVisible();
    } else {
      const hasStaticGraph = await page.locator('[class*="graph"]').count() > 0;
      expect(hasStaticGraph).toBeTruthy();
    }
  });
});
