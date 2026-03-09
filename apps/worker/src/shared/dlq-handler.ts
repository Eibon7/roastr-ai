import type { Job } from "bullmq";
import { workerLogger } from "./logger.js";

/** Sanitized DLQ entry — GDPR compliant, no comment text, prompts, or sensitive data */
export type DlqEntry = {
  jobType: string;
  queue: string;
  jobId: string;
  userId?: string;
  accountId?: string;
  platform?: string;
  attemptCount: number;
  finalError: string;
  failedAt: string;
};

const SENSITIVE_KEYS = new Set([
  "text",
  "commenttext",
  "prompt",
  "content",
  "roast",
  "accesstoken",
  "refreshtoken",
  "access_token",
  "refresh_token",
  "comment_text",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, "");
}

function sanitizePayload(data: unknown): Record<string, unknown> {
  if (data == null || typeof data !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(normalizeKey(k))) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizePayload(v);
    }
  }
  return out;
}

export function handleDlqJob(job: Job | undefined, queueName: string, err: Error): void {
  if (!job) {
    workerLogger.warn("DLQ: job undefined", { queue: queueName, error: err.message });
    return;
  }

  const data = job.data as Record<string, unknown>;
  const entry: DlqEntry = {
    jobType: (data?.name as string) ?? job.name ?? "unknown",
    queue: queueName,
    jobId: String(job.id ?? "unknown"),
    userId: data?.userId as string | undefined,
    accountId: data?.accountId as string | undefined,
    platform: data?.platform as string | undefined,
    attemptCount: job.attemptsMade ?? 0,
    finalError: err.message,
    failedAt: new Date().toISOString(),
  };

  workerLogger.warn("Job moved to DLQ", {
    ...entry,
    sanitizedPayload: sanitizePayload(data),
  });
}
