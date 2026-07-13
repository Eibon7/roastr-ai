-- Idempotency table: records which roast generation attempts have consumed
-- a roast slot. Mirrors analysis_job_reservations (00004) so BullMQ retries
-- of the automatic roast trigger (analysis.ts -> POST /internal/roast/auto-generate)
-- don't double-charge roasts_used for the same comment.
CREATE TABLE IF NOT EXISTS roast_job_reservations (
  job_id    TEXT PRIMARY KEY,
  user_id   UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rjr_created_at ON roast_job_reservations (created_at);

ALTER TABLE roast_job_reservations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON roast_job_reservations FROM PUBLIC;
REVOKE ALL ON roast_job_reservations FROM anon;
REVOKE ALL ON roast_job_reservations FROM authenticated;
GRANT ALL ON roast_job_reservations TO service_role;

DROP POLICY IF EXISTS "Service role full access" ON roast_job_reservations;

CREATE POLICY "Service role full access" ON roast_job_reservations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomically checks the roast quota, increments usage, and records the
-- reservation. Idempotent: if job_id already exists the slot is treated as
-- already consumed (retries of the same generation attempt are free).
-- Mirrors try_consume_analysis_slot (00004) — same TOCTOU-safe locking order.
-- Returns: { "allowed": bool, "remaining": int, "reason"?: str }
CREATE OR REPLACE FUNCTION try_consume_roast_slot(
  p_user_id UUID,
  p_job_id  TEXT
) RETURNS JSONB AS $$
DECLARE
  v_billing_state TEXT;
  v_limit         INTEGER;
  v_used          INTEGER;
BEGIN
  SELECT billing_state, roasts_limit, roasts_used
    INTO v_billing_state, v_limit, v_used
    FROM subscriptions_usage
   WHERE user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN '{"allowed": false, "reason": "not_found"}'::JSONB;
  END IF;

  IF EXISTS (SELECT 1 FROM roast_job_reservations WHERE job_id = p_job_id) THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', GREATEST(0, v_limit - v_used)
    );
  END IF;

  IF v_billing_state = 'paused' THEN
    RETURN '{"allowed": false, "reason": "paused"}'::JSONB;
  END IF;

  IF v_used >= v_limit THEN
    RETURN '{"allowed": false, "reason": "over_limit"}'::JSONB;
  END IF;

  UPDATE subscriptions_usage
     SET roasts_used = roasts_used + 1
   WHERE user_id = p_user_id;

  INSERT INTO roast_job_reservations (job_id, user_id)
  VALUES (p_job_id, p_user_id)
  ON CONFLICT (job_id) DO NOTHING;

  RETURN jsonb_build_object('allowed', true, 'remaining', GREATEST(0, v_limit - v_used - 1));
END;
$$ LANGUAGE plpgsql;

-- TTL cleanup: delete reservations older than 30 days (mirrors 00004's note;
-- run via pg_cron or a Supabase scheduled Edge Function).
--   SELECT cron.schedule(
--     'cleanup-roast-job-reservations',
--     '0 3 * * *',
--     $$DELETE FROM roast_job_reservations WHERE created_at < NOW() - INTERVAL '30 days'$$
--   );
