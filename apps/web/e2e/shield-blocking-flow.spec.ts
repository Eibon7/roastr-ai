import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E coverage for the fourth core flow: ingestion -> analysis -> Shield
 * (automatic blocking), from the point of view of what a real user actually
 * sees once the pipeline has acted on a toxic comment.
 *
 * Why this suite mocks the Shield feed endpoint instead of running a real
 * ingestion -> analysis -> Shield pipeline:
 * - The real pipeline lives entirely in apps/worker (BullMQ jobs consumed by
 *   apps/worker/src/processors/ingestion.ts, analysis.ts and shield.ts,
 *   backed by Redis and Supabase). A browser-driven Playwright test has no
 *   way to start a real worker/Redis/Supabase stack in this environment (the
 *   e2e webServer here only runs `vite dev` — see onboarding-flow.spec.ts's
 *   header comment for the same rationale), and there is no deterministic
 *   way to "wait" for a real BullMQ job chain to finish from the browser
 *   layer even if it were running.
 * - What IS honestly testable end-to-end from apps/web is the user-facing
 *   half of this flow: once Shield has already taken an automatic action
 *   (recorded as a row in `shield_logs` — see
 *   apps/worker/src/processors/shield.ts's claim/finalize logic), the user
 *   must be able to see it, both as an at-a-glance stat on the dashboard
 *   (ShieldStatsWidget / RecentThreatsWidget, both backed by
 *   src/hooks/use-shield-logs.ts) and as a full, filterable feed on the
 *   dedicated /shield page (src/routes/shield.tsx, ShieldPage). Both read the
 *   same backend endpoint: GET /shield/logs (see
 *   apps/api/src/modules/shield/shield.controller.ts +
 *   shield-logs.service.ts), which is what this suite mocks with
 *   page.route — exactly the observable effect the real pipeline has on the
 *   `shield_logs` table, from the frontend's point of view.
 *
 * Known product gap surfaced while building this suite (not fixed here, out
 * of scope for apps/web/e2e): apps/web/src/components/shield/ShieldFeed.tsx
 * is dead code — it is never imported by any route or page (confirmed by
 * grepping apps/web/src; only its own unit test renders it). The component
 * actually wired into the app for viewing the Shield feed is ShieldPage at
 * the /shield route (see App.tsx), which is what this suite drives instead.
 *
 * The Shield's *decision* to act (Perspective/LLM classification + Roastr
 * Persona escalation via analysisReducer, then resolveShieldAction picking
 * hide/block/report) is exercised separately and honestly, without any
 * frontend or BullMQ involved, by
 * apps/worker/test/ingestion-analysis-shield-pipeline.spec.ts, which chains
 * the three real processor functions together with mocked Supabase/queue/
 * network boundaries. This suite intentionally does not re-test that
 * decision logic — it only proves the frontend surfaces its result.
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

type ShieldLog = {
  id: string;
  platform: string;
  action_taken: string;
  severity_score: number;
  platform_fallback: boolean;
  created_at: string;
};

// What apps/worker/src/processors/shield.ts's finalize step (`action_taken:
// actionTaken` on the shield_logs row) would have produced for a comment with
// an identity attack on YouTube: resolveShieldAction resolves "report" as
// primary for a critical decision on a canReport platform, but reportComment
// has no native implementation yet (see action-executor.ts) and always falls
// back to hideComment, so the row is finalized as "hide" — this is exactly
// the scenario apps/worker/test/ingestion-analysis-shield-pipeline.spec.ts
// exercises for real.
const BLOCKED_COMMENT_LOG: ShieldLog = {
  id: 'shield-log-1',
  platform: 'youtube',
  action_taken: 'hide',
  severity_score: 1,
  platform_fallback: false,
  created_at: new Date().toISOString(),
};

const SECOND_LOG: ShieldLog = {
  id: 'shield-log-2',
  platform: 'x',
  action_taken: 'block',
  severity_score: 0.72,
  platform_fallback: true,
  created_at: new Date(Date.now() - 60_000).toISOString(),
};

/**
 * Installs all network mocks needed to drive the dashboard/Shield-feed flow
 * without a real backend or Supabase project. Must be called before the
 * first `page.goto`.
 */
async function mockBackend(
  page: Page,
  opts: { logs?: ShieldLog[] } = {},
): Promise<{ getLogsRequests: () => URLSearchParams[] }> {
  const userId = `e2e-user-${test.info().testId}`;
  const email = `${userId}@roastr.test`;
  const logs = opts.logs ?? [];
  const logsRequests: URLSearchParams[] = [];

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
      // This suite only cares about post-onboarding screens (dashboard and
      // /shield), so onboarding is always reported as already completed.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: 'done' }),
      });
      return;
    }

    if (path === '/shield/logs' && method === 'GET') {
      logsRequests.push(url.searchParams);
      const platform = url.searchParams.get('platform');
      const actionTaken = url.searchParams.get('action_taken');
      const filtered = logs.filter(
        (l) =>
          (!platform || l.platform === platform) &&
          (!actionTaken || l.action_taken === actionTaken),
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ logs: filtered, total: filtered.length }),
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

    if (path === '/roast/candidates' && method === 'GET') {
      // RoastReviewList (also rendered on /dashboard) expects an object
      // shaped `{ candidates: [...] }`, not a bare array — the generic
      // fallback below would make it crash on `data.candidates.length`.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [] }),
      });
      return;
    }

    if (path === '/billing/usage' && method === 'GET') {
      // UsageWidget (also rendered on /dashboard) reads several numeric/date
      // fields unconditionally (e.g. `current_period_end.toLocaleString()`)
      // — the generic fallback's `{}` would crash it.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'starter',
          billing_state: 'trialing',
          analysis_limit: 1000,
          analysis_used: 0,
          roasts_limit: 0,
          roasts_used: 0,
          current_period_end: null,
          trial_end: '2026-08-10T00:00:00.000Z',
        }),
      });
      return;
    }

    // Fallback for the other dashboard widgets this suite doesn't exercise
    // directly.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(method === 'GET' ? [] : {}),
    });
  });

  return { getLogsRequests: () => logsRequests };
}

async function registerNewUser(page: Page) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`probe-${Date.now()}@roastr.test`);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign up/i }).click();
}

test.describe('ingestion -> analysis -> Shield: automatic blocking is visible to the user (e2e)', () => {
  test('before Shield has acted, the dashboard widget and /shield page show an empty state', async ({
    page,
  }) => {
    await mockBackend(page, { logs: [] });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText(/shield activity/i)).toBeVisible();
    await expect(page.getByText('0', { exact: true }).first()).toBeVisible();

    await page.goto('/shield');
    await expect(page.getByRole('heading', { name: /shield activity/i })).toBeVisible();
    await expect(page.getByText(/sin actividad registrada/i)).toBeVisible();
  });

  test('after Shield automatically blocks a toxic comment, it shows up on the dashboard widget and the /shield feed', async ({
    page,
  }) => {
    await mockBackend(page, { logs: [BLOCKED_COMMENT_LOG] });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // ShieldStatsWidget: at-a-glance counters on the dashboard reflect the
    // action the pipeline already took (hide -> "Ocultados").
    await expect(page.getByText(/shield activity/i)).toBeVisible();
    await expect(page.getByText('1 esta semana')).toBeVisible();

    // The full, dedicated feed at /shield shows the same blocked comment
    // with its platform and severity, exactly as apps/api's GET /shield/logs
    // would after the real worker pipeline finalized the shield_logs row.
    // ShieldPage renders the same data twice (a mobile accordion and a
    // desktop <ul>/<li> list, toggled by CSS breakpoints) — scoping to the
    // `listitem` role targets only the real <li> desktop rows, since the
    // accordion is built from plain <div>s, avoiding ambiguous matches.
    await page.goto('/shield');
    await expect(page.getByRole('heading', { name: /shield activity/i })).toBeVisible();
    await expect(page.getByText(/^1$/).first()).toBeVisible(); // "Total acciones" stat
    const youtubeRow = page.getByRole('listitem').filter({ hasText: 'youtube' });
    await expect(youtubeRow).toBeVisible();
    await expect(youtubeRow.getByText(/oculto/i)).toBeVisible();
    await expect(youtubeRow.getByText(/100%/)).toBeVisible();
  });

  test('filtering the /shield feed by platform and action narrows it to what Shield actually did', async ({
    page,
  }) => {
    const backend = await mockBackend(page, { logs: [BLOCKED_COMMENT_LOG, SECOND_LOG] });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/shield');
    await expect(page.getByRole('heading', { name: /shield activity/i })).toBeVisible();

    // Unfiltered: both the YouTube "hide" and the X "block" actions are shown
    // (scoped to `listitem` — see the previous test's comment on why).
    const rows = page.getByRole('listitem');
    await expect(rows.filter({ hasText: 'youtube' })).toBeVisible();
    await expect(rows.filter({ hasText: 'x' })).toBeVisible();

    // Filtering by platform re-fetches from the backend with the right query
    // param (see ShieldPage's fetchLogs -> GET /shield/logs?platform=...).
    await page.getByLabel(/filtro de plataforma/i).selectOption('x');
    await expect.poll(() => backend.getLogsRequests().at(-1)?.get('platform')).toBe('x');
    await expect(rows.filter({ hasText: /bloqueado/i })).toBeVisible();
    await expect(rows.filter({ hasText: /oculto/i })).toHaveCount(0);

    // Resetting the platform filter and instead filtering by action narrows
    // it back down to just the "hide" action on YouTube.
    await page.getByLabel(/filtro de plataforma/i).selectOption('');
    await page.getByLabel(/filtro de acción/i).selectOption('hide');
    await expect.poll(() => backend.getLogsRequests().at(-1)?.get('action_taken')).toBe('hide');
    await expect(rows.filter({ hasText: /oculto/i })).toBeVisible();
    await expect(rows.filter({ hasText: /bloqueado/i })).toHaveCount(0);
  });
});
