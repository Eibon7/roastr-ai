import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RoastController } from "../../src/modules/roast/roast.controller";
import type { RoastPipelineService } from "../../src/modules/roast/roast-pipeline.service";
import type { AutoApproveService } from "../../src/modules/roast/auto-approve.service";

// `null` (not `undefined`) signals "no authenticated user" — using `undefined`
// as the sentinel would trigger the default-parameter value instead.
function makeReq(userId: string | null = "user-1") {
  return { user: userId ? { id: userId } : undefined };
}

const VALID_BODY = {
  commentId: "comment-1",
  commentText: "Tu contenido es una basura total",
  severityScore: 0.72,
  platform: "youtube",
  accountId: "account-1",
  tone: "balanceado",
};

describe("RoastController", () => {
  let pipeline: RoastPipelineService;
  let autoApprove: AutoApproveService;
  let controller: RoastController;

  beforeEach(() => {
    pipeline = {
      generate: vi.fn().mockResolvedValue({
        candidateId: "candidate-1",
        generatedText: "Un roast generado",
        isValid: true,
        violations: [],
        truncatedText: "Un roast generado",
        published: false,
      }),
      listPendingReview: vi.fn().mockResolvedValue([{ id: "candidate-1" }]),
      markPublished: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
    } as unknown as RoastPipelineService;

    autoApprove = {
      getConfig: vi.fn().mockResolvedValue({ autoApproveRoasts: false }),
      setAutoApprove: vi.fn().mockResolvedValue(undefined),
    } as unknown as AutoApproveService;

    controller = new RoastController(pipeline, autoApprove);
  });

  describe("POST /roast/generate", () => {
    it("throws 404 when there is no authenticated user", async () => {
      await expect(controller.generate(VALID_BODY, makeReq(null))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it.each(["commentId", "commentText", "platform", "accountId"])(
      "throws 400 when %s is missing",
      async (field) => {
        const body = { ...VALID_BODY, [field]: "" };
        await expect(controller.generate(body, makeReq())).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it("throws 400 for an invalid tone", async () => {
      await expect(
        controller.generate({ ...VALID_BODY, tone: "unknown_tone" }, makeReq()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("calls the pipeline with the request payload, defaulting severityScore to 0.5", async () => {
      const { severityScore: _drop, ...bodyWithoutSeverity } = VALID_BODY;
      await controller.generate(bodyWithoutSeverity as typeof VALID_BODY, makeReq("user-42"));

      expect(pipeline.generate).toHaveBeenCalledWith({
        userId: "user-42",
        commentId: VALID_BODY.commentId,
        commentText: VALID_BODY.commentText,
        severityScore: 0.5,
        platform: VALID_BODY.platform,
        accountId: VALID_BODY.accountId,
        tone: VALID_BODY.tone,
      });
    });

    it("returns the generated candidate on success", async () => {
      const result = await controller.generate(VALID_BODY, makeReq());
      expect(result).toEqual({
        candidateId: "candidate-1",
        generatedText: "Un roast generado",
        isValid: true,
        violations: [],
        truncatedText: "Un roast generado",
        published: false,
      });
    });

    it("propagates pipeline failures uncaught (e.g. an LLM/provider error)", async () => {
      // The controller has no try/catch around pipeline.generate(); any exception
      // (including one originating from LlmService's HTTP/timeout/malformed-response
      // handling) bubbles up to Nest's global exception filter as-is.
      const llmError = new Error("LLM error: rate limited");
      vi.mocked(pipeline.generate).mockRejectedValue(llmError);

      await expect(controller.generate(VALID_BODY, makeReq())).rejects.toThrow(
        "LLM error: rate limited",
      );
    });
  });

  describe("GET /roast/candidates", () => {
    it("throws 404 when there is no authenticated user", async () => {
      await expect(controller.listCandidates(makeReq(null))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns the pending candidates for the user", async () => {
      const result = await controller.listCandidates(makeReq("user-1"));
      expect(pipeline.listPendingReview).toHaveBeenCalledWith("user-1");
      expect(result).toEqual({ candidates: [{ id: "candidate-1" }] });
    });
  });

  describe("PATCH /roast/candidates/:id/approve", () => {
    it("throws 404 when there is no authenticated user", async () => {
      await expect(
        controller.approve("candidate-1", { approvedText: "ok" }, makeReq(null)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 400 when approvedText is missing", async () => {
      await expect(
        controller.approve("candidate-1", { approvedText: "" }, makeReq()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws 400 when approvedText is only whitespace", async () => {
      await expect(
        controller.approve("candidate-1", { approvedText: "   " }, makeReq()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("marks the candidate as published on success", async () => {
      await controller.approve("candidate-1", { approvedText: "Texto final" }, makeReq("user-1"));
      expect(pipeline.markPublished).toHaveBeenCalledWith("candidate-1", "user-1");
    });
  });

  describe("PATCH /roast/candidates/:id/discard", () => {
    it("throws 404 when there is no authenticated user", async () => {
      await expect(controller.discard("candidate-1", makeReq(null))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("discards the candidate on success", async () => {
      await controller.discard("candidate-1", makeReq("user-1"));
      expect(pipeline.discard).toHaveBeenCalledWith("candidate-1", "user-1");
    });
  });

  describe("GET /roast/accounts/:accountId/auto-approve", () => {
    it("throws 404 when there is no authenticated user", async () => {
      await expect(controller.getAutoApprove("account-1", makeReq(null))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns the auto-approve config", async () => {
      const result = await controller.getAutoApprove("account-1", makeReq("user-1"));
      expect(autoApprove.getConfig).toHaveBeenCalledWith("user-1", "account-1");
      expect(result).toEqual({ autoApproveRoasts: false });
    });
  });

  describe("PATCH /roast/accounts/:accountId/auto-approve", () => {
    it("throws 404 when there is no authenticated user", async () => {
      await expect(
        controller.setAutoApprove("account-1", { enabled: true }, makeReq(null)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 400 when enabled is not a boolean", async () => {
      await expect(
        controller.setAutoApprove("account-1", { enabled: "yes" as unknown as boolean }, makeReq()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("updates the auto-approve setting on success", async () => {
      await controller.setAutoApprove("account-1", { enabled: true }, makeReq("user-1"));
      expect(autoApprove.setAutoApprove).toHaveBeenCalledWith("user-1", "account-1", true);
    });
  });
});
