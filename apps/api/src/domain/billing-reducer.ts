import type { BillingState } from "@roastr/shared";

export type BillingEvent =
  | { type: "TRIAL_STARTED" }
  | { type: "TRIAL_EXPIRED" }
  | { type: "PAYMENT_SUCCEEDED" }
  | { type: "PAYMENT_FAILED" }
  | { type: "SUBSCRIPTION_CANCELED" }
  | { type: "SUBSCRIPTION_PAUSED" }
  | { type: "SUBSCRIPTION_RESUMED" }
  | { type: "GRACE_PERIOD_EXPIRED" };

export type BillingSideEffect =
  | { type: "SEND_EMAIL"; template: string }
  | { type: "DISABLE_INGESTION" }
  | { type: "ENABLE_INGESTION" }
  | { type: "RESET_USAGE" };

export type BillingReducerResult = {
  newState: BillingState;
  sideEffects: BillingSideEffect[];
};

type Transition = {
  target: BillingState;
  sideEffects: BillingSideEffect[];
};

const ACTIVATE: BillingSideEffect[] = [
  { type: "ENABLE_INGESTION" },
  { type: "RESET_USAGE" },
];

const PAUSE: BillingSideEffect[] = [
  { type: "DISABLE_INGESTION" },
  { type: "SEND_EMAIL", template: "subscription_paused" },
];

const TRANSITIONS: Record<
  BillingState,
  Partial<Record<BillingEvent["type"], Transition>>
> = {
  trialing: {
    TRIAL_EXPIRED: {
      target: "expired_trial_pending_payment",
      sideEffects: [{ type: "SEND_EMAIL", template: "trial_expired" }],
    },
    PAYMENT_SUCCEEDED: {
      target: "active",
      sideEffects: ACTIVATE,
    },
    SUBSCRIPTION_CANCELED: {
      target: "paused",
      sideEffects: PAUSE,
    },
  },
  expired_trial_pending_payment: {
    PAYMENT_SUCCEEDED: {
      target: "active",
      sideEffects: ACTIVATE,
    },
    GRACE_PERIOD_EXPIRED: {
      target: "paused",
      sideEffects: PAUSE,
    },
  },
  active: {
    PAYMENT_FAILED: {
      target: "payment_retry",
      sideEffects: [{ type: "SEND_EMAIL", template: "payment_failed" }],
    },
    SUBSCRIPTION_CANCELED: {
      target: "canceled_pending",
      sideEffects: [{ type: "SEND_EMAIL", template: "subscription_canceled" }],
    },
    SUBSCRIPTION_PAUSED: {
      target: "paused",
      sideEffects: PAUSE,
    },
  },
  payment_retry: {
    PAYMENT_SUCCEEDED: {
      target: "active",
      sideEffects: ACTIVATE,
    },
    GRACE_PERIOD_EXPIRED: {
      target: "paused",
      sideEffects: PAUSE,
    },
    SUBSCRIPTION_PAUSED: {
      target: "paused",
      sideEffects: PAUSE,
    },
  },
  canceled_pending: {
    PAYMENT_SUCCEEDED: {
      target: "active",
      sideEffects: ACTIVATE,
    },
    GRACE_PERIOD_EXPIRED: {
      target: "paused",
      sideEffects: PAUSE,
    },
    SUBSCRIPTION_PAUSED: {
      target: "paused",
      sideEffects: PAUSE,
    },
  },
  paused: {
    SUBSCRIPTION_RESUMED: {
      target: "active",
      sideEffects: ACTIVATE,
    },
    PAYMENT_SUCCEEDED: {
      target: "active",
      sideEffects: ACTIVATE,
    },
  },
};

export function billingReducer(
  currentState: BillingState,
  event: BillingEvent,
): BillingReducerResult {
  const stateTransitions = TRANSITIONS[currentState];
  const transition = stateTransitions?.[event.type];

  if (!transition) {
    return { newState: currentState, sideEffects: [] };
  }

  return {
    newState: transition.target,
    sideEffects: transition.sideEffects.map(e => ({ ...e })),
  };
}
