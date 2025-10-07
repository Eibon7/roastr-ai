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
    // Tab through first 5 interactive elements
    const focusedElements = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      const el = await page.evaluate(() => ({
        tagName: document.activeElement?.tagName,
        role: document.activeElement?.getAttribute('role'),
        ariaLabel: document.activeElement?.getAttribute('aria-label')
      }));
      focusedElements.push(el);
    }

    // Verify all focused elements are interactive
    const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
    focusedElements.forEach((el, index) => {
      expect(interactiveTags).toContain(el.tagName);
    });

    // Verify we moved through different elements (no focus trap)
    const uniqueTags = new Set(focusedElements.map(el => el.tagName));
    expect(uniqueTags.size).toBeGreaterThanOrEqual(2);
  });

  test('should have proper semantic HTML', async ({ page }) => {
    const hasMain = await page.locator('main, [role="main"]').count() > 0;
    const hasHeadings = await page.locator('h1, h2, h3').count() > 0;
    
    expect(hasMain).toBeTruthy();
    expect(hasHeadings).toBeTruthy();
  });
});
