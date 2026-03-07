import type { Job } from "bullmq";
import { createJobLogger } from "../shared/logger.js";

export async function analysisProcessor(job: Job): Promise<void> {
  const log = createJobLogger("analysis", job.id ?? "unknown");
  log.info("Processing analysis job");
}
