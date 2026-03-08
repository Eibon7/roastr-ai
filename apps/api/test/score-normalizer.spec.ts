import { describe, it, expect } from "vitest";
import {
  normalizePerspectiveScores,
  normalizeLlmScores,
  normalizeBothFailed,
} from "../src/domain/score-normalizer";

describe("score-normalizer", () => {
  describe("normalizePerspectiveScores", () => {
    it("extracts scoreBase from TOXICITY and SEVERE_TOXICITY", () => {
      const raw = {
        TOXICITY: { summaryScore: { value: 0.6 } },
        SEVERE_TOXICITY: { summaryScore: { value: 0.4 } },
        IDENTITY_ATTACK: { summaryScore: { value: 0.1 } },
        INSULT: { summaryScore: { value: 0.2 } },
        THREAT: { summaryScore: { value: 0.05 } },
      };
      const out = normalizePerspectiveScores(raw);
      expect(out.scoreBase).toBe(0.6);
      expect(out.scoreSource).toBe("perspective");
      expect(out.hasIdentityAttack).toBe(false);
      expect(out.hasThreat).toBe(false);
      expect(out.insultDensity).toBe(0);
    });

    it("flags identity attack when >= 0.5", () => {
      const raw = {
        TOXICITY: { summaryScore: { value: 0.3 } },
        SEVERE_TOXICITY: { summaryScore: { value: 0.2 } },
        IDENTITY_ATTACK: { summaryScore: { value: 0.7 } },
        INSULT: { summaryScore: { value: 0.1 } },
        THREAT: { summaryScore: { value: 0.1 } },
      };
      const out = normalizePerspectiveScores(raw);
      expect(out.hasIdentityAttack).toBe(true);
    });

    it("sets insultDensity when INSULT >= 0.5", () => {
      const raw = {
        TOXICITY: { summaryScore: { value: 0.5 } },
        SEVERE_TOXICITY: { summaryScore: { value: 0.3 } },
        IDENTITY_ATTACK: { summaryScore: { value: 0 } },
        INSULT: { summaryScore: { value: 0.8 } },
        THREAT: { summaryScore: { value: 0 } },
      };
      const out = normalizePerspectiveScores(raw);
      expect(out.insultDensity).toBe(1);
    });
  });

  describe("normalizeLlmScores", () => {
    it("maps toxicity_level to scoreBase", () => {
      const out = normalizeLlmScores({
        toxicity_level: "high",
        has_identity_attack: false,
        has_threat: false,
        insults_count: 2,
        has_initial_insult_with_argument: true,
      });
      expect(out.scoreBase).toBe(0.75);
      expect(out.scoreSource).toBe("llm_fallback");
      expect(out.hasInsultWithArgument).toBe(true);
      expect(out.insultDensity).toBe(2);
    });
  });

  describe("normalizeBothFailed", () => {
    it("returns conservative fallback", () => {
      const out = normalizeBothFailed();
      expect(out.scoreBase).toBeNull();
      expect(out.scoreSource).toBe("both_failed");
      expect(out.hasIdentityAttack).toBe(false);
      expect(out.hasThreat).toBe(false);
    });
  });
});
