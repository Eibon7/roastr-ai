import { describe, it, expect } from "vitest";
import { StyleValidatorService } from "../../src/modules/roast/style-validator.service";

const svc = new StyleValidatorService();

describe("StyleValidatorService", () => {
  describe("validate()", () => {
    it("passes a clean text for youtube", () => {
      const result = svc.validate("Gracias por tu opinión, aunque no la comparto.", "youtube");
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("fails when text exceeds platform limit", () => {
      const longText = "a ".repeat(600); // 1200 chars > 1000 youtube limit
      const result = svc.validate(longText, "youtube");
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.ruleId === "max_length")).toBe(true);
    });

    it("fails for X when text exceeds 280 chars", () => {
      const longText = "Esto es un texto muy largo ".repeat(15);
      const result = svc.validate(longText, "x");
      expect(result.violations.some((v) => v.ruleId === "max_length")).toBe(true);
    });

    it("fails when text contains a URL", () => {
      const result = svc.validate("Mira esto: https://example.com/spam", "youtube");
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.ruleId === "no_urls")).toBe(true);
    });

    it("fails when text contains a mention", () => {
      const result = svc.validate("Oye @pepito, esto no va a ningún lado.", "youtube");
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.ruleId === "no_mentions")).toBe(true);
    });

    it("fails when text is all caps", () => {
      const result = svc.validate("ESTO ES UNA RESPUESTA RIDICULA TOTALMENTE ABSURDA", "youtube");
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.ruleId === "no_all_caps")).toBe(true);
    });

    it("passes mixed case text", () => {
      const result = svc.validate("Esto es Normal y así está bien.", "youtube");
      expect(result.violations.some((v) => v.ruleId === "no_all_caps")).toBe(false);
    });

    it("fails when text is too short", () => {
      const result = svc.validate("ok", "youtube");
      expect(result.violations.some((v) => v.ruleId === "min_length")).toBe(true);
    });

    it("fails when text has excessive blank lines", () => {
      const result = svc.validate("Hola\n\n\n\nmundo", "youtube");
      expect(result.violations.some((v) => v.ruleId === "no_empty_lines_excess")).toBe(true);
    });

    it("reports multiple violations at once", () => {
      const result = svc.validate("https://bad.url @mention", "youtube");
      expect(result.valid).toBe(false);
      const ruleIds = result.violations.map((v) => v.ruleId);
      expect(ruleIds).toContain("no_urls");
      expect(ruleIds).toContain("no_mentions");
    });
  });

  describe("truncate()", () => {
    it("returns text unchanged if within limit", () => {
      const text = "Texto corto";
      expect(svc.truncate(text, "youtube")).toBe(text);
    });

    it("truncates to platform limit with ellipsis", () => {
      const text = "a".repeat(1500);
      const truncated = svc.truncate(text, "youtube");
      expect(truncated.length).toBeLessThanOrEqual(1_000);
      expect(truncated.endsWith("…")).toBe(true);
    });

    it("truncates to 280 for X", () => {
      const text = "x".repeat(500);
      const truncated = svc.truncate(text, "x");
      expect(truncated.length).toBeLessThanOrEqual(280);
    });
  });
});
