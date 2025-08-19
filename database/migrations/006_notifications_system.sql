-- Migration: Add in-app notifications system
-- Created: 2025-08-19
-- Purpose: Track in-app notifications for subscription events and user actions

-- Create notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type varchar(50) NOT NULL CHECK (type IN (
        'subscription_status', 
        'payment_failed', 
        'subscription_canceled', 
        'upgrade_success', 
        'plan_downgrade',
        'account_action_required',
        'system_announcement'
    )),
    title varchar(200) NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}',
    
    -- Status tracking
    status varchar(20) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    priority varchar(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Display settings
    show_banner boolean DEFAULT false,
    banner_variant varchar(20) DEFAULT 'info' CHECK (banner_variant IN ('info', 'warning', 'error', 'success')),
    action_required boolean DEFAULT false,
    action_url varchar(500),
    action_text varchar(100),
    
    -- Timestamps
    expires_at timestamptz,
    read_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_status ON user_notifications(status);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_priority ON user_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_expires_at ON user_notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_status_created ON user_notifications(user_id, status, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
    ON user_notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read, archive)
CREATE POLICY "Users can update own notifications"
    ON user_notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Only service role can insert notifications (system-generated)
CREATE POLICY "Service role can create notifications"
    ON user_notifications FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
    ON user_notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_user_notifications_updated_at_trigger
    BEFORE UPDATE ON user_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_user_notifications_updated_at();

-- Function to automatically clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM user_notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < now() - INTERVAL '7 days'; -- Keep for 7 days after expiry
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE user_notifications IS 'Stores in-app notifications for users about billing, subscriptions, and system events';
COMMENT ON COLUMN user_notifications.user_id IS 'Reference to users table';
COMMENT ON COLUMN user_notifications.type IS 'Notification type for categorization and handling';
COMMENT ON COLUMN user_notifications.title IS 'Short notification title displayed to user';
COMMENT ON COLUMN user_notifications.message IS 'Detailed notification message';
COMMENT ON COLUMN user_notifications.metadata IS 'Additional data specific to notification type';
COMMENT ON COLUMN user_notifications.status IS 'Current status: unread, read, archived';
COMMENT ON COLUMN user_notifications.priority IS 'Display priority: low, normal, high, urgent';
COMMENT ON COLUMN user_notifications.show_banner IS 'Whether to show as banner/alert in UI';
COMMENT ON COLUMN user_notifications.banner_variant IS 'Banner style: info, warning, error, success';
COMMENT ON COLUMN user_notifications.action_required IS 'Whether user action is required';
COMMENT ON COLUMN user_notifications.action_url IS 'URL for call-to-action button';
COMMENT ON COLUMN user_notifications.action_text IS 'Text for call-to-action button';
COMMENT ON COLUMN user_notifications.expires_at IS 'When notification should no longer be shown';
COMMENT ON COLUMN user_notifications.read_at IS 'When notification was marked as read';