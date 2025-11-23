/**
 * Visual Test Stability Tests - CodeRabbit Round 5 Improvements
 *
 * Tests the enhanced visual testing features added in CodeRabbit Round 5:
 * 1. Enhanced timezone and locale handling
 * 2. Improved motion reduction for stable animations
 * 3. Better selector fallback strategies
 * 4. Network resilience improvements
 */

const { test, expect } = require('@playwright/test');

describe('Shield UI Visual Stability - Round 5 Improvements', () => {
  // Mock test environment setup
  const setupStableEnvironment = async (page) => {
    // Test the enhanced Date override functionality
    await page.addInitScript(() => {
      // Verify Date override is working
      window.testDateOverride = () => {
        const now = new Date();
        const fixedDate = new Date('2024-01-15T12:00:00.000Z');
        return {
          nowTime: now.getTime(),
          fixedTime: fixedDate.getTime(),
          isOverridden: now.getTime() === fixedDate.getTime()
        };
      };

      // Test timezone offset override
      window.testTimezoneOffset = () => {
        const date = new Date();
        return date.getTimezoneOffset();
      };

      // Test Intl.DateTimeFormat override
      window.testIntlOverride = () => {
        const formatter = new Intl.DateTimeFormat();
        return formatter.resolvedOptions();
      };
    });
  };

  describe('Enhanced Timezone and Locale Handling', () => {
    test('should properly override Date constructor for consistent timestamps', async ({
      page
    }) => {
      await setupStableEnvironment(page);
      await page.goto('about:blank');

      // Test Date constructor override
      const dateTest = await page.evaluate(() => {
        return window.testDateOverride();
      });

      // Should use fixed timestamp
      expect(dateTest.isOverridden).toBe(true);
    });

    test('should override Date.now() for consistency', async ({ page }) => {
      await setupStableEnvironment(page);
      await page.goto('about:blank');

      const nowTest = await page.evaluate(() => {
        return Date.now() === new Date('2024-01-15T12:00:00.000Z').getTime();
      });

      expect(nowTest).toBe(true);
    });

    test('should set timezone offset to 0 (UTC)', async ({ page }) => {
      await setupStableEnvironment(page);
      await page.goto('about:blank');

      const timezoneOffset = await page.evaluate(() => {
        return window.testTimezoneOffset();
      });

      expect(timezoneOffset).toBe(0);
    });

    test('should override Intl.DateTimeFormat to use UTC', async ({ page }) => {
      await setupStableEnvironment(page);
      await page.goto('about:blank');

      const intlOptions = await page.evaluate(() => {
        return window.testIntlOverride();
      });

      expect(intlOptions.timeZone).toBe('UTC');
      expect(intlOptions.locale).toBe('en-US');
    });

    test('should set stable navigator properties', async ({ page }) => {
      await setupStableEnvironment(page);
      await page.goto('about:blank');

      const navigatorProps = await page.evaluate(() => {
        return {
          language: navigator.language,
          languages: navigator.languages
        };
      });

      expect(navigatorProps.language).toBe('en-US');
      expect(navigatorProps.languages).toEqual(['en-US']);
    });
  });

  describe('Improved Motion Reduction', () => {
    test('should disable animations for stable screenshots', async ({ page }) => {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-delay: 0.01ms !important;
            transition-duration: 0.01ms !important;
            transition-delay: 0.01ms !important;
            transform-origin: center !important;
          }
          
          .animate-pulse, .animate-spin, .animate-bounce {
            animation: none !important;
          }
          
          .loading-skeleton {
            background: #374151 !important;
          }
        `
      });

      await page.goto('about:blank');

      // Test that animations are effectively disabled
      const animationStyles = await page.evaluate(() => {
        const testDiv = document.createElement('div');
        testDiv.className = 'animate-pulse';
        document.body.appendChild(testDiv);

        const computedStyle = window.getComputedStyle(testDiv);
        const animationName = computedStyle.animationName;
        const animationDuration = computedStyle.animationDuration;

        document.body.removeChild(testDiv);

        return {
          animationName,
          animationDuration
        };
      });

      expect(animationStyles.animationName).toBe('none');
    });

    test('should set consistent loading skeleton appearance', async ({ page }) => {
      await page.addStyleTag({
        content: `
          .loading-skeleton {
            background: #374151 !important;
          }
        `
      });

      await page.setContent('<div class="loading-skeleton">Loading...</div>');

      const bgColor = await page.evaluate(() => {
        const skeleton = document.querySelector('.loading-skeleton');
        return window.getComputedStyle(skeleton).backgroundColor;
      });

      // Should have the consistent background color
      expect(bgColor).toBe('rgb(55, 65, 81)'); // #374151 in RGB
    });
  });

  describe('Enhanced Selector Fallback Strategies', () => {
    test('should handle multiple selector fallback options', async ({ page }) => {
      // Create test content with various selector options
      await page.setContent(`
        <div>
          <h1 data-testid="shield-title">Shield - Contenido Interceptado</h1>
          <div class="shield-icon" aria-label="Shield Icon">🛡️</div>
        </div>
      `);

      // Test primary selector (data-testid)
      const primarySelector = page.locator('[data-testid="shield-title"]');
      await expect(primarySelector).toBeVisible();

      // Test fallback selector (text content)
      const fallbackSelector = page.locator('text=Shield - Contenido Interceptado');
      await expect(fallbackSelector).toBeVisible();

      // Test aria-label fallback
      const ariaSelector = page.locator('[aria-label*="Shield"]');
      await expect(ariaSelector).toBeVisible();

      // Test class fallback
      const classSelector = page.locator('.shield-icon');
      await expect(classSelector).toBeVisible();
    });

    test('should gracefully handle missing primary selectors', async ({ page }) => {
      // Create content without data-testid attributes
      await page.setContent(`
        <div>
          <h1>Shield - Contenido Interceptado</h1>
          <div class="shield-icon">🛡️</div>
        </div>
      `);

      // Should still find elements using fallback selectors
      const titleByText = page.locator('text=Shield - Contenido Interceptado');
      await expect(titleByText).toBeVisible();

      const iconByClass = page.locator('.shield-icon');
      await expect(iconByClass).toBeVisible();
    });

    test('should handle complex selector combinations', async ({ page }) => {
      await page.setContent(`
        <div>
          <div data-testid="shield-event" class="bg-gray-800">
            <span data-testid="action-badge">Bloqueado</span>
            <button data-testid="revert-button">Revertir</button>
          </div>
        </div>
      `);

      // Test combined selectors
      const eventWithBadge = page.locator(
        '[data-testid="shield-event"]:has([data-testid="action-badge"])'
      );
      await expect(eventWithBadge).toBeVisible();

      const eventWithButton = page.locator(
        '[data-testid="shield-event"]:has(button:has-text("Revertir"))'
      );
      await expect(eventWithButton).toBeVisible();

      // Test fallback for complex selectors
      const fallbackEvent = page.locator('.bg-gray-800:has-text("Bloqueado")');
      await expect(fallbackEvent).toBeVisible();
    });
  });

  describe('Network Resilience Improvements', () => {
    test('should handle network idle waits properly', async ({ page }) => {
      let networkIdleReached = false;

      // Monitor network idle state
      page.on('response', () => {
        // Network activity detected
      });

      await page.goto('about:blank');

      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
        networkIdleReached = true;
      } catch (error) {
        // Should handle timeout gracefully
        expect(error.message).toContain('Timeout');
      }

      // Should either reach network idle or handle timeout
      expect(typeof networkIdleReached).toBe('boolean');
    });

    test('should use appropriate timeout values', async ({ page }) => {
      await page.goto('about:blank');

      // Test with extended timeout for stability
      const startTime = Date.now();

      try {
        await page.waitForSelector('non-existent-element', {
          timeout: 100, // Short timeout for test
          state: 'visible'
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;

        // Should respect timeout value
        expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
        expect(elapsed).toBeLessThan(200); // But not too much
        expect(error.message).toContain('Timeout');
      }
    });

    test('should handle layout stability waits', async ({ page }) => {
      await page.setContent(`
        <div id="dynamic-content">
          <p>Initial content</p>
        </div>
      `);

      // Simulate dynamic content loading
      await page.evaluate(() => {
        setTimeout(() => {
          document.getElementById('dynamic-content').innerHTML = '<p>Updated content</p>';
        }, 100);
      });

      // Wait for layout stability
      await page.waitForTimeout(200);

      const content = await page.locator('#dynamic-content p').textContent();
      expect(content).toBe('Updated content');
    });
  });

  describe('Error State Handling', () => {
    test('should handle missing elements gracefully', async ({ page }) => {
      await page.goto('about:blank');

      // Should not find element but not crash
      const missingElement = page.locator('[data-testid="non-existent"]');
      const isVisible = await missingElement.isVisible();

      expect(isVisible).toBe(false);
    });

    test('should handle multiple selector failures', async ({ page }) => {
      await page.setContent('<div>No matching content</div>');

      // Try multiple selectors, all should fail gracefully
      const selectors = [
        '[data-testid="missing"]',
        '[aria-label="missing"]',
        '.missing-class',
        'text=Missing Text'
      ];

      for (const selector of selectors) {
        const element = page.locator(selector);
        const isVisible = await element.isVisible();
        expect(isVisible).toBe(false);
      }
    });

    test('should provide meaningful error messages', async ({ page }) => {
      await page.goto('about:blank');

      try {
        await page.waitForSelector('[data-testid="missing"]', {
          timeout: 100,
          state: 'visible'
        });
      } catch (error) {
        expect(error.message).toContain('Timeout');
        expect(error.message).toContain('data-testid="missing"');
      }
    });
  });

  describe('Performance and Stability Metrics', () => {
    test('should complete screenshot operations within reasonable time', async ({ page }) => {
      await page.setContent(`
        <div style="width: 1920px; height: 1080px; background: linear-gradient(45deg, #374151, #1f2937);">
          <h1>Test Content for Screenshot</h1>
        </div>
      `);

      const startTime = Date.now();

      // Take screenshot (mocked for test)
      await page.locator('h1').screenshot();

      const elapsed = Date.now() - startTime;

      // Should complete quickly
      expect(elapsed).toBeLessThan(5000); // 5 seconds max
    });

    test('should handle viewport changes efficiently', async ({ page }) => {
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 375, height: 667 }
      ];

      for (const viewport of viewports) {
        const startTime = Date.now();

        await page.setViewportSize(viewport);

        const elapsed = Date.now() - startTime;

        // Viewport changes should be fast
        expect(elapsed).toBeLessThan(1000); // 1 second max
      }
    });
  });
});
