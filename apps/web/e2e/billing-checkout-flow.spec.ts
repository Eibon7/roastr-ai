import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E coverage for the billing core flow: plan selection -> Polar checkout
 * -> webhook -> UsageWidget reflecting the new plan/usage.
 *
 * Why network mocks instead of a real backend/Supabase/Polar (see the same
 * rationale in onboarding-flow.spec.ts, which this suite follows):
 * - apps/api and a real Supabase/Polar sandbox aren't started by the e2e
 *   webServer (only `vite dev` is), so /api/* and Polar have nothing real to
 *   hit.
 * - There is no way to complete a real payment from an automated test —
 *   Polar's hosted checkout requires a live card/session and human/webhook
 *   round-trip that isn't reproducible deterministically in CI.
 *
 * This suite intercepts at the Playwright network layer (page.route) the
 * calls the real app makes — POST /auth/v1/token (Supabase), POST
 * /api/auth/register, GET/POST /api/auth/onboarding, GET /api/billing/usage
 * and POST /api/billing/checkout — and additionally mocks the fake Polar
 * checkout URL returned by our own backend, so `window.location.href = url`
 * (the real redirect BillingController.createCheckout's frontend caller
 * performs — see OnboardingWizard.tsx's payment step) resolves
 * deterministically without ever leaving the test sandbox. The Polar
 * webhook itself (POST /webhooks/polar, see
 * apps/api/src/modules/billing/polar-webhook.controller.ts) is simulated by
 * simply changing what our mocked GET /billing/usage returns before the
 * next fetch — exactly the observable effect a real webhook has on
 * `subscriptions_usage`, from the frontend's point of view.
 *
 * Known product gap surfaced while building this suite (not fixed here, out
 * of scope for apps/web/e2e): BillingPage's "Cambiar plan" button is a bare
 * `<a href="/onboarding">` (see BillingPage.tsx) with no plan preselection,
 * and OnboardingWizard's own effect immediately redirects to /dashboard the
 * instant it sees the backend's onboarding state as "done" (its very first
 * effect, before ever rendering a step) — which is exactly the state a
 * paying user on /billing already has. So today, clicking "Cambiar plan"
 * from /billing can never actually reach the plan/payment steps again; it
 * bounces straight back to /dashboard. Confirmed by reading
 * OnboardingWizard.tsx line by line, not assumed. Because of that, the
 * checkout-call test below drives the wizard directly with an in-progress
 * onboarding state (`select_plan`), which is the only path in the current
 * app that actually reaches the "Ir a Polar checkout" button and calls
 * POST /billing/checkout — the same component/button a first-time
 * subscriber uses during onboarding.
 */

const TEST_PASSWORD = 'Sup3rSecret!1';
const FAKE_CHECKOUT_URL = 'https://sandbox.polar.sh/checkout/cs_test_e2e';

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

type Usage = {
  plan: string;
  billing_state: string;
  analysis_limit: number;
  analysis_used: number;
  roasts_limit: number;
  roasts_used: number;
  current_period_end: string | null;
  trial_end: string | null;
};

const STARTER_TRIAL_USAGE: Usage = {
  plan: 'starter',
  billing_state: 'trialing',
  analysis_limit: 1000,
  analysis_used: 120,
  roasts_limit: 0,
  roasts_used: 0,
  current_period_end: null,
  trial_end: '2026-08-10T00:00:00.000Z',
};

// The state subscriptions_usage would be in immediately after Polar sends a
// `subscription.active` webhook for an upgrade to "pro" (see
// polar-webhook.controller.ts's SUBSCRIPTION_ACTIVE handling).
const PRO_ACTIVE_USAGE: Usage = {
  plan: 'pro',
  billing_state: 'active',
  analysis_limit: 10000,
  analysis_used: 120,
  roasts_limit: 0,
  roasts_used: 0,
  current_period_end: '2026-08-11T00:00:00.000Z',
  trial_end: null,
};

type MockBackend = {
  getCheckoutCalls: () => Array<{ plan: string }>;
  setUsage: (usage: Usage) => void;
};

/**
 * Installs all network mocks needed to drive the billing flow without a
 * real backend, Supabase project, or Polar sandbox. Must be called before
 * the first `page.goto`.
 */
async function mockBackend(
  page: Page,
  opts: { onboardingState?: string; usage: Usage },
): Promise<MockBackend> {
  const userId = `e2e-user-${test.info().testId}`;
  const email = `${userId}@roastr.test`;
  let onboardingState = opts.onboardingState ?? 'done';
  let usage = opts.usage;
  const checkoutCalls: Array<{ plan: string }> = [];

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
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: onboardingState }),
      });
      return;
    }

    if (path === '/billing/usage' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(usage),
      });
      return;
    }

    if (path === '/billing/checkout' && method === 'POST') {
      const body = req.postDataJSON() as { plan: string };
      checkoutCalls.push({ plan: body.plan });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ url: FAKE_CHECKOUT_URL }),
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
    // review list, etc.) this suite doesn't exercise directly — return an
    // empty-ish success so they don't hang the page in a loading state or
    // spam retries.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(method === 'GET' ? [] : {}),
    });
  });

  // The Polar hosted checkout page itself: `window.location.href = url` in
  // OnboardingWizard's payment step performs a real, full-page navigation to
  // whatever URL our mocked /billing/checkout returns. Intercepting it here
  // means that navigation resolves against the Playwright sandbox instead of
  // trying to reach an actual Polar server (there is no live payment session
  // to complete in an automated test).
  await page.route(FAKE_CHECKOUT_URL, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1>Polar checkout (mocked)</h1></body></html>',
    });
  });

  return {
    getCheckoutCalls: () => checkoutCalls,
    setUsage: (next: Usage) => {
      usage = next;
    },
  };
}

async function registerNewUser(page: Page) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`probe-${Date.now()}@roastr.test`);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign up/i }).click();
}

test.describe('billing: plan selection -> checkout -> webhook -> UsageWidget (e2e)', () => {
  test('BillingPage shows the current plan and usage via UsageWidget', async ({ page }) => {
    await mockBackend(page, { onboardingState: 'done', usage: STARTER_TRIAL_USAGE });
    await registerNewUser(page);

    // Onboarding is already "done" for this user, so OnboardingWizard's own
    // first effect bounces straight to /dashboard.
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/billing');

    await expect(page.getByText(/plan starter/i)).toBeVisible();
    await expect(page.getByText(/trialing/i)).toBeVisible();
    await expect(page.getByText(/120\s*\/\s*1,?000/)).toBeVisible();
    await expect(page.getByText(/880\s*restantes/)).toBeVisible();
    await expect(page.getByText(/trial hasta/i)).toBeVisible();
  });

  test('choosing a plan and confirming payment calls POST /billing/checkout with the right plan and redirects to Polar', async ({
    page,
  }) => {
    const backend = await mockBackend(page, {
      onboardingState: 'select_plan',
      usage: STARTER_TRIAL_USAGE,
    });
    await registerNewUser(page);

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole('heading', { name: /elige tu plan/i })).toBeVisible();

    // Pick the "pro" plan from the comparison table.
    await page
      .getByRole('row', { name: /pro/i })
      .getByRole('button', { name: /^elegir$/i })
      .click();

    await expect(page.getByRole('heading', { name: /^pago$/i })).toBeVisible();
    await expect(page.getByText(/plan\s+pro/i)).toBeVisible();

    await page.getByRole('button', { name: /ir a polar checkout/i }).click();

    await expect.poll(() => backend.getCheckoutCalls()).toEqual([{ plan: 'pro' }]);

    // The real redirect to Polar's hosted checkout (mocked at the network
    // layer — see mockBackend's FAKE_CHECKOUT_URL route).
    await expect(page).toHaveURL(FAKE_CHECKOUT_URL);
    await expect(page.getByRole('heading', { name: /polar checkout \(mocked\)/i })).toBeVisible();
  });

  test('after the webhook is simulated, UsageWidget reflects the new plan/limits on reload', async ({
    page,
  }) => {
    const backend = await mockBackend(page, { onboardingState: 'done', usage: STARTER_TRIAL_USAGE });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/billing');
    await expect(page.getByText(/plan starter/i)).toBeVisible();
    await expect(page.getByText(/trialing/i)).toBeVisible();

    // Simulate Polar's webhook having already updated subscriptions_usage
    // server-side (see polar-webhook.controller.ts) — from the frontend's
    // perspective, this is indistinguishable from GET /billing/usage simply
    // returning a different row.
    backend.setUsage(PRO_ACTIVE_USAGE);

    await page.reload();

    await expect(page.getByText(/plan pro/i)).toBeVisible();
    await expect(page.getByText(/active/i)).toBeVisible();
    await expect(page.getByText(/120\s*\/\s*10,?000/)).toBeVisible();
    await expect(page.getByText(/9,?880\s*restantes/)).toBeVisible();
    // Trial has ended for a paid "active" subscription.
    await expect(page.getByText(/trial hasta/i)).not.toBeVisible();
  });
});
