import { describe, it, expect } from "vitest";
import { billingReducer } from "../../src/domain/billing-reducer";

describe("Billing edge cases", () => {
  it("trialing → paused on subscription canceled during trial", () => {
    const result = billingReducer("trialing", { type: "SUBSCRIPTION_CANCELED" });
    expect(result.newState).toBe("paused");
  });

  it("payment_retry → active on payment succeeded", () => {
    const result = billingReducer("payment_retry", { type: "PAYMENT_SUCCEEDED" });
    expect(result.newState).toBe("active");
    expect(result.sideEffects.some((e) => e.type === "RESET_USAGE")).toBe(true);
  });

  it("active → payment_retry on payment failed", () => {
    const result = billingReducer("active", { type: "PAYMENT_FAILED" });
    expect(result.newState).toBe("payment_retry");
  });

  it("active → canceled_pending on subscription canceled", () => {
    const result = billingReducer("active", { type: "SUBSCRIPTION_CANCELED" });
    expect(result.newState).toBe("canceled_pending");
  });

  it("paused → active on payment succeeded (reactivation)", () => {
    const result = billingReducer("paused", { type: "PAYMENT_SUCCEEDED" });
    expect(result.newState).toBe("active");
    expect(result.sideEffects.some((e) => e.type === "RESET_USAGE")).toBe(true);
  });

  it("expired_trial_pending_payment → active on payment succeeded", () => {
    const result = billingReducer("expired_trial_pending_payment", { type: "PAYMENT_SUCCEEDED" });
    expect(result.newState).toBe("active");
  });
});
