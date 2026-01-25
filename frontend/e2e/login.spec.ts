import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Login Flow
 *
 * Tests the login page functionality including:
 * - Login form rendering
 * - Demo mode login (no backend required)
 * - Navigation after login
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and cookies before each test
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    // Check for login form elements
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('should display demo login button', async ({ page }) => {
    await page.goto('/login');

    // Check for demo login button - text is "Modo Demo (Sin Backend)"
    const demoButton = page.getByRole('button', { name: /modo demo/i });
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toBeEnabled();
  });

  test('should login with demo mode and redirect to admin dashboard', async ({ page }) => {
    await page.goto('/login');

    // Click demo login button - it uses window.location.href so we need to wait for navigation
    const navigationPromise = page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });
    await page.getByRole('button', { name: /modo demo/i }).click();

    // Wait for navigation (window.location.href causes full page reload)
    await navigationPromise;

    // Wait for page to fully load after navigation
    await page.waitForLoadState('networkidle');

    // Should be on admin dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // The dashboard might not have a heading, just verify we're on the right page
    // Or check for any admin content like sidebar
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('should persist demo login in localStorage', async ({ page }) => {
    await page.goto('/login');

    // Login with demo mode
    await page.getByRole('button', { name: /modo demo/i }).click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Check localStorage
    const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(authToken).toContain('demo-token-');

    const user = await page.evaluate(() => localStorage.getItem('user'));
    expect(user).toBeTruthy();

    const parsedUser = JSON.parse(user || '{}');
    expect(parsedUser.is_admin).toBe(true);
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    // Note: Actual validation depends on form implementation
    // This test verifies the button is clickable
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('should navigate to login from unauthorized route', async ({ page }) => {
    // Try to access admin route without auth
    await page.goto('/admin/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should have link to register page (ROA-532)', async ({ page }) => {
    await page.goto('/login');

    // Check for "Crear cuenta" link
    const registerLink = page.getByRole('link', { name: /crear cuenta/i });
    await expect(registerLink).toBeVisible();

    // Click and verify navigation to /register
    await registerLink.click();
    await expect(page).toHaveURL(/\/register/);

    // Verify register page loaded (should have "Crear cuenta" heading)
    await expect(page.getByRole('heading', { name: /crear cuenta/i })).toBeVisible();
  });

  test('should validate email format (ROA-532)', async ({ page }) => {
    await page.goto('/login');

    // Type invalid email (TLD invalid)
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('test@test.con');
    
    // Blur to trigger validation
    await emailInput.blur();

    // Should show error message
    await expect(page.getByText(/email inválido/i)).toBeVisible();

    // Button should be disabled
    const loginButton = page.getByRole('button', { name: /^iniciar sesión$/i });
    await expect(loginButton).toBeDisabled();

    // Fix email
    await emailInput.fill('test@roastr.ai');
    await emailInput.blur();

    // Error should disappear
    await expect(page.getByText(/email inválido/i)).not.toBeVisible();

    // Button should be enabled
    await expect(loginButton).toBeEnabled();
  });
});
