-- Migration 012: Add persona_fields_used to responses table
-- Issue #81: Track which Roastr Persona fields are used in each response

-- ============================================================================
-- ADD PERSONA TRACKING FIELD TO RESPONSES
-- ============================================================================

-- Add persona_fields_used column to track which persona fields influenced each response
ALTER TABLE responses 
ADD COLUMN persona_fields_used TEXT[] DEFAULT NULL;

-- Add index for efficient querying of persona field usage
CREATE INDEX idx_responses_persona_fields_used ON responses 
USING GIN (persona_fields_used) 
WHERE persona_fields_used IS NOT NULL;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN responses.persona_fields_used IS 
'Array of Roastr Persona field names that were used to generate this response (Issue #81)';

COMMENT ON INDEX idx_responses_persona_fields_used IS 
'Efficient lookup for persona field usage analytics (Issue #81)';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- The persona_fields_used array can contain:
-- ['lo_que_me_define'] - Only identity field was used
-- ['lo_que_no_tolero'] - Only intolerance field was used  
-- ['lo_que_me_da_igual'] - Only tolerance field was used
-- ['lo_que_me_define', 'lo_que_no_tolero'] - Multiple fields were used
-- NULL - No persona fields were used (default behavior)

-- This enables analytics queries like:
-- SELECT COUNT(*) FROM responses WHERE 'lo_que_me_define' = ANY(persona_fields_used);
-- SELECT persona_fields_used, COUNT(*) FROM responses WHERE persona_fields_used IS NOT NULL GROUP BY persona_fields_used;