import { describe, it, expect } from "vitest";
import { resolveShieldAction } from "../src/modules/shield/shield.service";
import type { AnalysisResult } from "@roastr/shared";

function analysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    decision: "no_action",
    severity_score: 0,
    flags: {
      has_identity_attack: false,
      has_threat: false,
      has_insult_with_argument: false,
      matched_red_lines: [],
      insult_density: 0,
    },
    adjustments: {
      persona_applied: false,
      persona_factor: 1,
      recurrence_factor: 1,
      severity_score_final: 1,
    },
    score_source: "perspective",
    ...overrides,
  };
}

describe("Shield engine — resolveShieldAction", () => {
  describe("strike_1 (correctiva) genera hide o strike1 según plataforma", () => {
    it("correctiva en YouTube (canReply) → strike1", () => {
      const result = analysisResult({
        decision: "correctiva",
        severity_score: 0.4,
        flags: { ...analysisResult().flags, has_insult_with_argument: true },
      });
      const resolved = resolveShieldAction(result, "youtube", 0.95);
      expect(resolved.primary).toBe("strike1");
      expect(resolved.fallbacks).toEqual([]);
    });

    it("correctiva en Instagram (no canReply) → strike1_silent con platformFallback", () => {
      const result = analysisResult({
        decision: "correctiva",
        severity_score: 0.4,
        flags: { ...analysisResult().flags, has_insult_with_argument: true },
      });
      const resolved = resolveShieldAction(result, "instagram", 0.95);
      expect(resolved.primary).toBe("strike1_silent");
      expect(resolved.platformFallback).toBe(true);
    });
  });

  describe("escalate (shield_critico) genera hide+block+report cuando plataforma soporta", () => {
    it("shield_critico con identity_attack en YouTube → report con fallbacks hide+block", () => {
      const result = analysisResult({
        decision: "shield_critico",
        severity_score: 0.9,
        flags: {
          has_identity_attack: true,
          has_threat: false,
          has_insult_with_argument: false,
          matched_red_lines: [],
          insult_density: 0,
        },
      });
      const resolved = resolveShieldAction(result, "youtube", 0.95);
      expect(resolved.primary).toBe("report");
      expect(resolved.fallbacks).toContain("hide");
      expect(resolved.fallbacks).toContain("block");
    });

    it("shield_critico con threat en YouTube → report con fallbacks", () => {
      const result = analysisResult({
        decision: "shield_critico",
        severity_score: 0.85,
        flags: {
          has_identity_attack: false,
          has_threat: true,
          has_insult_with_argument: false,
          matched_red_lines: [],
          insult_density: 0,
        },
      });
      const resolved = resolveShieldAction(result, "youtube", 0.95);
      expect(resolved.primary).toBe("report");
      expect(resolved.fallbacks).toContain("hide");
      expect(resolved.fallbacks).toContain("block");
    });

    it("shield_critico sin identity/threat en YouTube → hide con fallback block", () => {
      const result = analysisResult({
        decision: "shield_critico",
        severity_score: 0.95,
        flags: {
          has_identity_attack: false,
          has_threat: false,
          has_insult_with_argument: false,
          matched_red_lines: [],
          insult_density: 0,
        },
      });
      const resolved = resolveShieldAction(result, "youtube", 0.95);
      expect(resolved.primary).toBe("hide");
      expect(resolved.fallbacks).toContain("block");
    });
  });

  describe("plataforma sin canReport degrada a hide+block", () => {
    it("shield_critico con identity_attack en X (no canReport) → hide con fallback block, platformFallback", () => {
      const result = analysisResult({
        decision: "shield_critico",
        severity_score: 0.9,
        flags: {
          has_identity_attack: true,
          has_threat: false,
          has_insult_with_argument: false,
          matched_red_lines: [],
          insult_density: 0,
        },
      });
      const resolved = resolveShieldAction(result, "x", 0.95);
      expect(resolved.primary).toBe("hide");
      expect(resolved.fallbacks).toContain("block");
      expect(resolved.platformFallback).toBe(false);
    });

    it("shield_moderado en X → hide con fallback block", () => {
      const result = analysisResult({
        decision: "shield_moderado",
        severity_score: 0.6,
      });
      const resolved = resolveShieldAction(result, "x", 0.95);
      expect(resolved.primary).toBe("hide");
      expect(resolved.fallbacks).toContain("block");
    });
  });

  describe("aggressiveness se aplica (effectiveScore en motor de análisis)", () => {
    it("aggressiveness bajo (0.9) con score 0.6 → downgrade a none (effectiveScore < tau_shield)", () => {
      const result = analysisResult({
        decision: "shield_moderado",
        severity_score: 0.6,
      });
      const resolved = resolveShieldAction(result, "youtube", 0.9);
      expect(resolved.primary).toBe("none");
      expect(resolved.fallbacks).toEqual([]);
    });

    it("aggressiveness 0.95, 0.98, 1 con score 0.6 → hide con fallbacks", () => {
      const result = analysisResult({
        decision: "shield_moderado",
        severity_score: 0.6,
      });
      for (const agg of [0.95, 0.98, 1]) {
        const resolved = resolveShieldAction(result, "youtube", agg);
        expect(resolved.primary).toBe("hide");
        expect(resolved.fallbacks).toContain("block");
      }
    });

    it("identity_attack o threat no se degradan por aggressiveness", () => {
      const result = analysisResult({
        decision: "shield_critico",
        severity_score: 0.3,
        flags: {
          has_identity_attack: true,
          has_threat: false,
          has_insult_with_argument: false,
          matched_red_lines: [],
          insult_density: 0,
        },
      });
      const resolved = resolveShieldAction(result, "youtube", 0.9);
      expect(resolved.primary).toBe("report");
    });
  });

  describe("no_action no genera acciones", () => {
    it("no_action → none", () => {
      const result = analysisResult({ decision: "no_action", severity_score: 0.1 });
      const resolved = resolveShieldAction(result, "youtube", 0.95);
      expect(resolved.primary).toBe("none");
      expect(resolved.fallbacks).toEqual([]);
      expect(resolved.platformFallback).toBe(false);
    });
  });

  describe("plataforma sin hide ni block → none con platformFallback", () => {
    it("LinkedIn (sin capacidades) → none", () => {
      const result = analysisResult({
        decision: "shield_moderado",
        severity_score: 0.8,
      });
      const resolved = resolveShieldAction(result, "linkedin", 0.95);
      expect(resolved.primary).toBe("none");
      expect(resolved.platformFallback).toBe(true);
    });
  });

  describe("fallo de acción no bloquea — executor continúa con fallbacks", () => {
    it("resolved incluye fallbacks para continuar si primary falla", () => {
      const result = analysisResult({
        decision: "shield_critico",
        severity_score: 0.9,
        flags: {
          has_identity_attack: true,
          has_threat: false,
          has_insult_with_argument: false,
          matched_red_lines: [],
          insult_density: 0,
        },
      });
      const resolved = resolveShieldAction(result, "youtube", 0.95);
      expect(resolved.primary).toBe("report");
      expect(resolved.fallbacks.length).toBeGreaterThan(0);
    });
  });
});
