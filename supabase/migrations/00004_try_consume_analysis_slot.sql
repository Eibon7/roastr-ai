-- Idempotency table: records which BullMQ jobs have consumed an analysis slot.
-- This prevents double-billing on job retries.
CREATE TABLE IF NOT EXISTS analysis_job_reservations (
  job_id    TEXT PRIMARY KEY,
  user_id   UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomically checks billing quota, increments usage, and records the reservation.
-- Idempotent: if job_id already exists the slot is treated as already consumed.
-- Returns: { "allowed": bool, "remaining": int, "reason"?: str }
CREATE OR REPLACE FUNCTION try_consume_analysis_slot(
  p_user_id UUID,
  p_job_id  TEXT
) RETURNS JSONB AS $$
DECLARE
  v_billing_state TEXT;
  v_limit         INTEGER;
  v_used          INTEGER;
BEGIN
  -- Idempotent retry: job already reserved → succeed without double-billing
  IF EXISTS (SELECT 1 FROM analysis_job_reservations WHERE job_id = p_job_id) THEN
    SELECT GREATEST(0, analysis_limit - analysis_used)
      INTO v_limit
      FROM subscriptions_usage
     WHERE user_id = p_user_id;
    RETURN jsonb_build_object('allowed', true, 'remaining', COALESCE(v_limit, 0));
  END IF;

  -- Lock the row to prevent concurrent races
  SELECT billing_state, analysis_limit, analysis_used
    INTO v_billing_state, v_limit, v_used
    FROM subscriptions_usage
   WHERE user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN '{"allowed": false, "reason": "not_found"}'::JSONB;
  END IF;

  IF v_billing_state = 'paused' THEN
    RETURN '{"allowed": false, "reason": "paused"}'::JSONB;
  END IF;

  IF v_used >= v_limit THEN
    RETURN '{"allowed": false, "reason": "over_limit"}'::JSONB;
  END IF;

  -- Consume the slot atomically
  UPDATE subscriptions_usage
     SET analysis_used = analysis_used + 1
   WHERE user_id = p_user_id;

  -- Record reservation so retries are idempotent
  INSERT INTO analysis_job_reservations (job_id, user_id)
  VALUES (p_job_id, p_user_id)
  ON CONFLICT (job_id) DO NOTHING;

  RETURN jsonb_build_object('allowed', true, 'remaining', GREATEST(0, v_limit - v_used - 1));
END;
$$ LANGUAGE plpgsql;
