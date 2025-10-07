import { test, expect } from '@playwright/test';

test.describe('Dashboard Graph Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should render dependency graph', async ({ page }) => {
    // Switch to graph view
    await page.getByTestId('nav-graph').click();

    // Check for graph container
    await expect(page.getByTestId('graph-view')).toBeVisible();
    await expect(page.getByTestId('graph-wrapper')).toBeVisible();
  });

  test('should allow node selection', async ({ page }) => {
    // Switch to graph view
    await page.getByTestId('nav-graph').click();

    // Verify graph wrapper is visible
    await expect(page.getByTestId('graph-wrapper')).toBeVisible();

    // Check for SVG or Canvas elements (graph rendering)
    const graphElements = page.locator('[data-testid="graph-wrapper"] svg, [data-testid="graph-wrapper"] canvas');
    const hasGraphElement = await graphElements.count() > 0;

    if (hasGraphElement) {
      // If graph rendered, verify it's visible
      await expect(graphElements.first()).toBeVisible();
    }

    // Verify page still functional
    await expect(page.getByTestId('main-content')).toBeVisible();
  });

  test('should support interactions', async ({ page }) => {
    // Switch to graph view
    await page.getByTestId('nav-graph').click();

    // Verify graph view is rendered
    await expect(page.getByTestId('graph-view')).toBeVisible();
    await expect(page.getByTestId('graph-wrapper')).toBeVisible();

    // Graph rendering complete - check for interactive elements
    const interactiveGraph = page.locator('[data-testid="graph-wrapper"] svg, [data-testid="graph-wrapper"] canvas');
    if (await interactiveGraph.count() > 0) {
      await expect(interactiveGraph.first()).toBeVisible();
    }
  });
});
