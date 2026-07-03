import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Job } from "bullmq";

const logSpies = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
vi.mock("../src/shared/logger.js", () => ({ createJobLogger: () => logSpies }));

const mockIncrementAnalysisUsed = vi.fn();
vi.mock("../src/shared/billing-guard.js", () => ({
  incrementAnalysisUsed: (...args: unknown[]) => mockIncrementAnalysisUsed(...args),
}));

const { billingProcessor } = await import("../src/processors/billing.js");

function makeJob(data: Record<string, unknown> | undefined): Job {
  return { id: "job-1", data } as unknown as Job;
}

describe("billingProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIncrementAnalysisUsed.mockResolvedValue(undefined);
  });

  it("con type increment_analysis y userId, incrementa el uso y loggea debug", async () => {
    await billingProcessor(makeJob({ type: "increment_analysis", userId: "user-1" }));

    expect(mockIncrementAnalysisUsed).toHaveBeenCalledWith("user-1");
    expect(logSpies.debug).toHaveBeenCalledWith(
      "Incremented analysis_used",
      expect.objectContaining({ userId: "user-1" }),
    );
    expect(logSpies.info).not.toHaveBeenCalled();
  });

  it("con un type distinto no incrementa el uso, solo loggea genérico", async () => {
    await billingProcessor(makeJob({ type: "reset_limits", userId: "user-1" }));

    expect(mockIncrementAnalysisUsed).not.toHaveBeenCalled();
    expect(logSpies.info).toHaveBeenCalledWith("Processing billing job");
  });

  it("con increment_analysis pero sin userId no incrementa el uso", async () => {
    await billingProcessor(makeJob({ type: "increment_analysis" }));

    expect(mockIncrementAnalysisUsed).not.toHaveBeenCalled();
    expect(logSpies.info).toHaveBeenCalledWith("Processing billing job");
  });

  it("con job.data undefined no lanza y cae al camino genérico", async () => {
    await expect(billingProcessor(makeJob(undefined))).resolves.toBeUndefined();

    expect(mockIncrementAnalysisUsed).not.toHaveBeenCalled();
    expect(logSpies.info).toHaveBeenCalledWith("Processing billing job");
  });

  it("repropaga el error si falla el incremento (para reintento de BullMQ)", async () => {
    mockIncrementAnalysisUsed.mockRejectedValue(new Error("Failed to increment analysis_used: db down"));

    await expect(
      billingProcessor(makeJob({ type: "increment_analysis", userId: "user-1" })),
    ).rejects.toThrow("Failed to increment analysis_used: db down");
  });
});
