-- Now that the 4-column unique constraint exists (added in 00007), update
-- increment_offender_strike to use the 4-column ON CONFLICT target and drop
-- the legacy 3-column constraint so the schema is fully consistent.

-- Drop old 3-column unique constraint if it still exists
DO $$
DECLARE
  old_constraint text;
BEGIN
  SELECT c.conname INTO old_constraint
  FROM pg_constraint c
  WHERE c.conrelid = 'offenders'::regclass
    AND c.contype = 'u'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = 'offenders'::regclass
        AND a.attname = 'platform'
        AND a.attnum = ANY(c.conkey)
    );

  IF old_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE offenders DROP CONSTRAINT %I', old_constraint);
  END IF;
END $$;

-- Re-create the function using the 4-column conflict target
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
