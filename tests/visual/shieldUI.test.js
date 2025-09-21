/**
 * Shield UI Visual Tests with Playwright
 * 
 * Comprehensive visual testing for Shield UI components across different
 * viewports, states, and user interactions.
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const TEST_URL = process.env.TEST_URL || 'http://localhost:3000';
const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

// Mock data for consistent testing
const mockShieldData = [
  {
    id: '1',
    action_type: 'block',
    content: 'This is offensive content that was automatically blocked by Shield',
    platform: 'twitter',
    reason: 'toxic',
    created_at: '2024-01-15T10:00:00Z',
    reverted_at: null,
    metadata: {},
  },
  {
    id: '2',
    action_type: 'mute',
    content: 'Another problematic comment that was muted',
    platform: 'youtube',
    reason: 'harassment',
    created_at: '2024-01-14T15:30:00Z',
    reverted_at: '2024-01-14T16:00:00Z',
    metadata: { reverted: true },
  },
];

test.describe('Shield UI Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for consistent visual testing
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
                hasPrev: false,
              },
            },
          }),
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
            },
          }),
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
                statistics: true,
              },
            },
          }),
        });
      }
    });

    // Mock feature flag check
    await page.route('**/feature_flags**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { enabled: true },
          error: null,
        }),
      });
    });
  });

  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} viewport (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test('should render Shield UI main interface', async ({ page }) => {
        await page.goto(`${TEST_URL}/shield`);
        
        // Wait for content to load
        await page.waitForSelector('[data-testid="shield-icon"]', { timeout: 10000 });
        
        // Take screenshot of main interface
        await expect(page).toHaveScreenshot(`shield-main-${viewport.name}.png`);
      });

      test('should display shield events list', async ({ page }) => {
        await page.goto(`${TEST_URL}/shield`);
        
        // Wait for events to load
        await page.waitForSelector('text=This is offensive content', { timeout: 10000 });
        
        // Verify both events are displayed
        await expect(page.locator('text=This is offensive content')).toBeVisible();
        await expect(page.locator('text=Another problematic comment')).toBeVisible();
        
        // Take screenshot of events list
        await expect(page).toHaveScreenshot(`shield-events-list-${viewport.name}.png`);
      });

      test('should show filter controls', async ({ page }) => {
        await page.goto(`${TEST_URL}/shield`);
        
        // Wait for filters to load
        await page.waitForSelector('select', { timeout: 5000 });
        
        // Verify filter elements
        await expect(page.locator('text=Período de tiempo')).toBeVisible();
        await expect(page.locator('text=Categoría')).toBeVisible();
        
        // Take screenshot of filter section
        await expect(page.locator('div:has(select)').first()).toHaveScreenshot(`shield-filters-${viewport.name}.png`);
      });

      test('should display action type badges correctly', async ({ page }) => {
        await page.goto(`${TEST_URL}/shield`);
        
        // Wait for content
        await page.waitForSelector('text=Bloqueado', { timeout: 5000 });
        
        // Verify action type badges
        await expect(page.locator('text=Bloqueado')).toBeVisible();
        await expect(page.locator('text=Silenciado')).toBeVisible();
        
        // Take screenshot focusing on badges
        const eventItem = page.locator('.bg-gray-800').first();
        await expect(eventItem).toHaveScreenshot(`shield-action-badges-${viewport.name}.png`);
      });

      test('should show revert button for non-reverted actions', async ({ page }) => {
        await page.goto(`${TEST_URL}/shield`);
        
        // Wait for revert buttons using more stable selector
        await page.waitForSelector('button:has-text("Revertir")', { timeout: 10000 });
        
        // Should show revert button for first action (not reverted)
        const revertButtons = page.locator('button:has-text("Revertir")');
        await expect(revertButtons).toHaveCount(1);
        
        // Take screenshot of action with revert button using more stable selector
        const actionWithRevert = page.locator('[data-testid="shield-action"]:has(button:has-text("Revertir"))');
        await expect(actionWithRevert.first()).toHaveScreenshot(`shield-revert-button-${viewport.name}.png`);
      });

      test('should show reverted status for reverted actions', async ({ page }) => {
        await page.goto(`${TEST_URL}/shield`);
        
        // Wait for reverted status using more stable selector
        await page.waitForSelector('text=Revertido el', { timeout: 10000 });
        
        // Verify reverted status is shown
        await expect(page.locator('text=Revertido el')).toBeVisible();
        
        // Take screenshot of reverted action using data attribute
        const revertedAction = page.locator('[data-testid="shield-action"]:has-text("Revertido el")');
        await expect(revertedAction.first()).toHaveScreenshot(`shield-reverted-status-${viewport.name}.png`);
      });
    });
  }

  test.describe('Interactive States', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test('should show revert confirmation dialog', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      // Wait for and click revert button
      await page.waitForSelector('button:has-text("Revertir")', { timeout: 5000 });
      await page.click('button:has-text("Revertir")');
      
      // Wait for dialog to appear
      await page.waitForSelector('text=Confirmar reversión', { timeout: 3000 });
      
      // Verify dialog content
      await expect(page.locator('text=Confirmar reversión')).toBeVisible();
      await expect(page.locator('text=¿Estás seguro de que quieres revertir esta acción de Shield?')).toBeVisible();
      
      // Take screenshot of dialog
      await expect(page.locator('.fixed.inset-0')).toHaveScreenshot('shield-revert-dialog.png');
    });

    test('should show filter dropdown interactions', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      // Wait for and interact with time range filter
      await page.waitForSelector('select', { timeout: 5000 });
      const timeRangeSelect = page.locator('select').first();
      
      // Open dropdown and take screenshot
      await timeRangeSelect.focus();
      await expect(timeRangeSelect).toHaveScreenshot('shield-time-filter-focused.png');
      
      // Change selection
      await timeRangeSelect.selectOption('7d');
      await expect(page).toHaveScreenshot('shield-after-filter-change.png');
    });

    test('should show loading state', async ({ page }) => {
      // Delay API response to capture loading state
      await page.route('**/api/shield/events', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { events: [], pagination: { total: 0 } },
          }),
        });
      });

      await page.goto(`${TEST_URL}/shield`);
      
      // Capture loading state
      await expect(page.locator('.animate-pulse')).toBeVisible();
      await expect(page).toHaveScreenshot('shield-loading-state.png');
    });

    test('should show empty state', async ({ page }) => {
      // Mock empty response
      await page.route('**/api/shield/events', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              events: [],
              pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
            },
          }),
        });
      });

      await page.goto(`${TEST_URL}/shield`);
      
      // Wait for empty state
      await page.waitForSelector('text=No hay contenido interceptado', { timeout: 5000 });
      
      // Verify empty state elements
      await expect(page.locator('text=No hay contenido interceptado')).toBeVisible();
      await expect(page.locator('text=Aún no se ha interceptado ningún contenido')).toBeVisible();
      
      // Take screenshot of empty state
      await expect(page).toHaveScreenshot('shield-empty-state.png');
    });

    test('should show error state', async ({ page }) => {
      // Mock error response
      await page.route('**/api/shield/events', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          status: 500,
          body: JSON.stringify({
            success: false,
            error: { message: 'Database connection failed' },
          }),
        });
      });

      await page.goto(`${TEST_URL}/shield`);
      
      // Wait for error state
      await page.waitForSelector('text=Database connection failed', { timeout: 5000 });
      
      // Verify error display
      await expect(page.locator('text=Database connection failed')).toBeVisible();
      
      // Take screenshot of error state
      await expect(page).toHaveScreenshot('shield-error-state.png');
    });

    test('should show feature flag disabled state', async ({ page }) => {
      // Mock disabled feature flag
      await page.route('**/feature_flags**', async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: { enabled: false },
            error: null,
          }),
        });
      });

      await page.goto(`${TEST_URL}/shield`);
      
      // Wait for disabled state
      await page.waitForSelector('text=Próximamente', { timeout: 5000 });
      
      // Verify disabled state content
      await expect(page.locator('text=Próximamente')).toBeVisible();
      await expect(page.locator('text=La interfaz de Shield está actualmente en desarrollo')).toBeVisible();
      
      // Take screenshot of disabled state
      await expect(page).toHaveScreenshot('shield-disabled-state.png');
    });
  });

  test.describe('Responsive Design', () => {
    test('should adapt layout for mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${TEST_URL}/shield`);
      
      // Wait for content
      await page.waitForSelector('text=Shield - Contenido Interceptado', { timeout: 5000 });
      
      // Verify mobile layout
      const header = page.locator('h1:has-text("Shield - Contenido Interceptado")');
      await expect(header).toBeVisible();
      
      // Check filter layout on mobile
      const filterGrid = page.locator('div:has(select)').first();
      await expect(filterGrid).toHaveScreenshot('shield-mobile-filters.png');
      
      // Take full mobile screenshot
      await expect(page).toHaveScreenshot('shield-mobile-full.png', { fullPage: true });
    });

    test('should show proper tablet layout', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`${TEST_URL}/shield`);
      
      // Wait for content
      await page.waitForSelector('text=Shield - Contenido Interceptado', { timeout: 5000 });
      
      // Take tablet screenshot
      await expect(page).toHaveScreenshot('shield-tablet-layout.png', { fullPage: true });
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle non-numeric pagination inputs', async ({ page }) => {
      // Test with non-numeric page parameter
      await page.goto(`${TEST_URL}/shield?page=abc&limit=xyz`);
      
      // Should still load with default values
      await page.waitForSelector('[data-testid="shield-icon"]', { timeout: 10000 });
      
      // Verify content loads despite invalid params
      await expect(page.locator('text=Shield - Contenido Interceptado')).toBeVisible();
    });
  });

  test.describe('Accessibility Visual Checks', () => {
    test('should show proper focus states', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      // Focus on refresh button with more stable selector
      await page.waitForSelector('[data-testid="refresh-button"], button:has-text("Actualizar")', { timeout: 10000 });
      const refreshButton = page.locator('[data-testid="refresh-button"]').first().or(page.locator('button:has-text("Actualizar")').first());
      await refreshButton.focus();
      await expect(refreshButton).toHaveScreenshot('shield-button-focus.png');
      
      // Focus on filter select with more specific selector
      const timeFilter = page.locator('[data-testid="time-filter"]').first().or(page.locator('select').first());
      await timeFilter.focus();
      await expect(timeFilter).toHaveScreenshot('shield-select-focus.png');
    });

    test('should show proper contrast in dark mode', async ({ page }) => {
      await page.goto(`${TEST_URL}/shield`);
      
      // Wait for content
      await page.waitForSelector('.bg-gray-900', { timeout: 5000 });
      
      // Verify dark mode styling
      await expect(page.locator('.bg-gray-900')).toBeVisible();
      
      // Take screenshot to verify contrast
      await expect(page).toHaveScreenshot('shield-dark-mode-contrast.png');
    });
  });
});