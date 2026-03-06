import type { Plan } from "../types/billing.js";

export type PlanLimits = {
  analysisLimit: number;
  roastsLimit: number;
  accountsPerPlatform: number;
  trialDays: number | null;
  priceEur: number;
  queuePriority: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  starter: {
    analysisLimit: 1_000,
    roastsLimit: 0,
    accountsPerPlatform: 1,
    trialDays: 30,
    priceEur: 5,
    queuePriority: false,
  },
  pro: {
    analysisLimit: 10_000,
    roastsLimit: 0,
    accountsPerPlatform: 2,
    trialDays: 7,
    priceEur: 15,
    queuePriority: false,
  },
  plus: {
    analysisLimit: 100_000,
    roastsLimit: 0,
    accountsPerPlatform: 2,
    trialDays: null,
    priceEur: 50,
    queuePriority: true,
  },
} as const;
