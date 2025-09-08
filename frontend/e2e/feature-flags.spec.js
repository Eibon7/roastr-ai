/**
 * E2E tests for Feature Flags - Issue #318
 * Tests Shop feature flag behavior in navigation and accessibility
 */

import { test, expect } from '@playwright/test';
import { 
  TEST_USERS, 
  mockFeatureFlags, 
  setupAuthState,
  clearAuthState
} from './auth.fixtures.js';

test.describe('Feature Flags - Shop Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await clearAuthState(page);
    // Deterministic baseline
    await mockFeatureFlags(page, { ENABLE_SHOP: false });
  });

  test.describe('Shop Feature Flag Disabled', () => {
    test.beforeEach(async ({ page }) => {
      // Mock feature flags with shop disabled
      await mockFeatureFlags(page, { ENABLE_SHOP: false });
    });

    test('should not show shop links when flag is disabled', async ({ page }) => {
      // Navigate to home page
      await page.goto('/');

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // Optional: authenticate if sidebar requires auth
      // await setupAuthState(page, TEST_USERS.user);
      const shopNavLink = page.locator('nav a:has-text("Shop")');
      await expect(shopNavLink).toHaveCount(0);
    });

    test('should redirect or show 404 when accessing shop URL with flag disabled', async ({ page }) => {
      // Try to access shop directly
      await page.goto('/shop');

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Check what happens - should be redirect or 404, not shop content
      const currentUrl = page.url();
      const pageContent = await page.textContent('body');

      // With shop flag disabled, should either redirect away from /shop or show 404
      const isRedirected = !currentUrl.includes('/shop');
      const isNotFound = pageContent?.toLowerCase().includes('404') || pageContent?.toLowerCase().includes('not found') || false;

      // Should be redirected OR show 404, but not show shop content
      expect(isRedirected || isNotFound).toBeTruthy();

      // Should NOT show shop content when flag is disabled
      const hasShopContent = pageContent?.toLowerCase().includes('shop') && !isNotFound;
      expect(hasShopContent).toBeFalsy();
    });

    test('should check admin interface accessibility', async ({ page }) => {
      // Try to access admin area
      await page.goto('/admin');

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Check what happens - could be redirect to login, admin page, or 404
      const currentUrl = page.url();
      const pageContent = await page.textContent('body');

      // Test documents current behavior
      const isAdminPage = currentUrl.includes('/admin') && !currentUrl.includes('/login');
      const isRedirectedToLogin = currentUrl.includes('/login');
      const isNotFound = pageContent?.toLowerCase().includes('404') || pageContent?.toLowerCase().includes('not found') || false;

      // One of these should be true
      expect(isAdminPage || isRedirectedToLogin || isNotFound).toBeTruthy();
    });
  });

  test.describe('Shop Feature Flag Enabled', () => {
    test.beforeEach(async ({ page }) => {
      // Mock feature flags with shop enabled
      await mockFeatureFlags(page, { ENABLE_SHOP: true });
    });

    test('should show shop links when flag is enabled', async ({ page }) => {
      // Navigate to home page
      await page.goto('/');

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // Log in if nav is gated
      await setupAuthState(page, TEST_USERS.user);
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const shopNavLink = page.locator('nav a:has-text("Shop")');
      await expect(shopNavLink).toHaveCount(1);
    });

    test('should handle shop URL access when flag is enabled', async ({ page }) => {
      await setupAuthState(page, TEST_USERS.user);
      await page.goto('/shop');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/shop(?:\/|$)/);
      // Basic content smoke check (adjust selector to your Shop page)
      await expect(page.locator('main')).toBeVisible();
    });
  });

  test.describe('Application Navigation', () => {
    test('should check main navigation structure', async ({ page }) => {
      // Navigate to home page
      await page.goto('/');

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Check for common navigation elements
      const navElements = page.locator('nav, [role="navigation"], .navigation, .navbar');
      const navCount = await navElements.count();

      // Check for links in the page
      const allLinks = page.locator('a[href]');
      const linkCount = await allLinks.count();

      // Basic navigation structure should exist
      expect(navCount + linkCount).toBeGreaterThan(0);
    });

    test('should check page responsiveness', async ({ page }) => {
      // Test different viewport sizes
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check if page loads without errors
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();

      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Page should still work on mobile
      const mobileTitle = await page.title();
      expect(mobileTitle).toBeTruthy();
    });

  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Stub specific feature-flags API endpoint with 500 error
      // Use the correct endpoint path that matches the app and fixtures
      await page.route('**/api/config/flags', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });

      await page.goto('/');

      // Wait for error UI or toast to appear instead of networkidle
      const errorSelector = '[data-testid="error-message"], .error-toast, .error-banner';
      await page.waitForSelector(errorSelector, { timeout: 10000 }).catch((error) => {
        // Log the timeout/error for debugging
        console.log(`Timeout waiting for error UI selector "${errorSelector}":`, error.message);
        // Continue with fallback check after logging
      });

      // Verify error handling or fallback UI is shown
      const hasErrorUI = await page.locator(errorSelector).count() > 0;
      const pageContent = await page.textContent('body');

      expect(hasErrorUI || pageContent.includes('error') || pageContent.includes('Error')).toBeTruthy();
    });
  });
});
