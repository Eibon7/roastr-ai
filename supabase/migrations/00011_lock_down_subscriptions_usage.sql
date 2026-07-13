-- Security fix: subscriptions_usage relied solely on RLS USING clauses
-- (auth.uid() = user_id) with no WITH CHECK and no REVOKE, unlike
-- analysis_job_reservations (00004). Without WITH CHECK, Postgres reuses the
-- USING expression as the implicit check on the new row, which only
-- constrains user_id — not plan/analysis_limit/roasts_limit/billing_state.
-- A directly-authenticated Supabase client could therefore self-grant a
-- higher plan or higher limits via UPDATE, bypassing Polar entirely.
--
-- All reads/writes to this table already go through apps/api and
-- apps/worker using SUPABASE_SERVICE_ROLE_KEY (billing.service.ts,
-- polar-webhook.controller.ts, subscription.guard.ts, oauth.service.ts,
-- auth.controller.ts, billing-guard.ts) — no client code depends on
-- anon/authenticated table access. Lock it down the same way
-- analysis_job_reservations is locked down: revoke all client-facing
-- privileges and restrict access to service_role.

REVOKE ALL ON subscriptions_usage FROM PUBLIC;
REVOKE ALL ON subscriptions_usage FROM anon;
REVOKE ALL ON subscriptions_usage FROM authenticated;
GRANT ALL ON subscriptions_usage TO service_role;

DROP POLICY IF EXISTS subscriptions_usage_select ON subscriptions_usage;
DROP POLICY IF EXISTS subscriptions_usage_update ON subscriptions_usage;

CREATE POLICY "Service role full access" ON subscriptions_usage
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
