import { test, expect, devices } from '@playwright/test';

test.describe('Dashboard Responsive Design', () => {
  test('should render on desktop (1920x1080)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, #root').first()).toBeVisible();
    const sections = await page.locator('section, [class*="panel"]').count();
    expect(sections).toBeGreaterThanOrEqual(2);
    await context.close();
  });

  test('should render on mobile (375x667)', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone SE'] });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, #root').first()).toBeVisible();
    await context.close();
  });

  test('should render on tablet (768x1024)', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPad Mini'] });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, #root').first()).toBeVisible();
    await context.close();
  });
});
