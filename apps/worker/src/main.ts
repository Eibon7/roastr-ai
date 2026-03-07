import { Worker } from "bullmq";
import { ingestionProcessor } from "./processors/ingestion.js";
import { analysisProcessor } from "./processors/analysis.js";
import { shieldProcessor } from "./processors/shield.js";
import { billingProcessor } from "./processors/billing.js";
import { maintenanceProcessor } from "./processors/maintenance.js";
import { workerLogger, createJobLogger } from "./shared/logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const PREFIX = process.env.QUEUE_PREFIX || "dev";
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 5;
const SHUTDOWN_TIMEOUT_MS = 10_000;

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
    concurrency: CONCURRENCY,
  });

  worker.on("failed", (job, err) => {
    const log = createJobLogger(q.name, job?.id ?? "unknown");
    log.error("Job failed", { error: err.message, stack: err.stack });
  });

  worker.on("completed", (job) => {
    const log = createJobLogger(q.name, job.id ?? "unknown");
    log.debug("Job completed");
  });

  workers.push(worker);
}

workerLogger.info("Worker started", {
  queues: queues.map((q) => `${PREFIX}:${q.name}`).join(", "),
  concurrency: CONCURRENCY,
});

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  workerLogger.info("Graceful shutdown initiated");

  const timeout = setTimeout(() => {
    workerLogger.warn("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    await Promise.all(workers.map((w) => w.close()));
    workerLogger.info("All workers closed cleanly");
  } catch (err) {
    workerLogger.error("Error during shutdown", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeout);
    process.exit(0);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
