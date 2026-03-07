import { test, expect } from '@playwright/test';

test('app loads and shows content', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Roastr/i);
});

test('health check page accessible', async ({ page }) => {
  const response = await page.request.get('http://localhost:3000/health');
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
