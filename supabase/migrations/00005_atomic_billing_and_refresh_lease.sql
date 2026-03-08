-- ============================================================
-- 1. Atomic billing event application with compare-and-swap
-- ============================================================
-- Applies a pre-computed billing transition under a row-level lock.
-- The TypeScript caller runs billingReducer() in memory and passes the
-- expected_state (the state it observed before computing) plus the new
-- state.  If another webhook already changed the state, the function
-- returns 'conflict' and the caller retries.
--
-- Returns: 'ok' | 'conflict'

CREATE OR REPLACE FUNCTION apply_billing_event(
  p_user_id         UUID,
  p_expected_state  TEXT,
  p_new_state       TEXT,
  p_plan            TEXT,
  p_analysis_limit  INTEGER,
  p_roasts_limit    INTEGER,
  p_analysis_used   INTEGER DEFAULT NULL,
  p_roasts_used     INTEGER DEFAULT NULL,
  p_subscription_id TEXT    DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  v_current_state TEXT;
BEGIN
  -- Advisory transaction lock serializes concurrent calls for the same user,
  -- including the first-write race where SELECT ... FOR UPDATE cannot lock a
  -- non-existent row and two concurrent INSERTs would clobber each other.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  -- Lock the row (or establish the absence of a row) before writing
  SELECT billing_state
    INTO v_current_state
    FROM subscriptions_usage
   WHERE user_id = p_user_id
     FOR UPDATE;

  -- Treat a missing row as 'trialing' (first webhook for this user)
  IF NOT FOUND THEN
    v_current_state := 'trialing';
  END IF;

  -- Compare-and-swap: reject if state has already been advanced
  IF v_current_state <> p_expected_state THEN
    RETURN 'conflict';
  END IF;

  INSERT INTO subscriptions_usage (
    user_id, billing_state, plan,
    analysis_limit, roasts_limit,
    analysis_used,  roasts_used,
    polar_subscription_id, updated_at
  ) VALUES (
    p_user_id, p_new_state, p_plan,
    p_analysis_limit, p_roasts_limit,
    COALESCE(p_analysis_used, 0), COALESCE(p_roasts_used, 0),
    p_subscription_id, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    billing_state         = EXCLUDED.billing_state,
    plan                  = EXCLUDED.plan,
    analysis_limit        = EXCLUDED.analysis_limit,
    roasts_limit          = EXCLUDED.roasts_limit,
    polar_subscription_id = EXCLUDED.polar_subscription_id,
    updated_at            = EXCLUDED.updated_at,
    -- Only reset usage counters when the caller explicitly requests it
    analysis_used = CASE
      WHEN p_analysis_used IS NOT NULL THEN EXCLUDED.analysis_used
      ELSE subscriptions_usage.analysis_used
    END,
    roasts_used = CASE
      WHEN p_roasts_used IS NOT NULL THEN EXCLUDED.roasts_used
      ELSE subscriptions_usage.roasts_used
    END;

  RETURN 'ok';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Per-account refresh lease column
-- ============================================================
-- Workers claim this lease before calling the OAuth provider so that
-- only one worker refreshes a given account's token at a time.
-- The lease is a TTL timestamp; expired leases are treated as released.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS refresh_lease_at TIMESTAMPTZ;

-- Index so the conditional UPDATE for lease claim is fast
CREATE INDEX IF NOT EXISTS idx_accounts_refresh_lease
  ON accounts (id, refresh_lease_at);
