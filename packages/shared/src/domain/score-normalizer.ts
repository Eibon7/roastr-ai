import type { ScoreSource } from "../types/analysis.js";

export type PerspectiveAttributeScores = Record<
  string,
  { summaryScore?: { value?: number } }
>;

export type NormalizedScore = {
  scoreBase: number | null;
  scoreSource: ScoreSource;
  hasIdentityAttack: boolean;
  hasThreat: boolean;
  hasInsultWithArgument: boolean;
  insultDensity: number;
};

const FLAG_THRESHOLD = 0.5;

export function normalizePerspectiveScores(
  raw: PerspectiveAttributeScores,
): NormalizedScore {
  const toxicity = raw.TOXICITY?.summaryScore?.value ?? null;
  const severeToxicity = raw.SEVERE_TOXICITY?.summaryScore?.value ?? null;
  const identityAttack = raw.IDENTITY_ATTACK?.summaryScore?.value ?? 0;
  const insult = raw.INSULT?.summaryScore?.value ?? 0;
  const threat = raw.THREAT?.summaryScore?.value ?? 0;

  const scoreBase =
    toxicity !== null && severeToxicity !== null
      ? Math.max(toxicity, severeToxicity)
      : toxicity ?? severeToxicity;

  const hasIdentityAttack = identityAttack >= FLAG_THRESHOLD;
  const hasThreat = threat >= FLAG_THRESHOLD;
  const insultDensity = insult >= FLAG_THRESHOLD ? 1 : 0;

  return {
    scoreBase,
    scoreSource: "perspective",
    hasIdentityAttack,
    hasThreat,
    hasInsultWithArgument: false,
    insultDensity,
  };
}

export function normalizeBothFailed(): NormalizedScore {
  return {
    scoreBase: null,
    scoreSource: "both_failed",
    hasIdentityAttack: false,
    hasThreat: false,
    hasInsultWithArgument: false,
    insultDensity: 0,
  };
}

export type LLMToxicityResult = {
  score: number;
  hasIdentityAttack?: boolean;
  hasThreat?: boolean;
};

export function normalizeFromLLM(result: LLMToxicityResult): NormalizedScore {
  const score = Math.max(0, Math.min(1, result.score));
  return {
    scoreBase: score,
    scoreSource: "llm_fallback",
    hasIdentityAttack: result.hasIdentityAttack ?? false,
    hasThreat: result.hasThreat ?? false,
    hasInsultWithArgument: false,
    insultDensity: 0,
  };
}
