import type { NormalizedScore } from "@roastr/shared";

export type { PerspectiveAttributeScores, NormalizedScore } from "@roastr/shared";
export { normalizePerspectiveScores, normalizeBothFailed } from "@roastr/shared";

/** Raw LLM fallback response shape */
export type LlmFallbackScores = {
  toxicity_level: "low" | "medium" | "high" | "critical";
  has_identity_attack: boolean;
  has_threat: boolean;
  insults_count: number;
  has_initial_insult_with_argument: boolean;
};

const TOXICITY_LEVEL_SCORE: Record<string, number> = {
  low: 0.2,
  medium: 0.45,
  high: 0.75,
  critical: 0.95,
};

export function normalizeLlmScores(raw: LlmFallbackScores): NormalizedScore {
  const scoreBase = TOXICITY_LEVEL_SCORE[raw.toxicity_level] ?? 0.45;

  return {
    scoreBase,
    scoreSource: "llm_fallback",
    hasIdentityAttack: raw.has_identity_attack,
    hasThreat: raw.has_threat,
    hasInsultWithArgument: raw.has_initial_insult_with_argument,
    insultDensity: raw.insults_count,
  };
}
