/**
 * Test fixtures and utilities for E2E authentication tests
 */

export const TEST_USERS = {
  validUser: {
    email: 'valid.user@example.com',
    password: 'ValidPass123!',
    name: 'Valid User'
  },
  
  testUser: () => ({
    email: `test.user+${Date.now()}@example.com`,
    password: 'TestPass123!',
    name: 'Test User'
  }),
  
  adminUser: {
    email: 'admin@example.com',
    password: 'AdminPass123!',
    name: 'Admin User'
  }
};

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
  await expect(emailInput).toHaveAttribute('required');
  await expect(passwordInput).toHaveAttribute('required');
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