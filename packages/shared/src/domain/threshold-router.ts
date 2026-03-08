import type { AnalysisDecision } from "../types/analysis.js";
import type { Thresholds, OffenderProfile } from "../types/shield.js";

export type ThresholdRouterInput = {
  scoreFinal: number;
  thresholds: Thresholds;
  hasIdentityAttack: boolean;
  hasThreat: boolean;
  hasInsultWithArgument: boolean;
  offender: OffenderProfile | null;
};

export function thresholdRouter(input: ThresholdRouterInput): AnalysisDecision {
  if (input.hasIdentityAttack) return "shield_critico";
  if (input.hasThreat) return "shield_critico";

  if (input.scoreFinal >= input.thresholds.tau_critical) return "shield_critico";
  if (input.scoreFinal >= input.thresholds.tau_shield) return "shield_moderado";

  if (
    input.scoreFinal >= input.thresholds.tau_low &&
    input.hasInsultWithArgument &&
    (input.offender?.strikeLevel === 0 || !input.offender)
  ) {
    return "correctiva";
  }

  if (input.scoreFinal >= input.thresholds.tau_low) return "eligible_for_response";

  return "no_action";
}
