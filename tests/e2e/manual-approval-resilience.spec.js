/**
 * E2E Tests: Manual Approval UI Resilience
 * Issue #419: Verify UI resilience for timeouts, network errors, and variants exhaustion
 *
 * Test Coverage:
 * - AC #1: Timeout handling with clear message and retry
 * - AC #2: Network error handling for approval/publishing
 * - AC #3: "No more variants" scenario handled gracefully
 * - AC #4: Clear and actionable error messages
 * - AC #5: Retry functionality available where appropriate
 *
 * @requires @playwright/test
 */

const { test, expect } = require('@playwright/test');
const { createMockServer } = require('./fixtures/mock-server');
const {
  waitForErrorMessage,
  waitForSuccessMessage,
  waitForLoadingToComplete,
  isVisibleWithinTimeout,
  measureDuration,
} = require('./helpers/timeout-helpers');

/**
 * Test Suite: Manual Approval UI - Resilience
 * Tests error handling, timeouts, and recovery mechanisms
 */
test.describe('Manual Approval UI - Resilience', () => {
  let mockServer;

  /**
   * Setup: Initialize mock server before each test
   */
  test.beforeEach(async ({ page }) => {
    mockServer = createMockServer(page);

    // Mock successful pending roasts endpoint (default state)
    await mockServer.mockPendingRoasts([
      {
        id: 'roast_test_1',
        comment: 'Este es un comentario tóxico para testing',
        roast: 'Esta es una respuesta ingeniosa de prueba',
        platform: 'twitter',
        toxicity_score: 0.85,
        created_at: new Date().toISOString(),
      },
    ]);
  });

  /**
   * Cleanup: Clear all mocks after each test
   */
  test.afterEach(async () => {
    if (mockServer) {
      await mockServer.clearAll();
    }
  });

  /**
   * ==============================================
   * AC #1: Timeout Handling
   * ==============================================
   */
  test.describe('AC #1: Timeout Handling', () => {
    test('should show clear timeout message after 30s', async ({ page }) => {
      // Mock timeout for variant generation (31s delay)
      await mockServer.mockTimeout('**/api/approval/*/regenerate', 31000);

      // Navigate to manual approval UI
      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Trigger variant generation
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();

      // Wait for timeout error message (up to 35s)
      const errorText = await waitForErrorMessage(page, 35000);

      // Assert clear timeout message
      expect(errorText).toContain('tardó demasiado');
      expect(errorText.toLowerCase()).toContain('intenta');

      // Assert retry button is visible
      const retryBtn = page.locator('[data-testid="retry-btn"]');
      const isRetryVisible = await isVisibleWithinTimeout(page, '[data-testid="retry-btn"]', 5000);
      expect(isRetryVisible).toBe(true);

      // Screenshot for evidence
      await page.screenshot({
        path: 'docs/test-evidence/issue-419/timeout-error.png',
        fullPage: true,
      });
    });

    test('should allow retry after timeout', async ({ page }) => {
      let attemptCount = 0;

      // Mock first call times out, second call succeeds
      await page.route('**/api/approval/*/regenerate', async (route) => {
        attemptCount++;

        if (attemptCount === 1) {
          // First attempt: timeout
          await new Promise((resolve) => setTimeout(resolve, 31000));
          await route.fulfill({
            status: 408,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'TIMEOUT',
              message: 'Request timeout',
              code: 'E_TIMEOUT',
            }),
          });
        } else {
          // Second attempt: success
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              variant: {
                id: 'variant_success',
                text: 'Este es el roast generado después del retry',
                created_at: new Date().toISOString(),
              },
            }),
          });
        }
      });

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Trigger variant generation (first attempt)
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();

      // Wait for timeout error
      await waitForErrorMessage(page, 35000);

      // Click retry button
      const retryBtn = page.locator('[data-testid="retry-btn"]');
      await retryBtn.click();

      // Wait for success (variant should appear)
      await page.waitForSelector('.variant-text', { timeout: 10000 });

      const variantText = await page.textContent('.variant-text');
      expect(variantText).toContain('roast generado');
      expect(attemptCount).toBe(2);

      // Screenshot success state
      await page.screenshot({
        path: 'docs/test-evidence/issue-419/timeout-retry-success.png',
        fullPage: true,
      });
    });

    test('should not hang indefinitely on timeout', async ({ page }) => {
      // Mock very long timeout
      await mockServer.mockTimeout('**/api/approval/*/regenerate', 31000);

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Measure duration of timeout handling
      const { duration } = await measureDuration(async () => {
        const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
        await generateBtn.click();
        await waitForErrorMessage(page, 35000);
      });

      // Assert operation completed within reasonable time (< 35s)
      expect(duration).toBeLessThan(35000);
      expect(duration).toBeGreaterThan(30000); // Should actually wait ~30s

      console.log(`✓ Timeout triggered correctly after ${duration}ms`);
    });
  });

  /**
   * ==============================================
   * AC #2: Network Error Handling
   * ==============================================
   */
  test.describe('AC #2: Network Error Handling', () => {
    test('should handle network error during approval', async ({ page }) => {
      // Mock network error for approval endpoint
      await mockServer.mockNetworkError('**/api/approval/*/approve');

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Click approve button
      const approveBtn = page.locator('[data-testid="approve-btn"]').first();
      await approveBtn.click();

      // Wait for error message
      const errorText = await waitForErrorMessage(page, 10000);

      // Assert user-friendly error message
      expect(errorText.toLowerCase()).toContain('error');
      expect(errorText.toLowerCase()).toContain('red' || 'conexión');

      // Assert UI state remains intact (button still visible and enabled)
      await expect(approveBtn).toBeVisible();
      await expect(approveBtn).toBeEnabled();

      // Assert retry button is available
      const isRetryVisible = await isVisibleWithinTimeout(page, '[data-testid="retry-btn"]', 5000);
      expect(isRetryVisible).toBe(true);

      // Screenshot
      await page.screenshot({
        path: 'docs/test-evidence/issue-419/network-error-approval.png',
        fullPage: true,
      });
    });

    test('should handle network error during variant generation', async ({ page }) => {
      // Mock network error for variant generation
      await mockServer.mockNetworkError('**/api/approval/*/regenerate');

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Trigger variant generation
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();

      // Wait for error message
      const errorText = await waitForErrorMessage(page, 10000);

      // Assert error message contains network context
      expect(errorText.toLowerCase()).toContain('error');

      // Assert retry button available
      const isRetryVisible = await isVisibleWithinTimeout(page, '[data-testid="retry-btn"]', 5000);
      expect(isRetryVisible).toBe(true);

      // Screenshot
      await page.screenshot({
        path: 'docs/test-evidence/issue-419/network-error-variant.png',
        fullPage: true,
      });
    });

    test('should handle network error during rejection', async ({ page }) => {
      // Mock network error for rejection endpoint
      await mockServer.mockNetworkError('**/api/approval/*/reject');

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Click reject button
      const rejectBtn = page.locator('[data-testid="reject-btn"]').first();
      await rejectBtn.click();

      // Wait for error message
      const errorText = await waitForErrorMessage(page, 10000);

      // Assert error message
      expect(errorText.toLowerCase()).toContain('error');

      // Assert UI state intact
      await expect(rejectBtn).toBeVisible();
      await expect(rejectBtn).toBeEnabled();

      // Screenshot
      await page.screenshot({
        path: 'docs/test-evidence/issue-419/network-error-reject.png',
        fullPage: true,
      });
    });

    test('should recover from transient network error on retry', async ({ page }) => {
      // Mock fail then success
      await mockServer.mockFailThenSuccess(
        '**/api/approval/*/regenerate',
        {
          status: 500,
          body: { error: 'Network error', message: 'Connection failed' },
        },
        {
          status: 200,
          body: {
            variant: {
              id: 'variant_recovered',
              text: 'Roast generado después de recuperarse del error',
              created_at: new Date().toISOString(),
            },
          },
        }
      );

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // First attempt fails
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();
      await waitForErrorMessage(page, 10000);

      // Retry succeeds
      const retryBtn = page.locator('[data-testid="retry-btn"]');
      await retryBtn.click();

      // Wait for success
      await page.waitForSelector('.variant-text', { timeout: 10000 });
      const variantText = await page.textContent('.variant-text');
      expect(variantText).toContain('Roast generado');

      console.log('✓ Successfully recovered from transient network error');
    });
  });

  /**
   * ==============================================
   * AC #3: "No More Variants" Scenario
   * ==============================================
   */
  test.describe('AC #3: No More Variants Scenario', () => {
    test('should handle variant exhaustion gracefully', async ({ page }) => {
      // Mock variant exhaustion (429)
      await mockServer.mockVariantExhaustion();

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Trigger variant generation
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();

      // Wait for error message
      const errorText = await waitForErrorMessage(page, 10000);

      // Assert specific "no more variants" message
      expect(errorText.toLowerCase()).toContain('no' && 'más' && 'variante');
      expect(errorText.toLowerCase()).toContain('aprobar' || 'rechazar');

      // Assert variant button is disabled
      await expect(generateBtn).toBeDisabled();

      // Assert approve/reject buttons still enabled
      const approveBtn = page.locator('[data-testid="approve-btn"]').first();
      const rejectBtn = page.locator('[data-testid="reject-btn"]').first();

      await expect(approveBtn).toBeEnabled();
      await expect(rejectBtn).toBeEnabled();

      // Assert NO retry button (non-recoverable error)
      const isRetryVisible = await isVisibleWithinTimeout(page, '[data-testid="retry-btn"]', 3000);
      expect(isRetryVisible).toBe(false);

      // Screenshot
      await page.screenshot({
        path: 'docs/test-evidence/issue-419/variants-exhausted.png',
        fullPage: true,
      });
    });

    test('should allow approval even when variants exhausted', async ({ page }) => {
      // Mock variant exhaustion
      await mockServer.mockVariantExhaustion();

      // Mock successful approval
      await mockServer.mockSuccessfulApproval();

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Try to generate variant (fails)
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();
      await waitForErrorMessage(page, 10000);

      // Approve anyway
      const approveBtn = page.locator('[data-testid="approve-btn"]').first();
      await approveBtn.click();

      // Wait for success message
      const successText = await waitForSuccessMessage(page, 10000);
      expect(successText).toContain('aprobado' || 'publicado');

      console.log('✓ Approval succeeded even with variant exhaustion');
    });

    test('should allow rejection even when variants exhausted', async ({ page }) => {
      // Mock variant exhaustion
      await mockServer.mockVariantExhaustion();

      // Mock successful rejection
      await mockServer.mockSuccessfulRejection();

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Try to generate variant (fails)
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();
      await waitForErrorMessage(page, 10000);

      // Reject anyway
      const rejectBtn = page.locator('[data-testid="reject-btn"]').first();
      await rejectBtn.click();

      // Wait for success message
      const successText = await waitForSuccessMessage(page, 10000);
      expect(successText).toContain('rechazado');

      console.log('✓ Rejection succeeded even with variant exhaustion');
    });
  });

  /**
   * ==============================================
   * AC #4: Clear and Actionable Error Messages
   * ==============================================
   */
  test.describe('AC #4: Clear and Actionable Error Messages', () => {
    test('should display actionable error messages with context', async ({ page }) => {
      const errorScenarios = [
        {
          endpoint: '**/api/approval/*/regenerate',
          action: async () => {
            await page.locator('[data-testid="generate-variant-btn"]').first().click();
          },
          expectedKeywords: ['generar', 'variante'],
        },
        {
          endpoint: '**/api/approval/*/approve',
          action: async () => {
            await page.locator('[data-testid="approve-btn"]').first().click();
          },
          expectedKeywords: ['aprobar'],
        },
        {
          endpoint: '**/api/approval/*/reject',
          action: async () => {
            await page.locator('[data-testid="reject-btn"]').first().click();
          },
          expectedKeywords: ['rechazar'],
        },
      ];

      for (const scenario of errorScenarios) {
        // Mock network error for this endpoint
        await mockServer.mockNetworkError(scenario.endpoint);

        await page.goto('/manual-approval.html');
        await waitForLoadingToComplete(page);

        // Trigger action
        await scenario.action();

        // Wait for error message
        const errorText = await waitForErrorMessage(page, 10000);

        // Assert message includes context
        const hasContext = scenario.expectedKeywords.some((keyword) =>
          errorText.toLowerCase().includes(keyword)
        );
        expect(hasContext).toBe(true);

        // Assert message is user-friendly
        expect(errorText.length).toBeGreaterThan(10); // Not empty
        expect(errorText.length).toBeLessThan(200); // Not too long

        // Clear mocks for next iteration
        await mockServer.clearAll();
        await mockServer.mockPendingRoasts([
          {
            id: 'roast_test_1',
            comment: 'Test comment',
            roast: 'Test roast',
            platform: 'twitter',
            created_at: new Date().toISOString(),
          },
        ]);
      }

      console.log('✓ All error messages contain appropriate context');
    });

    test('should not leak sensitive information in error messages', async ({ page }) => {
      // Mock server error with sensitive details
      await page.route('**/api/approval/*/regenerate', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Database connection failed: host=db.internal.roastr.com port=5432',
            message: 'Internal server error at /api/manual-approval/variants',
            stack: 'Error at roastGenerator.js:150:12...',
            apiKey: 'sk-abc123...',
          }),
        });
      });

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Trigger variant generation
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();

      // Wait for error message
      const errorText = await waitForErrorMessage(page, 10000);

      // Assert NO sensitive information leaked
      expect(errorText.toLowerCase()).not.toContain('database');
      expect(errorText.toLowerCase()).not.toContain('db.internal');
      expect(errorText.toLowerCase()).not.toContain('port');
      expect(errorText.toLowerCase()).not.toContain('stack');
      expect(errorText.toLowerCase()).not.toContain('sk-');
      expect(errorText.toLowerCase()).not.toContain('apikey');

      // Assert generic message instead
      expect(errorText.toLowerCase()).toContain('error' || 'servidor');

      console.log('✓ No sensitive information leaked in error message');

      // Screenshot
      await page.screenshot({
        path: 'docs/test-evidence/issue-419/no-sensitive-info-leaked.png',
        fullPage: true,
      });
    });

    test('should provide clear guidance on what to do next', async ({ page }) => {
      // Mock timeout error
      await mockServer.mockTimeout('**/api/approval/*/regenerate', 31000);

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Trigger timeout
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();
      const errorText = await waitForErrorMessage(page, 35000);

      // Assert message provides guidance
      const hasGuidance =
        errorText.toLowerCase().includes('intenta') ||
        errorText.toLowerCase().includes('retry') ||
        errorText.toLowerCase().includes('reintentar');

      expect(hasGuidance).toBe(true);

      console.log('✓ Error message provides clear next-step guidance');
    });
  });

  /**
   * ==============================================
   * AC #5: Retry Functionality
   * ==============================================
   */
  test.describe('AC #5: Retry Functionality', () => {
    test('should show retry button for recoverable errors', async ({ page }) => {
      const recoverableErrors = [
        {
          name: 'timeout',
          setup: async () => {
            await mockServer.mockTimeout('**/api/approval/*/regenerate', 31000);
          },
          trigger: async () => {
            await page.locator('[data-testid="generate-variant-btn"]').first().click();
          },
          waitTime: 35000,
        },
        {
          name: 'network error',
          setup: async () => {
            await mockServer.mockNetworkError('**/api/approval/*/regenerate');
          },
          trigger: async () => {
            await page.locator('[data-testid="generate-variant-btn"]').first().click();
          },
          waitTime: 10000,
        },
        {
          name: '503 service unavailable',
          setup: async () => {
            await mockServer.mockEndpoint('POST', '**/api/approval/*/regenerate', {
              status: 503,
              body: { error: 'Service temporarily unavailable' },
            });
          },
          trigger: async () => {
            await page.locator('[data-testid="generate-variant-btn"]').first().click();
          },
          waitTime: 10000,
        },
      ];

      for (const errorType of recoverableErrors) {
        await errorType.setup();

        await page.goto('/manual-approval.html');
        await waitForLoadingToComplete(page);

        await errorType.trigger();
        await waitForErrorMessage(page, errorType.waitTime);

        // Assert retry button visible
        const isRetryVisible = await isVisibleWithinTimeout(page, '[data-testid="retry-btn"]', 5000);
        expect(isRetryVisible).toBe(true);

        console.log(`✓ Retry button shown for: ${errorType.name}`);

        // Clean up for next iteration
        await mockServer.clearAll();
        await mockServer.mockPendingRoasts([
          {
            id: 'roast_test_1',
            comment: 'Test',
            roast: 'Test roast',
            platform: 'twitter',
            created_at: new Date().toISOString(),
          },
        ]);
      }
    });

    test('should NOT show retry button for non-recoverable errors', async ({ page }) => {
      // Mock variant exhaustion (429 - non-recoverable)
      await mockServer.mockVariantExhaustion();

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // Trigger variant generation
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();

      // Wait for error message
      await waitForErrorMessage(page, 10000);

      // Assert NO retry button
      const isRetryVisible = await isVisibleWithinTimeout(page, '[data-testid="retry-btn"]', 3000);
      expect(isRetryVisible).toBe(false);

      console.log('✓ Retry button correctly hidden for non-recoverable error (variant exhaustion)');
    });

    test('should successfully re-attempt operation on retry', async ({ page }) => {
      let attemptCount = 0;

      // Mock fail on first call, success on retry
      await page.route('**/api/approval/*/regenerate', async (route) => {
        attemptCount++;

        if (attemptCount === 1) {
          // First attempt: fail
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Temporary server error',
            }),
          });
        } else {
          // Retry: success
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              variant: {
                id: 'variant_retry_success',
                text: 'Roast generado exitosamente después del retry',
                created_at: new Date().toISOString(),
              },
            }),
          });
        }
      });

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // First attempt
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();
      await waitForErrorMessage(page, 10000);

      // Retry
      const retryBtn = page.locator('[data-testid="retry-btn"]');
      await retryBtn.click();

      // Wait for success
      await page.waitForSelector('.variant-text', { timeout: 10000 });
      const variantText = await page.textContent('.variant-text');

      expect(variantText).toContain('Roast generado');
      expect(attemptCount).toBe(2);

      console.log('✓ Retry successfully re-attempted operation and succeeded');

      // Screenshot success state
      await page.screenshot({
        path: 'docs/test-evidence/issue-419/retry-success-final.png',
        fullPage: true,
      });
    });

    test('should not duplicate operations on retry', async ({ page }) => {
      let attemptCount = 0;

      await page.route('**/api/approval/*/regenerate', async (route) => {
        attemptCount++;

        if (attemptCount === 1) {
          await route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Temporary error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            body: JSON.stringify({
              variant: {
                id: `variant_${attemptCount}`,
                text: `Variant ${attemptCount}`,
                created_at: new Date().toISOString(),
              },
            }),
          });
        }
      });

      await page.goto('/manual-approval.html');
      await waitForLoadingToComplete(page);

      // First attempt
      const generateBtn = page.locator('[data-testid="generate-variant-btn"]').first();
      await generateBtn.click();
      await waitForErrorMessage(page, 10000);

      // Retry once
      const retryBtn = page.locator('[data-testid="retry-btn"]');
      await retryBtn.click();
      await page.waitForSelector('.variant-text', { timeout: 10000 });

      // Assert only 2 attempts (initial + 1 retry)
      expect(attemptCount).toBe(2);

      console.log('✓ Retry did not duplicate operation (only 2 attempts total)');
    });
  });
});
