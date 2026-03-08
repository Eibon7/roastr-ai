import { describe, it, expect } from "vitest";
import { resolveShieldAction } from "@roastr/shared";
import { getPlatformCapabilities } from "@roastr/shared";
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
      aggressiveness_applied: 1,
    },
    score_source: "perspective",
    ...overrides,
  };
}

describe("Platform adapters — capabilities", () => {
  it("YouTube has canHide, canReport, canBlock, canReply", () => {
    const caps = getPlatformCapabilities("youtube");
    expect(caps.canHide).toBe(true);
    expect(caps.canReport).toBe(true);
    expect(caps.canBlock).toBe(true);
    expect(caps.canReply).toBe(true);
  });

  it("X has canHide, canBlock, canReply but not canReport", () => {
    const caps = getPlatformCapabilities("x");
    expect(caps.canHide).toBe(true);
    expect(caps.canReport).toBe(false);
    expect(caps.canBlock).toBe(true);
    expect(caps.canReply).toBe(true);
  });

  it("LinkedIn has no capabilities", () => {
    const caps = getPlatformCapabilities("linkedin");
    expect(caps.canHide).toBe(false);
    expect(caps.canReport).toBe(false);
    expect(caps.canBlock).toBe(false);
    expect(caps.canReply).toBe(false);
  });
});

describe("Shield resolver — platform-specific actions", () => {
  it("correctiva on YouTube → strike1", () => {
    const result = analysisResult({
      decision: "correctiva",
      severity_score: 0.4,
      flags: { ...analysisResult().flags, has_insult_with_argument: true },
    });
    const resolved = resolveShieldAction(result, "youtube", 0.95);
    expect(resolved.primary).toBe("strike1");
  });

  it("correctiva on X → strike1", () => {
    const result = analysisResult({
      decision: "correctiva",
      severity_score: 0.4,
      flags: { ...analysisResult().flags, has_insult_with_argument: true },
    });
    const resolved = resolveShieldAction(result, "x", 0.95);
    expect(resolved.primary).toBe("strike1");
  });

  it("shield_critico with identity_attack on X → hide (no report)", () => {
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
  });
});
