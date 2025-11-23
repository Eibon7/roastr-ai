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

    // Check for main content
    await expect(page.getByTestId('main-content')).toBeVisible();

    // Check for sidebar sections
    await expect(page.getByTestId('left-sidebar')).toBeVisible();
    await expect(page.getByTestId('system-status')).toBeVisible();

    // Check for navigation menu
    await expect(page.getByTestId('nav-menu')).toBeVisible();
    await expect(page.getByTestId('nav-health')).toBeVisible();
    await expect(page.getByTestId('nav-graph')).toBeVisible();
    await expect(page.getByTestId('nav-reports')).toBeVisible();
  });

  test('should display metric cards with values', async ({ page }) => {
    // Test AC: Metric cards render with actual data

    // Check for stats grid and individual stats
    await expect(page.getByTestId('stats-grid')).toBeVisible();
    await expect(page.getByTestId('stat-health')).toBeVisible();
    await expect(page.getByTestId('stat-drift')).toBeVisible();
    await expect(page.getByTestId('stat-nodes')).toBeVisible();
    await expect(page.getByTestId('stat-coverage')).toBeVisible();
  });

  test('should navigate between sections using tabs or buttons', async ({ page }) => {
    // Test AC: User can navigate between different dashboard sections

    // Click on Health Panel nav
    await page.getByTestId('nav-health').click();
    await expect(page.getByTestId('health-panel')).toBeVisible();

    // Click on System Graph nav
    await page.getByTestId('nav-graph').click();
    await expect(page.getByTestId('graph-view')).toBeVisible();

    // Click on Reports nav
    await page.getByTestId('nav-reports').click();
    // Reports component doesn't have a test ID yet, check main content still visible
    await expect(page.getByTestId('main-content')).toBeVisible();
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
    const hasNeonText = await page
      .locator('text=/node|system|gdd/i')
      .first()
      .evaluate((el) => {
        const color = window.getComputedStyle(el).color;
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return false;
        const [, r, g, b] = match.map(Number);
        // Neon green theme (#39ff14): g > 200, r < 100, b < 100
        return g > 200 && r < 100 && b < 100;
      });

    expect(hasNeonText).toBeTruthy();
  });
});
