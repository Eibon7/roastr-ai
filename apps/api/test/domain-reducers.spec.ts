import { describe, it, expect } from "vitest";
import {
  thresholdRouter,
  type ThresholdRouterInput,
} from "../src/domain/threshold-router";
import {
  billingReducer,
  type BillingEvent,
  type BillingReducerResult,
} from "../src/domain/billing-reducer";
import {
  matchPersona,
  type PersonaMatchResult,
} from "../src/domain/persona-matcher";
import { analysisReducer, type AnalysisReducerInput } from "../src/domain/analysis-reducer";
import type {
  Thresholds,
  Weights,
  BillingState,
  PersonaProfile,
} from "@roastr/shared";
import { FALLBACK_THRESHOLDS, FALLBACK_WEIGHTS, N_DENSIDAD } from "@roastr/shared";

const baseThresholds: Thresholds = { ...FALLBACK_THRESHOLDS };

function routerInput(overrides: Partial<ThresholdRouterInput> = {}): ThresholdRouterInput {
  return {
    scoreFinal: 0,
    thresholds: baseThresholds,
    hasIdentityAttack: false,
    hasThreat: false,
    hasInsultWithArgument: false,
    offender: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// thresholdRouter
// ---------------------------------------------------------------------------
describe("thresholdRouter", () => {
  it("returns shield_critico when identity attack regardless of score", () => {
    expect(thresholdRouter(routerInput({ hasIdentityAttack: true, scoreFinal: 0.1 }))).toBe(
      "shield_critico",
    );
  });

  it("returns shield_critico when threat regardless of score", () => {
    expect(thresholdRouter(routerInput({ hasThreat: true, scoreFinal: 0.05 }))).toBe(
      "shield_critico",
    );
  });

  it("returns shield_critico when score >= tau_critical", () => {
    expect(thresholdRouter(routerInput({ scoreFinal: 0.9 }))).toBe("shield_critico");
  });

  it("returns shield_moderado when score >= tau_shield but < tau_critical", () => {
    expect(thresholdRouter(routerInput({ scoreFinal: 0.6 }))).toBe("shield_moderado");
  });

  it("returns correctiva when insult-with-argument, score >= tau_low, strike 0", () => {
    expect(
      thresholdRouter(
        routerInput({
          scoreFinal: 0.3,
          hasInsultWithArgument: true,
          offender: { strikeLevel: 0, lastStrike: null },
        }),
      ),
    ).toBe("correctiva");
  });

  it("returns correctiva when insult-with-argument and offender is null", () => {
    expect(
      thresholdRouter(
        routerInput({ scoreFinal: 0.3, hasInsultWithArgument: true, offender: null }),
      ),
    ).toBe("correctiva");
  });

  it("does NOT return correctiva when strikeLevel > 0", () => {
    expect(
      thresholdRouter(
        routerInput({
          scoreFinal: 0.3,
          hasInsultWithArgument: true,
          offender: { strikeLevel: 1, lastStrike: null },
        }),
      ),
    ).toBe("eligible_for_response");
  });

  it("returns eligible_for_response when score >= tau_low without insult", () => {
    expect(thresholdRouter(routerInput({ scoreFinal: 0.3 }))).toBe("eligible_for_response");
  });

  it("returns no_action when score is below tau_low", () => {
    expect(thresholdRouter(routerInput({ scoreFinal: 0.1 }))).toBe("no_action");
  });

  it("identity attack takes priority over score-based paths", () => {
    expect(
      thresholdRouter(routerInput({ hasIdentityAttack: true, scoreFinal: 0.01 })),
    ).toBe("shield_critico");
  });
});

// ---------------------------------------------------------------------------
// billingReducer
// ---------------------------------------------------------------------------
describe("billingReducer", () => {
  const ALL_STATES: BillingState[] = [
    "trialing",
    "expired_trial_pending_payment",
    "active",
    "payment_retry",
    "canceled_pending",
    "paused",
  ];

  describe("trialing transitions", () => {
    it("TRIAL_EXPIRED → expired_trial_pending_payment + email", () => {
      const r = billingReducer("trialing", { type: "TRIAL_EXPIRED" });
      expect(r.newState).toBe("expired_trial_pending_payment");
      expect(r.sideEffects).toContainEqual({ type: "SEND_EMAIL", template: "trial_expired" });
    });

    it("PAYMENT_SUCCEEDED → active + activate effects", () => {
      const r = billingReducer("trialing", { type: "PAYMENT_SUCCEEDED" });
      expect(r.newState).toBe("active");
      expect(r.sideEffects).toContainEqual({ type: "ENABLE_INGESTION" });
      expect(r.sideEffects).toContainEqual({ type: "RESET_USAGE" });
    });
  });

  describe("expired_trial_pending_payment transitions", () => {
    it("PAYMENT_SUCCEEDED → active + activate", () => {
      const r = billingReducer("expired_trial_pending_payment", { type: "PAYMENT_SUCCEEDED" });
      expect(r.newState).toBe("active");
    });

    it("GRACE_PERIOD_EXPIRED → paused + pause effects", () => {
      const r = billingReducer("expired_trial_pending_payment", { type: "GRACE_PERIOD_EXPIRED" });
      expect(r.newState).toBe("paused");
      expect(r.sideEffects).toContainEqual({ type: "DISABLE_INGESTION" });
      expect(r.sideEffects).toContainEqual({
        type: "SEND_EMAIL",
        template: "subscription_paused",
      });
    });
  });

  describe("active transitions", () => {
    it("PAYMENT_FAILED → payment_retry + email", () => {
      const r = billingReducer("active", { type: "PAYMENT_FAILED" });
      expect(r.newState).toBe("payment_retry");
      expect(r.sideEffects).toContainEqual({ type: "SEND_EMAIL", template: "payment_failed" });
    });

    it("SUBSCRIPTION_CANCELED → canceled_pending + email", () => {
      const r = billingReducer("active", { type: "SUBSCRIPTION_CANCELED" });
      expect(r.newState).toBe("canceled_pending");
      expect(r.sideEffects).toContainEqual({
        type: "SEND_EMAIL",
        template: "subscription_canceled",
      });
    });
  });

  describe("payment_retry transitions", () => {
    it("PAYMENT_SUCCEEDED → active", () => {
      expect(billingReducer("payment_retry", { type: "PAYMENT_SUCCEEDED" }).newState).toBe(
        "active",
      );
    });

    it("GRACE_PERIOD_EXPIRED → paused", () => {
      expect(billingReducer("payment_retry", { type: "GRACE_PERIOD_EXPIRED" }).newState).toBe(
        "paused",
      );
    });
  });

  describe("canceled_pending transitions", () => {
    it("PAYMENT_SUCCEEDED → active", () => {
      expect(billingReducer("canceled_pending", { type: "PAYMENT_SUCCEEDED" }).newState).toBe(
        "active",
      );
    });

    it("GRACE_PERIOD_EXPIRED → paused", () => {
      expect(billingReducer("canceled_pending", { type: "GRACE_PERIOD_EXPIRED" }).newState).toBe(
        "paused",
      );
    });
  });

  describe("paused transitions", () => {
    it("SUBSCRIPTION_RESUMED → active + activate", () => {
      const r = billingReducer("paused", { type: "SUBSCRIPTION_RESUMED" });
      expect(r.newState).toBe("active");
      expect(r.sideEffects).toContainEqual({ type: "ENABLE_INGESTION" });
    });

    it("PAYMENT_SUCCEEDED → active", () => {
      expect(billingReducer("paused", { type: "PAYMENT_SUCCEEDED" }).newState).toBe("active");
    });
  });

  describe("invalid transitions return unchanged state", () => {
    it("trialing + SUBSCRIPTION_CANCELED has no transition", () => {
      const r = billingReducer("trialing", { type: "SUBSCRIPTION_CANCELED" });
      expect(r.newState).toBe("trialing");
      expect(r.sideEffects).toEqual([]);
    });

    it("active + TRIAL_EXPIRED has no transition", () => {
      const r = billingReducer("active", { type: "TRIAL_EXPIRED" });
      expect(r.newState).toBe("active");
      expect(r.sideEffects).toEqual([]);
    });

    it("paused + PAYMENT_FAILED stays paused", () => {
      const r = billingReducer("paused", { type: "PAYMENT_FAILED" });
      expect(r.newState).toBe("paused");
      expect(r.sideEffects).toEqual([]);
    });
  });

  it("all 15 valid transitions are covered", () => {
    const validTransitions: [BillingState, BillingEvent["type"]][] = [
      ["trialing", "TRIAL_EXPIRED"],
      ["trialing", "PAYMENT_SUCCEEDED"],
      ["expired_trial_pending_payment", "PAYMENT_SUCCEEDED"],
      ["expired_trial_pending_payment", "GRACE_PERIOD_EXPIRED"],
      ["active", "PAYMENT_FAILED"],
      ["active", "SUBSCRIPTION_CANCELED"],
      ["active", "SUBSCRIPTION_PAUSED"],
      ["payment_retry", "PAYMENT_SUCCEEDED"],
      ["payment_retry", "GRACE_PERIOD_EXPIRED"],
      ["payment_retry", "SUBSCRIPTION_PAUSED"],
      ["canceled_pending", "PAYMENT_SUCCEEDED"],
      ["canceled_pending", "GRACE_PERIOD_EXPIRED"],
      ["canceled_pending", "SUBSCRIPTION_PAUSED"],
      ["paused", "SUBSCRIPTION_RESUMED"],
      ["paused", "PAYMENT_SUCCEEDED"],
    ];

    for (const [state, event] of validTransitions) {
      const result = billingReducer(state, { type: event } as BillingEvent);
      expect(result.newState).not.toBe(state);
      expect(result.sideEffects.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// matchPersona
// ---------------------------------------------------------------------------
describe("matchPersona", () => {
  const persona: PersonaProfile = {
    identities: ["latino", "Mexican"],
    redLines: ["muerte", "Violencia"],
    tolerances: ["gordo"],
  };

  it("returns all false when persona is null", () => {
    const result = matchPersona("any text", null);
    expect(result).toEqual({
      matchesLineaRoja: false,
      matchesIdentidad: false,
      matchesTolerancia: false,
      matchedRedLines: [],
    });
  });

  it("matches red lines case-insensitively", () => {
    const result = matchPersona("MUERTE al equipo", persona);
    expect(result.matchesLineaRoja).toBe(true);
    expect(result.matchedRedLines).toEqual(["muerte"]);
  });

  it("matches identities case-insensitively", () => {
    const result = matchPersona("eres un mexican feo", persona);
    expect(result.matchesIdentidad).toBe(true);
  });

  it("matches tolerances", () => {
    const result = matchPersona("estás gordo", persona);
    expect(result.matchesTolerancia).toBe(true);
  });

  it("returns multiple matched red lines", () => {
    const result = matchPersona("muerte y violencia extrema", persona);
    expect(result.matchedRedLines).toEqual(["muerte", "Violencia"]);
    expect(result.matchesLineaRoja).toBe(true);
  });

  it("returns false for non-matching text", () => {
    const result = matchPersona("hola buen día", persona);
    expect(result.matchesLineaRoja).toBe(false);
    expect(result.matchesIdentidad).toBe(false);
    expect(result.matchesTolerancia).toBe(false);
    expect(result.matchedRedLines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// analysisReducer
// ---------------------------------------------------------------------------
describe("analysisReducer", () => {
  const baseWeights: Weights = FALLBACK_WEIGHTS;

  function reducerInput(overrides: Partial<AnalysisReducerInput> = {}): AnalysisReducerInput {
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
      weights: baseWeights,
      remainingAnalysis: 100,
      insultDensity: 0,
      hasIdentityAttack: false,
      hasThreat: false,
      hasInsultWithArgument: false,
      ...overrides,
    };
  }

  it("returns no_action when remaining credits are 0", () => {
    const result = analysisReducer(reducerInput({ remainingAnalysis: 0 }));
    expect(result.decision).toBe("no_action");
    expect(result.severity_score).toBe(0);
  });

  it("uses tau_shield as fallback when scoreBase is null", () => {
    const result = analysisReducer(reducerInput({ scoreBase: null, scoreSource: "both_failed" }));
    expect(result.score_source).toBe("both_failed");
    expect(result.severity_score).toBeGreaterThanOrEqual(FALLBACK_THRESHOLDS.tau_shield);
  });

  it("overrides score to 1.0 when insult density >= N_DENSIDAD", () => {
    const result = analysisReducer(reducerInput({ insultDensity: N_DENSIDAD, scoreBase: 0.1 }));
    expect(result.severity_score).toBe(1.0);
    expect(result.decision).toBe("shield_critico");
  });

  it("applies linea_roja weight when persona matches red line", () => {
    const base = 0.5;
    const result = analysisReducer(
      reducerInput({
        scoreBase: base,
        personaMatches: {
          matchesLineaRoja: true,
          matchesIdentidad: false,
          matchesTolerancia: false,
          matchedRedLines: ["muerte"],
        },
      }),
    );
    expect(result.adjustments.persona_applied).toBe(true);
    expect(result.adjustments.persona_factor).toBeCloseTo(FALLBACK_WEIGHTS.linea_roja, 5);
  });

  it("applies identidad weight cumulatively with linea_roja", () => {
    const base = 0.5;
    const result = analysisReducer(
      reducerInput({
        scoreBase: base,
        personaMatches: {
          matchesLineaRoja: true,
          matchesIdentidad: true,
          matchesTolerancia: false,
          matchedRedLines: ["muerte"],
        },
      }),
    );
    const expectedFactor = FALLBACK_WEIGHTS.linea_roja * FALLBACK_WEIGHTS.identidad;
    expect(result.adjustments.persona_factor).toBeCloseTo(expectedFactor, 5);
  });

  it("applies tolerancia only when adjusted < tau_shield", () => {
    const result = analysisReducer(
      reducerInput({
        scoreBase: 0.2,
        personaMatches: {
          matchesLineaRoja: false,
          matchesIdentidad: false,
          matchesTolerancia: true,
          matchedRedLines: [],
        },
      }),
    );
    expect(result.adjustments.persona_factor).toBeCloseTo(FALLBACK_WEIGHTS.tolerancia, 5);
  });

  it("does NOT apply tolerancia when adjusted >= tau_shield", () => {
    const result = analysisReducer(
      reducerInput({
        scoreBase: 0.7,
        personaMatches: {
          matchesLineaRoja: false,
          matchesIdentidad: false,
          matchesTolerancia: true,
          matchedRedLines: [],
        },
      }),
    );
    expect(result.adjustments.persona_factor).toBe(1);
  });

  it("applies recurrence factor for strikeLevel 1", () => {
    const result = analysisReducer(
      reducerInput({ offender: { strikeLevel: 1, lastStrike: null } }),
    );
    expect(result.adjustments.recurrence_factor).toBe(1.1);
  });

  it("applies recurrence factor for strikeLevel 2", () => {
    const result = analysisReducer(
      reducerInput({ offender: { strikeLevel: 2, lastStrike: null } }),
    );
    expect(result.adjustments.recurrence_factor).toBe(1.25);
  });

  it("applies recurrence factor for critical strikeLevel", () => {
    const result = analysisReducer(
      reducerInput({ offender: { strikeLevel: "critical", lastStrike: null } }),
    );
    expect(result.adjustments.recurrence_factor).toBe(1.5);
  });

  it("clamps final score to 1.0", () => {
    const result = analysisReducer(
      reducerInput({
        scoreBase: 0.9,
        personaMatches: {
          matchesLineaRoja: true,
          matchesIdentidad: true,
          matchesTolerancia: false,
          matchedRedLines: ["x"],
        },
        offender: { strikeLevel: "critical", lastStrike: null },
      }),
    );
    expect(result.severity_score).toBeLessThanOrEqual(1.0);
  });

  it("delegates to thresholdRouter for final decision", () => {
    const result = analysisReducer(reducerInput({ hasIdentityAttack: true, scoreBase: 0.1 }));
    expect(result.decision).toBe("shield_critico");
    expect(result.flags.has_identity_attack).toBe(true);
  });

  it("returns correct scoreSource for perspective scores", () => {
    const result = analysisReducer(reducerInput({ scoreBase: 0.5 }));
    expect(result.score_source).toBe("perspective");
  });

  it("populates flags correctly", () => {
    const result = analysisReducer(
      reducerInput({
        hasIdentityAttack: true,
        hasThreat: true,
        hasInsultWithArgument: true,
        insultDensity: 2,
        personaMatches: {
          matchesLineaRoja: false,
          matchesIdentidad: false,
          matchesTolerancia: false,
          matchedRedLines: ["test"],
        },
      }),
    );
    expect(result.flags).toEqual({
      has_identity_attack: true,
      has_threat: true,
      has_insult_with_argument: true,
      matched_red_lines: ["test"],
      insult_density: 2,
    });
  });
});
