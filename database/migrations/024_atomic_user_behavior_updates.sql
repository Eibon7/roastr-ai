-- Migration 024: Atomic User Behavior Updates for Shield
-- Purpose: Add Postgres RPC function for atomic user_behavior increments
--          Prevents race conditions when multiple Shield actions update same user
-- Related: Issue #653, CodeRabbit Review #3375358448 (M3)

-- Function to atomically update user_behavior counters
-- Uses INSERT...ON CONFLICT to ensure atomic operations
CREATE OR REPLACE FUNCTION atomic_update_user_behavior(
  p_organization_id UUID,
  p_platform TEXT,
  p_platform_user_id TEXT,
  p_platform_username TEXT,
  p_violation_data JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_severity TEXT;
  v_toxicity_score NUMERIC;
  v_action_tags TEXT[];
  v_current_behavior JSONB;
BEGIN
  -- Extract parameters from violation_data
  v_severity := p_violation_data->>'severity';
  v_toxicity_score := (p_violation_data->>'toxicity_score')::NUMERIC;
  v_action_tags := ARRAY(SELECT jsonb_array_elements_text(p_violation_data->'action_tags'));

  -- Upsert with atomic increment
  INSERT INTO user_behaviors (
    organization_id,
    platform,
    platform_user_id,
    platform_username,
    total_violations,
    severity_counts,
    actions_taken,
    last_violation_at,
    last_seen_at,
    created_at,
    updated_at
  )
  VALUES (
    p_organization_id,
    p_platform,
    p_platform_user_id,
    p_platform_username,
    1, -- total_violations
    jsonb_build_object(v_severity, 1), -- severity_counts
    jsonb_build_array(
      jsonb_build_object(
        'timestamp', CURRENT_TIMESTAMP,
        'comment_id', p_violation_data->>'comment_id',
        'action_tags', v_action_tags,
        'severity', v_severity,
        'toxicity_score', v_toxicity_score
      )
    ), -- actions_taken
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (organization_id, platform, platform_user_id) DO UPDATE
  SET
    total_violations = user_behaviors.total_violations + 1,
    severity_counts = jsonb_set(
      COALESCE(user_behaviors.severity_counts, '{}'::jsonb),
      ARRAY[v_severity],
      to_jsonb(COALESCE((user_behaviors.severity_counts->>v_severity)::INT, 0) + 1)
    ),
    actions_taken = COALESCE(user_behaviors.actions_taken, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'timestamp', CURRENT_TIMESTAMP,
        'comment_id', p_violation_data->>'comment_id',
        'action_tags', v_action_tags,
        'severity', v_severity,
        'toxicity_score', v_toxicity_score
      )
    ),
    last_violation_at = CURRENT_TIMESTAMP,
    last_seen_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  RETURNING
    jsonb_build_object(
      'user_id', platform_user_id,
      'total_violations', total_violations,
      'severity_counts', severity_counts,
      'last_violation_at', last_violation_at
    ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION atomic_update_user_behavior(UUID, TEXT, TEXT, TEXT, JSONB) IS
'Atomically updates user_behavior counters using INSERT...ON CONFLICT. '
'Prevents race conditions when multiple Shield actions update the same user simultaneously. '
'Returns updated user behavior data. '
'Called by ShieldService._updateUserBehaviorFromTags() in Phase 2.';

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION atomic_update_user_behavior(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION atomic_update_user_behavior(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;
