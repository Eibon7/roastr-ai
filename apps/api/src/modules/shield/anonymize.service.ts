import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const ANON_PREFIX = "anon:";

export function hashIdentifier(raw: string): string {
  return ANON_PREFIX + createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export function isAnonymized(value: string): boolean {
  return value.startsWith(ANON_PREFIX);
}

@Injectable()
export class AnonymizeService {
  constructor(private readonly config: ConfigService) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  /**
   * Anonymizes PII in offender records older than cutoff.
   * Replaces offender_id with a deterministic SHA-256 hash while preserving strike stats.
   * Skips records already anonymized.
   */
  async anonymizeOldOffenders(cutoffIso: string): Promise<{ anonymized: number }> {
    const supabase = this.getSupabase();

    const { data: candidates, error: fetchErr } = await supabase
      .from("offenders")
      .select("id, offender_id, last_strike, created_at")
      .or(`last_strike.is.null,last_strike.lt.${cutoffIso}`)
      .lt("created_at", cutoffIso);

    if (fetchErr) throw fetchErr;
    if (!candidates || candidates.length === 0) return { anonymized: 0 };

    const toAnonymize = (candidates as { id: string; offender_id: string }[]).filter(
      (r) => !isAnonymized(r.offender_id),
    );
    if (toAnonymize.length === 0) return { anonymized: 0 };

    const updates = toAnonymize.map(({ id, offender_id }) => ({
      id,
      offender_id: hashIdentifier(offender_id),
      updated_at: new Date().toISOString(),
    }));

    const { error: updateErr } = await supabase
      .from("offenders")
      .upsert(updates, { onConflict: "id" });

    if (updateErr) throw updateErr;

    return { anonymized: toAnonymize.length };
  }
}
