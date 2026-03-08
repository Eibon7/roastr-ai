import type { PersonaProfile } from "@roastr/shared";
import { decryptToken } from "./token-decrypt.js";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function decryptPersona(ciphertext: Buffer | Uint8Array | null | undefined): PersonaProfile | null {
  if (!ciphertext || ciphertext.length === 0) return null;
  const buf = ciphertext instanceof Buffer ? ciphertext : Buffer.from(ciphertext);
  try {
    const json = decryptToken(buf);
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      isStringArray((parsed as { identities?: unknown }).identities) &&
      isStringArray((parsed as { redLines?: unknown }).redLines) &&
      isStringArray((parsed as { tolerances?: unknown }).tolerances)
    ) {
      return parsed as PersonaProfile;
    }
  } catch {
    // Invalid or corrupted persona config
  }
  return null;
}
