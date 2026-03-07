import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

test('app loads and shows content', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Roastr/i);
});

test('health check page accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
