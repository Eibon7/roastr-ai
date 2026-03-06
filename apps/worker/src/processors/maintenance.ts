import type { Job } from "bullmq";

export async function maintenanceProcessor(job: Job): Promise<void> {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "worker",
    queue: "maintenance",
    jobId: job.id,
    message: "Processing maintenance job",
  }));
}
