import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function encryptToken(plaintext: string, secret: string): Buffer {
  const key = scryptSync(secret, "roastr-token-salt", KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

describe("decryptToken", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("desencripta token cifrado con el mismo secret", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-secret-32-characters-long!!";
    const { decryptToken } = await import("../src/shared/token-decrypt.js");
    const plain = "my-access-token-123";
    const cipher = encryptToken(plain, process.env.TOKEN_ENCRYPTION_KEY);
    expect(decryptToken(cipher)).toBe(plain);
  });

  it("usa fallback development key si no hay env", async () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    const { decryptToken } = await import("../src/shared/token-decrypt.js");
    const plain = "token";
    const cipher = encryptToken(
      plain,
      "development-only-32-char-secret-key!!",
    );
    expect(decryptToken(cipher)).toBe(plain);
  });
});
