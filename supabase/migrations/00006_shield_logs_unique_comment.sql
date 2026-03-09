-- Prevent duplicate shield actions on the same comment.
-- If removeOnComplete purges a completed analysis job from Redis and ingestion
-- re-enqueues it, the shield processor could write a second log entry for the
-- same comment. This unique constraint makes that a graceful no-op at the DB
-- level rather than silent double-billing or double-moderation.
ALTER TABLE shield_logs
  ADD CONSTRAINT shield_logs_unique_comment
  UNIQUE (user_id, account_id, platform, comment_id);
