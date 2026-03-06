import { Worker } from "bullmq";
import { ingestionProcessor } from "./processors/ingestion.js";
import { analysisProcessor } from "./processors/analysis.js";
import { shieldProcessor } from "./processors/shield.js";
import { billingProcessor } from "./processors/billing.js";
import { maintenanceProcessor } from "./processors/maintenance.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const PREFIX = process.env.QUEUE_PREFIX || "dev";

const connection = { url: REDIS_URL };

const queues = [
  { name: "ingestion", processor: ingestionProcessor },
  { name: "analysis", processor: analysisProcessor },
  { name: "shield", processor: shieldProcessor },
  { name: "billing", processor: billingProcessor },
  { name: "maintenance", processor: maintenanceProcessor },
] as const;

const workers: Worker[] = [];

for (const q of queues) {
  const worker = new Worker(q.name, q.processor, {
    connection,
    prefix: PREFIX,
  });

  worker.on("failed", (job, err) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "worker",
      queue: q.name,
      jobId: job?.id,
      error: err.message,
    }));
  });

  workers.push(worker);
}

console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: "info",
  service: "worker",
  message: `Worker started, listening on queues: ${queues.map((q) => `${PREFIX}:${q.name}`).join(", ")}`,
}));

async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
