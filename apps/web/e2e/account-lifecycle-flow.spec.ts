import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E coverage for the last core flow: the lifecycle of an already-connected
 * account — disconnect (with the 90-day GDPR retention window), pause/resume,
 * and reconnecting an account whose OAuth token has broken.
 *
 * Why network mocks instead of a real backend/OAuth provider (same rationale
 * as the other suites in this directory, most closely mirroring
 * onboarding-flow.spec.ts's handling of GET /oauth/:platform/authorize):
 * - apps/api isn't started by the e2e webServer (only `vite dev` is), so
 *   /api/* calls have nothing real to hit.
 * - Driving a real Google/X OAuth consent screen to prove reconnection isn't
 *   deterministic and requires live third-party credentials. This suite
 *   mocks GET /oauth/:platform/authorize as apps/api's
 *   OAuthController.authorize would answer for a healthy request, and
 *   asserts the frontend actually performs the resulting
 *   `window.location.href` navigation (ConnectedAccounts.tsx's
 *   `handleConnect`) — unlike onboarding-flow.spec.ts, which only needed to
 *   simulate the *return* leg of that trip, this suite's "Reconectar" button
 *   reuses the exact same handler, so proving the outbound redirect fires is
 *   the actual behavior under test here.
 *
 * The component-level rendering/branching logic (which actions show for
 * which status, disabled states, error handling) is already covered solidly
 * by apps/web/test/components/accounts/ConnectedAccounts.spec.tsx. This suite
 * intentionally does not re-test that in isolation — it drives the same
 * flows through real navigation (signup -> /accounts) and a real backend
 * round trip simulated at the network layer, exactly like a user would
 * experience it.
 *
 * ConnectedAccounts is rendered at both /connect and /accounts (see
 * App.tsx); this suite uses /accounts since it's the dedicated
 * "manage your connected accounts" destination, not part of onboarding.
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

type Account = {
  id: string;
  platform: string;
  username: string;
  status: 'active' | 'paused' | 'revoked' | 'error';
  status_reason: string | null;
  integration_health: string;
  retention_until: string | null;
};

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-yt-1',
    platform: 'youtube',
    username: 'roastr-channel',
    status: 'active',
    status_reason: null,
    integration_health: 'ok',
    retention_until: null,
    ...overrides,
  };
}

type MockBackend = {
  getAccounts: () => Account[];
  getPauseCalls: () => Array<{ id: string; paused: boolean }>;
  getDisconnectCalls: () => string[];
  getAuthorizeCalls: () => string[];
};

/**
 * Installs all network mocks needed to drive the account-lifecycle flow
 * without a real backend, Supabase project, or OAuth provider. `accounts`
 * acts as the backing store for GET /accounts: DELETE /accounts/:id and
 * PATCH /accounts/:id/pause mutate it in place, exactly like the real
 * AccountsService/Supabase round-trip would. Must be called before the first
 * `page.goto`.
 */
async function mockBackend(
  page: Page,
  opts: { accounts?: Account[] } = {},
): Promise<MockBackend> {
  const userId = `e2e-user-${test.info().testId}`;
  const email = `${userId}@roastr.test`;
  let accounts = opts.accounts ?? [];
  const pauseCalls: Array<{ id: string; paused: boolean }> = [];
  const disconnectCalls: string[] = [];
  const authorizeCalls: string[] = [];

  await page.route('**/auth/v1/token**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fakeSupabaseSession(userId, email)),
    });
  });

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
      // This suite only cares about the post-onboarding accounts screen, so
      // onboarding is always reported as already completed — otherwise
      // RequireOnboarding would bounce /accounts back to /onboarding (see
      // onboarding-flow.spec.ts's header comment for the same gotcha).
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: 'done' }),
      });
      return;
    }

    if (path === '/accounts' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accounts),
      });
      return;
    }

    const disconnectMatch = path.match(/^\/accounts\/([^/]+)$/);
    if (disconnectMatch && method === 'DELETE') {
      const id = disconnectMatch[1];
      disconnectCalls.push(id);
      // Faithful to AccountsService.disconnectByUserAndId: the row isn't
      // deleted, it flips to "revoked" with a 90-day retention_until, so it
      // still shows up in the next GET /accounts (see
      // accounts.controller.ts's DELETE handler and ConnectedAccounts.tsx's
      // "revoked" badge/retention rendering).
      const retentionUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      accounts = accounts.map((a) =>
        a.id === id ? { ...a, status: 'revoked' as const, retention_until: retentionUntil } : a,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ disconnected: true }),
      });
      return;
    }

    const pauseMatch = path.match(/^\/accounts\/([^/]+)\/pause$/);
    if (pauseMatch && method === 'PATCH') {
      const id = pauseMatch[1];
      const body = req.postDataJSON() as { paused: boolean };
      pauseCalls.push({ id, paused: body.paused });
      accounts = accounts.map((a) =>
        a.id === id ? { ...a, status: (body.paused ? 'paused' : 'active') as Account['status'] } : a,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ paused: body.paused }),
      });
      return;
    }

    const authorizeMatch = path.match(/^\/oauth\/(youtube|x)\/authorize$/);
    if (authorizeMatch && method === 'GET') {
      // Faithful to OAuthController.authorize: returns the provider consent
      // URL the frontend should redirect to. We don't need a real
      // Google/X URL here — only that ConnectedAccounts.tsx's handleConnect
      // actually performs `window.location.href = url` with it.
      authorizeCalls.push(authorizeMatch[1]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: `https://reconnect.roastr.test/${authorizeMatch[1]}/consent`,
        }),
      });
      return;
    }

    // Fallback for the assorted dashboard widgets this suite doesn't
    // exercise directly — return an empty-ish success so they don't hang the
    // page in a loading state or spam retries.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(method === 'GET' ? [] : {}),
    });
  });

  // The reconnect destination itself: `window.location.href = url` performs
  // a real, full-page navigation. Intercepting it means that navigation
  // resolves against the Playwright sandbox instead of trying to reach an
  // actual OAuth provider (see billing-checkout-flow.spec.ts's analogous
  // handling of the Polar checkout redirect).
  await page.route('https://reconnect.roastr.test/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body><h1>OAuth consent (mocked)</h1></body></html>',
    });
  });

  return {
    getAccounts: () => accounts,
    getPauseCalls: () => pauseCalls,
    getDisconnectCalls: () => disconnectCalls,
    getAuthorizeCalls: () => authorizeCalls,
  };
}

async function registerNewUser(page: Page) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`probe-${Date.now()}@roastr.test`);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign up/i }).click();
}

test.describe('account lifecycle: disconnect, pause/resume, reconnect after a broken token (e2e)', () => {
  test('the user sees their connected accounts with active, paused and broken statuses', async ({
    page,
  }) => {
    await mockBackend(page, {
      accounts: [
        makeAccount({ id: 'acc-yt-1', platform: 'youtube', username: 'roastr-channel', status: 'active' }),
        makeAccount({ id: 'acc-x-1', platform: 'x', username: 'roastr', status: 'paused' }),
        makeAccount({ id: 'acc-x-2', platform: 'x', username: 'roastr-broken', status: 'error' }),
      ],
    });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/accounts');

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    const activeRow = table.getByRole('row').filter({ hasText: 'roastr-channel' });
    await expect(activeRow.getByText('Activa')).toBeVisible();

    const pausedRow = table.getByRole('row').filter({ hasText: '@roastr' }).filter({ hasNotText: 'broken' });
    await expect(pausedRow.getByText('Pausada')).toBeVisible();

    const brokenRow = table.getByRole('row').filter({ hasText: 'roastr-broken' });
    await expect(brokenRow.getByText('Token expirado')).toBeVisible();
    await expect(brokenRow.getByRole('button', { name: 'Reconectar cuenta' })).toBeVisible();
  });

  test('disconnecting an account shows a confirmation dialog and, on confirm, marks it as disconnected with the retention notice', async ({
    page,
  }) => {
    const backend = await mockBackend(page, {
      accounts: [makeAccount({ id: 'acc-yt-1', status: 'active' })],
    });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/accounts');
    // ConnectedAccounts renders the account list twice — a desktop <table>
    // and a mobile accordion, toggled by CSS breakpoints (see
    // shield-blocking-flow.spec.ts's comment on the same pattern for
    // ShieldPage). Scoping to `table` avoids ambiguous double matches from
    // the hidden-but-still-in-DOM accordion.
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByText('Activa')).toBeVisible();

    await table.getByRole('button', { name: 'Desconectar cuenta' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Desconectar cuenta')).toBeVisible();
    await expect(dialog.getByText(/se conservarán 90 días/i)).toBeVisible();

    await dialog.getByRole('button', { name: 'Desconectar' }).click();

    await expect.poll(() => backend.getDisconnectCalls()).toEqual(['acc-yt-1']);

    // The dialog closes and the account is now shown as disconnected with
    // the retention date, instead of disappearing outright — matching
    // AccountsService.disconnectByUserAndId's soft-revoke + 90-day GDPR
    // retention window.
    await expect(dialog).not.toBeVisible();
    await expect(table.getByText('Desconectada')).toBeVisible();
    await expect(table.getByText(/Datos retenidos hasta/i)).toBeVisible();
    await expect(table.getByRole('button', { name: 'Desconectar cuenta' })).not.toBeVisible();
  });

  test('cancelling the disconnect dialog leaves the account untouched', async ({ page }) => {
    const backend = await mockBackend(page, {
      accounts: [makeAccount({ id: 'acc-yt-1', status: 'active' })],
    });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/accounts');
    const table = page.getByRole('table');
    await table.getByRole('button', { name: 'Desconectar cuenta' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    await expect(dialog).not.toBeVisible();
    expect(backend.getDisconnectCalls()).toEqual([]);
    await expect(table.getByText('Activa')).toBeVisible();
  });

  test('pausing an active account and then resuming it updates the visible status both times', async ({
    page,
  }) => {
    const backend = await mockBackend(page, {
      accounts: [makeAccount({ id: 'acc-yt-1', status: 'active' })],
    });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/accounts');
    const table = page.getByRole('table');
    await expect(table.getByText('Activa')).toBeVisible();

    await table.getByRole('button', { name: 'Pausar cuenta' }).click();

    await expect.poll(() => backend.getPauseCalls()).toEqual([{ id: 'acc-yt-1', paused: true }]);
    await expect(table.getByText('Pausada')).toBeVisible();
    await expect(table.getByText('Activa')).not.toBeVisible();

    await table.getByRole('button', { name: 'Reanudar cuenta' }).click();

    await expect.poll(() => backend.getPauseCalls()).toEqual([
      { id: 'acc-yt-1', paused: true },
      { id: 'acc-yt-1', paused: false },
    ]);
    await expect(table.getByText('Activa')).toBeVisible();
    await expect(table.getByText('Pausada')).not.toBeVisible();
  });

  test('reconnecting a broken account calls GET /oauth/:platform/authorize and follows the returned URL', async ({
    page,
  }) => {
    const backend = await mockBackend(page, {
      accounts: [makeAccount({ id: 'acc-x-1', platform: 'x', username: 'roastr-broken', status: 'error' })],
    });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/accounts');
    const table = page.getByRole('table');
    await expect(table.getByText('Token expirado')).toBeVisible();

    await table.getByRole('button', { name: 'Reconectar cuenta' }).click();

    // The real request goes out to apps/api's OAuthController.authorize for
    // the account's own platform (x, not youtube) ...
    await expect.poll(() => backend.getAuthorizeCalls()).toEqual(['x']);

    // ... and the frontend actually follows the returned URL via
    // `window.location.href`, landing on the (mocked) OAuth consent page —
    // proving the button really relaunches the OAuth flow rather than just
    // firing the request.
    await expect(page).toHaveURL('https://reconnect.roastr.test/x/consent');
    await expect(page.getByRole('heading', { name: /oauth consent \(mocked\)/i })).toBeVisible();
  });
});
