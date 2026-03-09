-- Forward migration: ensure the offenders unique constraint covers 4 columns
-- (user_id, account_id, platform, offender_id).
--
-- Fresh deployments already have the correct constraint from 00001.
-- For databases deployed before platform was added to the constraint, this
-- migration drops the old 3-column constraint and creates the 4-column one so
-- that 00003_increment_offender_strike (ON CONFLICT on all 4 columns) works
-- correctly in both cases.
DO $$
DECLARE
  old_constraint text;
BEGIN
  -- Find any unique constraint on offenders that does NOT include the platform column
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
    ALTER TABLE offenders
      ADD CONSTRAINT offenders_user_id_account_id_platform_offender_id_key
      UNIQUE (user_id, account_id, platform, offender_id);
  END IF;
END $$;
