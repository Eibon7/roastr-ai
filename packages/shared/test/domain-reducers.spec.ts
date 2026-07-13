import { describe, it, expect } from "vitest";
import { analysisReducer, type AnalysisReducerInput } from "../src/domain/analysis-reducer";
import { thresholdRouter, type ThresholdRouterInput } from "../src/domain/threshold-router";
import { FALLBACK_THRESHOLDS, FALLBACK_WEIGHTS } from "../src/types/shield";
import type { OffenderProfile } from "../src/types/shield";

function baseInput(overrides: Partial<AnalysisReducerInput> = {}): AnalysisReducerInput {
  return {
    scoreBase: 0.5,
    scoreSource: "perspective",
    personaMatches: {
      matchesLineaRoja: false,
      matchesIdentidad: false,
      matchesTolerancia: false,
      matchedRedLines: [],
    },
    offender: null,
    thresholds: FALLBACK_THRESHOLDS,
    weights: FALLBACK_WEIGHTS,
    remainingAnalysis: 10,
    insultDensity: 0,
    hasIdentityAttack: false,
    hasThreat: false,
    hasInsultWithArgument: false,
    ...overrides,
  };
}

describe("analysisReducer", () => {
  it("short-circuits to no_action with severity 0 when the analysis quota is exhausted", () => {
    const result = analysisReducer(baseInput({ remainingAnalysis: 0, scoreBase: 0.9 }));
    expect(result.decision).toBe("no_action");
    expect(result.severity_score).toBe(0);
    expect(result.adjustments.recurrence_factor).toBe(1);
  });

  it("short-circuits to no_action for negative remainingAnalysis too", () => {
    const result = analysisReducer(baseInput({ remainingAnalysis: -1 }));
    expect(result.decision).toBe("no_action");
  });

  it("falls back to thresholds.tau_shield when scoreBase is null", () => {
    const result = analysisReducer(baseInput({ scoreBase: null, scoreSource: "both_failed" }));
    // scoreBase becomes tau_shield (0.55) -> decision should be shield_moderado boundary
    expect(result.severity_score).toBeCloseTo(FALLBACK_THRESHOLDS.tau_shield, 5);
    expect(result.decision).toBe("shield_moderado");
    expect(result.score_source).toBe("both_failed");
  });

  it("forces scoreBase to 1.0 when insultDensity reaches N_DENSIDAD", () => {
    const result = analysisReducer(baseInput({ scoreBase: 0.1, insultDensity: 3 }));
    expect(result.severity_score).toBe(1.0);
    expect(result.decision).toBe("shield_critico");
  });

  it("does not force scoreBase to 1.0 below N_DENSIDAD", () => {
    const result = analysisReducer(baseInput({ scoreBase: 0.1, insultDensity: 2 }));
    expect(result.severity_score).toBeLessThan(1.0);
  });

  it("applies the linea_roja weight multiplicatively when matched", () => {
    const result = analysisReducer(
      baseInput({
        scoreBase: 0.4,
        personaMatches: {
          matchesLineaRoja: true,
          matchesIdentidad: false,
          matchesTolerancia: false,
          matchedRedLines: ["insulto"],
        },
      }),
    );
    expect(result.severity_score).toBeCloseTo(0.4 * FALLBACK_WEIGHTS.linea_roja, 5);
    expect(result.adjustments.persona_applied).toBe(true);
    expect(result.flags.matched_red_lines).toEqual(["insulto"]);
  });

  it("applies the identidad weight multiplicatively when matched", () => {
    const result = analysisReducer(
      baseInput({
        scoreBase: 0.4,
        personaMatches: {
          matchesLineaRoja: false,
          matchesIdentidad: true,
          matchesTolerancia: false,
          matchedRedLines: [],
        },
      }),
    );
    expect(result.severity_score).toBeCloseTo(0.4 * FALLBACK_WEIGHTS.identidad, 5);
  });

  it("applies the tolerancia weight only while the running score stays below tau_shield", () => {
    const result = analysisReducer(
      baseInput({
        scoreBase: 0.3,
        personaMatches: {
          matchesLineaRoja: false,
          matchesIdentidad: false,
          matchesTolerancia: true,
          matchedRedLines: [],
        },
      }),
    );
    expect(result.severity_score).toBeCloseTo(0.3 * FALLBACK_WEIGHTS.tolerancia, 5);
  });

  it("skips the tolerancia weight once the adjusted score has already reached tau_shield", () => {
    const result = analysisReducer(
      baseInput({
        scoreBase: 0.9, // already >= tau_shield before tolerancia is considered
        personaMatches: {
          matchesLineaRoja: false,
          matchesIdentidad: false,
          matchesTolerancia: true,
          matchedRedLines: [],
        },
      }),
    );
    expect(result.severity_score).toBeCloseTo(0.9, 5);
  });

  it.each([
    [1 as const, 1.1],
    [2 as const, 1.25],
    ["critical" as const, 1.5],
  ])("applies recurrence factor %s -> %s for repeat offenders", (strikeLevel, factor) => {
    const offender: OffenderProfile = { strikeLevel, lastStrike: "2026-01-01" };
    const result = analysisReducer(baseInput({ scoreBase: 0.2, offender }));
    expect(result.adjustments.recurrence_factor).toBe(factor);
    expect(result.severity_score).toBeCloseTo(Math.min(0.2 * factor, 1), 5);
  });

  it("leaves recurrence factor at 1 when there is no offender profile", () => {
    const result = analysisReducer(baseInput({ scoreBase: 0.2, offender: null }));
    expect(result.adjustments.recurrence_factor).toBe(1);
  });

  it("clamps the final score to the [0, 1] range", () => {
    const offender: OffenderProfile = { strikeLevel: "critical", lastStrike: null };
    const result = analysisReducer(
      baseInput({
        scoreBase: 0.9,
        offender,
        personaMatches: {
          matchesLineaRoja: true,
          matchesIdentidad: true,
          matchesTolerancia: false,
          matchedRedLines: ["x"],
        },
      }),
    );
    expect(result.severity_score).toBeLessThanOrEqual(1.0);
    expect(result.severity_score).toBeGreaterThanOrEqual(0);
  });

  it("computes personaFactor as 1 when scoreBase is exactly 0 (avoids division by zero)", () => {
    const result = analysisReducer(
      baseInput({
        scoreBase: 0,
        personaMatches: {
          matchesLineaRoja: true,
          matchesIdentidad: false,
          matchesTolerancia: false,
          matchedRedLines: ["x"],
        },
      }),
    );
    expect(result.adjustments.persona_factor).toBe(1);
  });

  it("marks persona_applied false when no persona rule matched", () => {
    const result = analysisReducer(baseInput({ scoreBase: 0.1 }));
    expect(result.adjustments.persona_applied).toBe(false);
    expect(result.adjustments.persona_factor).toBe(1);
  });

  it("propagates identity-attack / threat / insult-with-argument flags into the result", () => {
    const result = analysisReducer(
      baseInput({
        scoreBase: 0.1,
        hasIdentityAttack: true,
        hasThreat: true,
        hasInsultWithArgument: true,
      }),
    );
    expect(result.flags.has_identity_attack).toBe(true);
    expect(result.flags.has_threat).toBe(true);
    expect(result.flags.has_insult_with_argument).toBe(true);
    // hard override via thresholdRouter regardless of low score
    expect(result.decision).toBe("shield_critico");
  });

  it("carries the score_source through untouched", () => {
    const result = analysisReducer(baseInput({ scoreSource: "llm_fallback", scoreBase: 0.1 }));
    expect(result.score_source).toBe("llm_fallback");
  });
});

describe("thresholdRouter", () => {
  function baseRouter(overrides: Partial<ThresholdRouterInput> = {}): ThresholdRouterInput {
    return {
      scoreFinal: 0,
      thresholds: FALLBACK_THRESHOLDS,
      hasIdentityAttack: false,
      hasThreat: false,
      hasInsultWithArgument: false,
      offender: null,
      ...overrides,
    };
  }

  it("routes to shield_critico on identity attack regardless of score", () => {
    expect(thresholdRouter(baseRouter({ hasIdentityAttack: true, scoreFinal: 0 }))).toBe(
      "shield_critico",
    );
  });

  it("routes to shield_critico on threat regardless of score", () => {
    expect(thresholdRouter(baseRouter({ hasThreat: true, scoreFinal: 0 }))).toBe("shield_critico");
  });

  it("routes to shield_critico when scoreFinal >= tau_critical", () => {
    expect(
      thresholdRouter(baseRouter({ scoreFinal: FALLBACK_THRESHOLDS.tau_critical })),
    ).toBe("shield_critico");
  });

  it("routes to shield_moderado when scoreFinal >= tau_shield but below tau_critical", () => {
    expect(
      thresholdRouter(baseRouter({ scoreFinal: FALLBACK_THRESHOLDS.tau_shield })),
    ).toBe("shield_moderado");
  });

  it("routes to correctiva when scoreFinal >= tau_low, insult-with-argument, and offender is a first-timer", () => {
    expect(
      thresholdRouter(
        baseRouter({
          scoreFinal: FALLBACK_THRESHOLDS.tau_low,
          hasInsultWithArgument: true,
          offender: { strikeLevel: 0, lastStrike: null },
        }),
      ),
    ).toBe("correctiva");
  });

  it("routes to correctiva when scoreFinal >= tau_low, insult-with-argument, and there is no offender record at all", () => {
    expect(
      thresholdRouter(
        baseRouter({
          scoreFinal: FALLBACK_THRESHOLDS.tau_low,
          hasInsultWithArgument: true,
          offender: null,
        }),
      ),
    ).toBe("correctiva");
  });

  it("does NOT route to correctiva for a repeat offender — falls through to eligible_for_response", () => {
    expect(
      thresholdRouter(
        baseRouter({
          scoreFinal: FALLBACK_THRESHOLDS.tau_low,
          hasInsultWithArgument: true,
          offender: { strikeLevel: 1, lastStrike: "2026-01-01" },
        }),
      ),
    ).toBe("eligible_for_response");
  });

  it("routes to eligible_for_response when scoreFinal >= tau_low without insult-with-argument", () => {
    expect(
      thresholdRouter(baseRouter({ scoreFinal: FALLBACK_THRESHOLDS.tau_low })),
    ).toBe("eligible_for_response");
  });

  it("routes to no_action when scoreFinal is below tau_low", () => {
    expect(
      thresholdRouter(baseRouter({ scoreFinal: FALLBACK_THRESHOLDS.tau_low - 0.01 })),
    ).toBe("no_action");
  });

  it("routes to no_action for scoreFinal of exactly 0", () => {
    expect(thresholdRouter(baseRouter({ scoreFinal: 0 }))).toBe("no_action");
  });
});
