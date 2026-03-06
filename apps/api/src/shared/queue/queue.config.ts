import type { JobsOptions } from "bullmq";

export const QUEUE_NAMES = {
  INGESTION: "ingestion",
  ANALYSIS: "analysis",
  SHIELD: "shield",
  BILLING: "billing",
  MAINTENANCE: "maintenance",
} as const;

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 60_000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};
