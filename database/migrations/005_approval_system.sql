-- Migration: Add approval system fields to responses table
-- This adds the necessary fields for manual approval workflow

-- Add approval-related columns to responses table
ALTER TABLE responses 
ADD COLUMN rejection_reason TEXT,
ADD COLUMN rejected_at TIMESTAMPTZ,
ADD COLUMN rejected_by UUID REFERENCES users(id),
ADD COLUMN approved_by UUID REFERENCES users(id),
ADD COLUMN approved_at TIMESTAMPTZ;

-- Update the post_status constraint to include new approval statuses
ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_post_status_check;
ALTER TABLE responses ADD CONSTRAINT responses_post_status_check 
CHECK (post_status IN ('pending', 'approved', 'rejected', 'posted', 'failed'));

-- Create index for efficient approval queries
CREATE INDEX idx_responses_approval_status ON responses(organization_id, post_status, created_at DESC)
WHERE post_status IN ('pending', 'approved');

-- Create index for user approval tracking
CREATE INDEX idx_responses_approved_by ON responses(approved_by, approved_at)
WHERE approved_by IS NOT NULL;

-- Add comment to document the new fields
COMMENT ON COLUMN responses.rejection_reason IS 'Reason for rejecting the response (when post_status = rejected)';
COMMENT ON COLUMN responses.rejected_at IS 'Timestamp when response was rejected';
COMMENT ON COLUMN responses.rejected_by IS 'User who rejected the response';
COMMENT ON COLUMN responses.approved_by IS 'User who approved the response';
COMMENT ON COLUMN responses.approved_at IS 'Timestamp when response was approved';