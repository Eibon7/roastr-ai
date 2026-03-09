-- Forward migration: re-create increment_offender_strike with the 4-column
-- conflict target (user_id, account_id, platform, offender_id).
--
-- Databases that ran the original 00003 (before platform was added to the
-- unique constraint) will have an older function definition that uses a
-- 3-column ON CONFLICT target. This migration brings it up to date so the
-- function matches the constraint updated by 00007_offenders_platform_unique.
CREATE OR REPLACE FUNCTION increment_offender_strike(
  p_user_id    UUID,
  p_account_id UUID,
  p_platform   TEXT,
  p_offender_id TEXT
) RETURNS offenders AS $$
DECLARE
  result offenders;
BEGIN
  INSERT INTO offenders (user_id, account_id, platform, offender_id, strike_level, last_strike, updated_at)
  VALUES (p_user_id, p_account_id, p_platform, p_offender_id, 1, NOW(), NOW())
  ON CONFLICT (user_id, account_id, platform, offender_id)
  DO UPDATE SET
    strike_level = LEAST(offenders.strike_level + 1, 3),
    last_strike  = NOW(),
    updated_at   = NOW()
  RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
