import { describe, it, expect } from "vitest";
import { ANON_PREFIX, hashIdentifier, isAnonymized } from "../src/crypto/anonymize";

const SECRET = "test-secret-key";
const HEX64_RE = /^[0-9a-f]{64}$/;

describe("hashIdentifier", () => {
  it("prefixes the output with ANON_PREFIX", () => {
    const hashed = hashIdentifier("user@example.com", SECRET);
    expect(hashed.startsWith(ANON_PREFIX)).toBe(true);
  });

  it("produces a 64-char lowercase hex digest after the prefix", () => {
    const hashed = hashIdentifier("user@example.com", SECRET);
    const digest = hashed.slice(ANON_PREFIX.length);
    expect(digest).toMatch(HEX64_RE);
  });

  it("is deterministic: same input + same secret always yields the same hash", () => {
    const a = hashIdentifier("user@example.com", SECRET);
    const b = hashIdentifier("user@example.com", SECRET);
    expect(a).toBe(b);
  });

  it("is keyed: the same raw value hashed with a different secret produces a different digest", () => {
    const a = hashIdentifier("user@example.com", SECRET);
    const b = hashIdentifier("user@example.com", "a-different-secret");
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different raw inputs (with the same secret)", () => {
    const a = hashIdentifier("user-a@example.com", SECRET);
    const b = hashIdentifier("user-b@example.com", SECRET);
    expect(a).not.toBe(b);
  });

  it("is not reversible: the digest reveals nothing about the raw input", () => {
    const raw = "very-identifiable-email@example.com";
    const hashed = hashIdentifier(raw, SECRET);
    // The digest must not leak substrings of the original value, and its
    // length must not vary with input length (fixed 256-bit output).
    expect(hashed).not.toContain(raw);
    expect(hashed).not.toContain("example.com");
    expect(hashed.length).toBe(ANON_PREFIX.length + 64);
  });

  it("hash length is independent of raw input length", () => {
    const short = hashIdentifier("a", SECRET);
    const long = hashIdentifier("a".repeat(5000), SECRET);
    expect(short.length).toBe(long.length);
  });

  it("supports empty string input deterministically (HMAC of empty message)", () => {
    const a = hashIdentifier("", SECRET);
    const b = hashIdentifier("", SECRET);
    expect(a).toBe(b);
    expect(a.startsWith(ANON_PREFIX)).toBe(true);
    expect(a.slice(ANON_PREFIX.length)).toMatch(HEX64_RE);
  });

  it("throws rather than silently succeeding when raw is null/undefined", () => {
    expect(() => hashIdentifier(null as unknown as string, SECRET)).toThrow();
    expect(() => hashIdentifier(undefined as unknown as string, SECRET)).toThrow();
  });

  it("throws when the secret is null/undefined", () => {
    expect(() => hashIdentifier("user@example.com", null as unknown as string)).toThrow();
  });
});

describe("isAnonymized", () => {
  it("returns true for a value produced by hashIdentifier", () => {
    const hashed = hashIdentifier("user@example.com", SECRET);
    expect(isAnonymized(hashed)).toBe(true);
  });

  it("returns false for a raw, un-hashed value", () => {
    expect(isAnonymized("user@example.com")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isAnonymized("")).toBe(false);
  });

  it("returns false for a raw value that happens to start with the anon: prefix but isn't a valid digest", () => {
    expect(isAnonymized("anon:not-a-real-hash")).toBe(false);
    expect(isAnonymized(ANON_PREFIX + "user@example.com")).toBe(false);
  });

  it("returns false when the hex digest is too short or too long", () => {
    const hashed = hashIdentifier("user@example.com", SECRET);
    const tooShort = hashed.slice(0, -1);
    const tooLong = hashed + "a";
    expect(isAnonymized(tooShort)).toBe(false);
    expect(isAnonymized(tooLong)).toBe(false);
  });

  it("returns false when the digest contains uppercase hex characters", () => {
    const hashed = hashIdentifier("user@example.com", SECRET);
    const upper = ANON_PREFIX + hashed.slice(ANON_PREFIX.length).toUpperCase();
    expect(isAnonymized(upper)).toBe(false);
  });

  it("returns false when the digest contains non-hex characters", () => {
    const invalid = ANON_PREFIX + "g".repeat(64);
    expect(isAnonymized(invalid)).toBe(false);
  });

  it("round-trips correctly across many distinct inputs", () => {
    const inputs = ["a", "b@c.com", "12345", "", "🙂", "long-string-".repeat(10)];
    for (const raw of inputs) {
      const hashed = hashIdentifier(raw, SECRET);
      expect(isAnonymized(hashed)).toBe(true);
      expect(isAnonymized(raw)).toBe(false);
    }
  });
});
