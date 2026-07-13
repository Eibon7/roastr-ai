import type { JobsOptions } from "bullmq";
import type { Plan } from "@roastr/shared";

export const QUEUE_NAMES = {
  INGESTION: "ingestion",
  ANALYSIS: "analysis",
  SHIELD: "shield",
  BILLING: "billing",
  MAINTENANCE: "maintenance",
} as const;

/** DI token for the ingestion producer queue (see OAuthModule). A plain
 * factory provider is used instead of @nestjs/bullmq's registerQueue()/
 * InjectQueue() — that machinery's "shared config holder" hangs indefinitely
 * under Test.createTestingModule() when no Redis is reachable, even with the
 * queue provider itself overridden. */
export const INGESTION_QUEUE = Symbol("INGESTION_QUEUE");

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 60_000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};

// docs/04-conexion-redes-sociales.md §4.6.1 — cadence per plan
const INGESTION_INTERVAL_MS: Record<Plan, number> = {
  starter: 900_000, // 15 min
  pro: 600_000, // 10 min
  plus: 300_000, // 5 min
};

export function ingestionIntervalMs(plan: Plan): number {
  return INGESTION_INTERVAL_MS[plan] ?? INGESTION_INTERVAL_MS.starter;
}
