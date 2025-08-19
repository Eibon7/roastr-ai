/**
 * E2E tests for authentication flows
 * Tests critical user journeys for registration, login, logout, password recovery, and email verification
 */

import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'test+' + Date.now() + '@example.com',
  password: 'TestPass123!',
  weakPassword: '123',
  name: 'Test User'
};

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the application
    await page.goto('/');
  });

  test.describe('Registration Flow', () => {
    test('should successfully register with valid password', async ({ page }) => {
      // Navigate to registration page
      await page.goto('/register');
      
      // Fill registration form
      await page.fill('[name="name"]', TEST_USER.name);
      await page.fill('[name="email"]', TEST_USER.email);
      await page.fill('[name="password"]', TEST_USER.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should show success message
      await expect(page.locator('.alert')).toContainText('Cuenta creada exitosamente');
      
      // Should redirect to login page after delay
      await page.waitForURL('/login', { timeout: 5000 });
      await expect(page.locator('.alert')).toContainText('Revisa tu email para confirmar');
    });

    test('should reject weak password during registration', async ({ page }) => {
      // Navigate to registration page
      await page.goto('/register');
      
      // Fill form with weak password
      await page.fill('[name="name"]', TEST_USER.name);
      await page.fill('[name="email"]', TEST_USER.email);
      await page.fill('[name="password"]', TEST_USER.weakPassword);
      
      // Password field should show validation errors
      await expect(page.locator('.text-red-400')).toBeVisible();
      
      // Submit button should be disabled
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
    });

    test('should show real-time password validation feedback', async ({ page }) => {
      await page.goto('/register');
      
      const passwordInput = page.locator('[name="password"]');
      
      // Focus on password input to show requirements
      await passwordInput.focus();
      await expect(page.locator('text=Requisitos de contraseña')).toBeVisible();
      
      // Type weak password - should show red indicators
      await passwordInput.fill('abc');
      await expect(page.locator('.text-red-400')).toHaveCount(3); // All requirements unmet
      
      // Type stronger password - should show green indicators progressively
      await passwordInput.fill('Abc123!');
      await expect(page.locator('.text-green-500')).toHaveCount(3); // All requirements met
      
      // Should show strength indicator
      await expect(page.locator('text=Fuerte')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/register');
      
      // Fill form with invalid email
      await page.fill('[name="name"]', TEST_USER.name);
      await page.fill('[name="email"]', 'invalid-email');
      await page.fill('[name="password"]', TEST_USER.password);
      
      // Submit button should be disabled
      await expect(page.locator('button[type="submit"]')).toBeDisabled();
      
      // Fix email - button should become enabled
      await page.fill('[name="email"]', TEST_USER.email);
      await expect(page.locator('button[type="submit"]')).not.toBeDisabled();
    });
  });

  test.describe('Login Flow', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      // For this test, we assume a user already exists or we create one first
      await page.goto('/login');
      
      // Fill login form
      await page.fill('[name="email"]', 'test@example.com');
      await page.fill('[name="password"]', 'TestPass123!');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard on success
      await page.waitForURL('/dashboard', { timeout: 10000 });
      await expect(page).toHaveURL('/dashboard');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      
      // Fill form with wrong credentials
      await page.fill('[name="email"]', 'wrong@example.com');
      await page.fill('[name="password"]', 'wrongpassword');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('.alert')).toContainText('Email o contraseña incorrectos');
      
      // Should remain on login page
      await expect(page).toHaveURL('/login');
    });

    test('should toggle password visibility', async ({ page }) => {
      await page.goto('/login');
      
      const passwordInput = page.locator('[name="password"]');
      const toggleButton = page.locator('button[type="button"]').last();
      
      // Password should be hidden by default
      await expect(passwordInput).toHaveAttribute('type', 'password');
      
      // Click toggle button to show password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Click again to hide password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('should validate login form fields', async ({ page }) => {
      await page.goto('/login');
      
      const submitButton = page.locator('button[type="submit"]');
      
      // Initially button should be disabled (empty form)
      await expect(submitButton).toBeDisabled();
      
      // Fill email only
      await page.fill('[name="email"]', TEST_USER.email);
      await expect(submitButton).toBeDisabled();
      
      // Fill password too - should enable button
      await page.fill('[name="password"]', 'anypassword');
      await expect(submitButton).not.toBeDisabled();
    });
  });

  test.describe('Logout Flow', () => {
    test('should successfully logout user', async ({ page }) => {
      // First login (assuming we have a valid session or create one)
      await page.goto('/login');
      await page.fill('[name="email"]', 'test@example.com');
      await page.fill('[name="password"]', 'TestPass123!');
      await page.click('button[type="submit"]');
      
      // Wait for dashboard
      await page.waitForURL('/dashboard');
      
      // Find and click logout button (this will depend on your UI)
      await page.click('[data-testid="logout-button"]');
      
      // Should redirect to login page
      await page.waitForURL('/login');
      await expect(page).toHaveURL('/login');
      
      // Should not be able to access dashboard without re-authenticating
      await page.goto('/dashboard');
      await page.waitForURL('/login'); // Should redirect to login
    });
  });

  test.describe('Password Recovery Flow', () => {
    test('should send password reset email', async ({ page }) => {
      await page.goto('/login');
      
      // Click forgot password link
      await page.click('text=¿Olvidaste tu contraseña?');
      
      // Should navigate to password reset page
      await expect(page).toHaveURL('/reset-password');
      
      // Fill email and submit
      await page.fill('[name="email"]', TEST_USER.email);
      await page.click('button[type="submit"]');
      
      // Should show success message (even if user doesn't exist, for security)
      await expect(page.locator('.alert')).toContainText('reset link has been sent');
    });
  });

  test.describe('Navigation and Links', () => {
    test('should navigate between login and register pages', async ({ page }) => {
      await page.goto('/login');
      
      // Click register link
      await page.click('text=Crear cuenta');
      await expect(page).toHaveURL('/register');
      
      // Click login link
      await page.click('text=Inicia sesión');
      await expect(page).toHaveURL('/login');
    });

    test('should show benefits on registration page', async ({ page }) => {
      await page.goto('/register');
      
      // Should show benefits section
      await expect(page.locator('text=¿Por qué unirse a Roastr.ai?')).toBeVisible();
      await expect(page.locator('text=Genera roasts inteligentes')).toBeVisible();
      await expect(page.locator('text=Plan gratuito con 100 respuestas')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/login');
      
      // Form should still be functional
      await page.fill('[name="email"]', TEST_USER.email);
      await page.fill('[name="password"]', 'somepassword');
      
      // Button should be visible and clickable
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).not.toBeDisabled();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state during login', async ({ page }) => {
      await page.goto('/login');
      
      // Fill form
      await page.fill('[name="email"]', TEST_USER.email);
      await page.fill('[name="password"]', 'somepassword');
      
      // Click submit and immediately check for loading state
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // Should show loading text and spinner
      await expect(page.locator('text=Procesando')).toBeVisible();
      await expect(page.locator('.animate-spin')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // This test would need network interception
      // For now, we'll test the UI behavior when errors occur
      
      await page.goto('/login');
      await page.fill('[name="email"]', TEST_USER.email);
      await page.fill('[name="password"]', 'wrongpassword');
      
      // Submit and expect error handling
      await page.click('button[type="submit"]');
      
      // Error alert should appear
      await expect(page.locator('.alert')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper form labels and ARIA attributes', async ({ page }) => {
      await page.goto('/login');
      
      // Check that form fields have proper labels
      await expect(page.locator('label[for="email"]')).toContainText('Correo electrónico');
      await expect(page.locator('label[for="password"]')).toContainText('Contraseña');
      
      // Check required attributes
      await expect(page.locator('[name="email"]')).toHaveAttribute('required');
      await expect(page.locator('[name="password"]')).toHaveAttribute('required');
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/login');
      
      // Tab through form elements
      await page.keyboard.press('Tab'); // Email field
      await expect(page.locator('[name="email"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Password field
      await expect(page.locator('[name="password"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused();
    });
  });
});