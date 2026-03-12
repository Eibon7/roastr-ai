import type { Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { hashIdentifier, isAnonymized } from "@roastr/shared";
import { createJobLogger } from "../shared/logger.js";

const RETENTION_DAYS = 90;

export async function maintenanceProcessor(job: Job): Promise<void> {
  const log = createJobLogger("maintenance", job.id ?? "unknown");
  const jobType = (job.data?.type as string) ?? "gdpr_cleanup";

  if (jobType !== "gdpr_cleanup") {
    log.debug("Unknown job type, skipping", { jobType });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonymizeSecret = process.env.ANONYMIZE_HMAC_KEY;
  if (!supabaseUrl || !supabaseKey || !anonymizeSecret) {
    const missing = [
      !supabaseUrl && "SUPABASE_URL",
      !supabaseKey && "SUPABASE_SERVICE_ROLE_KEY",
      !anonymizeSecret && "ANONYMIZE_HMAC_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    log.error("Missing required environment variables", { missing });
    throw new Error(`Required environment variables missing: ${missing}`);
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

    // 3. Anonymize old offenders in pages to avoid memory/payload limits.
    //    Composite cursor (created_at, id) avoids skipping rows that share the
    //    same timestamp at a page boundary.
    const PAGE_SIZE = 500;
    let cursor = {
      created_at: "1970-01-01T00:00:00.000Z",
      id: "00000000-0000-0000-0000-000000000000",
    };

    for (;;) {
      // Fetch the next page: rows after the composite cursor, ordered by
      // (created_at, id) so the cursor advances deterministically even when
      // multiple rows have an identical created_at value.
      const { data: page, error: pageErr } = await supabase
        .from("offenders")
        .select("id, offender_id, created_at")
        .or(`last_strike.is.null,last_strike.lt.${cutoffIso}`)
        .lt("created_at", cutoffIso)
        .or(
          `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`,
        )
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);

      if (pageErr) throw pageErr;
      if (!page || page.length === 0) break;

      const toAnonymize = (page as { id: string; offender_id: string; created_at: string }[])
        .filter((r) => !isAnonymized(r.offender_id));

      if (toAnonymize.length > 0) {
        const now = new Date().toISOString();
        const updates = toAnonymize.map(({ id, offender_id }) => ({
          id,
          offender_id: hashIdentifier(offender_id, anonymizeSecret),
          updated_at: now,
        }));
        const { error: updateErr } = await supabase
          .from("offenders")
          .upsert(updates, { onConflict: "id" });
        if (updateErr) throw updateErr;
        offendersAnonymized += toAnonymize.length;
      }

      // Advance composite cursor to the last row of this page
      const last = page[page.length - 1] as { created_at: string; id: string };
      cursor = { created_at: last.created_at, id: last.id };

      // Fewer rows than PAGE_SIZE means no more pages remain
      if (page.length < PAGE_SIZE) break;
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
