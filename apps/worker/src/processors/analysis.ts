import type { Job } from "bullmq";
import { createJobLogger } from "../shared/logger.js";
import { checkBillingLimits, incrementAnalysisUsed } from "../shared/billing-guard.js";

export async function analysisProcessor(job: Job): Promise<void> {
  const log = createJobLogger("analysis", job.id ?? "unknown");
  const userId = job.data?.userId as string | undefined;
  if (userId) {
    const guard = await checkBillingLimits(userId);
    if (!guard.allowed) {
      log.debug("Skipping job: billing limit", { reason: guard.reason });
      return;
    }
  }
  log.info("Processing analysis job");
  if (userId) {
    await incrementAnalysisUsed(userId);
  }
}
