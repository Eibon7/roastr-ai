import { describe, it, expect } from "vitest";
import { PLAN_LIMITS } from "../src/constants/plans";

describe("PLAN_LIMITS", () => {
  it("defines limits for exactly the three known plans", () => {
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual(["plus", "pro", "starter"]);
  });

  it("starter: has a 30-day trial, 1 account per platform, and the lowest price", () => {
    expect(PLAN_LIMITS.starter).toEqual({
      analysisLimit: 1_000,
      roastsLimit: 5,
      accountsPerPlatform: 1,
      trialDays: 30,
      priceEur: 5,
      queuePriority: false,
    });
  });

  it("pro: has a shorter trial and 2 accounts per platform", () => {
    expect(PLAN_LIMITS.pro.trialDays).toBe(7);
    expect(PLAN_LIMITS.pro.accountsPerPlatform).toBe(2);
    expect(PLAN_LIMITS.pro.queuePriority).toBe(false);
  });

  it("plus: has no trial (null) and gets queue priority", () => {
    expect(PLAN_LIMITS.plus.trialDays).toBeNull();
    expect(PLAN_LIMITS.plus.queuePriority).toBe(true);
  });

  it("analysisLimit strictly increases from starter to pro to plus", () => {
    expect(PLAN_LIMITS.starter.analysisLimit).toBeLessThan(PLAN_LIMITS.pro.analysisLimit);
    expect(PLAN_LIMITS.pro.analysisLimit).toBeLessThan(PLAN_LIMITS.plus.analysisLimit);
  });

  it("priceEur strictly increases from starter to pro to plus", () => {
    expect(PLAN_LIMITS.starter.priceEur).toBeLessThan(PLAN_LIMITS.pro.priceEur);
    expect(PLAN_LIMITS.pro.priceEur).toBeLessThan(PLAN_LIMITS.plus.priceEur);
  });

  it("roastsLimit strictly increases from starter to pro to plus", () => {
    expect(PLAN_LIMITS.starter.roastsLimit).toBeLessThan(PLAN_LIMITS.pro.roastsLimit);
    expect(PLAN_LIMITS.pro.roastsLimit).toBeLessThan(PLAN_LIMITS.plus.roastsLimit);
    expect(PLAN_LIMITS.starter.roastsLimit).toBeGreaterThan(0);
  });
});
