export const FEATURE_FLAG_NAMES = [
  // Core
  'roasting_enabled',
  'autopost_enabled',
  'personal_tone_enabled',
  'multi_version_enabled',
  'sponsor_feature_enabled',
  // Shield
  'enable_shield',
  'kill_switch_autopost',
  'enable_perspective_fallback',
  'manual_review_enabled',
  // UX/UI
  'show_transparency_disclaimer',
  'enable_magic_links_user',
  'onboarding_skip_allowed',
  // Experimental
  'enable_nsfw_tone',
  'enable_advanced_tones',
  'enable_hall_of_fame',
  'enable_brigading_detection',
] as const;

export const PLAN_LIMIT_KEYS = [
  'starter_monthly_analyses',
  'pro_monthly_analyses',
  'plus_monthly_analyses',
] as const;

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];

export function isValidFeatureFlagName(name: string): name is FeatureFlagName {
  return (FEATURE_FLAG_NAMES as readonly string[]).includes(name);
}
