import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { hashIdentifier, isAnonymized } from "@roastr/shared";

@Injectable()
export class AnonymizeService {
  constructor(private readonly config: ConfigService) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  private get hmacKey(): string {
    return this.config.getOrThrow("ANONYMIZE_HMAC_KEY");
  }

  /**
   * Anonymizes PII in offender records older than cutoff.
   * Replaces offender_id with a keyed HMAC-SHA256 digest while preserving strike stats.
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

    const secret = this.hmacKey;
    const updates = toAnonymize.map(({ id, offender_id }) => ({
      id,
      offender_id: hashIdentifier(offender_id, secret),
      updated_at: new Date().toISOString(),
    }));

    const { error: updateErr } = await supabase
      .from("offenders")
      .upsert(updates, { onConflict: "id" });

    if (updateErr) throw updateErr;

    return { anonymized: toAnonymize.length };
  }
}
