-- Add updated_at to shield_logs for lease-advancing staleness checks.
--
-- The shield worker uses shield_logs as a distributed claim to prevent two
-- workers from moderating the same comment. Staleness was previously computed
-- from created_at, which never advances after the first claim — so a reclaimed
-- row remained immediately stale. updated_at advances each time the claim is
-- refreshed or retried, giving each worker a full RECLAIM_THRESHOLD window.
ALTER TABLE shield_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Back-fill existing rows so they appear non-stale (their created_at is the
-- best proxy we have for when they were last active).
UPDATE shield_logs SET updated_at = created_at WHERE updated_at = '1970-01-01'::timestamptz;
