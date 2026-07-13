import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { RoastInternalController } from "../../src/modules/roast/roast-internal.controller";
import type { RoastPipelineService } from "../../src/modules/roast/roast-pipeline.service";

const mockSupabaseFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

function createConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    NODE_ENV: "test",
    INTERNAL_API_SECRET: "shared-secret-123",
    ...overrides,
  };
  return {
    get: vi.fn((key: string) => values[key]),
    getOrThrow: vi.fn((key: string) => {
      if (values[key] === undefined) throw new Error(`Unknown config: ${key}`);
      return values[key];
    }),
  } as unknown as ConfigService;
}

function mockBillingState(billingState: string | null) {
  mockSupabaseFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: billingState ? { billing_state: billingState } : null,
            error: null,
          }),
      }),
    }),
  });
}

const VALID_BODY = {
  userId: "user-1",
  commentId: "comment-1",
  commentText: "Tu contenido es una basura total",
  severityScore: 0.72,
  platform: "youtube",
  accountId: "account-1",
  tone: "balanceado",
};

describe("RoastInternalController", () => {
  let pipeline: RoastPipelineService;
  let config: ConfigService;
  let controller: RoastInternalController;

  beforeEach(() => {
    mockSupabaseFrom.mockReset();
    mockBillingState("active");
    pipeline = {
      generate: vi.fn().mockResolvedValue({
        candidateId: "candidate-1",
        generatedText: "Un roast generado",
        isValid: true,
        violations: [],
        truncatedText: "Un roast generado",
        published: false,
      }),
    } as unknown as RoastPipelineService;
    config = createConfig();
    controller = new RoastInternalController(pipeline, config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("secret verification", () => {
    it("throws 403 when the provided secret does not match", async () => {
      await expect(
        controller.autoGenerate(VALID_BODY, "wrong-secret"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(pipeline.generate).not.toHaveBeenCalled();
    });

    it("throws 403 when no secret header is sent at all", async () => {
      await expect(
        controller.autoGenerate(VALID_BODY, undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("succeeds when the provided secret matches", async () => {
      const result = await controller.autoGenerate(VALID_BODY, "shared-secret-123");
      expect(result.skipped).toBe(false);
      expect(pipeline.generate).toHaveBeenCalledTimes(1);
    });

    it("skips verification (dev/test) when INTERNAL_API_SECRET is not configured", async () => {
      config = createConfig({ INTERNAL_API_SECRET: undefined, NODE_ENV: "development" });
      controller = new RoastInternalController(pipeline, config);

      const result = await controller.autoGenerate(VALID_BODY, undefined);
      expect(result.skipped).toBe(false);
      expect(pipeline.generate).toHaveBeenCalledTimes(1);
    });

    it("fails closed with 403 in production when INTERNAL_API_SECRET is not configured", async () => {
      config = createConfig({ INTERNAL_API_SECRET: undefined, NODE_ENV: "production" });
      controller = new RoastInternalController(pipeline, config);

      await expect(
        controller.autoGenerate(VALID_BODY, undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(pipeline.generate).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it.each(["userId", "commentId", "commentText", "accountId", "platform"])(
      "throws 400 when %s is missing",
      async (field) => {
        const body = { ...VALID_BODY, [field]: "" };
        await expect(
          controller.autoGenerate(body, "shared-secret-123"),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );
  });

  describe("billing state gate", () => {
    it("skips generation without calling the pipeline when the subscription is inactive", async () => {
      mockBillingState("paused");

      const result = await controller.autoGenerate(VALID_BODY, "shared-secret-123");

      expect(result).toEqual({ skipped: true, reason: "inactive_subscription" });
      expect(pipeline.generate).not.toHaveBeenCalled();
    });

    it("treats a missing subscriptions_usage row as trialing (active)", async () => {
      mockBillingState(null);

      const result = await controller.autoGenerate(VALID_BODY, "shared-secret-123");

      expect(result.skipped).toBe(false);
      expect(pipeline.generate).toHaveBeenCalledTimes(1);
    });
  });

  describe("generation", () => {
    it("calls the pipeline with the request payload, defaulting severityScore to 0.5", async () => {
      const { severityScore: _drop, ...bodyWithoutSeverity } = VALID_BODY;
      await controller.autoGenerate(bodyWithoutSeverity as typeof VALID_BODY, "shared-secret-123");

      expect(pipeline.generate).toHaveBeenCalledWith({
        userId: VALID_BODY.userId,
        commentId: VALID_BODY.commentId,
        commentText: VALID_BODY.commentText,
        severityScore: 0.5,
        platform: VALID_BODY.platform,
        accountId: VALID_BODY.accountId,
        tone: VALID_BODY.tone,
        jobId: `roast:${VALID_BODY.commentId}`,
      });
    });

    it("falls back to the 'balanceado' tone when an invalid tone is provided", async () => {
      await controller.autoGenerate({ ...VALID_BODY, tone: "not-a-real-tone" }, "shared-secret-123");

      expect(pipeline.generate).toHaveBeenCalledWith(
        expect.objectContaining({ tone: "balanceado" }),
      );
    });

    it("returns the generated candidate on success", async () => {
      const result = await controller.autoGenerate(VALID_BODY, "shared-secret-123");
      expect(result).toEqual({
        skipped: false,
        candidateId: "candidate-1",
        published: false,
      });
    });

    it("propagates pipeline failures uncaught", async () => {
      vi.mocked(pipeline.generate).mockRejectedValue(new Error("LLM error: rate limited"));

      await expect(
        controller.autoGenerate(VALID_BODY, "shared-secret-123"),
      ).rejects.toThrow("LLM error: rate limited");
    });

    it("gracefully skips when the pipeline rejects with a roast-quota ForbiddenException", async () => {
      vi.mocked(pipeline.generate).mockRejectedValue(
        new ForbiddenException("Roast quota unavailable (over_limit)."),
      );

      const result = await controller.autoGenerate(VALID_BODY, "shared-secret-123");

      expect(result).toEqual({ skipped: true, reason: "quota_exceeded" });
    });
  });
});
