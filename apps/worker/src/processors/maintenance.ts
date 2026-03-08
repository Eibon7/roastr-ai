import type { Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { createJobLogger } from "../shared/logger.js";

const RETENTION_DAYS = 90;
const ANON_PREFIX = "anon:";

function hashIdentifier(raw: string): string {
  return ANON_PREFIX + createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function isAnonymized(value: string): boolean {
  return value.startsWith(ANON_PREFIX);
}

export async function maintenanceProcessor(job: Job): Promise<void> {
  const log = createJobLogger("maintenance", job.id ?? "unknown");
  const jobType = (job.data?.type as string) ?? "gdpr_cleanup";

  if (jobType !== "gdpr_cleanup") {
    log.debug("Unknown job type, skipping", { jobType });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    const missing = [!supabaseUrl && "SUPABASE_URL", !supabaseKey && "SUPABASE_SERVICE_ROLE_KEY"]
      .filter(Boolean)
      .join(", ");
    log.error("Missing required environment variables", { missing });
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();

  let shieldLogsDeleted = 0;
  let roastCandidatesDeleted = 0;
  let offendersAnonymized = 0;
  let accountsPurged = 0;

  try {
    // 1. Delete shield_logs older than 90 days
    const { data: shieldData, error: shieldErr } = await supabase
      .from("shield_logs")
      .delete()
      .lt("created_at", cutoffIso)
      .select("id");

    if (shieldErr) {
      log.error("Failed to purge shield_logs", { error: shieldErr.message });
      throw shieldErr;
    }
    shieldLogsDeleted = shieldData?.length ?? 0;

    // 2. Delete roast_candidates older than 90 days
    const { data: roastData, error: roastErr } = await supabase
      .from("roast_candidates")
      .delete()
      .lt("created_at", cutoffIso)
      .select("id");

    if (roastErr) {
      log.error("Failed to purge roast_candidates", { error: roastErr.message });
      throw roastErr;
    }
    roastCandidatesDeleted = roastData?.length ?? 0;

    // 3. Anonymize old offenders — preserve strike_count, hash PII (offender_id)
    const { data: candidates, error: fetchErr } = await supabase
      .from("offenders")
      .select("id, offender_id, last_strike, created_at")
      .or(`last_strike.is.null,last_strike.lt.${cutoffIso}`)
      .lt("created_at", cutoffIso);

    if (fetchErr) throw fetchErr;

    if (candidates && candidates.length > 0) {
      const toAnonymize = (candidates as { id: string; offender_id: string }[]).filter(
        (r) => !isAnonymized(r.offender_id),
      );
      if (toAnonymize.length > 0) {
        const updates = toAnonymize.map(({ id, offender_id }) => ({
          id,
          offender_id: hashIdentifier(offender_id),
          updated_at: new Date().toISOString(),
        }));
        const { error: updateErr } = await supabase
          .from("offenders")
          .upsert(updates, { onConflict: "id" });
        if (updateErr) throw updateErr;
        offendersAnonymized = toAnonymize.length;
      }
    }

    // 4. Purge accounts flagged for retention expiry
    const nowIso = new Date().toISOString();
    const { data: accountData, error: accountErr } = await supabase
      .from("accounts")
      .delete()
      .not("retention_until", "is", null)
      .lt("retention_until", nowIso)
      .select("id");

    if (accountErr) {
      log.error("Failed to purge expired accounts", { error: accountErr.message });
      throw accountErr;
    }
    accountsPurged = accountData?.length ?? 0;

    log.info("GDPR cleanup completed", {
      shieldLogsDeleted,
      roastCandidatesDeleted,
      offendersAnonymized,
      accountsPurged,
    });
  } catch (err) {
    log.error("GDPR cleanup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
