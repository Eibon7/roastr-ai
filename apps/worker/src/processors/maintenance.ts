import type { Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
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
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();

  let shieldLogsDeleted = 0;
  let offendersDeleted = 0;
  let accountsPurged = 0;

  try {
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

    const { data: offendersNull, error: err1 } = await supabase
      .from("offenders")
      .delete()
      .is("last_strike", null)
      .lt("created_at", cutoffIso)
      .select("id");
    if (err1) {
      log.error("Failed to purge null-strike offenders", { error: err1.message });
      throw err1;
    }

    const { data: offendersStale, error: err2 } = await supabase
      .from("offenders")
      .delete()
      .not("last_strike", "is", null)
      .lt("last_strike", cutoffIso)
      .select("id");
    if (err2) {
      log.error("Failed to purge stale offenders", { error: err2.message });
      throw err2;
    }

    offendersDeleted = (offendersNull?.length ?? 0) + (offendersStale?.length ?? 0);

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
      offendersDeleted,
      accountsPurged,
    });
  } catch (err) {
    log.error("GDPR cleanup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
