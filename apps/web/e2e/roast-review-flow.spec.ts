import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E coverage for the fourth-and-a-half core flow: a YouTube comment is
 * analyzed -> the worker's analysis processor decides it's
 * eligible_for_response/correctiva (Shield + roasteable) -> it triggers
 * automatic roast generation -> the resulting candidate is visible to the
 * user for review on the dashboard.
 *
 * Why this suite mocks the /roast/candidates endpoint instead of running a
 * real analysis -> auto-generate -> RoastPipelineService pipeline (same
 * rationale as shield-blocking-flow.spec.ts, which this suite follows):
 * - The trigger itself lives entirely in apps/worker
 *   (src/processors/analysis.ts calling src/shared/roast-trigger.ts's
 *   triggerAutoRoast, an HTTP call to apps/api's
 *   POST /internal/roast/auto-generate — see
 *   apps/api/src/modules/roast/roast-internal.controller.ts), backed by
 *   BullMQ/Redis/Supabase and a real LLM call inside RoastPipelineService.
 *   None of that is started by the e2e webServer here (only `vite dev` is),
 *   and there is no deterministic browser-level way to wait for a real
 *   worker job chain to finish.
 * - What IS honestly testable end-to-end from apps/web is the user-facing
 *   half: once the worker's internal call has already produced a
 *   `roast_candidates` row (via RoastPipelineService.generate, left as
 *   `pending_review` unless auto-approve was active for that account — see
 *   AutoApproveService), the user must be able to see it and discard it from
 *   RoastReviewList.tsx (rendered on /dashboard — see
 *   apps/web/src/routes/dashboard.tsx), which reads GET /roast/candidates
 *   (apps/api/src/modules/roast/roast.controller.ts's listCandidates ->
 *   RoastPipelineService.listPendingReview). This suite mocks that endpoint
 *   with page.route — exactly the observable effect the real pipeline has on
 *   `roast_candidates`, from the frontend's point of view.
 *
 * Two things confirmed by reading the real code line by line, not assumed,
 * that shape what this suite can honestly cover:
 *
 * 1) There is currently no "approve/publish" action in the UI.
 *    RoastReviewList.tsx only renders a Discard button (`DiscardButton`) —
 *    grepping apps/web/src for "approve"/"publish" only matches this file's
 *    own status-badge labels ("Aprobado"/"Publicado"), never a button or an
 *    apiFetch call to PATCH /roast/candidates/:id/approve. That endpoint
 *    does exist in roast.controller.ts, but it requires an `approvedText`
 *    body — text that was only ever available synchronously from the old
 *    POST /roast/generate response (marked "Ephemeral ... do not store on
 *    client" in roast.controller.ts) and displayed by RoastGenerateModal,
 *    which was removed as dead code once roast generation became fully
 *    automatic for YouTube (see this project's sibling task). The
 *    auto-generate path never stores generatedText anywhere the frontend can
 *    read it back from, so there is no data an "aprobar" button could even
 *    submit today. Separately, GET /roast/candidates itself only ever
 *    returns rows with status "pending_review" (listPendingReview's
 *    `.eq("status", "pending_review")` filter) — an auto-approved candidate
 *    (published directly by the pipeline) would never appear in this list at
 *    all. This suite does not fabricate a UI action that doesn't exist; it
 *    documents the gap here instead, matching this project's other e2e
 *    suites' approach to confirmed dead ends.
 *
 * 2) The Discard button is itself broken for real users, verified by running
 *    this exact suite against the real component (not assumed): the backend
 *    returns `204 No Content` for a successful discard
 *    (`@HttpCode(HttpStatus.NO_CONTENT)` in roast.controller.ts), but
 *    apps/web/src/lib/api.ts's apiFetch unconditionally calls `res.json()`
 *    after checking `res.ok` — and calling `.json()` on a 204/empty-body
 *    Response throws ("Unexpected end of JSON input"), confirmed with a bare
 *    `new Response(null, { status: 204 }).json()` in Node and reproduced
 *    below in a real Chromium page. RoastReviewList's handleDiscard treats
 *    that thrown error as a discard failure (`setDiscardError`) and skips
 *    the `fetchCandidates()` refresh it would otherwise do on success. Net
 *    effect: clicking "Descartar" always shows a false failure alert even
 *    though the backend call actually succeeded, and the row is only
 *    removed from view once the user manually hits the refresh button
 *    (which re-fetches independently of the failed discard call). The unit
 *    test at apps/web/test/components/roast/RoastReviewList.spec.tsx never
 *    catches this because it mocks apiFetch directly, bypassing the real
 *    fetch/Response plumbing where the bug lives.
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

type RoastCandidate = {
  id: string;
  platform: string;
  tone: string;
  status: 'pending_review' | 'approved' | 'discarded' | 'published';
  has_validation_errors: boolean;
  created_at: string;
  account_id: string;
};

// Two candidates as RoastPipelineService.generate would have left them after
// apps/worker's analysis processor auto-triggered generation for YouTube
// comments decided eligible_for_response/correctiva (see roast-trigger.ts).
const CANDIDATE_1: RoastCandidate = {
  id: 'cand-1',
  platform: 'youtube',
  tone: 'canalla',
  status: 'pending_review',
  has_validation_errors: false,
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  account_id: 'acc-yt-1',
};

const CANDIDATE_2: RoastCandidate = {
  id: 'cand-2',
  platform: 'youtube',
  tone: 'balanceado',
  status: 'pending_review',
  has_validation_errors: true,
  created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
  account_id: 'acc-yt-1',
};

/**
 * Installs all network mocks needed to drive the roast-review flow without a
 * real backend, Supabase project, worker or LLM. Must be called before the
 * first `page.goto`. `candidates` acts as the backing store for
 * `roast_candidates`: GET /roast/candidates reads from it, PATCH
 * .../discard mutates it — exactly like the real
 * RoastPipelineService/Supabase round-trip, just in memory.
 */
async function mockBackend(
  page: Page,
  opts: { candidates?: RoastCandidate[] } = {},
): Promise<{ getDiscardCalls: () => string[]; getCandidates: () => RoastCandidate[] }> {
  const userId = `e2e-user-${test.info().testId}`;
  const email = `${userId}@roastr.test`;
  let candidates = opts.candidates ?? [];
  const discardCalls: string[] = [];

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
      // This suite only cares about the post-onboarding dashboard, so
      // onboarding is always reported as already completed.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: 'done' }),
      });
      return;
    }

    if (path === '/roast/candidates' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates }),
      });
      return;
    }

    const discardMatch = path.match(/^\/roast\/candidates\/([^/]+)\/discard$/);
    if (discardMatch && method === 'PATCH') {
      const id = discardMatch[1];
      discardCalls.push(id);
      // Faithful to RoastPipelineService.discard: the row's status flips
      // server-side, so it drops out of the pending_review-only
      // GET /roast/candidates result from now on.
      candidates = candidates.filter((c) => c.id !== id);
      // Faithful to roast.controller.ts's real response: 204 No Content,
      // no body — this is exactly what triggers the apiFetch bug described
      // in the header comment above.
      await route.fulfill({ status: 204 });
      return;
    }

    if (path === '/shield/logs' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ logs: [], total: 0 }),
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

    if (path === '/billing/usage' && method === 'GET') {
      // UsageWidget (also rendered on /dashboard) reads several numeric/date
      // fields unconditionally — the generic fallback's `{}` would crash it.
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

  return {
    getDiscardCalls: () => discardCalls,
    getCandidates: () => candidates,
  };
}

async function registerNewUser(page: Page) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`probe-${Date.now()}@roastr.test`);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign up/i }).click();
}

test.describe('analysis -> automatic roast generation (YouTube) -> review in RoastReviewList (e2e)', () => {
  test('the user sees auto-generated YouTube roast candidates pending review, with their metadata', async ({
    page,
  }) => {
    await mockBackend(page, { candidates: [CANDIDATE_1, CANDIDATE_2] });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText(/roasts pendientes de revisión/i)).toBeVisible();

    const rows = page.getByRole('row');
    const row1 = rows.filter({ hasText: 'Canalla' });
    await expect(row1).toBeVisible();
    await expect(row1.getByText('YouTube')).toBeVisible();
    await expect(row1.getByText(/pendiente/i)).toBeVisible();

    // The second candidate carries validation warnings from
    // StyleValidatorService (has_validation_errors) — surfaced as a warning
    // marker next to its status badge.
    const row2 = rows.filter({ hasText: 'Balanceado' });
    await expect(row2).toBeVisible();
    await expect(row2.getByText('YouTube')).toBeVisible();
    await expect(row2).toContainText('⚠');

    // Both rows expose a Discard action while pending_review.
    await expect(page.getByRole('button', { name: 'Descartar roast' })).toHaveCount(2);
  });

  test('the list is empty before any comment has been analyzed as roasteable', async ({ page }) => {
    await mockBackend(page, { candidates: [] });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText('Roasts pendientes de revisión', { exact: true })).toBeVisible();
    await expect(page.getByText('No hay roasts pendientes de revisión.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descartar roast' })).toHaveCount(0);
  });

  test('discarding a candidate reaches the backend and removes it from the list immediately, with no error alert', async ({
    page,
  }) => {
    const backend = await mockBackend(page, { candidates: [CANDIDATE_1] });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByRole('row').filter({ hasText: 'Canalla' })).toBeVisible();

    await page.getByRole('button', { name: 'Descartar roast' }).click();

    // The PATCH call really goes out and the backing store really drops the
    // candidate (exactly what RoastPipelineService.discard would do against
    // Supabase) ...
    await expect.poll(() => backend.getDiscardCalls()).toEqual(['cand-1']);
    await expect.poll(() => backend.getCandidates()).toEqual([]);

    // ... and apiFetch correctly handles the 204 No Content response (no
    // res.json() on an empty body), so RoastReviewList's discard handler
    // completes and re-fetches the list on its own — no error alert, and
    // the row disappears without the user needing to hit "Refrescar".
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Canalla' })).toHaveCount(0);
  });

  test('the "Refrescar" button re-fetches the list on demand', async ({ page }) => {
    const backend = await mockBackend(page, { candidates: [CANDIDATE_1, CANDIDATE_2] });
    await registerNewUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByRole('button', { name: 'Descartar roast' })).toHaveCount(2);

    // Simulate the candidate having been discarded through some other means
    // (e.g. another tab) — the backing store already reflects it, but this
    // page's list won't know until it re-fetches.
    backend.getCandidates().splice(
      backend.getCandidates().findIndex((c) => c.id === 'cand-1'),
      1,
    );

    await page.getByRole('button', { name: 'Refrescar' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'Canalla' })).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Balanceado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descartar roast' })).toHaveCount(1);
  });
});
