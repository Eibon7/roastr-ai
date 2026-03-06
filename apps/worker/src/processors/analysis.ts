import type { Job } from "bullmq";

export async function analysisProcessor(job: Job): Promise<void> {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "worker",
    queue: "analysis",
    jobId: job.id,
    message: "Processing analysis job",
  }));
}
