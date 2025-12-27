import { test, expect, Page } from '@playwright/test';

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display the register form', async ({ page }) => {
    // Verificar que el formulario esté presente
    await expect(page.locator('h2:has-text("Crear cuenta")')).toBeVisible();
    await expect(page.locator('input[id="fullName"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('input[id="terms"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Crear cuenta")')).toBeVisible();
  });

  test('should show validation errors when submitting empty form', async ({ page }) => {
    // Click submit sin llenar campos
    await page.click('button[type="submit"]:has-text("Crear cuenta")');

    // Verificar errores de validación
    await expect(page.locator('text=El nombre es requerido')).toBeVisible();
    await expect(page.locator('text=El email es requerido')).toBeVisible();
    await expect(page.locator('text=La contraseña es requerida')).toBeVisible();
    await expect(page.locator('text=Debes aceptar los términos y condiciones')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('input[id="email"]', 'invalid-email');
    await page.click('input[id="password"]'); // Trigger blur

    await expect(page.locator('text=Email inválido')).toBeVisible();
  });

  test('should validate password requirements', async ({ page }) => {
    // Password muy corta
    await page.fill('input[id="password"]', 'short');
    await page.click('input[id="email"]'); // Trigger blur

    await expect(page.locator('text=Mínimo 8 caracteres')).toBeVisible();

    // Password sin minúscula
    await page.fill('input[id="password"]', 'PASSWORD123');
    await page.click('input[id="email"]'); // Trigger blur

    await expect(page.locator('text=Debe incluir al menos una minúscula')).toBeVisible();

    // Password sin mayúscula
    await page.fill('input[id="password"]', 'password123');
    await page.click('input[id="email"]'); // Trigger blur

    await expect(page.locator('text=Debe incluir al menos una mayúscula')).toBeVisible();

    // Password sin número
    await page.fill('input[id="password"]', 'Password');
    await page.click('input[id="email"]'); // Trigger blur

    await expect(page.locator('text=Debe incluir al menos un número')).toBeVisible();
  });

  test('should show password requirements dynamically', async ({ page }) => {
    // Verificar que los requisitos cambien de color cuando se cumplan
    const passwordInput = page.locator('input[id="password"]');

    await passwordInput.fill('Pass1234');

    // Verificar que los requisitos cumplidos estén en verde usando data-testid
    await expect(page.locator('[data-testid="requirement-length"]')).toHaveClass(/text-green-600/);
    await expect(page.locator('[data-testid="requirement-lowercase"]')).toHaveClass(/text-green-600/);
    await expect(page.locator('[data-testid="requirement-uppercase"]')).toHaveClass(/text-green-600/);
    await expect(page.locator('[data-testid="requirement-number"]')).toHaveClass(/text-green-600/);
  });

  test('should register successfully with valid data', async ({ page }) => {
    // Mock de la API para simular registro exitoso
    await page.route('/api/v2/auth/register', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            full_name: 'Test User'
          },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token'
          }
        })
      });
    });

    // Llenar formulario con datos válidos
    await page.fill('input[id="fullName"]', 'Test User');
    await page.fill('input[id="email"]', 'test@example.com');
    await page.fill('input[id="password"]', 'SecurePass123');
    await page.check('input[id="terms"]');

    // Submit
    await page.click('button[type="submit"]:has-text("Crear cuenta")');

    // Verificar redirección a dashboard
    await page.waitForURL('**/dashboard');
  });

  test('should handle email already taken error', async ({ page }) => {
    // Mock API response con error de email ya registrado
    await page.route('/api/v2/auth/register', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error_code: 'AUTH_EMAIL_TAKEN',
          message: 'Email already in use'
        })
      });
    });

    await page.fill('input[id="fullName"]', 'Existing User');
    await page.fill('input[id="email"]', 'existing@example.com');
    await page.fill('input[id="password"]', 'SecurePass123');
    await page.check('input[id="terms"]');

    await page.click('button[type="submit"]:has-text("Crear cuenta")');

    // Verificar mensaje de error user-friendly
    await expect(page.locator('text=Este email ya está registrado')).toBeVisible();
  });

  test('should handle rate limit error', async ({ page }) => {
    // Mock API response con error de rate limit
    await page.route('/api/v2/auth/register', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error_code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: 'Too many requests'
        })
      });
    });

    await page.fill('input[id="fullName"]', 'Test User');
    await page.fill('input[id="email"]', 'test@example.com');
    await page.fill('input[id="password"]', 'SecurePass123');
    await page.check('input[id="terms"]');

    await page.click('button[type="submit"]:has-text("Crear cuenta")');

    // Verificar mensaje de rate limit
    await expect(page.locator('text=Demasiados intentos. Espera 15 minutos')).toBeVisible();
  });

  test('should have link to login page', async ({ page }) => {
    const loginLink = page.locator('a:has-text("Inicia sesión")');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/register');

    // Card debe ser visible y no desbordarse
    const card = page.locator('[data-testid="register-card"]');
    await expect(card).toBeVisible();

    // Todos los inputs deben ser visibles
    await expect(page.locator('input[id="fullName"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    // Card debe estar centrada
    const card = page.locator('[data-testid="register-card"]');
    await expect(card).toBeVisible();

    // Formulario debe ser completamente visible
    await expect(page.locator('button[type="submit"]')).toBeInViewport();
  });

  test('should work with dark theme', async ({ page }) => {
    // Simular tema oscuro
    await page.emulateMedia({ colorScheme: 'dark' });

    // Verificar que el formulario sigue siendo visible
    await expect(page.locator('h2:has-text("Crear cuenta")')).toBeVisible();

    // Verificar que los requisitos de password en verde sean visibles en dark mode
    await page.fill('input[id="password"]', 'SecurePass123');
    await expect(page.locator('[data-testid="requirement-length"]')).toHaveClass(/text-green-/);
  });

  test('should work with light theme', async ({ page }) => {
    // Simular tema claro
    await page.emulateMedia({ colorScheme: 'light' });

    // Verificar que el formulario sigue siendo visible
    await expect(page.locator('h2:has-text("Crear cuenta")')).toBeVisible();

    // Verificar que los requisitos de password en verde sean visibles en light mode
    await page.fill('input[id="password"]', 'SecurePass123');
    await expect(page.locator('[data-testid="requirement-length"]')).toHaveClass(/text-green-/);
  });
});

