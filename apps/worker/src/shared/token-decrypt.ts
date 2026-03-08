import { createDecipheriv, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const DEV_FALLBACK_SECRET = "development-only-32-char-secret-key!!";

export function decryptToken(ciphertext: Buffer): string {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ??
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
      ? DEV_FALLBACK_SECRET
      : undefined);

  if (!secret) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required");
  }

  const key = scryptSync(secret, "roastr-token-salt", KEY_LENGTH);

  const iv = ciphertext.subarray(0, IV_LENGTH);
  const tag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = ciphertext.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
