export type Plan = "starter" | "pro" | "plus";

export type BillingState =
  | "trialing"
  | "expired_trial_pending_payment"
  | "payment_retry"
  | "active"
  | "canceled_pending"
  | "paused";

/**
 * Billing states that grant access to paid functionality (HTTP endpoints
 * behind SubscriptionGuard, and background work like ingestion/analysis).
 * Single source of truth shared by apps/api's SubscriptionGuard and
 * apps/worker's billing-guard so both layers block the same states.
 */
export const ACTIVE_BILLING_STATES: BillingState[] = [
  "trialing",
  "active",
  "payment_retry",
  "canceled_pending",
];

export type SubscriptionUsage = {
  id: string;
  userId: string;
  plan: Plan;
  billingState: BillingState;
  analysisLimit: number;
  roastsLimit: number;
  analysisUsed: number;
  roastsUsed: number;
  polarSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  createdAt: string;
  updatedAt: string;
};
