/**
 * Shield UI Accessibility Tests
 *
 * Comprehensive accessibility testing using Axe-core to ensure
 * WCAG 2.1 AA compliance for Shield UI components.
 */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const TEST_URL = process.env.TEST_URL || 'http://localhost:3000';

// Mock data for consistent testing
const mockShieldData = [
  {
    id: '1',
    action_type: 'block',
    content: 'Test content that was blocked',
    platform: 'twitter',
    reason: 'toxic',
    created_at: '2024-01-15T10:00:00Z',
    reverted_at: null,
    metadata: {}
  },
  {
    id: '2',
    action_type: 'mute',
    content: 'Test content that was muted',
    platform: 'youtube',
    reason: 'harassment',
    created_at: '2024-01-14T15:30:00Z',
    reverted_at: '2024-01-14T16:00:00Z',
    metadata: { reverted: true }
  }
];

test.describe('Shield UI Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for consistent testing
    await page.route('**/api/shield/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/events')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              events: mockShieldData,
              pagination: {
                page: 1,
                limit: 20,
                total: 2,
                totalPages: 1,
                hasNext: false,
                hasPrev: false
              }
            }
          })
        });
      } else if (url.includes('/config')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { enabled: true }
          })
        });
      }
    });

    // Mock feature flag check
    await page.route('**/feature_flags**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { enabled: true },
          error: null
        })
      });
    });
  });

  test('should pass accessibility audit for main Shield UI', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    // Wait for content to load
    await page.waitForSelector('text=Shield - Contenido Interceptado', { timeout: 10000 });

    // Run accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    await page.waitForSelector('h1', { timeout: 5000 });

    // Check heading structure
    const h1 = await page.locator('h1').count();
    const h2 = await page.locator('h2').count();
    const h3 = await page.locator('h3').count();

    expect(h1).toBeGreaterThan(0); // Should have at least one h1

    // Run specific heading accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['heading-order'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    // Wait for form elements
    await page.waitForSelector('select', { timeout: 5000 });

    // Run label accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['label', 'label-title-only'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper button accessibility', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    // Wait for buttons
    await page.waitForSelector('button', { timeout: 5000 });

    // Check that all buttons have accessible names
    const buttons = await page.locator('button').all();

    for (const button of buttons) {
      const accessibleName =
        (await button.getAttribute('aria-label')) ||
        (await button.getAttribute('title')) ||
        (await button.textContent());

      expect(accessibleName).toBeTruthy();
      expect(accessibleName.trim()).not.toBe('');
    }

    // Run button accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['button-name'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    await page.waitForSelector('text=Shield - Contenido Interceptado', { timeout: 5000 });

    // Run color contrast check
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should be navigable with keyboard', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    await page.waitForSelector('button:has-text("Actualizar")', { timeout: 5000 });

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.locator(':focus').first();
    expect(await focusedElement.isVisible()).toBe(true);

    // Continue tabbing through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = await page.locator(':focus').first();

      if ((await focusedElement.count()) > 0) {
        expect(await focusedElement.isVisible()).toBe(true);
      }
    }

    // Run keyboard accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['focusable-content'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    await page.waitForSelector('text=Shield - Contenido Interceptado', { timeout: 5000 });

    // Run ARIA accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules([
        'aria-allowed-attr',
        'aria-required-attr',
        'aria-valid-attr-value',
        'aria-valid-attr'
      ])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should handle revert dialog accessibility', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    // Wait for and click revert button
    await page.waitForSelector('button:has-text("Revertir")', { timeout: 5000 });
    await page.click('button:has-text("Revertir")');

    // Wait for dialog
    await page.waitForSelector('text=Confirmar reversión', { timeout: 3000 });

    // Check dialog accessibility
    const dialog = page.locator('[role="dialog"], .fixed.inset-0');

    // Dialog should be focused or have proper focus management
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['focus-order-semantics'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should provide proper error messaging accessibility', async ({ page }) => {
    // Mock error response
    await page.route('**/api/shield/events', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        status: 500,
        body: JSON.stringify({
          success: false,
          error: { message: 'Database connection failed' }
        })
      });
    });

    await page.goto(`${TEST_URL}/shield`);

    // Wait for error state
    await page.waitForSelector('text=Database connection failed', { timeout: 5000 });

    // Check error message accessibility
    const errorMessage = page.locator('text=Database connection failed');
    const errorContainer = errorMessage.locator('xpath=ancestor::div[contains(@class, "bg-red")]');

    // Error should be properly announced to screen readers
    expect(await errorContainer.isVisible()).toBe(true);

    // Run accessibility check on error state
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should handle loading state accessibility', async ({ page }) => {
    // Delay API response to capture loading state
    await page.route('**/api/shield/events', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { events: [], pagination: { total: 0 } }
        })
      });
    });

    await page.goto(`${TEST_URL}/shield`);

    // Check loading state accessibility
    await page.waitForSelector('.animate-pulse', { timeout: 1000 });

    // Loading indicators should not interfere with accessibility
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support screen reader navigation', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    await page.waitForSelector('text=Shield - Contenido Interceptado', { timeout: 5000 });

    // Check for proper semantic markup
    const main = await page.locator('main, [role="main"]').count();
    const nav = await page.locator('nav, [role="navigation"]').count();
    const buttons = await page.locator('button, [role="button"]').count();

    expect(buttons).toBeGreaterThan(0);

    // Run landmark accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page }).withRules(['region']).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should handle disabled state accessibility', async ({ page }) => {
    // Mock disabled feature flag
    await page.route('**/feature_flags**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { enabled: false },
          error: null
        })
      });
    });

    await page.goto(`${TEST_URL}/shield`);

    // Wait for disabled state
    await page.waitForSelector('text=Próximamente', { timeout: 5000 });

    // Check disabled state accessibility
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should handle pagination accessibility', async ({ page }) => {
    // Mock response with multiple pages
    await page.route('**/api/shield/events', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            events: mockShieldData,
            pagination: {
              page: 1,
              limit: 20,
              total: 50,
              totalPages: 3,
              hasNext: true,
              hasPrev: false
            }
          }
        })
      });
    });

    await page.goto(`${TEST_URL}/shield`);

    // Wait for pagination
    await page.waitForSelector('text=Página 1 de 3', { timeout: 5000 });

    // Check pagination accessibility
    const paginationButtons = page.locator(
      'button:has-text("Siguiente"), button:has-text("Anterior")'
    );
    expect(await paginationButtons.count()).toBeGreaterThan(0);

    // Run accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['button-name'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should handle mobile accessibility', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`${TEST_URL}/shield`);

    await page.waitForSelector('text=Shield - Contenido Interceptado', { timeout: 5000 });

    // Check mobile accessibility
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should provide comprehensive accessibility report', async ({ page }) => {
    await page.goto(`${TEST_URL}/shield`);

    await page.waitForSelector('text=Shield - Contenido Interceptado', { timeout: 5000 });

    // Run comprehensive accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
      .analyze();

    // Generate detailed report
    const report = {
      url: page.url(),
      timestamp: new Date().toISOString(),
      violationsCount: accessibilityScanResults.violations.length,
      passesCount: accessibilityScanResults.passes.length,
      incompleteCount: accessibilityScanResults.incomplete.length,
      violations: accessibilityScanResults.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.length
      }))
    };

    console.log('Accessibility Report:', JSON.stringify(report, null, 2));

    // Assert no violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
