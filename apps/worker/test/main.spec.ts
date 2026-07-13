import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QUEUE_NAMES } from "../src/shared/queue.config.js";

type FailedHandler = (job: unknown, err: Error) => void;

type MockWorkerInstance = {
  name: string;
  processor: unknown;
  opts: unknown;
  handlers: Record<string, (...args: unknown[]) => void>;
  close: () => Promise<void>;
};

const { WorkerInstances, QueueInstances, QueueAddMock, dlqSpy, logSpies } = vi.hoisted(() => {
  const WorkerInstances: MockWorkerInstance[] = [];
  const QueueInstances: Array<{ name: string; opts: unknown }> = [];
  const QueueAddMock = vi.fn().mockResolvedValue(undefined);
  const dlqSpy = vi.fn();
  const logSpies = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { WorkerInstances, QueueInstances, QueueAddMock, dlqSpy, logSpies };
});

vi.mock("bullmq", () => {
  class Worker {
    name: string;
    processor: unknown;
    opts: unknown;
    handlers: Record<string, (...args: unknown[]) => void> = {};
    close = vi.fn().mockResolvedValue(undefined);
    constructor(name: string, processor: unknown, opts: unknown) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
      WorkerInstances.push(this as unknown as MockWorkerInstance);
    }
    on(event: string, cb: (...args: unknown[]) => void) {
      this.handlers[event] = cb;
      return this;
    }
  }

  class Queue {
    name: string;
    opts: unknown;
    add = QueueAddMock;
    constructor(name: string, opts: unknown) {
      this.name = name;
      this.opts = opts;
      QueueInstances.push({ name, opts });
    }
  }

  return { Worker, Queue };
});

vi.mock("../src/processors/ingestion.js", () => ({ ingestionProcessor: vi.fn() }));
vi.mock("../src/processors/analysis.js", () => ({ analysisProcessor: vi.fn() }));
vi.mock("../src/processors/shield.js", () => ({ shieldProcessor: vi.fn() }));
vi.mock("../src/processors/billing.js", () => ({ billingProcessor: vi.fn() }));
vi.mock("../src/processors/maintenance.js", () => ({ maintenanceProcessor: vi.fn() }));

vi.mock("../src/shared/logger.js", () => ({
  workerLogger: logSpies,
  createJobLogger: () => logSpies,
}));

vi.mock("../src/shared/dlq-handler.js", () => ({ handleDlqJob: dlqSpy }));

function resetSharedMocks() {
  WorkerInstances.length = 0;
  QueueInstances.length = 0;
  QueueAddMock.mockReset().mockResolvedValue(undefined);
  dlqSpy.mockReset();
  logSpies.info.mockReset();
  logSpies.warn.mockReset();
  logSpies.error.mockReset();
  logSpies.debug.mockReset();
}

describe("main.ts — worker.on('failed') decide cuándo enviar a DLQ", () => {
  let shieldFailedHandler: FailedHandler;

  beforeEach(async () => {
    resetSharedMocks();
    vi.resetModules();
    await import("../src/main.ts");

    const shieldWorker = WorkerInstances.find((w) => w.name === QUEUE_NAMES.SHIELD);
    if (!shieldWorker) throw new Error("shield worker no fue construido por main.ts");
    shieldFailedHandler = shieldWorker.handlers.failed as FailedHandler;
  });

  afterEach(() => {
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
  });

  it("registra un handler 'failed' en cada cola", () => {
    const names = WorkerInstances.map((w) => w.name);
    expect(names).toEqual(
      expect.arrayContaining([
        QUEUE_NAMES.INGESTION,
        QUEUE_NAMES.ANALYSIS,
        QUEUE_NAMES.SHIELD,
        QUEUE_NAMES.BILLING,
        QUEUE_NAMES.MAINTENANCE,
      ]),
    );
    for (const w of WorkerInstances) {
      expect(typeof w.handlers.failed).toBe("function");
    }
  });

  it("cuando attemptsMade >= attempts (reintentos agotados), invoca handleDlqJob", () => {
    const job = { id: "job-1", attemptsMade: 5, opts: { attempts: 5 } };
    const err = new Error("final failure");

    shieldFailedHandler(job, err);

    expect(dlqSpy).toHaveBeenCalledTimes(1);
    expect(dlqSpy).toHaveBeenCalledWith(job, QUEUE_NAMES.SHIELD, err);
  });

  it("cuando attemptsMade supera attempts, también invoca handleDlqJob", () => {
    const job = { id: "job-2", attemptsMade: 7, opts: { attempts: 5 } };
    const err = new Error("final failure");

    shieldFailedHandler(job, err);

    expect(dlqSpy).toHaveBeenCalledTimes(1);
  });

  it("en un fallo intermedio (attemptsMade < attempts) NO invoca handleDlqJob, para permitir el reintento", () => {
    const job = { id: "job-3", attemptsMade: 2, opts: { attempts: 5 } };
    const err = new Error("transient failure");

    shieldFailedHandler(job, err);

    expect(dlqSpy).not.toHaveBeenCalled();
  });

  it("usa el default de 5 attempts cuando job.opts.attempts no está definido", () => {
    const stillRetrying = { id: "job-4", attemptsMade: 4, opts: {} };
    shieldFailedHandler(stillRetrying, new Error("x"));
    expect(dlqSpy).not.toHaveBeenCalled();

    const exhausted = { id: "job-5", attemptsMade: 5, opts: {} };
    shieldFailedHandler(exhausted, new Error("x"));
    expect(dlqSpy).toHaveBeenCalledTimes(1);
  });

  it("con job undefined, no invoca handleDlqJob (attemptsMade por defecto 0 < default 5) y no lanza", () => {
    expect(() => shieldFailedHandler(undefined, new Error("boom"))).not.toThrow();
    expect(dlqSpy).not.toHaveBeenCalled();
  });

  it("siempre loggea el error del job, tanto en fallo intermedio como en fallo final", () => {
    const retrying = { id: "job-6", attemptsMade: 1, opts: { attempts: 5 } };
    shieldFailedHandler(retrying, new Error("retry me"));
    expect(logSpies.error).toHaveBeenCalledWith(
      "Job failed",
      expect.objectContaining({ error: "retry me" }),
    );

    logSpies.error.mockClear();

    const exhausted = { id: "job-7", attemptsMade: 5, opts: { attempts: 5 } };
    shieldFailedHandler(exhausted, new Error("final"));
    expect(logSpies.error).toHaveBeenCalledWith(
      "Job failed",
      expect.objectContaining({ error: "final" }),
    );
  });
});

describe("main.ts — scheduleMaintenance", () => {
  afterEach(() => {
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
  });

  it("crea la cola de mantenimiento y agenda el job gdpr-cleanup recurrente", async () => {
    resetSharedMocks();
    vi.resetModules();

    await import("../src/main.ts");
    await vi.waitFor(() => expect(QueueAddMock).toHaveBeenCalled());

    expect(QueueInstances.some((q) => q.name === QUEUE_NAMES.MAINTENANCE)).toBe(true);
    expect(QueueAddMock).toHaveBeenCalledWith(
      "gdpr-cleanup",
      { type: "gdpr_cleanup" },
      expect.objectContaining({ repeat: expect.objectContaining({ every: 86400_000 }) }),
    );
    expect(logSpies.info).toHaveBeenCalledWith("Scheduled GDPR cleanup (daily)");
  });

  it("si falla el scheduling (queue.add rechaza), loggea el error y no lanza sin manejar (unhandled rejection)", async () => {
    resetSharedMocks();
    vi.resetModules();
    QueueAddMock.mockReset().mockRejectedValue(new Error("redis unavailable"));

    await import("../src/main.ts");
    await vi.waitFor(() =>
      expect(logSpies.error).toHaveBeenCalledWith(
        "Failed to schedule maintenance",
        expect.objectContaining({ error: "redis unavailable" }),
      ),
    );
  });
});
