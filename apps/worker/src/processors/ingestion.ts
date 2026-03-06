import type { Job } from "bullmq";

export async function ingestionProcessor(job: Job): Promise<void> {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "worker",
    queue: "ingestion",
    jobId: job.id,
    message: "Processing ingestion job",
  }));
}
