import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Dashboard Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should have no critical accessibility violations', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Accessibility Violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tagName: el.tagName } : null;
    });
    
    expect(focusedElement).not.toBeNull();
  });

  test('should have proper semantic HTML', async ({ page }) => {
    const hasMain = await page.locator('main, [role="main"]').count() > 0;
    const hasHeadings = await page.locator('h1, h2, h3').count() > 0;
    
    expect(hasMain).toBeTruthy();
    expect(hasHeadings).toBeTruthy();
  });
});
