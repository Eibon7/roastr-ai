import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { RoastPipelineService } from "../../src/modules/roast/roast-pipeline.service";
import { DisclaimerService } from "../../src/modules/roast/disclaimer.service";
import type { PromptBuilderService } from "../../src/modules/roast/prompt-builder.service";
import type { StyleValidatorService } from "../../src/modules/roast/style-validator.service";
import type { LlmService } from "../../src/modules/roast/llm.service";
import type { AutoApproveService } from "../../src/modules/roast/auto-approve.service";

// ─── Supabase mock (mirrors the pattern used in test/auth/account-deletion.spec.ts) ──

type MockMethods = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

type MockChain = Promise<{ data: unknown; error: unknown }> & MockMethods;

function makeChain(defaultResult: { data: unknown; error: unknown } = { data: null, error: null }): MockChain {
  const chain = Promise.resolve(defaultResult) as unknown as MockChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(defaultResult));
  return chain;
}

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

function makeConfig(): ConfigService {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (key === "SUPABASE_URL") return "https://test.supabase.co";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-key";
      throw new Error(`Unknown config: ${key}`);
    }),
  } as unknown as ConfigService;
}

const BASE_INPUT = {
  userId: "user-1",
  commentId: "comment-1",
  commentText: "Tu contenido es una basura total",
  severityScore: 0.72,
  platform: "youtube",
  accountId: "account-1",
  tone: "balanceado" as const,
};

const YOUTUBE_DISCLAIMER =
  "\n\n⚠️ Este comentario fue generado con asistencia de IA (Roastr). No representa la opinión personal del creador.";

describe("RoastPipelineService", () => {
  let promptBuilder: PromptBuilderService;
  let styleValidator: StyleValidatorService;
  let llm: LlmService;
  let disclaimer: DisclaimerService;
  let autoApprove: AutoApproveService;
  let pipeline: RoastPipelineService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRpc.mockResolvedValue({ data: { allowed: true, remaining: 4 }, error: null });

    promptBuilder = {
      build: vi.fn().mockReturnValue({
        system: "system prompt",
        user: "user prompt",
        maxChars: 1000,
      }),
    } as unknown as PromptBuilderService;

    styleValidator = {
      validate: vi.fn().mockReturnValue({ valid: true, violations: [] }),
      truncate: vi.fn().mockImplementation((text: string) => text),
    } as unknown as StyleValidatorService;

    llm = {
      generate: vi.fn().mockResolvedValue({ text: "Un roast generado", model: "mock", tokens_used: 10 }),
    } as unknown as LlmService;

    disclaimer = new DisclaimerService();

    autoApprove = {
      isAutoApproveEnabled: vi.fn().mockResolvedValue(false),
      setAutoApprove: vi.fn(),
      getConfig: vi.fn(),
    } as unknown as AutoApproveService;

    pipeline = new RoastPipelineService(
      promptBuilder,
      styleValidator,
      llm,
      disclaimer,
      autoApprove,
      makeConfig(),
    );
  });

  describe("generate() — happy path", () => {
    it("builds the prompt, calls the LLM, applies the disclaimer, validates, truncates and persists metadata only", async () => {
      const insertChain = makeChain({ data: { id: "candidate-123" }, error: null });
      mockFrom.mockReturnValue(insertChain);

      const result = await pipeline.generate(BASE_INPUT);
      const expectedText = "Un roast generado" + YOUTUBE_DISCLAIMER;

      expect(promptBuilder.build).toHaveBeenCalledWith({
        commentText: BASE_INPUT.commentText,
        severityScore: BASE_INPUT.severityScore,
        platform: BASE_INPUT.platform,
        tone: BASE_INPUT.tone,
      });
      expect(llm.generate).toHaveBeenCalledWith({
        system: "system prompt",
        user: "user prompt",
        maxChars: 1000,
      });
      // Validation and truncation must run on the disclaimer-included text,
      // since that's what's actually shown to the user / published.
      expect(styleValidator.validate).toHaveBeenCalledWith(expectedText, BASE_INPUT.platform);
      expect(styleValidator.truncate).toHaveBeenCalledWith(expectedText, BASE_INPUT.platform);

      expect(mockFrom).toHaveBeenCalledWith("roast_candidates");
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: BASE_INPUT.userId,
          account_id: BASE_INPUT.accountId,
          platform: BASE_INPUT.platform,
          tone: BASE_INPUT.tone,
          status: "pending_review",
          has_validation_errors: false,
          violation_count: 0,
        }),
      );
      // Auto-approve is disabled by default, so nothing should be marked published.
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.not.objectContaining({ published_at: expect.anything() }),
      );

      expect(result).toEqual({
        generatedText: expectedText,
        candidateId: "candidate-123",
        isValid: true,
        violations: [],
        truncatedText: expectedText,
        published: false,
      });
    });

    it("marks has_validation_errors and violation_count from the validator result", async () => {
      vi.mocked(styleValidator.validate).mockReturnValue({
        valid: false,
        violations: [{ ruleId: "no_urls", message: "contains a URL" }],
      });
      const insertChain = makeChain({ data: { id: "candidate-456" }, error: null });
      mockFrom.mockReturnValue(insertChain);

      const result = await pipeline.generate(BASE_INPUT);

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ has_validation_errors: true, violation_count: 1 }),
      );
      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual([{ ruleId: "no_urls", message: "contains a URL" }]);
    });
  });

  describe("generate() — disclaimer", () => {
    it("prefixes X/Twitter content with [AI] instead of appending a suffix", async () => {
      const insertChain = makeChain({ data: { id: "candidate-x" }, error: null });
      mockFrom.mockReturnValue(insertChain);

      const result = await pipeline.generate({ ...BASE_INPUT, platform: "x" });

      expect(result.generatedText).toBe("[AI] Un roast generado");
    });

    it("does not double-apply the disclaimer if the LLM output already contains it", async () => {
      vi.mocked(llm.generate).mockResolvedValue({
        text: "Un roast generado" + YOUTUBE_DISCLAIMER,
        model: "mock",
        tokens_used: 10,
      });
      const insertChain = makeChain({ data: { id: "candidate-dup" }, error: null });
      mockFrom.mockReturnValue(insertChain);

      const result = await pipeline.generate(BASE_INPUT);

      expect(result.generatedText).toBe("Un roast generado" + YOUTUBE_DISCLAIMER);
    });
  });

  describe("generate() — auto-approve", () => {
    it("publishes immediately when auto-approve is enabled and the content is valid", async () => {
      vi.mocked(autoApprove.isAutoApproveEnabled).mockResolvedValue(true);
      const insertChain = makeChain({ data: { id: "candidate-auto" }, error: null });
      mockFrom.mockReturnValue(insertChain);

      const result = await pipeline.generate(BASE_INPUT);

      expect(autoApprove.isAutoApproveEnabled).toHaveBeenCalledWith(
        BASE_INPUT.userId,
        BASE_INPUT.accountId,
      );
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published", published_at: expect.any(String) }),
      );
      expect(result.published).toBe(true);
    });

    it("still queues for manual review when auto-approve is enabled but validation fails", async () => {
      vi.mocked(autoApprove.isAutoApproveEnabled).mockResolvedValue(true);
      vi.mocked(styleValidator.validate).mockReturnValue({
        valid: false,
        violations: [{ ruleId: "no_urls", message: "contains a URL" }],
      });
      const insertChain = makeChain({ data: { id: "candidate-invalid" }, error: null });
      mockFrom.mockReturnValue(insertChain);

      const result = await pipeline.generate(BASE_INPUT);

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending_review" }),
      );
      expect(result.published).toBe(false);
    });
  });

  describe("generate() — roast quota", () => {
    it("consumes a roast slot via try_consume_roast_slot before doing any work", async () => {
      const insertChain = makeChain({ data: { id: "candidate-123" }, error: null });
      mockFrom.mockReturnValue(insertChain);

      await pipeline.generate(BASE_INPUT);

      expect(mockRpc).toHaveBeenCalledWith("try_consume_roast_slot", {
        p_user_id: BASE_INPUT.userId,
        p_job_id: expect.any(String),
      });
    });

    it("uses the provided jobId for idempotency instead of generating a random one", async () => {
      const insertChain = makeChain({ data: { id: "candidate-123" }, error: null });
      mockFrom.mockReturnValue(insertChain);

      await pipeline.generate({ ...BASE_INPUT, jobId: "roast:comment-1" });

      expect(mockRpc).toHaveBeenCalledWith("try_consume_roast_slot", {
        p_user_id: BASE_INPUT.userId,
        p_job_id: "roast:comment-1",
      });
    });

    it("throws ForbiddenException and does not call the LLM when the quota is exhausted", async () => {
      mockRpc.mockResolvedValue({ data: { allowed: false, reason: "over_limit" }, error: null });

      await expect(pipeline.generate(BASE_INPUT)).rejects.toThrow(/over_limit/);
      expect(llm.generate).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("propagates the raw error when the quota RPC itself fails", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "db down" } });

      await expect(pipeline.generate(BASE_INPUT)).rejects.toThrow(
        "Failed to check roast quota: db down",
      );
      expect(llm.generate).not.toHaveBeenCalled();
    });
  });

  describe("generate() — LLM failures propagate uncaught", () => {
    it("rejects with the same error the LLM service throws (no retry, no catch in the pipeline)", async () => {
      // SUSPICIOUS: roast-pipeline.service.ts awaits `this.llm.generate(prompt)` with no
      // try/catch and no retry logic. Any error thrown by LlmService (HTTP error,
      // malformed response, network failure) propagates verbatim out of generate().
      const llmError = new Error("LLM error: rate limited");
      vi.mocked(llm.generate).mockRejectedValue(llmError);

      await expect(pipeline.generate(BASE_INPUT)).rejects.toThrow("LLM error: rate limited");
      // Because the LLM step throws first, no candidate should ever be persisted.
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("generate() — persistence failures", () => {
    it("throws when supabase insert returns an error", async () => {
      const insertChain = makeChain({ data: null, error: { message: "unique violation" } });
      mockFrom.mockReturnValue(insertChain);

      await expect(pipeline.generate(BASE_INPUT)).rejects.toThrow(
        /Failed to save roast candidate: unique violation/,
      );
    });

    it("throws when supabase insert returns no data and no error", async () => {
      const insertChain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(insertChain);

      await expect(pipeline.generate(BASE_INPUT)).rejects.toThrow(/Failed to save roast candidate/);
    });
  });

  describe("discard()", () => {
    it("updates the candidate status to discarded", async () => {
      const updateChain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(updateChain);

      await pipeline.discard("candidate-1", "user-1");

      expect(mockFrom).toHaveBeenCalledWith("roast_candidates");
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "discarded" }),
      );
      expect(updateChain.eq).toHaveBeenCalledWith("id", "candidate-1");
      expect(updateChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("throws when the update fails", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: "not found" } }));
      await expect(pipeline.discard("candidate-1", "user-1")).rejects.toThrow(
        /Failed to discard candidate: not found/,
      );
    });
  });

  describe("markPublished()", () => {
    it("updates the candidate status to published", async () => {
      const updateChain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(updateChain);

      await pipeline.markPublished("candidate-1", "user-1");

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published" }),
      );
    });

    it("throws when the update fails", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: "db down" } }));
      await expect(pipeline.markPublished("candidate-1", "user-1")).rejects.toThrow(
        /Failed to mark candidate as published: db down/,
      );
    });
  });

  describe("listPendingReview()", () => {
    it("returns the pending candidates for the user", async () => {
      const candidates = [{ id: "c1", platform: "youtube" }];
      mockFrom.mockReturnValue(makeChain({ data: candidates, error: null }));

      const result = await pipeline.listPendingReview("user-1");
      expect(result).toEqual(candidates);
    });

    it("returns an empty array when data is null", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
      const result = await pipeline.listPendingReview("user-1");
      expect(result).toEqual([]);
    });

    it("throws when the query fails", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: "timeout" } }));
      await expect(pipeline.listPendingReview("user-1")).rejects.toThrow(/Failed to list candidates: timeout/);
    });
  });
});
