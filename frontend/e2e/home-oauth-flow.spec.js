/**
 * E2E Tests for Home Page OAuth Flow - Issue #1043
 *
 * Tests the complete OAuth flow for connecting social networks from the Home page
 * CodeRabbit nice-to-have: E2E tests for full OAuth flow
 */

const { test, expect } = require('@playwright/test');

test.describe('Home Page OAuth Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - assume user is logged in
    await page.goto('/login');

    // Fill login form (adjust selectors based on your actual login form)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // Wait for navigation to /app
    await page.waitForURL('**/app', { timeout: 10000 });
  });

  test('should display home page with all components', async ({ page }) => {
    await page.goto('/app');

    // Verify page title
    await expect(page.locator('h1')).toContainText('Inicio');

    // Verify usage widgets are visible
    await expect(page.locator('text=Análisis este mes')).toBeVisible();
    await expect(page.locator('text=Roasts este mes')).toBeVisible();

    // Verify connect network card is visible
    await expect(page.locator('text=Redes Disponibles')).toBeVisible();

    // Verify accounts table is visible
    await expect(page.locator('text=Cuentas Conectadas')).toBeVisible();
  });

  test('should show loading state while fetching accounts', async ({ page }) => {
    // Intercept API call to delay response
    await page.route('**/api/accounts', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.goto('/app');

    // Verify loading skeleton is shown
    await expect(page.locator('[data-testid*="skeleton"]').first()).toBeVisible();
  });

  test('should display connect buttons for each platform', async ({ page }) => {
    await page.goto('/app');

    // Wait for page to load
    await page.waitForSelector('text=Redes Disponibles');

    // Verify platform buttons are visible (adjust based on actual implementation)
    const twitterButton = page.locator('button:has-text("Twitter")');
    const instagramButton = page.locator('button:has-text("Instagram")');

    // At least one platform button should be visible
    await expect(twitterButton.or(instagramButton).first()).toBeVisible();
  });

  test('should handle OAuth connection flow for Twitter', async ({ page, context }) => {
    await page.goto('/app');

    // Wait for connect network card to load
    await page.waitForSelector('text=Redes Disponibles');

    // Mock OAuth redirect
    await page.route('**/api/accounts/connect/twitter', async (route) => {
      const response = await route.fetch();
      const json = await response.json();

      if (json.authUrl) {
        // Simulate OAuth redirect
        await context.grantPermissions(['notifications']);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            authUrl: 'https://oauth.example.com/twitter?redirect_uri=/app'
          })
        });
      }

      return route.continue();
    });

    // Click Twitter connect button
    const twitterButton = page.locator('button:has-text("Twitter")').first();
    if (await twitterButton.isVisible()) {
      await twitterButton.click();

      // Verify OAuth flow initiated (either redirect or success message)
      // Check for success message or URL change indicating OAuth redirect
      const successVisible = await page
        .locator('text=conectada')
        .isVisible()
        .catch(() => false);
      const urlChanged = !page.url().includes('/app');
      expect(successVisible || urlChanged).toBeTruthy();
    }
  });

  test('should disable platform button when limit is reached', async ({ page }) => {
    // Mock accounts API to return accounts at limit
    await page.route('**/api/accounts', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: '1', platform: 'twitter', status: 'active' },
            { id: '2', platform: 'twitter', status: 'active' } // At limit for starter plan
          ]
        })
      });
    });

    // Mock plan API to return starter plan (limit: 1 per platform)
    await page.route('**/api/plan/current', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'starter'
        })
      });
    });

    await page.goto('/app');
    await page.waitForSelector('text=Redes Disponibles');

    // Twitter button should be disabled if at limit
    const twitterButton = page.locator('button:has-text("Twitter")').first();
    if (await twitterButton.isVisible()) {
      // Check if button shows limit reached (adjust selector based on implementation)
      const isDisabled = await twitterButton.isDisabled();
      const buttonText = await twitterButton.textContent();

      // Either button is disabled or shows limit message
      expect(isDisabled || buttonText.includes('2/1')).toBeTruthy();
    }
  });

  test('should refresh accounts after successful connection', async ({ page }) => {
    let accountsCallCount = 0;

    await page.route('**/api/accounts', async (route) => {
      accountsCallCount++;

      if (accountsCallCount === 1) {
        // Initial load - empty accounts
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: []
          })
        });
      } else {
        // After connection - new account added
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [{ id: '1', platform: 'twitter', handle: '@testuser', status: 'active' }]
          })
        });
      }
    });

    // Mock successful connection
    await page.route('**/api/accounts/connect/twitter', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'twitter connected successfully',
          data: { id: '1', platform: 'twitter' }
        })
      });
    });

    await page.goto('/app');
    await page.waitForSelector('text=Redes Disponibles');

    // Click connect button
    const connectButton = page.locator('button:has-text("Twitter")').first();
    if (await connectButton.isVisible()) {
      await connectButton.click();

      // Wait for accounts to refresh
      await page.waitForTimeout(1000);

      // Verify accounts table updated
      await expect(page.locator('text=@testuser')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle OAuth connection errors gracefully', async ({ page }) => {
    // Mock connection error
    await page.route('**/api/accounts/connect/twitter', async (route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to connect platform'
        })
      });
    });

    await page.goto('/app');
    await page.waitForSelector('text=Redes Disponibles');

    // Click connect button
    const connectButton = page.locator('button:has-text("Twitter")').first();
    if (await connectButton.isVisible()) {
      await connectButton.click();

      // Verify error message is shown (toast or error state)
      await expect(page.locator('text=Error').or(page.locator('text=Failed')).first()).toBeVisible({
        timeout: 3000
      });
    }
  });

  test('should navigate to account detail on table row click', async ({ page }) => {
    // Mock accounts with data
    await page.route('**/api/accounts', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'acc_123',
              platform: 'twitter',
              handle: '@testuser',
              status: 'active',
              roasts_count: 45,
              shield_interceptions: 12
            }
          ]
        })
      });
    });

    await page.goto('/app');
    await page.waitForSelector('text=Cuentas Conectadas');

    // Click on account row
    const accountRow = page.locator('text=@testuser').locator('..').locator('..');
    await accountRow.click();

    // Verify navigation to account detail
    await expect(page).toHaveURL(/.*\/app\/accounts\/acc_123/, { timeout: 5000 });
  });

  test('should display empty state when no accounts connected', async ({ page }) => {
    // Mock empty accounts
    await page.route('**/api/accounts', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: []
        })
      });
    });

    await page.goto('/app');

    // Verify empty state message
    await expect(page.locator('text=No tienes cuentas conectadas')).toBeVisible();
  });

  test('should handle error boundary gracefully', async ({ page }) => {
    // Force an error by breaking API response
    await page.route('**/api/accounts', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json{{{'
      });
    });

    await page.goto('/app');

    // Error boundary should catch and display error UI
    await expect(
      page.locator('text=Something went wrong').or(page.locator('text=Algo salió mal')).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
