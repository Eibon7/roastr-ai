-- Migration: Create polar_webhook_events table
-- Issue: #594 - Polar Payment Integration
-- Created: 2025-11-11
-- Purpose: Track webhook events from Polar for idempotency and debugging

-- Create polar_webhook_events table
CREATE TABLE IF NOT EXISTS polar_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polar_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance and querying
CREATE INDEX IF NOT EXISTS idx_polar_webhook_events_processed ON polar_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_polar_webhook_events_type ON polar_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_polar_webhook_events_created_at ON polar_webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_polar_webhook_events_polar_id ON polar_webhook_events(polar_event_id);

-- Enable Row Level Security
ALTER TABLE polar_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access webhook events (admin-only data)
CREATE POLICY polar_webhook_events_service_all
  ON polar_webhook_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to cleanup old processed events (retention: 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_polar_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM polar_webhook_events
  WHERE processed = TRUE
    AND created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE polar_webhook_events IS 'Webhook events from Polar for subscription lifecycle tracking and idempotency';
COMMENT ON COLUMN polar_webhook_events.polar_event_id IS 'Unique event ID from Polar (used for idempotency)';
COMMENT ON COLUMN polar_webhook_events.event_type IS 'Event type: order.created, subscription.updated, subscription.canceled, etc.';
COMMENT ON COLUMN polar_webhook_events.payload IS 'Full JSON payload from Polar webhook';
COMMENT ON COLUMN polar_webhook_events.processed IS 'True if event has been processed successfully';
COMMENT ON FUNCTION cleanup_old_polar_webhook_events IS 'Cleanup function for old processed events (90 day retention)';

