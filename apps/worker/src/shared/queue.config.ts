import type { ConnectionOptions, JobsOptions } from "bullmq";

/** Queue names — centralizados para workers y producers */
export const QUEUE_NAMES = {
  INGESTION: "ingestion",
  ANALYSIS: "analysis",
  SHIELD: "shield",
  BILLING: "billing",
  MAINTENANCE: "maintenance",
} as const;

/** Job options por defecto: 5 intentos, backoff exponencial 1m base (1m→2m→4m→8m→16m) */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 60_000, // 1 min base → 2m → 4m → 8m → 16m
  },
  removeOnComplete: true,
  removeOnFail: false, // mantener en failed para DLQ/revisión
};

/** Connection config desde env */
export function getConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  return { url };
}

/** Queue prefix por environment (dev/staging/prod) */
export function getQueuePrefix(): string {
  const env = process.env.NODE_ENV || "development";
  const explicit = process.env.QUEUE_PREFIX;
  if (explicit) return explicit;
  if (env === "production") return "prod";
  if (env === "staging" || env === "stg") return "stg";
  return "dev";
}
