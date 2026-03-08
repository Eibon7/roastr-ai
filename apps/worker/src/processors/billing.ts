import type { Job } from "bullmq";
import { createJobLogger } from "../shared/logger.js";
import { incrementAnalysisUsed } from "../shared/billing-guard.js";

export async function billingProcessor(job: Job): Promise<void> {
  const log = createJobLogger("billing", job.id ?? "unknown");
  const { userId, type } = job.data ?? {};
  if (type === "increment_analysis" && userId) {
    await incrementAnalysisUsed(userId);
    log.debug("Incremented analysis_used", { userId });
  } else {
    log.info("Processing billing job");
  }
}
