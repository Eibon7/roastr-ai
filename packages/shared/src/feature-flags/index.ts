export const FEATURE_FLAG_NAMES = [
  'roasting_enabled',
  'shield_enabled',
  'analysis_enabled',
  'billing_enabled',
  'admin_panel_enabled',
  'persona_enabled',
  'x_platform_enabled',
  'youtube_platform_enabled',
] as const;

export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number];

export function isValidFeatureFlagName(name: string): name is FeatureFlagName {
  return (FEATURE_FLAG_NAMES as readonly string[]).includes(name);
}
