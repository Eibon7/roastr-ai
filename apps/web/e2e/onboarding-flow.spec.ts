import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E coverage for the first core flow: signup -> onboarding wizard ->
 * connect an account via OAuth.
 *
 * Why network mocks instead of a real backend/Supabase/OAuth provider:
 * - `apps/web`'s Supabase client (src/lib/supabase-client.ts) falls back to
 *   the placeholder `http://localhost:54321` when VITE_SUPABASE_URL isn't
 *   set, which is what happens when `npm run dev` is started by
 *   playwright.config.ts's webServer in this environment — nothing listens
 *   on that port, so a real signInWithPassword call would hang/fail.
 * - apps/api isn't started by the e2e webServer either (only `vite dev` is),
 *   so /api/* calls have nothing real to hit.
 * - Driving a real Google/X OAuth consent screen from an automated test is
 *   not deterministic and requires live third-party credentials.
 *
 * Instead, this suite intercepts at the Playwright network layer
 * (page.route) exactly the calls the real app makes — POST /auth/v1/token
 * (Supabase), POST /api/auth/register, GET/POST /api/auth/onboarding, and
 * GET /api/oauth/:platform/authorize — and resolves the OAuth step by
 * handing back the same `?success=youtube` query the real backend redirect
 * would produce (see apps/api/src/modules/oauth/oauth.controller.ts
 * `buildRedirectUrl`), rather than trying to click through a real provider.
 *
 * Known product gap surfaced while building this suite (not fixed here,
 * out of scope for apps/web/e2e): `/connect` is wrapped in
 * `RequireOnboarding` (see App.tsx's `ProtectedWithLayout`), so navigating
 * there via the wizard's "Conectar cuentas" button while the backend
 * onboarding state is still "connect_accounts" (not "done") immediately
 * redirects back to /onboarding — the button can never actually land on the
 * connect-accounts UI. Confirmed with a throwaway probe test against the
 * real app code. That's why the OAuth-return test below simulates the
 * resolved callback landing directly on /onboarding (which is exactly what
 * the task description's suggested pragmatic approach — "simula la
 * redirección de vuelta con el callback ya resuelto" — describes) instead
 * of clicking through /connect.
 */

const TEST_PASSWORD = 'Sup3rSecret!1';

function fakeSupabaseSession(userId: string, email: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: `fake-access-token-${userId}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `fake-refresh-token-${userId}`,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

type MockBackend = {
  getPersistedStates: () => string[];
  getState: () => string;
};

/**
 * Installs all network mocks needed to drive the signup -> onboarding flow
 * without a real backend, Supabase project, or OAuth provider. Must be
 * called before the first `page.goto`.
 */
async function mockBackend(
  page: Page,
  opts: { onboardingState?: string } = {},
): Promise<MockBackend> {
  const userId = `e2e-user-${test.info().testId}`;
  const email = `${userId}@roastr.test`;
  let onboardingState = opts.onboardingState ?? 'welcome';
  const persistedStates: string[] = [];

  // Supabase Auth: sign-in performed by RegisterPage right after our own
  // backend's /auth/register call succeeds.
  await page.route('**/auth/v1/token**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSupabaseSession(userId, email)),
    });
  });

  // Everything else the app talks to is our own backend, reached through
  // the /api/* prefix (see src/lib/api.ts). One handler, dispatched by path,
  // keeps route-registration ordering irrelevant.
  await page.route('**/api/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = req.method();

    if (path === '/auth/register' && method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: userId }),
      });
      return;
    }

    if (path === '/auth/onboarding') {
      if (method === 'POST') {
        const body = req.postDataJSON() as { state: string };
        onboardingState = body.state;
        persistedStates.push(body.state);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: onboardingState }),
      });
      return;
    }

    if (/^\/oauth\/(youtube|x)\/authorize$/.test(path) && method === 'GET') {
      // Collapse the entire provider round-trip (authorize -> consent
      // screen -> provider callback -> our backend's redirect) into the
      // single URL the frontend receives, matching
      // buildRedirectUrl(frontendUrl, returnTo, { success: platform }).
      const platform = path.includes('youtube') ? 'youtube' : 'x';
      const returnTo = url.searchParams.get('returnTo');
      const dest =
        returnTo === 'onboarding'
          ? `/onboarding?success=${platform}`
          : `/connect?success=${platform}`;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: dest }),
      });
      return;
    }

    if (path === '/accounts' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    // Fallback for the assorted dashboard widgets (Shield stats, roast
    // review list, billing usage, etc.) this suite doesn't exercise
    // directly — return an empty-ish success so they don't hang the page
    // in a loading state or spam retries.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(method === 'GET' ? [] : {}),
    });
  });

  return {
    getPersistedStates: () => persistedStates,
    getState: () => onboardingState,
  };
}

async function registerNewUser(page: Page) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`probe-${Date.now()}@roastr.test`);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign up/i }).click();
}

test.describe('signup -> onboarding -> connect account (e2e)', () => {
  test('a new user is routed to /onboarding and cannot reach a protected route without completing it', async ({
    page,
  }) => {
    const backend = await mockBackend(page, { onboardingState: 'welcome' });
    await registerNewUser(page);

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByRole('heading', { name: /bienvenido a roastr/i }),
    ).toBeVisible();

    // Jumping straight to a protected route is bounced back to /onboarding
    // by RequireOnboarding, since the backend still reports an incomplete
    // state ("welcome").
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/onboarding/);
    expect(backend.getState()).toBe('welcome');
  });

  test('choosing "Saltar por ahora" on connect_accounts completes onboarding and reaches /dashboard', async ({
    page,
  }) => {
    const backend = await mockBackend(page, { onboardingState: 'connect_accounts' });
    await registerNewUser(page);

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByRole('heading', { name: /conecta tus cuentas/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /saltar por ahora/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    expect(backend.getPersistedStates()).toContain('done');
    expect(backend.getState()).toBe('done');
  });

  test('the wizard persists the current step via POST /auth/onboarding as the user advances', async ({
    page,
  }) => {
    const backend = await mockBackend(page, { onboardingState: 'welcome' });
    await registerNewUser(page);

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByRole('heading', { name: /bienvenido a roastr/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /^continuar$/i }).click();
    await expect(
      page.getByRole('heading', { name: /elige tu plan/i }),
    ).toBeVisible();
    await expect
      .poll(() => backend.getPersistedStates())
      .toContain('select_plan');

    await page.getByRole('button', { name: /^elegir$/i }).first().click();
    await expect(page.getByRole('heading', { name: /^pago$/i })).toBeVisible();
    await expect.poll(() => backend.getPersistedStates()).toContain('payment');

    // A page reload resumes exactly where the user left off, proving the
    // step survives via the backend rather than local component state.
    await page.reload();
    await expect(page.getByRole('heading', { name: /^pago$/i })).toBeVisible();
    expect(backend.getState()).toBe('payment');
  });

  test('a resolved OAuth return for connect_accounts completes onboarding and navigates to /dashboard', async ({
    page,
  }) => {
    const backend = await mockBackend(page, { onboardingState: 'connect_accounts' });
    await registerNewUser(page);

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByRole('heading', { name: /conecta tus cuentas/i }),
    ).toBeVisible();

    // Simulate the browser landing back from a successful OAuth round trip
    // — this is exactly the URL OnboardingWizard's effect inspects
    // (searchParams "success"/"error"), and exactly what the real backend
    // redirect produces for returnTo=onboarding.
    await page.goto('/onboarding?success=youtube');

    await expect(page).toHaveURL(/\/dashboard/);
    expect(backend.getPersistedStates()).toContain('done');
    expect(backend.getState()).toBe('done');
  });

  test('an OAuth error return shows an error message and keeps the user on connect_accounts', async ({
    page,
  }) => {
    const backend = await mockBackend(page, { onboardingState: 'connect_accounts' });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/onboarding/);

    await page.goto('/onboarding?error=access_denied');

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(
      page.getByRole('heading', { name: /conecta tus cuentas/i }),
    ).toBeVisible();
    await expect(page.getByText(/acceso denegado/i)).toBeVisible();
    expect(backend.getState()).toBe('connect_accounts');
  });
});
