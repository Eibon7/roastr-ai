import { describe, it, expect } from "vitest";
import { ingestionIntervalMs } from "../../src/shared/queue/queue.config";

describe("ingestionIntervalMs", () => {
  it("returns 15 minutes for starter", () => {
    expect(ingestionIntervalMs("starter")).toBe(900_000);
  });

  it("returns 10 minutes for pro", () => {
    expect(ingestionIntervalMs("pro")).toBe(600_000);
  });

  it("returns 5 minutes for plus", () => {
    expect(ingestionIntervalMs("plus")).toBe(300_000);
  });

  it("falls back to the starter cadence for an unrecognized plan", () => {
    // @ts-expect-error testing runtime behavior with an invalid plan
    expect(ingestionIntervalMs("not-a-real-plan")).toBe(900_000);
  });
});
