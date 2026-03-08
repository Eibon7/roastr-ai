import { describe, it, expect } from "vitest";
import { analysisReducer } from "@roastr/shared";
import { FALLBACK_THRESHOLDS, FALLBACK_WEIGHTS } from "@roastr/shared";

describe("Analysis reducer — recurrence factor", () => {
  const baseInput = {
    scoreBase: 0.5,
    scoreSource: "perspective" as const,
    personaMatches: {
      matchesLineaRoja: false,
      matchesIdentidad: false,
      matchesTolerancia: false,
      matchedRedLines: [] as string[],
    },
    thresholds: FALLBACK_THRESHOLDS,
    weights: FALLBACK_WEIGHTS,
    remainingAnalysis: 100,
    insultDensity: 0,
    hasIdentityAttack: false,
    hasThreat: false,
    hasInsultWithArgument: false,
  };

  it("offender null → recurrence_factor 1 in adjustments", () => {
    const result = analysisReducer({ ...baseInput, offender: null });
    expect(result.adjustments.recurrence_factor).toBe(1);
  });

  it("offender strikeLevel 1 → recurrence_factor 1.1", () => {
    const result = analysisReducer({
      ...baseInput,
      offender: { strikeLevel: 1, lastStrike: null },
    });
    expect(result.adjustments.recurrence_factor).toBe(1.1);
  });

  it("offender strikeLevel 2 → recurrence_factor 1.25", () => {
    const result = analysisReducer({
      ...baseInput,
      offender: { strikeLevel: 2, lastStrike: null },
    });
    expect(result.adjustments.recurrence_factor).toBe(1.25);
  });

  it("offender strikeLevel critical → recurrence_factor 1.5", () => {
    const result = analysisReducer({
      ...baseInput,
      offender: { strikeLevel: "critical", lastStrike: null },
    });
    expect(result.adjustments.recurrence_factor).toBe(1.5);
  });

  it("higher recurrence increases severity_score", () => {
    const r0 = analysisReducer({ ...baseInput, offender: null });
    const r1 = analysisReducer({
      ...baseInput,
      offender: { strikeLevel: 1, lastStrike: null },
    });
    expect(r1.severity_score).toBeGreaterThanOrEqual(r0.severity_score);
  });
});
