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

// HMAC-SHA256 produces 64 hex chars (256 bits); validate the full shape so
// raw values that happen to start with "anon:" are not treated as anonymized.
const ANONYMIZED_RE = new RegExp(`^${ANON_PREFIX}[0-9a-f]{64}$`);

export function isAnonymized(value: string): boolean {
  return ANONYMIZED_RE.test(value);
}
