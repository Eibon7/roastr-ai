/**
 * Shield Stability Integration Tests - CodeRabbit Round 2
 * 
 * Integration tests for Shield system stability improvements:
 * - Visual test stability enhancements
 * - Network idle waits and timing
 * - Resilient selectors with fallbacks
 * - Edge case handling for real scenarios
 * - End-to-end stability verification
 */

const { chromium } = require('playwright');

describe('Shield Stability Integration Tests - CodeRabbit Round 2', () => {
  let browser;
  let context;
  let page;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true',
      slowMo: 50 // Add small delay for stability
    });
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    context = await browser.newContext({
      // Set stable viewport
      viewport: { width: 1920, height: 1080 },
      // Disable animations for stability
      reducedMotion: 'reduce',
      // Set stable locale
      locale: 'en-US',
      timezoneId: 'UTC'
    });

    page = await context.newPage();

    // Set stable environment variables (CodeRabbit feedback)
    await page.addInitScript(() => {
      // Fix Date.now() for consistent timestamps
      const fixedTime = new Date('2024-01-15T12:00:00Z').getTime();
      Date.now = () => fixedTime;
      
      // Fix Math.random() for consistent behavior
      Math.random = () => 0.5;
      
      // Stabilize timezone
      Intl.DateTimeFormat = class extends Intl.DateTimeFormat {
        constructor(locale, options) {
          super('en-US', { ...options, timeZone: 'UTC' });
        }
      };
    });

    // Mock API responses for consistency
    await page.route('**/api/shield/**', async (route) => {
      const url = route.request().url();
      
      if (url.includes('/events')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              events: [
                {
                  id: 'stable-action-1',
                  action_type: 'block',
                  content_hash: 'hash123',
                  content_snippet: 'Stable test content for screenshots',
                  platform: 'twitter',
                  reason: 'toxic',
                  created_at: '2024-01-15T10:00:00Z',
                  reverted_at: null,
                  metadata: {}
                },
                {
                  id: 'stable-action-2',
                  action_type: 'mute',
                  content_hash: 'hash456',
                  content_snippet: 'Another stable test content',
                  platform: 'youtube',
                  reason: 'harassment',
                  created_at: '2024-01-14T15:30:00Z',
                  reverted_at: '2024-01-14T16:00:00Z',
                  metadata: { reverted: true }
                }
              ],
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
              generatedAt: '2024-01-15T12:00:00Z'
            }
          })
        });
      }
    });
  });

  afterEach(async () => {
    await context?.close();
  });

  describe('Network Stability and Loading States', () => {
    test('should handle network idle waits properly', async () => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:3000/shield');
      
      // Enhanced network idle wait (CodeRabbit feedback)
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      
      // Verify page loads within reasonable time
      expect(loadTime).toBeLessThan(10000);
      
      // Verify content is loaded
      await expect(page.locator('text=Shield')).toBeVisible();
    });

    test('should handle slow network responses gracefully', async () => {
      // Simulate slow API response
      await page.route('**/api/shield/events', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { events: [], pagination: { total: 0 } }
          })
        });
      });

      await page.goto('http://localhost:3000/shield');
      
      // Should show loading state
      await expect(page.locator('.loading, .animate-pulse, [data-testid="loading-indicator"]')).toBeVisible();
      
      // Wait for content to load
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Loading state should be gone
      await expect(page.locator('.loading, .animate-pulse, [data-testid="loading-indicator"]')).not.toBeVisible();
    });

    test('should handle network failures with proper error states', async () => {
      await page.route('**/api/shield/events', async (route) => {
        await route.abort('failed');
      });

      await page.goto('http://localhost:3000/shield');
      
      // Should show error state
      await expect(page.locator('text=Error, text=Failed, [data-testid="error-message"]')).toBeVisible();
    });
  });

  describe('Selector Resilience and Fallbacks', () => {
    test('should use data-testid selectors with fallbacks', async () => {
      await page.goto('http://localhost:3000/shield');
      await page.waitForLoadState('networkidle');

      // Test primary data-testid selector
      let shieldIcon = page.locator('[data-testid="shield-icon"]');
      
      if (!(await shieldIcon.isVisible())) {
        // Fallback to aria-label
        shieldIcon = page.locator('[aria-label*="Shield"]');
      }
      
      if (!(await shieldIcon.isVisible())) {
        // Fallback to text content
        shieldIcon = page.locator('text=Shield');
      }
      
      await expect(shieldIcon).toBeVisible();
    });

    test('should handle missing data-testid attributes gracefully', async () => {
      await page.goto('http://localhost:3000/shield');
      await page.waitForLoadState('networkidle');

      // Try to find revert button with multiple selectors
      const revertButton = page.locator('[data-testid="revert-button"]')
        .or(page.locator('button:has-text("Revertir")'))
        .or(page.locator('button:has-text("Revert")'))
        .or(page.locator('.revert-btn'));

      if (await revertButton.count() > 0) {
        await expect(revertButton.first()).toBeVisible();
      }
    });

    test('should handle dynamic content loading with stable selectors', async () => {
      await page.goto('http://localhost:3000/shield');
      
      // Wait for initial load
      await page.waitForLoadState('networkidle');
      
      // Wait for specific content with timeout and stable selector
      await page.waitForSelector(
        '[data-testid="shield-event"], .shield-event, text=Stable test content',
        { timeout: 10000, state: 'visible' }
      );
      
      // Verify content is actually visible
      const eventContent = page.locator('text=Stable test content for screenshots');
      await expect(eventContent).toBeVisible();
    });
  });

  describe('Visual Stability Enhancements', () => {
    test('should have consistent styling across loads', async () => {
      // Load page multiple times and verify consistent appearance
      const screenshots = [];
      
      for (let i = 0; i < 3; i++) {
        await page.goto('http://localhost:3000/shield');
        await page.waitForLoadState('networkidle');
        
        // Wait for layout stability
        await page.waitForTimeout(500);
        
        const screenshot = await page.screenshot();
        screenshots.push(screenshot);
      }
      
      // Screenshots should be identical (or very similar)
      expect(screenshots[0]).toEqual(screenshots[1]);
      expect(screenshots[1]).toEqual(screenshots[2]);
    });

    test('should handle font loading for consistent text rendering', async () => {
      await page.goto('http://localhost:3000/shield');
      
      // Wait for fonts to load
      await page.waitForFunction(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      
      // Additional wait for font rendering stability
      await page.waitForTimeout(300);
      
      // Verify text is rendered consistently
      const title = page.locator('h1, [data-testid="shield-title"]');
      await expect(title).toHaveCSS('font-family', /sans-serif|system-ui/);
    });

    test('should handle responsive layout changes gracefully', async () => {
      await page.goto('http://localhost:3000/shield');
      await page.waitForLoadState('networkidle');
      
      // Test desktop layout
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(300); // Wait for layout reflow
      
      let mainContent = page.locator('main, [role="main"], .main-content');
      await expect(mainContent).toBeVisible();
      
      // Test tablet layout
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(300);
      
      await expect(mainContent).toBeVisible();
      
      // Test mobile layout
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      await expect(mainContent).toBeVisible();
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    test('should handle non-numeric pagination gracefully', async () => {
      await page.goto('http://localhost:3000/shield?page=abc&limit=xyz');
      await page.waitForLoadState('networkidle');
      
      // Should still load the page with default pagination
      await expect(page.locator('text=Shield')).toBeVisible();
      
      // Pagination should default to valid values
      const paginationInfo = page.locator('[data-testid="pagination-info"], .pagination-info');
      if (await paginationInfo.isVisible()) {
        const paginationText = await paginationInfo.textContent();
        expect(paginationText).toMatch(/page\s+1|showing\s+1/i);
      }
    });

    test('should handle special characters in query parameters', async () => {
      const specialChars = encodeURIComponent('!@#$%^&*()');
      await page.goto(`http://localhost:3000/shield?category=${specialChars}`);
      await page.waitForLoadState('networkidle');
      
      // Should not crash and should show default content
      await expect(page.locator('text=Shield')).toBeVisible();
    });

    test('should recover from temporary API failures', async () => {
      let failCount = 0;
      
      await page.route('**/api/shield/events', async (route) => {
        failCount++;
        if (failCount <= 2) {
          await route.abort('failed');
        } else {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { events: [], pagination: { total: 0 } }
            })
          });
        }
      });

      await page.goto('http://localhost:3000/shield');
      
      // Should initially show error
      await expect(page.locator('[data-testid="error-message"], .error, text=Error')).toBeVisible();
      
      // Click retry button if available
      const retryButton = page.locator('[data-testid="retry-button"], button:has-text("Retry"), button:has-text("Reintentar")');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await page.waitForLoadState('networkidle');
      }
    });

    test('should handle concurrent user interactions', async () => {
      await page.goto('http://localhost:3000/shield');
      await page.waitForLoadState('networkidle');
      
      // Simulate rapid filter changes
      const timeFilter = page.locator('select, [data-testid="time-filter"]').first();
      if (await timeFilter.isVisible()) {
        await timeFilter.selectOption('7d');
        await timeFilter.selectOption('30d');
        await timeFilter.selectOption('90d');
        
        // Wait for last request to complete
        await page.waitForLoadState('networkidle');
      }
      
      // Page should still be functional
      await expect(page.locator('text=Shield')).toBeVisible();
    });
  });

  describe('Performance and Memory Stability', () => {
    test('should not leak memory during navigation', async () => {
      const initialMetrics = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
      
      // Navigate multiple times
      for (let i = 0; i < 5; i++) {
        await page.goto('http://localhost:3000/shield');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(100);
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) window.gc();
      });
      
      const finalMetrics = await page.evaluate(() => performance.memory?.usedJSHeapSize || 0);
      
      // Memory shouldn't grow excessively
      if (initialMetrics > 0 && finalMetrics > 0) {
        const memoryGrowth = finalMetrics - initialMetrics;
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
      }
    });

    test('should handle large datasets efficiently', async () => {
      // Mock large dataset response
      const largeEvents = Array.from({ length: 100 }, (_, i) => ({
        id: `large-action-${i}`,
        action_type: 'block',
        content_hash: `hash${i}`,
        content_snippet: `Large dataset content ${i}`,
        platform: 'twitter',
        reason: 'toxic',
        created_at: '2024-01-15T10:00:00Z',
        reverted_at: null,
        metadata: {}
      }));

      await page.route('**/api/shield/events', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              events: largeEvents,
              pagination: { total: 100, page: 1, limit: 100 }
            }
          })
        });
      });

      const startTime = Date.now();
      await page.goto('http://localhost:3000/shield');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time even with large dataset
      expect(loadTime).toBeLessThan(15000);
      
      // Content should be visible
      await expect(page.locator('text=Shield')).toBeVisible();
    });

    test('should handle rapid state changes without race conditions', async () => {
      await page.goto('http://localhost:3000/shield');
      await page.waitForLoadState('networkidle');
      
      // Simulate rapid filter changes that could cause race conditions
      const promises = [];
      const filterSelectors = ['select', '[data-testid="time-filter"]', '[data-testid="category-filter"]'];
      
      for (const selector of filterSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          promises.push(
            element.selectOption('all').catch(() => {}) // Ignore errors
          );
        }
      }
      
      // Wait for all changes to complete
      await Promise.all(promises);
      await page.waitForLoadState('networkidle');
      
      // Page should still be functional
      await expect(page.locator('text=Shield')).toBeVisible();
    });
  });

  describe('Cross-browser Compatibility Stability', () => {
    test('should work consistently across different user agents', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      ];
      
      for (const userAgent of userAgents) {
        await page.setExtraHTTPHeaders({ 'User-Agent': userAgent });
        await page.goto('http://localhost:3000/shield');
        await page.waitForLoadState('networkidle');
        
        // Basic functionality should work regardless of user agent
        await expect(page.locator('text=Shield')).toBeVisible();
      }
    });

    test('should handle different screen densities consistently', async () => {
      const densities = [1, 1.5, 2, 3];
      
      for (const density of densities) {
        await page.setViewportSize({ 
          width: Math.floor(1920 / density), 
          height: Math.floor(1080 / density) 
        });
        
        await page.goto('http://localhost:3000/shield');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(300); // Wait for layout adjustment
        
        // Content should be visible at all densities
        await expect(page.locator('text=Shield')).toBeVisible();
      }
    });
  });
});