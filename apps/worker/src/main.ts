import { Worker, Queue } from "bullmq";
import { ingestionProcessor } from "./processors/ingestion.js";
import { analysisProcessor } from "./processors/analysis.js";
import { shieldProcessor } from "./processors/shield.js";
import { billingProcessor } from "./processors/billing.js";
import { maintenanceProcessor } from "./processors/maintenance.js";
import { workerLogger, createJobLogger } from "./shared/logger.js";
import { handleDlqJob } from "./shared/dlq-handler.js";
import {
  getConnection,
  getQueuePrefix,
  QUEUE_NAMES,
} from "./shared/queue.config.js";

const connection = getConnection();
const PREFIX = getQueuePrefix();
const CONCURRENCY = (() => {
  const raw = Number.parseInt(process.env.WORKER_CONCURRENCY ?? "", 10);
  return Number.isFinite(raw) && raw >= 1 && raw <= 100 ? raw : 5;
})();
const SHUTDOWN_TIMEOUT_MS = 10_000;

const queues = [
  { name: QUEUE_NAMES.INGESTION, processor: ingestionProcessor },
  { name: QUEUE_NAMES.ANALYSIS, processor: analysisProcessor },
  { name: QUEUE_NAMES.SHIELD, processor: shieldProcessor },
  { name: QUEUE_NAMES.BILLING, processor: billingProcessor },
  { name: QUEUE_NAMES.MAINTENANCE, processor: maintenanceProcessor },
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
    if ((job?.attemptsMade ?? 0) >= 4) {
      handleDlqJob(job, q.name, err);
    }
  });

  worker.on("completed", (job) => {
    const log = createJobLogger(q.name, job.id ?? "unknown");
    log.debug("Job completed");
  });

  workers.push(worker);
}

async function scheduleMaintenance() {
  const maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
    connection,
    prefix: PREFIX,
  });
  await maintenanceQueue.add(
    "gdpr-cleanup",
    { type: "gdpr_cleanup" },
    { repeat: { every: 86400_000 } },
  );
  workerLogger.info("Scheduled GDPR cleanup (daily)");
}
scheduleMaintenance().catch((e) => workerLogger.error("Failed to schedule maintenance", { error: e.message }));

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

  let exitCode = 0;
  try {
    await Promise.all(workers.map((w) => w.close()));
    workerLogger.info("All workers closed cleanly");
  } catch (err) {
    exitCode = 1;
    workerLogger.error("Error during shutdown", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeout);
    process.exit(exitCode);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
