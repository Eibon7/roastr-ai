-- Migration 003: Add Webhook Events Table for Idempotency
-- Issue #169: Webhooks Stripe mínimos (alta/cambio/cancelación)

-- ============================================================================
-- WEBHOOK EVENTS TABLE
-- ============================================================================

-- Webhook events table for idempotency control
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Stripe event details
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    
    -- Processing status
    status VARCHAR(20) DEFAULT 'received', -- received, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Event data
    event_data JSONB NOT NULL,
    
    -- Processing results
    processing_result JSONB,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Related entities (for debugging and queries)
    customer_id VARCHAR(255),
    subscription_id VARCHAR(255),
    account_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT webhook_events_status_check 
        CHECK (status IN ('received', 'processing', 'completed', 'failed')),
    CONSTRAINT webhook_events_attempts_positive 
        CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary indexes for performance
CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX idx_webhook_events_customer_id ON webhook_events(customer_id);
CREATE INDEX idx_webhook_events_account_id ON webhook_events(account_id);

-- Composite index for cleanup queries
CREATE INDEX idx_webhook_events_status_created ON webhook_events(status, created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on webhook_events table
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role can manage all webhook events
CREATE POLICY webhook_events_service_access ON webhook_events FOR ALL 
    USING (auth.role() = 'service_role');

-- Admin users can view webhook events (for debugging)
CREATE POLICY webhook_events_admin_read ON webhook_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Users can view their own webhook events
CREATE POLICY webhook_events_user_read ON webhook_events FOR SELECT
    USING (account_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if webhook event has already been processed
CREATE OR REPLACE FUNCTION is_webhook_event_processed(event_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    event_record RECORD;
BEGIN
    SELECT status INTO event_record 
    FROM webhook_events 
    WHERE stripe_event_id = event_id;
    
    -- If event doesn't exist, it hasn't been processed
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- If event is completed, it has been processed
    RETURN event_record.status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record webhook event start
CREATE OR REPLACE FUNCTION start_webhook_event_processing(
    event_id TEXT,
    event_type_param TEXT,
    event_data_param JSONB,
    customer_id_param TEXT DEFAULT NULL,
    subscription_id_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    webhook_id UUID;
BEGIN
    -- Insert or update webhook event
    INSERT INTO webhook_events (
        stripe_event_id,
        event_type,
        event_data,
        customer_id,
        subscription_id,
        status,
        attempts,
        last_attempt_at
    ) VALUES (
        event_id,
        event_type_param,
        event_data_param,
        customer_id_param,
        subscription_id_param,
        'processing',
        1,
        NOW()
    )
    ON CONFLICT (stripe_event_id) 
    DO UPDATE SET
        attempts = webhook_events.attempts + 1,
        status = CASE 
            WHEN webhook_events.status = 'completed' THEN 'completed' -- Don't change completed events
            WHEN webhook_events.attempts >= webhook_events.max_attempts THEN 'failed'
            ELSE 'processing'
        END,
        last_attempt_at = NOW()
    RETURNING id INTO webhook_id;
    
    RETURN webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete webhook event processing
CREATE OR REPLACE FUNCTION complete_webhook_event_processing(
    event_id TEXT,
    success BOOLEAN,
    result_data JSONB DEFAULT NULL,
    error_msg TEXT DEFAULT NULL,
    account_id_param UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    UPDATE webhook_events 
    SET 
        status = CASE WHEN success THEN 'completed' ELSE 'failed' END,
        processed_at = NOW(),
        processing_result = result_data,
        error_message = error_msg,
        account_id = COALESCE(account_id_param, account_id)
    WHERE stripe_event_id = event_id;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RETURN rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old webhook events (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_webhook_events(
    older_than_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM webhook_events 
    WHERE created_at < NOW() - (older_than_days || ' days')::INTERVAL
      AND status IN ('completed', 'failed');
    
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get webhook event statistics
CREATE OR REPLACE FUNCTION get_webhook_stats(
    since_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
    event_type TEXT,
    total_events BIGINT,
    completed_events BIGINT,
    failed_events BIGINT,
    success_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        we.event_type,
        COUNT(*) as total_events,
        COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as completed_events,
        COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_events,
        ROUND(
            (COUNT(CASE WHEN we.status = 'completed' THEN 1 END)::DECIMAL / COUNT(*)) * 100,
            2
        ) as success_rate
    FROM webhook_events we
    WHERE we.created_at >= since_date
    GROUP BY we.event_type
    ORDER BY total_events DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE webhook_events IS 'Idempotency control for Stripe webhook events - Issue #169';
COMMENT ON COLUMN webhook_events.stripe_event_id IS 'Unique Stripe event ID for idempotency';
COMMENT ON COLUMN webhook_events.status IS 'Processing status: received, processing, completed, failed';
COMMENT ON COLUMN webhook_events.event_data IS 'Full Stripe event payload for debugging';
COMMENT ON COLUMN webhook_events.processing_result IS 'Result of processing (entitlements updated, etc.)';

COMMENT ON FUNCTION is_webhook_event_processed IS 'Check if webhook event has already been successfully processed';
COMMENT ON FUNCTION start_webhook_event_processing IS 'Record start of webhook event processing with idempotency';
COMMENT ON FUNCTION complete_webhook_event_processing IS 'Mark webhook event as completed or failed';
COMMENT ON FUNCTION cleanup_webhook_events IS 'Cleanup old webhook events for maintenance';
COMMENT ON FUNCTION get_webhook_stats IS 'Get webhook processing statistics for monitoring';