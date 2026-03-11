-- Forward migration: add the 4-column unique constraint on offenders.
-- The legacy 3-column constraint (without platform) is intentionally left in
-- place here so that increment_offender_strike (still pointing to the old
-- constraint on deployed databases) continues to work until 00008 updates the
-- function definition and drops the old constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'offenders'::regclass
      AND contype = 'u'
      AND conname = 'offenders_user_id_account_id_platform_offender_id_key'
  ) THEN
    ALTER TABLE offenders
      ADD CONSTRAINT offenders_user_id_account_id_platform_offender_id_key
      UNIQUE (user_id, account_id, platform, offender_id);
  END IF;
END $$;
