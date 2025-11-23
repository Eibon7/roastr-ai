/**
 * Basic E2E tests to verify the application loads correctly
 */

import { test, expect } from '@playwright/test';

test.describe('Basic Application Tests', () => {
  test('should load the application homepage', async ({ page }) => {
    await page.goto('/');

    // Should have a title
    await expect(page).toHaveTitle(/Roastr/);

    // Should not have any console errors
    const consoleMessages = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    // Check that no JavaScript errors occurred
    expect(consoleMessages.length).toBe(0);
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/');

    // Should be able to navigate to login page
    if (await page.locator('text=Iniciar sesión').isVisible()) {
      await page.click('text=Iniciar sesión');
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should load CSS and be styled correctly', async ({ page }) => {
    await page.goto('/login');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check that Tailwind CSS classes are applied
    const body = page.locator('body');

    // Should have some basic styling applied
    const bodyClasses = await body.getAttribute('class');
    expect(bodyClasses).toBeTruthy();
  });
});
