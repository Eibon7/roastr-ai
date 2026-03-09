import type { Platform, AnalysisResult } from "../types/analysis.js";
import { FALLBACK_THRESHOLDS } from "../types/shield.js";
import { getPlatformCapabilities } from "../platforms/platform-capabilities.js";

export type PrimaryShieldAction =
  | "hide"
  | "report"
  | "block"
  | "strike1"
  | "strike1_silent"
  | "none";

export type ResolvedShieldAction = {
  primary: PrimaryShieldAction;
  fallbacks: PrimaryShieldAction[];
  platformFallback: boolean;
};

export function resolveShieldAction(
  analysisResult: AnalysisResult,
  platform: Platform,
  aggressiveness: number,
): ResolvedShieldAction {
  const caps = getPlatformCapabilities(platform);
  const effectiveScore = analysisResult.severity_score * aggressiveness;
  const tauShield = FALLBACK_THRESHOLDS.tau_shield;
  const tauLow = FALLBACK_THRESHOLDS.tau_low;

  const hardOverride =
    analysisResult.flags.has_identity_attack || analysisResult.flags.has_threat;
  if (
    !hardOverride &&
    (analysisResult.decision === "shield_moderado" ||
      analysisResult.decision === "shield_critico") &&
    effectiveScore < tauShield
  ) {
    return { primary: "none", fallbacks: [], platformFallback: false };
  }
  if (
    !hardOverride &&
    analysisResult.decision === "correctiva" &&
    effectiveScore < tauLow
  ) {
    return { primary: "none", fallbacks: [], platformFallback: false };
  }
  if (
    analysisResult.decision === "eligible_for_response" &&
    effectiveScore < tauLow
  ) {
    return { primary: "none", fallbacks: [], platformFallback: false };
  }

  if (analysisResult.decision === "no_action") {
    return { primary: "none", fallbacks: [], platformFallback: false };
  }

  if (analysisResult.decision === "correctiva") {
    if (caps.canReply) {
      return { primary: "strike1", fallbacks: [], platformFallback: false };
    }
    return { primary: "strike1_silent", fallbacks: [], platformFallback: true };
  }

  if (
    analysisResult.decision === "shield_moderado" ||
    analysisResult.decision === "shield_critico"
  ) {
    const isCritical =
      analysisResult.decision === "shield_critico" ||
      analysisResult.flags.has_identity_attack ||
      analysisResult.flags.has_threat;

    if (isCritical) {
      const criticalFlags =
        analysisResult.flags.has_identity_attack || analysisResult.flags.has_threat;
      if (criticalFlags && caps.canReport) {
        const fallbacks: PrimaryShieldAction[] = [];
        if (caps.canHide) fallbacks.push("hide");
        if (caps.canBlock) fallbacks.push("block");
        return { primary: "report", fallbacks, platformFallback: false };
      }
      if (caps.canHide) {
        return { primary: "hide", fallbacks: ["block"], platformFallback: false };
      }
      if (caps.canBlock) {
        return { primary: "block", fallbacks: [], platformFallback: true };
      }
      return { primary: "none", fallbacks: [], platformFallback: true };
    }

    if (caps.canHide) {
      return { primary: "hide", fallbacks: ["block"], platformFallback: false };
    }
    if (caps.canBlock) {
      return { primary: "block", fallbacks: [], platformFallback: true };
    }
    return { primary: "none", fallbacks: [], platformFallback: true };
  }

  return { primary: "none", fallbacks: [], platformFallback: false };
}
