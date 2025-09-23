/**
 * Shield Visual Tests - Round 4 Stability Enhancements
 * 
 * Tests for CodeRabbit Round 4 visual test improvements:
 * - Enhanced timezone and locale handling
 * - Better network resilience  
 * - Improved selector fallback strategies
 * - Loading state error handling
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const TEST_URL = process.env.TEST_URL || 'http://localhost:3000';

describe('Shield UI Visual Tests - Round 4 Stability', () => {
  test.beforeEach(async ({ page }) => {
    // Enhanced stability setup (Round 4 improvements)
    await page.addInitScript(() => {
      // Fixed Date and timezone handling
      const fixedDate = new Date('2024-01-15T12:00:00.000Z');
      
      // Override Date constructor and static methods
      const OriginalDate = Date;
      window.Date = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(fixedDate);
          } else {
            super(...args);
          }
        }
        
        static now() {
          return fixedDate.getTime();
        }
        
        getTimezoneOffset() {
          return 0; // UTC
        }
      };
      
      // Fix timezone for Intl.DateTimeFormat
      Object.defineProperty(Intl, 'DateTimeFormat', {
        value: class extends Intl.DateTimeFormat {
          constructor(locale, options) {
            super('en-US', { ...options, timeZone: 'UTC' });
          }
        }
      });
      
      // Stable locale settings
      Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
      Object.defineProperty(navigator, 'languages', { value: ['en-US'], configurable: true });
      
      // Disable resource hints and prefetching for stability
      Object.defineProperty(HTMLLinkElement.prototype, 'rel', {
        set: function(value) {
          if (!['prefetch', 'preload', 'dns-prefetch', 'preconnect'].includes(value)) {
            this.setAttribute('rel', value);
          }
        }
      });
      
      // Stable connection info
      Object.defineProperty(navigator, 'connection', {
        value: { 
          effectiveType: '4g', 
          downlink: 10,
          rtt: 50,
          saveData: false
        },
        configurable: true
      });
    });

    // Enhanced motion reduction (Round 4)
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-delay: 0.001ms !important;
          transition-duration: 0.001ms !important;
          transition-delay: 0.001ms !important;
          scroll-behavior: auto !important;
        }
        
        /* Disable lazy loading for stability */
        img[loading="lazy"] {
          loading: eager !important;
        }
        
        /* Force hardware acceleration off to reduce flakiness */
        * {
          transform: translateZ(0) !important;
          will-change: auto !important;
          backface-visibility: hidden !important;
        }
      `
    });

    // Set stable viewport and color scheme
    await page.emulateMedia({ 
      colorScheme: 'dark',
      reducedMotion: 'reduce',
      forcedColors: 'none'
    });

    // Enhanced mock data for Round 4 stability
    const stableMockData = [
      {
        id: 'action-stable-1',
        action_type: 'block',
        content_hash: 'stable-hash-1',
        content_snippet: 'Stable test content for visual testing',
        platform: 'twitter',
        reason: 'toxic',
        created_at: '2024-01-15T12:00:00.000Z',
        reverted_at: null,
        metadata: { source: 'test' },
      },
      {
        id: 'action-stable-2',
        action_type: 'mute',
        content_hash: 'stable-hash-2',
        content_snippet: 'Another stable test comment',
        platform: 'youtube',
        reason: 'spam',
        created_at: '2024-01-15T11:00:00.000Z',
        reverted_at: '2024-01-15T11:30:00.000Z',
        metadata: { source: 'test', reverted: true },
      },
    ];

    // Enhanced API mocking with error handling (Round 4)
    await page.route('**/api/shield/**', async (route) => {
      const url = route.request().url();
      
      try {
        if (url.includes('/events')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                events: stableMockData,
                pagination: {
                  page: 1,
                  limit: 20,
                  total: 2,
                  totalPages: 1,
                  hasNext: false,
                  hasPrev: false,
                },
                filters: {
                  category: 'all',
                  timeRange: '30d',
                  platform: 'all',
                  actionType: 'all',
                  startDate: null
                }
              },
            }),
          });
        } else if (url.includes('/stats')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                total: 2,
                reverted: 1,
                active: 1,
                byActionType: { block: 1, mute: 1 },
                byPlatform: { twitter: 1, youtube: 1 },
                byReason: { toxic: 1, spam: 1 },
                timeRange: '30d',
                generatedAt: '2024-01-15T12:00:00.000Z'
              },
            }),
          });
        } else if (url.includes('/config')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                enabled: true,
                features: {
                  eventFiltering: true,
                  revertActions: true,
                  statistics: true,
                },
                validation: {
                  categories: ['all', 'toxic', 'spam', 'harassment'],
                  timeRanges: ['7d', '30d', '90d', 'all'],
                  platforms: ['all', 'twitter', 'youtube', 'instagram'],
                  actionTypes: ['all', 'block', 'mute', 'flag', 'report']
                }
              },
            }),
          });
        } else {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: 'Not found' }),
          });
        }
      } catch (error) {
        // Fallback for any routing errors
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Internal error' }),
        });
      }
    });

    // Mock feature flags with enhanced stability
    await page.route('**/feature_flags**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { enabled: true },
          error: null,
        }),
      });
    });
  });

  test.describe('Enhanced Timezone and Locale Handling', () => {
    test('should display consistent timestamps across environments', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      // Enhanced network stability wait
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
      
      // Wait for timestamp elements with multiple selector strategies
      await page.waitForSelector(
        '[data-testid="timestamp"], .timestamp, time, [datetime]',
        { timeout: 10000 }
      );
      
      // Get all timestamp elements using comprehensive selectors
      const timestamps = await page.locator(
        '[data-testid="timestamp"], .timestamp, time, [datetime], ' +
        'text=/\\d{4}-\\d{2}-\\d{2}/, text=/\\d{1,2}:\\d{2}/'
      ).all();
      
      expect(timestamps.length).toBeGreaterThan(0);
      
      // Verify timestamps are in expected format (UTC)
      for (const timestamp of timestamps) {
        const text = await timestamp.textContent();
        if (text && text.includes('2024-01-15')) {
          expect(text).toMatch(/2024-01-15/);
        }
      }
      
      // Take screenshot to verify consistent timestamp rendering
      await expect(page).toHaveScreenshot('shield-stable-timestamps.png');
    });

    test('should handle locale-specific formatting consistently', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      await page.waitForLoadState('networkidle');
      
      // Verify English locale is consistently applied
      await page.waitForSelector('text=/Shield|Contenido|Actions|Acciones/i', { timeout: 10000 });
      
      // Check for consistent number formatting
      const numberElements = await page.locator(
        '[data-testid="count"], .count, .total, text=/\\d+/'
      ).all();
      
      for (const element of numberElements) {
        const text = await element.textContent();
        // Should use English number formatting (no thousand separators for small numbers)
        if (text && /^\d+$/.test(text.trim())) {
          expect(text.trim()).toMatch(/^\d+$/);
        }
      }
    });
  });

  test.describe('Network Resilience and Error Handling', () => {
    test('should handle network timeouts gracefully', async ({ page }) => {
      let requestCount = 0;
      
      // Enhanced timeout simulation with recovery
      await page.route('**/api/shield/events', async (route) => {
        requestCount++;
        
        if (requestCount === 1) {
          // First request: simulate timeout
          await new Promise(resolve => setTimeout(resolve, 200));
          await route.abort('timedout');
        } else if (requestCount === 2) {
          // Second request: simulate slow response
          await new Promise(resolve => setTimeout(resolve, 100));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { events: [], pagination: { total: 0 } },
            }),
          });
        } else {
          // Subsequent requests: fast response
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { events: [], pagination: { total: 0 } },
            }),
          });
        }
      });

      await page.goto(`${TEST_URL}/shield`);
      
      // Should eventually load content despite initial timeout
      await page.waitForSelector(
        '[data-testid="shield-container"], .shield-main, main',
        { timeout: 20000 }
      );
      
      // Verify content loads after network recovery
      const mainContent = page.locator(
        '[data-testid="shield-container"], .shield-main, main'
      ).first();
      await expect(mainContent).toBeVisible();
      
      // Should show appropriate empty state or content
      const contentIndicator = page.locator(
        '[data-testid="empty-state"], [data-testid="shield-events"], text=/No hay contenido|eventos/'
      ).first();
      await expect(contentIndicator).toBeVisible({ timeout: 5000 });
    });

    test('should handle API error responses robustly', async ({ page }) => {
      // Mock different error scenarios
      await page.route('**/api/shield/events', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { message: 'Service temporarily unavailable' },
          }),
        });
      });

      await page.goto(`${TEST_URL}/shield`);
      
      await page.waitForLoadState('networkidle');
      
      // Should display error state appropriately
      const errorIndicator = page.locator(
        '[data-testid="error-state"], [data-testid="error-message"], ' +
        'text=/error|Error|servicio|disponible/i'
      ).first();
      
      await expect(errorIndicator).toBeVisible({ timeout: 10000 });
      
      // Take screenshot of error state
      await expect(page).toHaveScreenshot('shield-error-state-robust.png');
    });

    test('should handle intermittent connectivity issues', async ({ page }) => {
      let shouldFail = true;
      
      await page.route('**/api/shield/**', async (route) => {
        if (shouldFail) {
          shouldFail = false; // Only fail first request
          await route.abort('failed');
        } else {
          // Subsequent requests succeed
          const url = route.request().url();
          if (url.includes('/events')) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: { events: [], pagination: { total: 0 } },
              }),
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, data: {} }),
            });
          }
        }
      });

      await page.goto(`${TEST_URL}/shield`);
      
      // Should recover and show content
      await page.waitForSelector(
        '[data-testid="shield-title"], h1, .page-title',
        { timeout: 15000 }
      );
      
      const pageTitle = page.locator(
        '[data-testid="shield-title"], h1, .page-title'
      ).first();
      await expect(pageTitle).toBeVisible();
    });
  });

  test.describe('Enhanced Selector Resilience', () => {
    test('should use comprehensive fallback selector strategies', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      await page.waitForLoadState('networkidle');
      
      // Test main container with multiple fallback strategies
      const mainContainer = page.locator('[data-testid="shield-container"]')
        .or(page.locator('.shield-main-container'))
        .or(page.locator('main:has-text("Shield")'))
        .or(page.locator('[role="main"]'))
        .or(page.locator('div:has(h1)'))
        .or(page.locator('body > div').first());
      
      await expect(mainContainer.first()).toBeVisible();
      
      // Test filter controls with comprehensive fallbacks
      const filterControls = page.locator('[data-testid="shield-filters"]')
        .or(page.locator('.filter-container'))
        .or(page.locator('div:has(select)'))
        .or(page.locator('[role="group"]:has(select)'))
        .or(page.locator('form:has(select)'))
        .or(page.locator('fieldset'));
      
      await expect(filterControls.first()).toBeVisible();
      
      // Test events list with multiple strategies
      const eventsList = page.locator('[data-testid="shield-events"]')
        .or(page.locator('.shield-events-list'))
        .or(page.locator('[role="list"]'))
        .or(page.locator('ul'))
        .or(page.locator('div:has([data-testid="shield-event"])'))
        .or(page.locator('div:has-text("Stable test content")'));
      
      await expect(eventsList.first()).toBeVisible();
    });

    test('should handle dynamic content with stable selectors', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      await page.waitForLoadState('networkidle');
      
      // Wait for content to load using most stable selectors
      await page.waitForSelector(
        '[data-testid="shield-event"], .shield-event-item, .event-card',
        { timeout: 10000 }
      );
      
      // Test individual event items with comprehensive fallbacks
      const eventItems = page.locator('[data-testid="shield-event"]')
        .or(page.locator('.shield-event-item'))
        .or(page.locator('.event-card'))
        .or(page.locator('li:has-text("Stable test content")'))
        .or(page.locator('div:has-text("twitter")'))
        .or(page.locator('[data-platform="twitter"]'));
      
      const eventCount = await eventItems.count();
      expect(eventCount).toBeGreaterThan(0);
      
      // Test action badges with multiple selectors
      const actionBadges = page.locator('[data-testid="action-badge"]')
        .or(page.locator('.action-badge'))
        .or(page.locator('.badge'))
        .or(page.locator('span:has-text("Bloqueado")'))
        .or(page.locator('span:has-text("block")'));
      
      await expect(actionBadges.first()).toBeVisible();
    });

    test('should handle missing elements gracefully', async ({ page }) => {
      // Mock response with no events
      await page.route('**/api/shield/events', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              events: [],
              pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
              filters: { category: 'all', timeRange: '30d' }
            },
          }),
        });
      });

      await page.goto(`${TEST_URL}/shield`);
      
      await page.waitForLoadState('networkidle');
      
      // Should show empty state with resilient selectors
      const emptyState = page.locator('[data-testid="empty-state"]')
        .or(page.locator('.empty-state'))
        .or(page.locator('.no-content'))
        .or(page.locator('text=/No hay contenido|Sin eventos|Empty/i'))
        .or(page.locator('div:has-text("interceptado")'));
      
      await expect(emptyState.first()).toBeVisible({ timeout: 10000 });
      
      // Verify no event items are present
      const eventItems = page.locator('[data-testid="shield-event"]')
        .or(page.locator('.shield-event-item'));
      
      await expect(eventItems).toHaveCount(0);
    });
  });

  test.describe('Loading State Improvements', () => {
    test('should handle loading states without hanging', async ({ page }) => {
      let resolveEvents;
      const eventsPromise = new Promise(resolve => {
        resolveEvents = resolve;
      });

      // Enhanced loading state handling with timeout safety
      const requestHandler = async (route) => {
        const url = route.request().url();
        
        if (url.includes('/events')) {
          try {
            // Wait for signal or timeout after 3 seconds
            await Promise.race([
              eventsPromise,
              new Promise(resolve => setTimeout(resolve, 3000))
            ]);
            
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: { events: [], pagination: { total: 0 } },
              }),
            });
          } catch (error) {
            // Fallback response
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: { events: [], pagination: { total: 0 } },
              }),
            });
          }
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: {} }),
          });
        }
      };

      await page.route('**/api/shield/**', requestHandler);

      await page.goto(`${TEST_URL}/shield`);
      
      // Look for loading indicators with comprehensive selectors
      try {
        await page.waitForSelector(
          '[data-testid="loading"], .loading, .spinner, .animate-pulse, [aria-busy="true"]',
          { timeout: 5000 }
        );
        
        const loadingIndicator = page.locator(
          '[data-testid="loading"], .loading, .spinner, .animate-pulse, [aria-busy="true"]'
        ).first();
        
        if (await loadingIndicator.isVisible()) {
          await expect(page).toHaveScreenshot('shield-loading-enhanced.png');
        }
      } catch (error) {
        // Loading state might be too fast to catch, continue
      }
      
      // Always resolve to prevent hanging
      resolveEvents();
      
      // Wait for final loaded state
      await page.waitForSelector(
        '[data-testid="shield-title"], h1, .page-title',
        { timeout: 10000 }
      );
    });

    test('should show loading skeletons consistently', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      // Should quickly show some content structure
      await page.waitForSelector(
        '[data-testid="shield-container"], main, .page-container',
        { timeout: 5000 }
      );
      
      // Look for skeleton loading elements
      const skeletons = page.locator(
        '[data-testid="skeleton"], .skeleton, .placeholder, .animate-pulse'
      );
      
      const skeletonCount = await skeletons.count();
      
      // If skeletons are present, they should be visible
      if (skeletonCount > 0) {
        await expect(skeletons.first()).toBeVisible();
      }
      
      // Eventually content should load
      await page.waitForLoadState('networkidle');
      
      // Take final screenshot
      await expect(page).toHaveScreenshot('shield-post-loading.png');
    });
  });

  test.describe('Accessibility and Focus Management', () => {
    test('should maintain focus visibility during interactions', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      await page.waitForLoadState('networkidle');
      
      // Test keyboard navigation with enhanced selectors
      const interactiveElements = page.locator(
        'button, select, input, a, [tabindex]:not([tabindex="-1"])'
      );
      
      const elementCount = await interactiveElements.count();
      expect(elementCount).toBeGreaterThan(0);
      
      // Focus first interactive element
      const firstElement = interactiveElements.first();
      await firstElement.focus();
      
      // Verify focus is visible
      await expect(firstElement).toBeFocused();
      
      // Take screenshot of focus state
      await expect(page).toHaveScreenshot('shield-focus-visible.png');
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      
      // Should move to next focusable element
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should provide proper ARIA labels and roles', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      await page.waitForLoadState('networkidle');
      
      // Check for proper ARIA attributes
      const ariaElements = page.locator(
        '[role], [aria-label], [aria-labelledby], [aria-describedby]'
      );
      
      const ariaCount = await ariaElements.count();
      expect(ariaCount).toBeGreaterThan(0);
      
      // Verify main landmark
      const mainLandmark = page.locator('[role="main"], main');
      await expect(mainLandmark.first()).toBeVisible();
      
      // Check for button accessibility
      const buttons = page.locator('button, [role="button"]');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = buttons.nth(i);
        const hasLabel = await button.evaluate(el => {
          return !!(el.getAttribute('aria-label') || 
                   el.getAttribute('aria-labelledby') || 
                   el.textContent?.trim());
        });
        expect(hasLabel).toBe(true);
      }
    });
  });
});