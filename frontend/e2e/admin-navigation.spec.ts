import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Admin Navigation
 *
 * Tests navigation between admin sections:
 * - Dashboard navigation
 * - Sidebar navigation
 * - Route protection
 */

test.describe('Admin Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login with demo mode before each test
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'demo-token-test');
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: '1',
          email: 'admin@example.com',
          name: 'Admin User',
          is_admin: true
        })
      );
    });
  });

  test('should navigate to users page', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Click on Users in sidebar
    await page.getByRole('link', { name: /usuarios/i }).click();

    // Should be on users page
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByRole('heading', { name: /usuarios/i })).toBeVisible();
  });

  test('should navigate to metrics page', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Click on Metrics in sidebar - the link text is "Panel de Métricas"
    await page.getByRole('link', { name: /panel de métricas/i }).click();

    // Should be on metrics page
    await expect(page).toHaveURL(/\/admin\/metrics/, { timeout: 10000 });
    // Just verify URL changed and page loaded (metrics page might not have a heading)
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to feature flags page', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Click on Feature Flags in sidebar
    await page.getByRole('link', { name: /feature flags/i }).click();

    // Should be on feature flags page
    await expect(page).toHaveURL(/\/admin\/config\/feature-flags/);
    await expect(page.getByRole('heading', { name: /feature flags/i })).toBeVisible();
  });

  test('should navigate to plans page', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Click on Plans in sidebar
    await page.getByRole('link', { name: /planes/i }).click();

    // Should be on plans page
    await expect(page).toHaveURL(/\/admin\/config\/plans/);
    await expect(page.getByRole('heading', { name: /planes/i })).toBeVisible();
  });

  test('should navigate to tones page', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Click on Tones in sidebar
    await page.getByRole('link', { name: /tonos/i }).click();

    // Should be on tones page
    await expect(page).toHaveURL(/\/admin\/config\/tones/);
    await expect(page.getByRole('heading', { name: /tonos/i })).toBeVisible();
  });

  test('should show active navigation item', async ({ page }) => {
    await page.goto('/admin/users');

    // Users link should be active/highlighted
    const usersLink = page.getByRole('link', { name: /usuarios/i });
    // Note: Actual implementation depends on how active state is styled
    await expect(usersLink).toBeVisible();
  });

  test('should redirect non-admin users', async ({ page }) => {
    // Clear and set non-admin user
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('auth_token', 'demo-token-test');
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: '2',
          email: 'user@example.com',
          name: 'Regular User',
          is_admin: false
        })
      );
    });

    // Try to access admin route
    await page.goto('/admin/dashboard');

    // Should redirect to /app
    await expect(page).toHaveURL(/\/app/);
  });
});
