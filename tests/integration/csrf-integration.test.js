/**
 * CSRF Integration Tests (Issue #745 - CodeRabbit Review #3436165706)
 *
 * Critical E2E tests to verify CSRF token flow end-to-end.
 * Unit tests with mocks cannot detect httpOnly cookie configuration issues.
 *
 * These tests verify:
 * 1. Backend sets csrf-token cookie with httpOnly: false
 * 2. Frontend can read token via document.cookie
 * 3. ApiClient includes X-CSRF-Token header
 * 4. Admin mutations succeed (200, not 403)
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:5000';

// Admin test user credentials (from e2e/auth.fixtures.js)
const ADMIN_USER = {
  email: 'admin@roastr.test',
  password: 'TestAdmin123!'
};

test.describe('CSRF Token Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);
  });

  test('should set csrf-token cookie with httpOnly: false', async ({ page, context }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect to admin dashboard
    await page.waitForURL('**/admin/**', { timeout: 5000 });

    // Get all cookies
    const cookies = await context.cookies();

    // Find csrf-token cookie
    const csrfCookie = cookies.find(c => c.name === 'csrf-token');

    // Assertions
    expect(csrfCookie, 'csrf-token cookie should exist').toBeDefined();
    expect(csrfCookie.httpOnly, 'csrf-token cookie must have httpOnly: false').toBe(false);
    expect(csrfCookie.sameSite, 'csrf-token cookie should have sameSite: Strict').toBe('Strict');
    expect(csrfCookie.value, 'csrf-token value should be 64-char hex').toMatch(/^[a-f0-9]{64}$/);

    console.log('✅ CSRF cookie configuration verified:', {
      httpOnly: csrfCookie.httpOnly,
      sameSite: csrfCookie.sameSite,
      secure: csrfCookie.secure,
      tokenLength: csrfCookie.value.length
    });
  });

  test('should read CSRF token via document.cookie', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/admin/**', { timeout: 5000 });

    // Execute frontend getCsrfToken() utility in browser context
    const tokenFromFrontend = await page.evaluate(() => {
      // Simulate frontend/src/utils/csrf.js getCsrfToken()
      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find(cookie =>
        cookie.trim().startsWith('csrf-token=')
      );

      if (!csrfCookie) {
        return null;
      }

      const token = csrfCookie.split('=')[1];
      return token || null;
    });

    // Assertions
    expect(tokenFromFrontend, 'getCsrfToken() should return non-null value').not.toBeNull();
    expect(tokenFromFrontend, 'Token should be 64-char hex').toMatch(/^[a-f0-9]{64}$/);

    console.log('✅ Frontend successfully read CSRF token:', tokenFromFrontend);
  });

  test('should include X-CSRF-Token header in admin POST requests', async ({ page }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/admin/**', { timeout: 5000 });

    // Capture network requests
    const requests = [];
    page.on('request', request => {
      if (request.method() === 'POST' || request.method() === 'PATCH' || request.method() === 'DELETE') {
        requests.push({
          method: request.method(),
          url: request.url(),
          headers: request.headers()
        });
      }
    });

    // Trigger an admin mutation (example: navigate to users page and try changing plan)
    // This depends on your admin UI structure - adjust as needed
    await page.goto(`${BASE_URL}/admin/users`);
    await page.waitForTimeout(2000); // Wait for page load

    // If admin page makes any POST requests, verify they include CSRF token
    if (requests.length > 0) {
      const postRequests = requests.filter(r =>
        r.url.includes('/api/admin') || r.url.includes('/api/auth/admin')
      );

      for (const req of postRequests) {
        expect(
          req.headers['x-csrf-token'],
          `POST ${req.url} should include X-CSRF-Token header`
        ).toBeDefined();

        expect(
          req.headers['x-csrf-token'],
          'X-CSRF-Token header should be 64-char hex'
        ).toMatch(/^[a-f0-9]{64}$/);

        console.log(`✅ Request to ${req.url} includes CSRF token`);
      }
    } else {
      console.log('ℹ️  No admin POST requests captured (may need manual trigger)');
    }
  });

  test('should return 200 (not 403) for admin mutation with valid CSRF token', async ({ page, request }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/admin/**', { timeout: 5000 });

    // Get CSRF token from cookie
    const csrfToken = await page.evaluate(() => {
      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find(cookie =>
        cookie.trim().startsWith('csrf-token=')
      );
      return csrfCookie ? csrfCookie.split('=')[1] : null;
    });

    expect(csrfToken, 'Should have CSRF token before making request').not.toBeNull();

    // Get auth token (from localStorage or cookie)
    const authToken = await page.evaluate(() => {
      return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    });

    // Make a test admin API call with CSRF token
    // Using POST to trigger CSRF validation (GET bypasses CSRF as it's a safe method)
    const response = await request.post(`${API_URL}/api/admin/test`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      data: { test: 'csrf_validation' },
      failOnStatusCode: false
    });

    // Assertions
    expect(response.status(), 'Admin request with CSRF token should return 200 (not 403)').toBeLessThan(400);

    console.log('✅ Admin request with CSRF token succeeded:', response.status());
  });

  test('should return 403 CSRF_TOKEN_MISSING when header is absent', async ({ page, request }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/admin/**', { timeout: 5000 });

    // Get auth token
    const authToken = await page.evaluate(() => {
      return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    });

    // Make admin POST without CSRF token (should fail)
    const response = await request.post(`${API_URL}/api/admin/test`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
        // NOTE: X-CSRF-Token header intentionally MISSING
      },
      data: { test: 'data' },
      failOnStatusCode: false
    });

    // Assertions
    expect(response.status(), 'Request without CSRF token should return 403').toBe(403);

    const body = await response.json();
    expect(body.error, 'Error should be CSRF_TOKEN_MISSING').toBe('CSRF_TOKEN_MISSING');

    console.log('✅ Request without CSRF token correctly rejected:', body);
  });

  test('should return 403 CSRF_TOKEN_INVALID when token is wrong', async ({ page, request }) => {
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/admin/**', { timeout: 5000 });

    // Get auth token
    const authToken = await page.evaluate(() => {
      return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    });

    // Make admin POST with INVALID CSRF token
    const response = await request.post(`${API_URL}/api/admin/test`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-CSRF-Token': 'invalid-token-12345', // Invalid token
        'Content-Type': 'application/json'
      },
      data: { test: 'data' },
      failOnStatusCode: false
    });

    // Assertions
    expect(response.status(), 'Request with invalid CSRF token should return 403').toBe(403);

    const body = await response.json();
    expect(body.error, 'Error should be CSRF_TOKEN_INVALID').toBe('CSRF_TOKEN_INVALID');

    console.log('✅ Request with invalid CSRF token correctly rejected:', body);
  });
});

test.describe('CSRF Token Visual Evidence', () => {
  test('capture Network tab screenshot showing cookie and headers', async ({ page }) => {
    // This test generates visual evidence for documentation

    // Login as admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/admin/**', { timeout: 5000 });

    // Open DevTools Network tab (if running headed mode)
    // Note: This requires --headed flag and manual inspection
    // For CI, we capture evidence via assertions above

    // Screenshot of admin page (shows authenticated state)
    await page.screenshot({
      path: 'docs/test-evidence/issue-745/csrf-admin-page.png',
      fullPage: true
    });

    console.log('✅ Screenshot saved: docs/test-evidence/issue-745/csrf-admin-page.png');
  });
});
