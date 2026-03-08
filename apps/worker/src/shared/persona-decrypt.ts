import type { PersonaProfile } from "@roastr/shared";
import { decryptToken } from "./token-decrypt.js";

export function decryptPersona(ciphertext: Buffer | Uint8Array | null | undefined): PersonaProfile | null {
  if (!ciphertext || ciphertext.length === 0) return null;
  const buf = ciphertext instanceof Buffer ? ciphertext : Buffer.from(ciphertext);
  try {
    const json = decryptToken(buf);
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as PersonaProfile).identities) &&
      Array.isArray((parsed as PersonaProfile).redLines) &&
      Array.isArray((parsed as PersonaProfile).tolerances)
    ) {
      return parsed as PersonaProfile;
    }
  } catch {
    // Invalid or corrupted persona config
  }
  return null;
}
