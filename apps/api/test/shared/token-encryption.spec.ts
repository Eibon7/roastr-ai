import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { TokenEncryptionService } from "../../src/shared/crypto/token-encryption.service";

function makeService(key: string | undefined): TokenEncryptionService {
  const config = {
    get: (_k: string) => key,
  } as unknown as ConfigService;
  return new TokenEncryptionService(config);
}

describe("TokenEncryptionService", () => {
  const originalEnvKey = process.env.TOKEN_ENCRYPTION_KEY;
  let service: TokenEncryptionService;

  beforeEach(() => {
    service = makeService("a-valid-32-character-secret-key!");
  });

  afterEach(() => {
    if (originalEnvKey === undefined) {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.TOKEN_ENCRYPTION_KEY = originalEnvKey;
    }
  });

  it("encrypts and decrypts back to the original plaintext", () => {
    const plaintext = "super-secret-oauth-token-value";
    const ciphertext = service.encrypt(plaintext);
    const decrypted = service.decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const ciphertext = service.encrypt("");
    expect(service.decrypt(ciphertext)).toBe("");
  });

  it("round-trips unicode content", () => {
    const plaintext = "token-with-emoji-🔒-and-áccents";
    const ciphertext = service.encrypt(plaintext);
    expect(service.decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces a Buffer output that is not the raw plaintext", () => {
    const plaintext = "plain-oauth-token";
    const ciphertext = service.encrypt(plaintext);
    expect(Buffer.isBuffer(ciphertext)).toBe(true);
    expect(ciphertext.toString("utf8")).not.toContain(plaintext);
  });

  it("uses a fresh random IV per call — encrypting the same plaintext twice yields different ciphertexts", () => {
    const plaintext = "same-token";
    const a = service.encrypt(plaintext);
    const b = service.encrypt(plaintext);
    // First 12 bytes are the IV per IV_LENGTH=12 in the source.
    const ivA = a.subarray(0, 12);
    const ivB = b.subarray(0, 12);
    expect(ivA.equals(ivB)).toBe(false);
    expect(a.equals(b)).toBe(false);
    // Both must still decrypt correctly regardless of differing IVs.
    expect(service.decrypt(a)).toBe(plaintext);
    expect(service.decrypt(b)).toBe(plaintext);
  });

  it("throws (does not fail silently) when decrypting a tampered ciphertext", () => {
    const ciphertext = service.encrypt("integrity-check-me");
    const tampered = Buffer.from(ciphertext);
    // Flip a byte in the encrypted payload region (after IV+tag).
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it("throws when decrypting with a tampered auth tag", () => {
    const ciphertext = service.encrypt("integrity-check-me");
    const tampered = Buffer.from(ciphertext);
    // Auth tag lives at bytes [12, 28).
    tampered[12] ^= 0xff;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it("throws when decrypting an empty buffer", () => {
    expect(() => service.decrypt(Buffer.alloc(0))).toThrow();
  });

  it("throws when decrypting a too-short/corrupt buffer", () => {
    expect(() => service.decrypt(Buffer.from("short"))).toThrow();
  });

  it("throws when decrypting ciphertext produced under a different key", () => {
    const other = makeService("a-different-32-character-secret!");
    const ciphertext = service.encrypt("cross-key-token");
    expect(() => other.decrypt(ciphertext)).toThrow();
  });

  it("throws a clear error when no encryption key is configured", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    const noKeyService = makeService(undefined);
    expect(() => noKeyService.encrypt("anything")).toThrow(
      "TOKEN_ENCRYPTION_KEY is required",
    );
  });

  it("falls back to process.env.TOKEN_ENCRYPTION_KEY when ConfigService has no value", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "env-fallback-32-character-secret!";
    const envService = makeService(undefined);
    const ciphertext = envService.encrypt("via-env-fallback");
    expect(envService.decrypt(ciphertext)).toBe("via-env-fallback");
  });
});
