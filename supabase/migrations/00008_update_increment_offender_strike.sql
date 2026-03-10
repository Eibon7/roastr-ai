-- Now that the 4-column unique constraint exists (added in 00007), update
-- increment_offender_strike to use the 4-column ON CONFLICT target and drop
-- the legacy constraints so the schema is fully consistent.

-- 1. Drop the legacy 3-column unique constraint by its exact auto-generated name.
--    A broader search would risk matching unrelated constraints.
ALTER TABLE offenders
  DROP CONSTRAINT IF EXISTS offenders_user_id_account_id_offender_id_key;

-- 2. Drop the old 3-arg function overload increment_offender_strike(UUID, UUID, TEXT)
--    if it exists from databases deployed before the platform column was added.
--    CREATE OR REPLACE only replaces matching signatures; the old overload must
--    be explicitly dropped.
DROP FUNCTION IF EXISTS increment_offender_strike(UUID, UUID, TEXT);

-- 3. Re-create (or replace) the canonical 4-arg function.
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
