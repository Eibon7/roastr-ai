export type Plan = "starter" | "pro" | "plus";

export type BillingState =
  | "trialing"
  | "expired_trial_pending_payment"
  | "payment_retry"
  | "active"
  | "canceled_pending"
  | "paused";

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
