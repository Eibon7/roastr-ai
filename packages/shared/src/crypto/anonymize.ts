import { createHmac } from "crypto";

export const ANON_PREFIX = "anon:";

/**
 * Produces a keyed HMAC-SHA256 digest of `raw` prefixed with ANON_PREFIX.
 * Using HMAC (instead of plain SHA-256) makes the output non-guessable even
 * if the input format is known, satisfying GDPR pseudonymisation requirements.
 * The full 64-char hex digest is preserved for collision-resistance.
 */
export function hashIdentifier(raw: string, secret: string): string {
  return ANON_PREFIX + createHmac("sha256", secret).update(raw).digest("hex");
}

export function isAnonymized(value: string): boolean {
  return value.startsWith(ANON_PREFIX);
}
