import { describe, it, expect } from "vitest";
import { resolveShieldAction } from "../src/domain/shield-resolver";
import { FALLBACK_THRESHOLDS } from "../src/types/shield";
import type { AnalysisResult, AnalysisDecision } from "../src/types/analysis";

function result(
  decision: AnalysisDecision,
  severity_score: number,
  flags: Partial<AnalysisResult["flags"]> = {},
): AnalysisResult {
  return {
    decision,
    severity_score,
    flags: {
      has_identity_attack: false,
      has_threat: false,
      has_insult_with_argument: false,
      matched_red_lines: [],
      insult_density: 0,
      ...flags,
    },
    adjustments: {
      persona_applied: false,
      persona_factor: 1,
      recurrence_factor: 1,
      severity_score_final: severity_score,
    },
    score_source: "perspective",
  };
}

const { tau_shield, tau_low } = FALLBACK_THRESHOLDS;

describe("resolveShieldAction", () => {
  it("resolves no_action decisions to primary none", () => {
    const action = resolveShieldAction(result("no_action", 0), "youtube", 1);
    expect(action).toEqual({ primary: "none", fallbacks: [], platformFallback: false });
  });

  it("resolves eligible_for_response to none when effective score is below tau_low", () => {
    const action = resolveShieldAction(result("eligible_for_response", tau_low - 0.05), "youtube", 1);
    expect(action.primary).toBe("none");
  });

  it("resolves eligible_for_response to none even at a high effective score (no dedicated branch)", () => {
    const action = resolveShieldAction(result("eligible_for_response", 0.99), "youtube", 1);
    expect(action.primary).toBe("none");
  });

  it("suppresses correctiva below tau_low", () => {
    const action = resolveShieldAction(result("correctiva", tau_low - 0.01), "youtube", 1);
    expect(action.primary).toBe("none");
  });

  it("routes correctiva at/above tau_low to strike1 when the platform allows replies", () => {
    const action = resolveShieldAction(result("correctiva", tau_low), "youtube", 1);
    expect(action).toEqual({ primary: "strike1", fallbacks: [], platformFallback: false });
  });

  it("routes correctiva to a silent strike when the platform cannot reply", () => {
    const action = resolveShieldAction(result("correctiva", tau_low), "instagram", 1);
    expect(action).toEqual({
      primary: "strike1_silent",
      fallbacks: [],
      platformFallback: true,
    });
  });

  it("suppresses shield_moderado/critico below tau_shield when there's no hard override", () => {
    const action = resolveShieldAction(result("shield_moderado", tau_shield - 0.05), "youtube", 1);
    expect(action.primary).toBe("none");
  });

  it("bypasses the tau_shield suppression when has_identity_attack is set (hard override)", () => {
    const action = resolveShieldAction(
      result("shield_moderado", tau_shield - 0.2, { has_identity_attack: true }),
      "youtube",
      1,
    );
    expect(action.primary).not.toBe("none");
  });

  it("bypasses the tau_shield suppression when has_threat is set (hard override)", () => {
    const action = resolveShieldAction(
      result("shield_moderado", tau_shield - 0.2, { has_threat: true }),
      "youtube",
      1,
    );
    expect(action.primary).not.toBe("none");
  });

  it("treats identity-attack/threat flags as critical even when decision is only shield_moderado", () => {
    const action = resolveShieldAction(
      result("shield_moderado", 0.9, { has_identity_attack: true }),
      "youtube",
      1,
    );
    // isCritical -> criticalFlags true -> platform can report -> "report"
    expect(action.primary).toBe("report");
  });

  it("reports with hide/block fallbacks for a critical decision on a fully-capable platform", () => {
    const action = resolveShieldAction(
      result("shield_critico", 0.9, { has_threat: true }),
      "youtube",
      1,
    );
    expect(action.primary).toBe("report");
    expect(action.fallbacks).toEqual(["hide", "block"]);
    expect(action.platformFallback).toBe(false);
  });

  it("falls back to hide when the platform cannot report a critical case", () => {
    // instagram: canReport=false, canHide=true, canBlock=true
    const action = resolveShieldAction(
      result("shield_critico", 0.9, { has_identity_attack: true }),
      "instagram",
      1,
    );
    expect(action.primary).toBe("hide");
    expect(action.fallbacks).toEqual(["block"]);
    expect(action.platformFallback).toBe(false);
  });

  it("skips the report branch when critical decision has no identity-attack/threat flags", () => {
    // decision itself is shield_critico (isCritical true) but criticalFlags false
    const action = resolveShieldAction(result("shield_critico", 0.9), "youtube", 1);
    expect(action.primary).toBe("hide");
  });

  it("falls back to block, marking platformFallback, when the platform can neither report nor hide", () => {
    const action = resolveShieldAction(
      result("shield_critico", 0.9, { has_threat: true }),
      "linkedin",
      1,
    );
    // linkedin: canHide=false, canReport=false, canBlock=false -> none, platformFallback true
    expect(action).toEqual({ primary: "none", fallbacks: [], platformFallback: true });
  });

  it("routes non-critical shield_moderado to hide with a block fallback", () => {
    const action = resolveShieldAction(result("shield_moderado", tau_shield), "youtube", 1);
    expect(action).toEqual({ primary: "hide", fallbacks: ["block"], platformFallback: false });
  });

  it("falls back to block for non-critical shield_moderado when the platform cannot hide", () => {
    const action = resolveShieldAction(result("shield_moderado", tau_shield), "linkedin", 1);
    expect(action).toEqual({ primary: "none", fallbacks: [], platformFallback: true });
  });

  it("scales the effective score by aggressiveness", () => {
    // severity 0.9 * aggressiveness 0 = 0 effective score -> below tau_shield -> suppressed
    const action = resolveShieldAction(result("shield_moderado", 0.9), "youtube", 0);
    expect(action.primary).toBe("none");
  });

  it("higher aggressiveness can push a borderline score over tau_shield", () => {
    const action = resolveShieldAction(result("shield_moderado", tau_shield / 2), "youtube", 3);
    expect(action.primary).not.toBe("none");
  });
});
