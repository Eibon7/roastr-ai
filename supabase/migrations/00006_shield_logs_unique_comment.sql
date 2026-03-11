-- Prevent duplicate shield actions on the same comment.
-- If removeOnComplete purges a completed analysis job from Redis and ingestion
-- re-enqueues it, the shield processor could write a second log entry for the
-- same comment. This unique constraint makes that a graceful no-op at the DB
-- level rather than silent double-billing or double-moderation.

-- Lock the table for the duration of this migration so no concurrent worker
-- insert can slip in between the dedup DELETE and the constraint creation.
LOCK TABLE shield_logs IN ACCESS EXCLUSIVE MODE;

-- Clean up any historical duplicates first, keeping the most recent row per
-- (user_id, account_id, platform, comment_id) so the constraint can be added
-- safely even on non-empty databases.
DELETE FROM shield_logs
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, account_id, platform, comment_id
             ORDER BY created_at DESC
           ) AS rn
    FROM shield_logs
  ) ranked
  WHERE rn > 1
);

ALTER TABLE shield_logs
  ADD CONSTRAINT shield_logs_unique_comment
  UNIQUE (user_id, account_id, platform, comment_id);
