-- Migration: Add roast regeneration and attempt history system
-- This adds the necessary fields and tables for tracking roast regeneration attempts

-- Add attempt tracking fields to responses table
ALTER TABLE responses 
ADD COLUMN attempt_number INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN parent_response_id UUID REFERENCES responses(id),
ADD COLUMN original_comment_id UUID; -- Store original comment for regenerated responses

-- Update the post_status constraint to include discarded status
ALTER TABLE responses DROP CONSTRAINT IF EXISTS responses_post_status_check;
ALTER TABLE responses ADD CONSTRAINT responses_post_status_check 
CHECK (post_status IN ('pending', 'approved', 'rejected', 'posted', 'failed', 'discarded'));

-- Create roast_attempts table for detailed history tracking
CREATE TABLE roast_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    response_id UUID REFERENCES responses(id) ON DELETE CASCADE,
    
    -- Attempt details
    attempt_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('accepted', 'discarded', 'regenerated', 'pending')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    generated_by UUID REFERENCES users(id),
    action_taken_by UUID REFERENCES users(id), -- User who accepted/discarded/regenerated
    
    INDEX (organization_id, comment_id, created_at DESC),
    INDEX (comment_id, attempt_number),
    INDEX (response_id)
);

-- Create indexes for efficient regeneration queries
CREATE INDEX idx_responses_regeneration ON responses(organization_id, parent_response_id, attempt_number)
WHERE parent_response_id IS NOT NULL;

CREATE INDEX idx_responses_comment_attempts ON responses(comment_id, attempt_number, created_at DESC)
WHERE comment_id IS NOT NULL;

-- Create index for roast attempts tracking
CREATE INDEX idx_roast_attempts_comment_status ON roast_attempts(comment_id, status, created_at DESC);

-- Add function to get current attempt number for a comment
CREATE OR REPLACE FUNCTION get_next_attempt_number(comment_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
    SELECT COALESCE(MAX(attempt_number), 0) + 1
    FROM responses 
    WHERE comment_id = comment_uuid;
$$;

-- Add function to count total attempts for a comment
CREATE OR REPLACE FUNCTION count_roast_attempts(comment_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM responses 
    WHERE comment_id = comment_uuid OR original_comment_id = comment_uuid;
$$;

-- Add comments to document the new fields
COMMENT ON COLUMN responses.attempt_number IS 'Attempt number for this roast (1 = first attempt, 2+ = regenerations)';
COMMENT ON COLUMN responses.parent_response_id IS 'Reference to the original response that was regenerated (null for first attempts)';
COMMENT ON COLUMN responses.original_comment_id IS 'Original comment ID for regenerated responses (for tracking across attempts)';

COMMENT ON TABLE roast_attempts IS 'Detailed history of roast generation attempts and their outcomes';
COMMENT ON COLUMN roast_attempts.attempt_number IS 'Sequential attempt number for this comment';
COMMENT ON COLUMN roast_attempts.status IS 'Final status of this attempt (accepted, discarded, regenerated, pending)';
COMMENT ON COLUMN roast_attempts.generated_by IS 'User who triggered the roast generation (usually system or API user)';
COMMENT ON COLUMN roast_attempts.action_taken_by IS 'User who made the decision on this attempt (approved, rejected, regenerated)';