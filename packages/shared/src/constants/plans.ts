import type { Plan } from "../types/billing.js";

export type PlanLimits = {
  analysisLimit: number;
  roastsLimit: number;
  accountsPerPlatform: number;
  trialDays: number | null;
  priceEur: number;
  queuePriority: boolean;
};

// roastsLimit: docs/06-motor-roasting.md §6.14 — estimado sobre X API Basic
// ($200/mo) y ~50 usuarios activos; sujeto a ajuste según uso real.
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  starter: {
    analysisLimit: 1_000,
    roastsLimit: 5,
    accountsPerPlatform: 1,
    trialDays: 30,
    priceEur: 5,
    queuePriority: false,
  },
  pro: {
    analysisLimit: 10_000,
    roastsLimit: 50,
    accountsPerPlatform: 2,
    trialDays: 7,
    priceEur: 15,
    queuePriority: false,
  },
  plus: {
    analysisLimit: 100_000,
    roastsLimit: 200,
    accountsPerPlatform: 2,
    trialDays: null,
    priceEur: 50,
    queuePriority: true,
  },
} as const;
