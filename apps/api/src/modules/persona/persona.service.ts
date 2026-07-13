import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import type { PersonaProfile } from "@roastr/shared";
import { TokenEncryptionService } from "../../shared/crypto/token-encryption.service";

const MAX_FIELD_LENGTH = 200;
const PERSONA_FIELDS = ["identities", "redLines", "tolerances"] as const;

const EMPTY_PERSONA: PersonaProfile = {
  identities: [],
  redLines: [],
  tolerances: [],
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

@Injectable()
export class PersonaService {
  constructor(
    private readonly config: ConfigService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow<string>("SUPABASE_URL"),
      this.config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  async getPersona(userId: string): Promise<PersonaProfile> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("roastr_persona_config")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load persona: ${error.message}`);
    }

    const encrypted = data?.roastr_persona_config as string | Buffer | null | undefined;
    if (!encrypted) return { ...EMPTY_PERSONA };

    return this.decrypt(encrypted);
  }

  async updatePersona(userId: string, input: unknown): Promise<PersonaProfile> {
    const profile = this.validate(input);
    const ciphertext = this.encryption.encrypt(JSON.stringify(profile));

    const supabase = this.getSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({
        roastr_persona_config: ciphertext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to update persona: ${error.message}`);
    }

    return profile;
  }

  private validate(input: unknown): PersonaProfile {
    if (!input || typeof input !== "object") {
      throw new BadRequestException("Persona payload must be an object.");
    }
    const record = input as Record<string, unknown>;

    for (const field of PERSONA_FIELDS) {
      const value = record[field];
      if (!isStringArray(value)) {
        throw new BadRequestException(`"${field}" must be an array of strings.`);
      }
      if (value.some((entry) => entry.length > MAX_FIELD_LENGTH)) {
        throw new BadRequestException(
          `"${field}" entries must be ${MAX_FIELD_LENGTH} characters or fewer.`,
        );
      }
    }

    return {
      identities: record.identities as string[],
      redLines: record.redLines as string[],
      tolerances: record.tolerances as string[],
    };
  }

  private decrypt(encrypted: string | Buffer): PersonaProfile {
    const buf = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted, "base64");
    try {
      const json = this.encryption.decrypt(buf);
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
      return { ...EMPTY_PERSONA };
    } catch {
      // Corrupted or undecryptable persona config — treat as unset rather
      // than failing the request.
      return { ...EMPTY_PERSONA };
    }
  }
}
