import { describe, it, expect } from "vitest";
import { DisclaimerService } from "../../src/modules/roast/disclaimer.service";

const svc = new DisclaimerService();

describe("DisclaimerService", () => {
  describe("apply()", () => {
    it("appends the YouTube footer disclaimer", () => {
      const result = svc.apply("Menudo comentario.", "youtube");
      expect(result.startsWith("Menudo comentario.")).toBe(true);
      expect(result).toContain("Roastr");
      expect(result).toContain("IA");
    });

    it("prefixes X (Twitter) content with [AI]", () => {
      const result = svc.apply("Vaya tontería.", "x");
      expect(result).toBe("[AI] Vaya tontería.");
    });

    it("prefixes 'twitter' the same as 'x'", () => {
      const result = svc.apply("Vaya tontería.", "twitter");
      expect(result).toBe("[AI] Vaya tontería.");
    });

    it("appends the default inline suffix for other platforms", () => {
      const result = svc.apply("Un roast cualquiera.", "instagram");
      expect(result).toBe("Un roast cualquiera. [Generado con IA — Roastr]");
    });

    it("is case-insensitive on the platform name", () => {
      const result = svc.apply("Vaya tontería.", "X");
      expect(result).toBe("[AI] Vaya tontería.");
    });

    it("does not double-apply the disclaimer when called twice", () => {
      const once = svc.apply("Contenido.", "youtube");
      const twice = svc.apply(once, "youtube");
      expect(twice).toBe(once);
    });

    it("does not double-apply the X prefix when called twice", () => {
      const once = svc.apply("Contenido.", "x");
      const twice = svc.apply(once, "x");
      expect(twice).toBe(once);
    });
  });

  describe("hasDisclaimer()", () => {
    it("detects the YouTube disclaimer", () => {
      const content = svc.apply("Hola", "youtube");
      expect(svc.hasDisclaimer(content, "youtube")).toBe(true);
      expect(svc.hasDisclaimer("Hola sin disclaimer", "youtube")).toBe(false);
    });

    it("detects the X prefix", () => {
      expect(svc.hasDisclaimer("[AI] Hola", "x")).toBe(true);
      expect(svc.hasDisclaimer("Hola", "x")).toBe(false);
    });

    it("detects the default suffix for other platforms", () => {
      const content = svc.apply("Hola", "reddit");
      expect(svc.hasDisclaimer(content, "reddit")).toBe(true);
      expect(svc.hasDisclaimer("Hola", "reddit")).toBe(false);
    });
  });

  // NOTE (report-only finding): DisclaimerService is registered and exported by
  // RoastModule but is never injected/called from RoastPipelineService.generate()
  // (grep across src/ confirms the only references are the class definition and
  // the module's providers/exports array). Generated roast text returned to the
  // client and eventually published does not appear to pass through this service
  // anywhere in the current pipeline — the AI disclaimer described in the prompt
  // (see prompt-builder.service.ts's "IMPORTANTE: ... transparencia requerida")
  // is only ever a model *instruction*, never enforced/injected in code.
});
