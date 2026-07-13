import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Job } from "bullmq";

const logSpies = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
vi.mock("../src/shared/logger.js", () => ({ workerLogger: logSpies }));

const { handleDlqJob } = await import("../src/shared/dlq-handler.js");

function makeJob(overrides: Partial<Job> & { data?: Record<string, unknown> }): Job {
  return {
    id: "job-1",
    name: "some-job",
    attemptsMade: 5,
    data: overrides.data,
    ...overrides,
  } as unknown as Job;
}

describe("handleDlqJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitiza el payload quitando los campos sensibles y conserva los inofensivos", async () => {
    const job = makeJob({
      data: {
        userId: "user-1",
        accountId: "acc-1",
        platform: "youtube",
        text: "comentario original ofensivo",
        commentText: "otro texto sensible",
        prompt: "prompt del roast",
        content: "contenido sensible",
        roast: "roast generado",
        accessToken: "secret-access-token",
        refreshToken: "secret-refresh-token",
        commentId: "c1",
      },
    });

    handleDlqJob(job, "shield", new Error("boom"));

    expect(logSpies.warn).toHaveBeenCalledTimes(1);
    const [, payload] = logSpies.warn.mock.calls[0];
    const sanitized = payload.sanitizedPayload as Record<string, unknown>;

    expect(sanitized).not.toHaveProperty("text");
    expect(sanitized).not.toHaveProperty("commentText");
    expect(sanitized).not.toHaveProperty("prompt");
    expect(sanitized).not.toHaveProperty("content");
    expect(sanitized).not.toHaveProperty("roast");
    expect(sanitized).not.toHaveProperty("accessToken");
    expect(sanitized).not.toHaveProperty("refreshToken");

    expect(JSON.stringify(sanitized)).not.toContain("secret-access-token");
    expect(JSON.stringify(sanitized)).not.toContain("secret-refresh-token");
    expect(JSON.stringify(sanitized)).not.toContain("prompt del roast");

    expect(sanitized).toEqual(
      expect.objectContaining({
        userId: "user-1",
        accountId: "acc-1",
        platform: "youtube",
        commentId: "c1",
      }),
    );
  });

  it("sanitiza campos sensibles anidados en objetos dentro del payload", async () => {
    const job = makeJob({
      data: {
        userId: "user-1",
        analysisResult: {
          decision: "shield_critico",
          prompt: "prompt anidado sensible",
          accessToken: "nested-secret",
        },
      },
    });

    handleDlqJob(job, "shield", new Error("boom"));

    const [, payload] = logSpies.warn.mock.calls[0];
    const sanitized = payload.sanitizedPayload as Record<string, unknown>;
    const nested = sanitized.analysisResult as Record<string, unknown>;

    expect(nested).not.toHaveProperty("prompt");
    expect(nested).not.toHaveProperty("accessToken");
    expect(nested).toEqual(expect.objectContaining({ decision: "shield_critico" }));
  });

  it("con payload vacío ({}), produce un sanitizedPayload vacío sin lanzar", async () => {
    const job = makeJob({ data: {} });

    expect(() => handleDlqJob(job, "billing", new Error("fail"))).not.toThrow();

    const [, payload] = logSpies.warn.mock.calls[0];
    expect(payload.sanitizedPayload).toEqual({});
  });

  it("con job.data undefined, no lanza y registra sanitizedPayload vacío", async () => {
    const job = makeJob({ data: undefined });

    expect(() => handleDlqJob(job, "billing", new Error("fail"))).not.toThrow();

    const [, payload] = logSpies.warn.mock.calls[0];
    expect(payload.sanitizedPayload).toEqual({});
    expect(payload.jobType).toBe("some-job");
  });

  it("con job undefined, loggea un warning distinto y no lanza", async () => {
    expect(() => handleDlqJob(undefined, "ingestion", new Error("db down"))).not.toThrow();

    expect(logSpies.warn).toHaveBeenCalledWith("DLQ: job undefined", {
      queue: "ingestion",
      error: "db down",
    });
  });

  it("el log estructurado incluye queue, jobId, error final y número de intentos agotados", async () => {
    const job = makeJob({ id: "job-42", attemptsMade: 5, data: { userId: "user-9" } });

    handleDlqJob(job, "analysis", new Error("Timeout exceeded"));

    expect(logSpies.warn).toHaveBeenCalledWith(
      "Job moved to DLQ",
      expect.objectContaining({
        queue: "analysis",
        jobId: "job-42",
        finalError: "Timeout exceeded",
        attemptCount: 5,
      }),
    );
  });

  it("usa job.name como jobType cuando data.name no está presente", async () => {
    const job = makeJob({ name: "process-comment", data: { userId: "user-1" } });

    handleDlqJob(job, "analysis", new Error("boom"));

    expect(logSpies.warn).toHaveBeenCalledWith(
      "Job moved to DLQ",
      expect.objectContaining({ jobType: "process-comment" }),
    );
  });

  it("no incluye arrays del payload en el sanitizedPayload", async () => {
    const job = makeJob({ data: { userId: "user-1", tags: ["a", "b"] } });

    handleDlqJob(job, "analysis", new Error("boom"));

    const [, payload] = logSpies.warn.mock.calls[0];
    const sanitized = payload.sanitizedPayload as Record<string, unknown>;
    expect(sanitized).not.toHaveProperty("tags");
  });
});
