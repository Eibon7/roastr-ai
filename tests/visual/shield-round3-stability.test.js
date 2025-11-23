/**
 * Shield UI Visual Stability Tests - CodeRabbit Round 3 Validation
 *
 * Tests to validate the stability improvements applied in Round 3:
 * - Fixed timezone and locale for consistent snapshots
 * - Reduced motion and stable color schemes
 * - Better async handling and network idle waits
 * - More resilient selectors with data-testid attributes
 * - Enhanced error handling and edge case coverage
 */

const { test, expect } = require('@playwright/test');

// Test configuration with Round 3 improvements
const TEST_URL = process.env.TEST_URL || 'http://localhost:3000';

// Mock data for consistent testing (Round 3 - Enhanced with proper UUIDs)
const mockShieldData = [
  {
    id: 'a1b2c3d4-e5f6-4789-abcd-123456789abc',
    action_type: 'block',
    content_hash: 'a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab',
    content_snippet: 'This is offensive content that was automatically blocked by Shield',
    platform: 'twitter',
    reason: 'toxic',
    created_at: '2024-01-15T10:00:00Z',
    reverted_at: null,
    metadata: {}
  },
  {
    id: 'f6e5d4c3-b2a1-4567-89ab-cdef12345678',
    action_type: 'mute',
    content_hash: 'f6e5d4c3b2a1567890abcdef1234567890abcdef1234567890abcdef1234567890cd',
    content_snippet: 'Another problematic comment that was muted',
    platform: 'youtube',
    reason: 'harassment',
    created_at: '2024-01-14T15:30:00Z',
    reverted_at: '2024-01-14T16:00:00Z',
    metadata: { reverted: true, revertReason: 'False positive' }
  }
];

test.describe('Shield UI Visual Stability - Round 3 Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Apply Round 3 stability improvements
    await page.addInitScript(() => {
      // Fix timezone to UTC for consistent timestamps (Round 3)
      Object.defineProperty(Intl, 'DateTimeFormat', {
        value: class extends Intl.DateTimeFormat {
          constructor(locale, options) {
            super('en-US', { ...options, timeZone: 'UTC' });
          }
        }
      });

      // Set stable locale (Round 3)
      Object.defineProperty(navigator, 'language', { value: 'en-US' });
      Object.defineProperty(navigator, 'languages', { value: ['en-US'] });

      // Fix Date constructor for consistent timestamps
      const OriginalDate = Date;
      Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super('2024-01-15T12:00:00.000Z'); // Fixed timestamp
          } else {
            super(...args);
          }
        }
        static now() {
          return new OriginalDate('2024-01-15T12:00:00.000Z').getTime();
        }
      };
    });

    // Reduce motion for stable animations (Round 3)
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-delay: 0.01ms !important;
          transition-duration: 0.01ms !important;
          transition-delay: 0.01ms !important;
        }
        
        /* Hide elements that cause visual instability */
        .animate-pulse { animation: none !important; }
        .animate-spin { animation: none !important; }
        
        /* Ensure consistent font rendering */
        * {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
      `
    });

    // Set stable color scheme (Round 3)
    await page.emulateMedia({ colorScheme: 'dark' });

    // Mock API responses with enhanced data (Round 3)
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
              },
              filters: {
                category: 'all',
                timeRange: '30d',
                platform: 'all',
                actionType: 'all'
              }
            }
          })
        });
      } else if (url.includes('/stats')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              total: 2,
              reverted: 1,
              active: 1,
              byActionType: { block: 1, mute: 1 },
              byPlatform: { twitter: 1, youtube: 1 },
              byReason: { toxic: 1, harassment: 1 },
              timeRange: '30d',
              generatedAt: '2024-01-15T12:00:00Z' // Fixed timestamp
            }
          })
        });
      } else if (url.includes('/config')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              enabled: true,
              features: {
                eventFiltering: true,
                revertActions: true,
                statistics: true
              },
              validation: {
                categories: ['all', 'toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'],
                timeRanges: ['7d', '30d', '90d', 'all'],
                platforms: [
                  'all',
                  'twitter',
                  'youtube',
                  'instagram',
                  'facebook',
                  'discord',
                  'twitch',
                  'reddit',
                  'tiktok',
                  'bluesky'
                ],
                actionTypes: ['all', 'block', 'mute', 'flag', 'report']
              }
            }
          })
        });
      } else if (url.includes('/revert/')) {
        // Mock successful revert
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              action: {
                id: 'a1b2c3d4-e5f6-4789-abcd-123456789abc',
                reverted_at: '2024-01-15T12:00:00Z'
              },
              message: 'Shield action reverted successfully'
            }
          })
        });
      }
    });

    // Mock feature flag check (Round 3)
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

  test.describe('Selector Resilience Validation (Round 3)', () => {
    test('should handle missing data-testid attributes gracefully', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      await page.waitForLoadState('networkidle');

      // Test fallback selectors when data-testid is not available
      const shieldIcon = page
        .locator('[data-testid="shield-icon"]')
        .or(page.locator('[aria-label*="Shield"]'));

      const shieldEvent = page
        .locator('[data-testid="shield-event"]')
        .or(page.locator('text=This is offensive content'));

      const revertButton = page
        .locator('[data-testid="revert-button"]')
        .or(page.locator('button:has-text("Revertir")'));

      // Verify fallback selectors work
      await expect(shieldIcon.or(page.locator('.shield-header'))).toBeVisible();
      await expect(shieldEvent.or(page.locator('.shield-event-item'))).toBeVisible();

      // Test multiple selector patterns
      const eventContainer = page
        .locator('[data-testid="shield-events-container"]')
        .or(
          page
            .locator('.shield-events')
            .or(page.locator('div:has(text="This is offensive content")'))
        );

      await expect(eventContainer).toBeVisible();
    });

    test('should handle dynamic content loading states', async ({ page }) => {
      // Delay API response to test loading states
      let resolveResponse;
      const responsePromise = new Promise((resolve) => {
        resolveResponse = resolve;
      });

      await page.route('**/api/shield/events', async (route) => {
        await responsePromise;
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { events: mockShieldData, pagination: { total: 2 } }
          })
        });
      });

      await page.goto(`${TEST_URL}/shield`);

      // Wait for loading indicators with multiple selector options
      const loadingIndicator = page
        .locator('[data-testid="loading-indicator"]')
        .or(
          page.locator('.animate-pulse').or(page.locator('.loading').or(page.locator('.spinner')))
        );

      // Should show loading state
      await expect(loadingIndicator.first()).toBeVisible({ timeout: 5000 });

      // Resolve the response
      resolveResponse();

      // Wait for content to load with resilient selectors
      await page.waitForSelector(
        '[data-testid="shield-event"], text=This is offensive content, .shield-event-item',
        { timeout: 10000 }
      );

      // Loading indicator should be gone
      await expect(loadingIndicator).not.toBeVisible();
    });
  });

  test.describe('Network Stability Validation (Round 3)', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network error
      await page.route('**/api/shield/events', async (route) => {
        await route.abort('failed');
      });

      await page.goto(`${TEST_URL}/shield`);
      await page.waitForLoadState('networkidle');

      // Should show error state with resilient selectors
      const errorMessage = page
        .locator('[data-testid="error-message"]')
        .or(
          page
            .locator('.error-message')
            .or(page.locator('text=Error').or(page.locator('[role="alert"]')))
        );

      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
    });

    test('should handle slow network responses', async ({ page }) => {
      // Mock slow response
      await page.route('**/api/shield/events', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { events: mockShieldData, pagination: { total: 2 } }
          })
        });
      });

      await page.goto(`${TEST_URL}/shield`);

      // Should eventually load content despite slow response
      await page.waitForSelector('[data-testid="shield-event"], text=This is offensive content', {
        timeout: 15000
      });

      const eventContent = page
        .locator('[data-testid="shield-event"]')
        .or(page.locator('text=This is offensive content'));

      await expect(eventContent.first()).toBeVisible();
    });
  });

  test.describe('Animation and Timing Stability (Round 3)', () => {
    test('should have consistent timing for interactive elements', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      await page.waitForLoadState('networkidle');

      // Wait for revert button with resilient selector
      const revertButton = page
        .locator('[data-testid="revert-button"]')
        .or(page.locator('button:has-text("Revertir")'));

      await expect(revertButton.first()).toBeVisible({ timeout: 10000 });

      // Click and wait for dialog with stable timing
      await revertButton.first().click();

      // Wait for dialog with multiple selector options
      const dialog = page
        .locator('[data-testid="revert-dialog"]')
        .or(page.locator('[role="dialog"]').or(page.locator('text=Confirmar reversión')));

      await expect(dialog.first()).toBeVisible({ timeout: 5000 });

      // Wait for animation completion (should be instant due to CSS override)
      await page.waitForTimeout(100);

      // Dialog should be stable
      await expect(dialog.first()).toBeVisible();
    });

    test('should handle focus states consistently', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      await page.waitForLoadState('networkidle');

      // Test focus on various elements with resilient selectors
      const focusableElements = [
        page
          .locator('[data-testid="refresh-button"]')
          .or(page.locator('button:has-text("Actualizar")')),
        page.locator('[data-testid="time-filter"]').or(page.locator('select').first()),
        page.locator('[data-testid="category-filter"]').or(page.locator('select').nth(1))
      ];

      for (const element of focusableElements) {
        if (await element.first().isVisible()) {
          await element.first().focus();
          await page.waitForTimeout(100); // Wait for focus styles

          // Verify element is focused (basic check)
          await expect(element.first()).toBeFocused();
        }
      }
    });
  });

  test.describe('Data Consistency Validation (Round 3)', () => {
    test('should display consistent timestamp formats', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      await page.waitForLoadState('networkidle');

      // Wait for events to load
      await page.waitForSelector('[data-testid="shield-event"], text=This is offensive content', {
        timeout: 10000
      });

      // Check for consistent timestamp display
      const timestamps = page
        .locator('[data-testid="event-timestamp"]')
        .or(page.locator('.timestamp').or(page.locator('time')));

      const timestampCount = await timestamps.count();
      if (timestampCount > 0) {
        for (let i = 0; i < timestampCount; i++) {
          const timestampText = await timestamps.nth(i).textContent();
          expect(timestampText).toBeTruthy();
          // Should follow consistent format (due to fixed timezone)
          expect(timestampText).toMatch(
            /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|hace \d+ (minuto|hora|día)s?/
          );
        }
      }
    });

    test('should handle empty states consistently', async ({ page }) => {
      // Mock empty response
      await page.route('**/api/shield/events', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              events: [],
              pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
              filters: { category: 'all', timeRange: '30d', platform: 'all' }
            }
          })
        });
      });

      await page.goto(`${TEST_URL}/shield`);
      await page.waitForLoadState('networkidle');

      // Should show consistent empty state
      const emptyState = page
        .locator('[data-testid="empty-state"]')
        .or(page.locator('text=No hay contenido interceptado').or(page.locator('.empty-state')));

      await expect(emptyState.first()).toBeVisible({ timeout: 10000 });

      // Verify consistent empty state content
      const emptyTitle = page
        .locator('[data-testid="empty-title"]')
        .or(page.locator('text=No hay contenido interceptado'));

      const emptyDescription = page
        .locator('[data-testid="empty-description"]')
        .or(page.locator('text=Aún no se ha interceptado ningún contenido'));

      await expect(emptyTitle.first()).toBeVisible();
      await expect(emptyDescription.first()).toBeVisible();
    });
  });

  test.describe('Filter Interaction Stability (Round 3)', () => {
    test('should handle filter changes without UI flicker', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      await page.waitForLoadState('networkidle');

      // Wait for filters to be available
      const timeFilter = page
        .locator('[data-testid="time-filter"]')
        .or(page.locator('select').first());

      await expect(timeFilter.first()).toBeVisible({ timeout: 10000 });

      // Change filter and verify no flicker
      await timeFilter.first().selectOption('7d');
      await page.waitForTimeout(200); // Brief wait for any updates

      // Content should still be visible (no flicker)
      const content = page
        .locator('[data-testid="shield-events-container"]')
        .or(page.locator('.shield-events').or(page.locator('main')));

      await expect(content.first()).toBeVisible();

      // Test another filter change
      const categoryFilter = page
        .locator('[data-testid="category-filter"]')
        .or(page.locator('select').nth(1));

      if (await categoryFilter.first().isVisible()) {
        await categoryFilter.first().selectOption('toxic');
        await page.waitForTimeout(200);

        // Content should remain stable
        await expect(content.first()).toBeVisible();
      }
    });
  });

  test.describe('Error Recovery Validation (Round 3)', () => {
    test('should recover from API errors gracefully', async ({ page }) => {
      let callCount = 0;

      // First call fails, second succeeds
      await page.route('**/api/shield/events', async (route) => {
        callCount++;
        if (callCount === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: { message: 'Temporary server error' }
            })
          });
        } else {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { events: mockShieldData, pagination: { total: 2 } }
            })
          });
        }
      });

      await page.goto(`${TEST_URL}/shield`);
      await page.waitForLoadState('networkidle');

      // Should show error initially
      const errorMessage = page
        .locator('[data-testid="error-message"]')
        .or(page.locator('text=error').or(page.locator('.error')));

      if (await errorMessage.first().isVisible()) {
        // Try to retry or refresh
        const retryButton = page
          .locator('[data-testid="retry-button"]')
          .or(
            page
              .locator('button:has-text("Reintentar")')
              .or(page.locator('button:has-text("Actualizar")'))
          );

        if (await retryButton.first().isVisible()) {
          await retryButton.first().click();

          // Should eventually show content
          await expect(
            page
              .locator('[data-testid="shield-event"]')
              .or(page.locator('text=This is offensive content'))
              .first()
          ).toBeVisible({ timeout: 10000 });
        }
      }
    });
  });
});
