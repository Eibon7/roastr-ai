-- Atomic increment for analysis_used to avoid TOCTOU race conditions
CREATE OR REPLACE FUNCTION increment_analysis_used(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE subscriptions_usage
  SET analysis_used = COALESCE(analysis_used, 0) + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
$$;
