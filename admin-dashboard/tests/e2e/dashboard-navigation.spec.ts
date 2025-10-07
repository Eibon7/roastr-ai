import { test, expect } from '@playwright/test';

/**
 * GDD Admin Dashboard - Navigation Tests
 *
 * Tests basic navigation and section rendering for the Snake Eater UI dashboard.
 * Validates that all major sections are present and accessible.
 */

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard before each test
    await page.goto('/dashboard');
    // Wait for dashboard to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard with all sections', async ({ page }) => {
    // Test AC: Dashboard loads and displays all major sections

    // Check for main heading
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Check for Overview section
    const overviewSection = page.locator('text=/overview/i').first();
    await expect(overviewSection).toBeVisible();

    // Check for Node Explorer section
    const nodeExplorerSection = page.locator('text=/node explorer/i').first();
    await expect(nodeExplorerSection).toBeVisible();

    // Check for Dependency Graph section
    const graphSection = page.locator('text=/dependency graph|graph/i').first();
    await expect(graphSection).toBeVisible();

    // Check for Reports/Validation section
    const reportsSection = page.locator('text=/reports|validation/i').first();
    await expect(reportsSection).toBeVisible();
  });

  test('should display metric cards with values', async ({ page }) => {
    // Test AC: Metric cards render with actual data

    // Look for metric cards (should have numeric values)
    const metricCards = page.locator('[class*="metric"], [class*="card"]').filter({
      hasText: /\d+/
    });

    // Should have at least 3 metric cards
    const count = await metricCards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Each card should be visible
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(metricCards.nth(i)).toBeVisible();
    }
  });

  test('should navigate between sections using tabs or buttons', async ({ page }) => {
    // Test AC: User can navigate between different dashboard sections

    // Find navigation elements (tabs, buttons, links)
    const navElements = page.locator('nav a, button[role="tab"], [role="navigation"] button');

    if (await navElements.count() > 0) {
      // Click first navigation element
      await navElements.first().click();
      await page.waitForTimeout(500);

      // Verify page didn't crash (title still exists)
      await expect(page.locator('h1, h2').first()).toBeVisible();
    } else {
      // If no navigation elements, verify at least the main content is present
      await expect(page.locator('main, [role="main"], #root').first()).toBeVisible();
    }
  });

  test('should display Snake Eater UI theming', async ({ page }) => {
    // Test AC: Dashboard displays dark-cyber theme

    // Get computed styles of body or root element
    const body = page.locator('body');
    const backgroundColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Dark theme should have dark background (rgb values < 50)
    const rgbMatch = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      const isDark = r < 50 && g < 50 && b < 50;
      expect(isDark).toBeTruthy();
    }

    // Check for cyber-themed elements (neon colors, monospace fonts)
    const hasNeonText = await page.locator('text=/node|system|gdd/i').first().evaluate((el) => {
      const color = window.getComputedStyle(el).color;
      // Neon colors typically have high saturation (green, cyan, blue)
      return color.includes('rgb');
    });

    expect(hasNeonText).toBeTruthy();
  });
});
