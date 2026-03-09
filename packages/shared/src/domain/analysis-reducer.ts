import type {
  AnalysisResult,
  AnalysisDecision,
  Thresholds,
  Weights,
  OffenderProfile,
  ScoreSource,
} from "../types/index.js";
import { N_DENSIDAD } from "../types/shield.js";
import { thresholdRouter } from "./threshold-router.js";

export type AnalysisReducerInput = {
  scoreBase: number | null;
  scoreSource: ScoreSource;
  personaMatches: {
    matchesLineaRoja: boolean;
    matchesIdentidad: boolean;
    matchesTolerancia: boolean;
    matchedRedLines: string[];
  };
  offender: OffenderProfile | null;
  thresholds: Thresholds;
  weights: Weights;
  remainingAnalysis: number;
  insultDensity: number;
  hasIdentityAttack: boolean;
  hasThreat: boolean;
  hasInsultWithArgument: boolean;
};

export function analysisReducer(input: AnalysisReducerInput): AnalysisResult {
  const {
    personaMatches,
    offender,
    thresholds,
    weights,
    remainingAnalysis,
    insultDensity,
    hasIdentityAttack,
    hasThreat,
    hasInsultWithArgument,
  } = input;

  let scoreBase = input.scoreBase;
  const scoreSource = input.scoreSource;

  if (remainingAnalysis <= 0) {
    return buildResult("no_action", 0, input, 1, scoreSource);
  }

  if (scoreBase === null) {
    scoreBase = thresholds.tau_shield;
  }

  if (insultDensity >= N_DENSIDAD) {
    scoreBase = 1.0;
  }

  let adjusted = scoreBase;
  if (personaMatches.matchesLineaRoja) adjusted *= weights.linea_roja;
  if (personaMatches.matchesIdentidad) adjusted *= weights.identidad;
  if (personaMatches.matchesTolerancia && adjusted < thresholds.tau_shield) {
    adjusted *= weights.tolerancia;
  }

  const personaFactor =
    scoreBase === 0 ? 1 : adjusted / scoreBase;

  let recurrenceFactor = 1;
  if (offender) {
    switch (offender.strikeLevel) {
      case 1:
        recurrenceFactor = 1.1;
        break;
      case 2:
        recurrenceFactor = 1.25;
        break;
      case "critical":
        recurrenceFactor = 1.5;
        break;
    }
    adjusted *= recurrenceFactor;
  }

  const scoreFinal = Math.max(0, Math.min(adjusted, 1.0));

  const decision = thresholdRouter({
    scoreFinal,
    thresholds,
    hasIdentityAttack,
    hasThreat,
    hasInsultWithArgument,
    offender,
  });

  return buildResult(decision, scoreFinal, input, recurrenceFactor, scoreSource, personaFactor);
}

function buildResult(
  decision: AnalysisDecision,
  severityScore: number,
  input: AnalysisReducerInput,
  recurrenceFactor: number,
  scoreSource: ScoreSource,
  personaFactor = 1,
): AnalysisResult {
  const personaApplied =
    input.personaMatches.matchesLineaRoja ||
    input.personaMatches.matchesIdentidad ||
    input.personaMatches.matchesTolerancia;

  return {
    decision,
    severity_score: severityScore,
    flags: {
      has_identity_attack: input.hasIdentityAttack,
      has_threat: input.hasThreat,
      has_insult_with_argument: input.hasInsultWithArgument,
      matched_red_lines: input.personaMatches.matchedRedLines,
      insult_density: input.insultDensity,
    },
    adjustments: {
      persona_applied: personaApplied,
      persona_factor: personaFactor,
      recurrence_factor: recurrenceFactor,
      severity_score_final: severityScore,
    },
    score_source: scoreSource,
  };
}
