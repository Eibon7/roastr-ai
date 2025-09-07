/**
 * Test fixtures and utilities for E2E authentication tests
 */
import { expect } from '@playwright/test';

/**
 * Get test user credentials from environment variables with secure defaults
 * Environment variables should be set for CI/CD environments
 * Defaults are provided for local development only
 */
function getTestUserCredentials() {
  return {
    // Issue #318 - Specific test users as per requirements
    admin: {
      email: process.env.E2E_ADMIN_EMAIL || 'admin@roastr.ai',
      password: process.env.E2E_ADMIN_PASSWORD || 'AdminTest123!',
      name: process.env.E2E_ADMIN_NAME || 'Admin User',
      isAdmin: true
    },

    user: {
      email: process.env.E2E_USER_EMAIL || 'user@roastr.ai',
      password: process.env.E2E_USER_PASSWORD || 'UserTest123!',
      name: process.env.E2E_USER_NAME || 'Regular User',
      isAdmin: false
    },

    // Legacy test users for backward compatibility
    validUser: {
      email: process.env.E2E_VALID_USER_EMAIL || 'valid.user@example.com',
      password: process.env.E2E_VALID_USER_PASSWORD || 'ValidPass123!',
      name: process.env.E2E_VALID_USER_NAME || 'Valid User'
    },

    testUser: () => ({
      email: `test.user+${Date.now()}@example.com`,
      password: process.env.E2E_TEST_USER_PASSWORD || 'TestPass123!',
      name: process.env.E2E_TEST_USER_NAME || 'Test User'
    }),

    adminUser: {
      email: process.env.E2E_ADMIN_USER_EMAIL || 'admin@example.com',
      password: process.env.E2E_ADMIN_USER_PASSWORD || 'AdminPass123!',
      name: process.env.E2E_ADMIN_USER_NAME || 'Admin User'
    }
  };
}

export const TEST_USERS = getTestUserCredentials();

export const INVALID_PASSWORDS = [
  {
    password: '123',
    reason: 'too short, no uppercase, no symbol'
  },
  {
    password: 'password',
    reason: 'no number, no uppercase, no symbol'
  },
  {
    password: 'Password',
    reason: 'no number, no symbol'
  },
  {
    password: 'password123',
    reason: 'no uppercase, no symbol'
  },
  {
    password: 'PASSWORD123',
    reason: 'no lowercase'
  },
  {
    password: 'Pass12',
    reason: 'too short, no symbol'
  }
];

export const VALID_PASSWORDS = [
  'Password123!',
  'MySecure123',
  'Test123$',
  'Strong1!',
  'Complex123#',
  'Secure@123'
];

export const INVALID_EMAILS = [
  'invalid',
  'invalid@',
  '@invalid.com',
  'invalid.com',
  'invalid@.com',
  'invalid@com',
  'invalid@@test.com'
];

/**
 * Wait for authentication to complete and user to be redirected
 * @param {import('@playwright/test').Page} page 
 * @param {string} expectedUrl 
 */
export async function waitForAuthRedirect(page, expectedUrl = '/dashboard') {
  try {
    await page.waitForURL(expectedUrl, { timeout: 10000 });
  } catch (error) {
    // If redirect doesn't happen, check for error messages
    const errorAlert = page.locator('.alert.error');
    if (await errorAlert.isVisible()) {
      const errorText = await errorAlert.textContent();
      throw new Error(`Authentication failed with error: ${errorText}`);
    }
    throw error;
  }
}

/**
 * Fill authentication form
 * @param {import('@playwright/test').Page} page 
 * @param {Object} credentials 
 */
export async function fillAuthForm(page, credentials) {
  if (credentials.name) {
    await page.fill('[name="name"]', credentials.name);
  }
  
  if (credentials.email) {
    await page.fill('[name="email"]', credentials.email);
  }
  
  if (credentials.password) {
    await page.fill('[name="password"]', credentials.password);
  }
}

/**
 * Submit form and wait for response
 * @param {import('@playwright/test').Page} page 
 */
export async function submitAuthForm(page) {
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();
  
  // Wait for either success or error response
  await page.waitForLoadState('networkidle');
}

/**
 * Check if password validation is working correctly
 * @param {import('@playwright/test').Page} page 
 * @param {string} password 
 * @param {boolean} shouldBeValid 
 */
export async function checkPasswordValidation(page, password, shouldBeValid) {
  const passwordInput = page.locator('[name="password"]');
  const submitButton = page.locator('button[type="submit"]');
  
  await passwordInput.fill(password);
  
  if (shouldBeValid) {
    await expect(submitButton).not.toBeDisabled();
  } else {
    await expect(submitButton).toBeDisabled();
  }
}

/**
 * Navigate to authentication page
 * @param {import('@playwright/test').Page} page 
 * @param {string} type - 'login' or 'register'
 */
export async function navigateToAuth(page, type = 'login') {
  await page.goto(`/${type}`);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Check for accessibility issues in auth forms
 * @param {import('@playwright/test').Page} page 
 */
export async function checkAuthAccessibility(page) {
  // Check for required form labels
  const emailLabel = page.locator('label[for="email"]');
  const passwordLabel = page.locator('label[for="password"]');
  
  await expect(emailLabel).toBeVisible();
  await expect(passwordLabel).toBeVisible();
  
  // Check for proper form attributes
  const emailInput = page.locator('[name="email"]');
  const passwordInput = page.locator('[name="password"]');
  
  await expect(emailInput).toHaveAttribute('type', 'email');
  await expect(emailInput).toHaveJSProperty('required', true);
  await expect(passwordInput).toHaveJSProperty('required', true);
}

/**
 * Create a test user via API (if available)
 * @param {Object} userData 
 */
export async function createTestUser(userData) {
  // This would typically make an API call to create a test user
  // For now, we'll just return the user data
  console.log('Creating test user:', userData);
  return userData;
}

/**
 * Clean up test users after tests
 * @param {string} email 
 */
export async function cleanupTestUser(email) {
  // This would typically make an API call to delete the test user
  console.log('Cleaning up test user:', email);
}

/**
 * Mock network responses for testing error scenarios
 * @param {import('@playwright/test').Page} page
 * @param {string} endpoint
 * @param {number} status
 * @param {Object} response
 */
export async function mockNetworkResponse(page, endpoint, status, response) {
  await page.route(endpoint, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });
}

/**
 * Mock successful login response for Issue #318 test users
 * @param {import('@playwright/test').Page} page
 * @param {Object} user - User object with email, password, isAdmin
 */
export async function mockLoginSuccess(page, user) {
  await page.unroute('**/api/auth/login').catch(() => {});
  await page.route('**/api/auth/login', async route => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    let requestBody = {};
    try {
      requestBody = route.request().postDataJSON();
    } catch (error) {
      // Log parsing error for debugging while preserving fallback behavior
      console.warn('Failed to parse request body as JSON in mockLoginSuccess:', error.message);
      // Fallback to empty object for non-JSON requests
    }

    if (requestBody.email === user.email && requestBody.password === user.password) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Login successful',
          data: {
            access_token: 'mock-jwt-token',
            refresh_token: 'mock-refresh-token',
            expires_at: Date.now() + 3600000, // 1 hour
            user: {
              id: user.isAdmin ? 'admin-user-id' : 'regular-user-id',
              email: user.email,
              email_confirmed: true,
              is_admin: user.isAdmin,
              name: user.name,
              plan: user.isAdmin ? 'enterprise' : 'free'
            }
          }
        })
      });
    } else {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Email o contraseña incorrectos'
        })
      });
    }
  });
}

/**
 * Mock feature flags response
 * @param {import('@playwright/test').Page} page
 * @param {Object} flags - Feature flags object
 */
export async function mockFeatureFlags(page, flags = {}) {
  await page.unroute('**/api/config/flags').catch(() => {});
  const defaultFlags = {
    ENABLE_SHOP: false,
    ENABLE_STYLE_PROFILE: true,
    ENABLE_RQC: false,
    ENABLE_SHIELD: false,
    ENABLE_BILLING: false,
    ...flags
  };

  await page.route('**/api/config/flags', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        flags: defaultFlags
      })
    });
  });
}

/**
 * Mock logout response
 * @param {import('@playwright/test').Page} page
 */
export async function mockLogout(page) {
  await page.unroute('**/api/auth/logout').catch(() => {});
  await page.route('**/api/auth/logout', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Logout successful'
      })
    });
  });
}

/**
 * Setup authentication state for a user
 * @param {import('@playwright/test').Page} page
 * @param {Object} user - User object
 *
 * WARNING: This test fixture uses localStorage for tokens which is INSECURE.
 * TODO: This is for testing purposes only and must NEVER be used in production.
 * Production applications should use httpOnly cookies for secure token storage.
 */
export async function setupAuthState(page, user) {
  // Set localStorage with auth data (TEST ONLY - use httpOnly cookies in production)
  await page.addInitScript((userData) => {
    localStorage.setItem('auth_token', 'mock-jwt-token');
    localStorage.setItem('refresh_token', 'mock-refresh-token');
    localStorage.setItem('user_data', JSON.stringify({
      id: userData.isAdmin ? 'admin-user-id' : 'regular-user-id',
      email: userData.email,
      name: userData.name,
      is_admin: userData.isAdmin,
      plan: userData.isAdmin ? 'enterprise' : 'free'
    }));
  }, user);
}

/**
 * Clear authentication state
 * @param {import('@playwright/test').Page} page
 */
export async function clearAuthState(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
  });
}