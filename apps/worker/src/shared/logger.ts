import { Logger } from "@roastr/shared";

const baseLogger = new Logger({ service: "worker" });

export function createJobLogger(queue: string, jobId: string): Logger {
  return baseLogger.child({ queue, jobId });
}

export { baseLogger as workerLogger };
