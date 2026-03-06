import type { Job } from "bullmq";

export async function shieldProcessor(job: Job): Promise<void> {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "worker",
    queue: "shield",
    jobId: job.id,
    message: "Processing shield job",
  }));
}
