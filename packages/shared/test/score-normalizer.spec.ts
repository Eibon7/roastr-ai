import { describe, it, expect } from "vitest";
import {
  normalizePerspectiveScores,
  normalizeBothFailed,
  normalizeFromLLM,
  type PerspectiveAttributeScores,
} from "../src/domain/score-normalizer";

function scores(overrides: PerspectiveAttributeScores = {}): PerspectiveAttributeScores {
  return overrides;
}

describe("normalizePerspectiveScores", () => {
  it("takes the max of TOXICITY and SEVERE_TOXICITY when both are present", () => {
    const result = normalizePerspectiveScores(
      scores({
        TOXICITY: { summaryScore: { value: 0.3 } },
        SEVERE_TOXICITY: { summaryScore: { value: 0.7 } },
      }),
    );
    expect(result.scoreBase).toBe(0.7);
  });

  it("uses TOXICITY alone when SEVERE_TOXICITY is missing", () => {
    const result = normalizePerspectiveScores(
      scores({ TOXICITY: { summaryScore: { value: 0.4 } } }),
    );
    expect(result.scoreBase).toBe(0.4);
  });

  it("uses SEVERE_TOXICITY alone when TOXICITY is missing", () => {
    const result = normalizePerspectiveScores(
      scores({ SEVERE_TOXICITY: { summaryScore: { value: 0.6 } } }),
    );
    expect(result.scoreBase).toBe(0.6);
  });

  it("returns scoreBase null when neither TOXICITY nor SEVERE_TOXICITY is present", () => {
    const result = normalizePerspectiveScores(scores({}));
    expect(result.scoreBase).toBeNull();
  });

  it("defaults missing attribute scores to 0/false rather than throwing", () => {
    const result = normalizePerspectiveScores(scores({}));
    expect(result.hasIdentityAttack).toBe(false);
    expect(result.hasThreat).toBe(false);
    expect(result.insultDensity).toBe(0);
    expect(result.hasInsultWithArgument).toBe(false);
  });

  it("flags hasIdentityAttack true at/above the 0.5 threshold", () => {
    expect(
      normalizePerspectiveScores(scores({ IDENTITY_ATTACK: { summaryScore: { value: 0.5 } } }))
        .hasIdentityAttack,
    ).toBe(true);
    expect(
      normalizePerspectiveScores(scores({ IDENTITY_ATTACK: { summaryScore: { value: 0.49 } } }))
        .hasIdentityAttack,
    ).toBe(false);
  });

  it("flags hasThreat true at/above the 0.5 threshold", () => {
    expect(
      normalizePerspectiveScores(scores({ THREAT: { summaryScore: { value: 0.5 } } })).hasThreat,
    ).toBe(true);
    expect(
      normalizePerspectiveScores(scores({ THREAT: { summaryScore: { value: 0.49 } } })).hasThreat,
    ).toBe(false);
  });

  it("sets insultDensity to 1 at/above the 0.5 threshold for INSULT, else 0", () => {
    expect(
      normalizePerspectiveScores(scores({ INSULT: { summaryScore: { value: 0.5 } } }))
        .insultDensity,
    ).toBe(1);
    expect(
      normalizePerspectiveScores(scores({ INSULT: { summaryScore: { value: 0.1 } } }))
        .insultDensity,
    ).toBe(0);
  });

  it("always reports scoreSource as 'perspective'", () => {
    expect(normalizePerspectiveScores(scores({})).scoreSource).toBe("perspective");
  });

  it("tolerates a missing summaryScore.value on a present attribute", () => {
    const result = normalizePerspectiveScores(scores({ TOXICITY: { summaryScore: {} } }));
    expect(result.scoreBase).toBeNull();
  });
});

describe("normalizeBothFailed", () => {
  it("returns a fully-neutral result with score_source both_failed", () => {
    const result = normalizeBothFailed();
    expect(result).toEqual({
      scoreBase: null,
      scoreSource: "both_failed",
      hasIdentityAttack: false,
      hasThreat: false,
      hasInsultWithArgument: false,
      insultDensity: 0,
    });
  });
});

describe("normalizeFromLLM", () => {
  it("passes through a score already within [0, 1]", () => {
    const result = normalizeFromLLM({ score: 0.6 });
    expect(result.scoreBase).toBe(0.6);
    expect(result.scoreSource).toBe("llm_fallback");
  });

  it("clamps a score above 1 down to 1", () => {
    expect(normalizeFromLLM({ score: 1.5 }).scoreBase).toBe(1);
  });

  it("clamps a negative score up to 0", () => {
    expect(normalizeFromLLM({ score: -0.5 }).scoreBase).toBe(0);
  });

  it("defaults hasIdentityAttack/hasThreat to false when omitted", () => {
    const result = normalizeFromLLM({ score: 0.2 });
    expect(result.hasIdentityAttack).toBe(false);
    expect(result.hasThreat).toBe(false);
  });

  it("propagates explicit hasIdentityAttack/hasThreat flags", () => {
    const result = normalizeFromLLM({ score: 0.2, hasIdentityAttack: true, hasThreat: true });
    expect(result.hasIdentityAttack).toBe(true);
    expect(result.hasThreat).toBe(true);
  });

  it("always reports hasInsultWithArgument as false", () => {
    expect(normalizeFromLLM({ score: 0.9 }).hasInsultWithArgument).toBe(false);
  });
});
