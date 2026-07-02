import { describe, it, expect, beforeEach } from "vitest";
import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { FeatureFlagService } from "../../src/modules/feature-flags/feature-flag.service";
import { SsotService } from "../../src/shared/config/ssot.service";
import { PromptBuilderService } from "../../src/modules/roast/prompt-builder.service";
import type { RoastContext } from "../../src/modules/roast/prompt-builder.service";

function makeService(flagOverrides: Record<string, boolean> = {}) {
  const ssot = new SsotService();
  const flags = new FeatureFlagService(ssot);
  for (const [flag, value] of Object.entries(flagOverrides)) {
    flags.setFlag(flag, value);
  }
  return new PromptBuilderService(flags);
}

const BASE_CTX: RoastContext = {
  commentText: "Tu contenido es una basura total",
  severityScore: 0.72,
  platform: "youtube",
  tone: "balanceado",
};

describe("PromptBuilderService", () => {
  describe("feature flag gate", () => {
    it("throws ForbiddenException when roasting_enabled is false", () => {
      const svc = makeService({ roasting_enabled: false });
      expect(() => svc.build(BASE_CTX)).toThrow(ForbiddenException);
    });

    it("allows building when roasting_enabled is true", () => {
      const svc = makeService({ roasting_enabled: true });
      expect(() => svc.build(BASE_CTX)).not.toThrow();
    });
  });

  describe("Block A — system prompt", () => {
    let svc: PromptBuilderService;
    beforeEach(() => { svc = makeService({ roasting_enabled: true }); });

    it("includes tone instruction for balanceado", () => {
      const { system } = svc.build({ ...BASE_CTX, tone: "balanceado" });
      expect(system).toContain("profesional");
    });

    it("includes tone instruction for flanders", () => {
      const { system } = svc.build({ ...BASE_CTX, tone: "flanders" });
      expect(system).toContain("amable");
    });

    it("includes tone instruction for canalla", () => {
      const { system } = svc.build({ ...BASE_CTX, tone: "canalla" });
      expect(system).toContain("sarcasmo");
    });

    it("uses persona profile for personal tone", () => {
      const svc2 = makeService({ roasting_enabled: true, personal_tone_enabled: true });
      const persona = {
        identities: ["músico independiente", "streamer"],
        redLines: ["racismo", "homofobia"],
        tolerances: ["críticas artísticas constructivas"],
      };
      const { system } = svc2.build({ ...BASE_CTX, tone: "personal", persona });
      expect(system).toContain("músico independiente");
      expect(system).toContain("racismo");
      expect(system).toContain("críticas artísticas constructivas");
    });

    it("requires personal_tone_enabled for personal tone", () => {
      const svc2 = makeService({ roasting_enabled: true, personal_tone_enabled: false });
      expect(() =>
        svc2.build({ ...BASE_CTX, tone: "personal", persona: { identities: [], redLines: [], tolerances: [] } }),
      ).toThrow(ForbiddenException);
    });

    it("always includes AI disclaimer instruction", () => {
      const { system } = svc.build(BASE_CTX);
      expect(system.toLowerCase()).toMatch(/ia|transparencia/);
    });
  });

  describe("Block B — comment context", () => {
    let svc: PromptBuilderService;
    beforeEach(() => { svc = makeService({ roasting_enabled: true }); });

    it("includes comment text", () => {
      const { user } = svc.build(BASE_CTX);
      expect(user).toContain(BASE_CTX.commentText);
    });

    it("includes platform label", () => {
      const { user } = svc.build(BASE_CTX);
      expect(user.toLowerCase()).toContain("youtube");
    });

    it("includes severity label", () => {
      const { user } = svc.build({ ...BASE_CTX, severityScore: 0.72 });
      expect(user).toMatch(/alta/i);
    });

    it("shows very high severity for score >= 0.85", () => {
      const { user } = svc.build({ ...BASE_CTX, severityScore: 0.9 });
      expect(user).toMatch(/muy alta/i);
    });
  });

  describe("Block C — generation instructions", () => {
    let svc: PromptBuilderService;
    beforeEach(() => { svc = makeService({ roasting_enabled: true }); });

    it("applies platform char limit for youtube (1000)", () => {
      const { maxChars, user } = svc.build({ ...BASE_CTX, platform: "youtube" });
      expect(maxChars).toBe(1_000);
      expect(user).toContain("1000");
    });

    it("applies platform char limit for x (280)", () => {
      const { maxChars, user } = svc.build({ ...BASE_CTX, platform: "x" });
      expect(maxChars).toBe(280);
      expect(user).toContain("280");
    });

    it("prohibits URLs in instructions", () => {
      const { user } = svc.build(BASE_CTX);
      expect(user).toMatch(/url/i);
    });

    it("prohibits mentions in instructions", () => {
      const { user } = svc.build(BASE_CTX);
      expect(user).toMatch(/@usuario|menciones/i);
    });
  });

  describe("invalid tone", () => {
    it("throws BadRequestException for unknown tone", () => {
      const svc = makeService({ roasting_enabled: true });
      // @ts-expect-error testing runtime behavior
      expect(() => svc.build({ ...BASE_CTX, tone: "unknown_tone" })).toThrow(BadRequestException);
    });
  });
});
