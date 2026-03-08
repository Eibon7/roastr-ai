-- Atomic increment for analysis_used to avoid TOCTOU race conditions
CREATE OR REPLACE FUNCTION increment_analysis_used(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rowcount INTEGER;
BEGIN
  UPDATE subscriptions_usage
  SET analysis_used = COALESCE(analysis_used, 0) + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RAISE EXCEPTION 'no subscriptions_usage row for user %', p_user_id;
  END IF;
END;
$$;
