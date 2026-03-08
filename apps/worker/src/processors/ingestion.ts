import type { Job } from "bullmq";
import { checkBillingLimits } from "../shared/billing-guard.js";

export async function ingestionProcessor(job: Job): Promise<void> {
  const userId = job.data?.userId as string | undefined;
  if (userId) {
    const guard = await checkBillingLimits(userId);
    if (!guard.allowed) {
      return;
    }
  }

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "worker",
    queue: "ingestion",
    jobId: job.id,
    message: "Processing ingestion job",
  }));
}
