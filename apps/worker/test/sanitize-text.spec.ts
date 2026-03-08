import { describe, it, expect } from "vitest";
import { sanitizeCommentText } from "../src/shared/sanitize-text.js";

describe("sanitizeCommentText", () => {
  it("trunca a 5000 caracteres", () => {
    const long = "a".repeat(6000);
    const out = sanitizeCommentText(long);
    expect(out.length).toBe(5000);
  });

  it("elimina caracteres de control", () => {
    const withControl = "hello\x00world\x1b";
    expect(sanitizeCommentText(withControl)).toBe("helloworld");
  });

  it("preserva texto normal", () => {
    const normal = "Hello, this is a normal comment!";
    expect(sanitizeCommentText(normal)).toBe(normal);
  });

  it("normaliza encoding NFC", () => {
    const nfd = "café"; // NFD form
    const out = sanitizeCommentText(nfd.normalize("NFD"));
    expect(out).toBe("café");
  });
});
