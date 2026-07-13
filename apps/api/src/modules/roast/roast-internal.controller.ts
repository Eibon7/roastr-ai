import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  ForbiddenException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { Public } from "../../shared/guards/public.decorator";
import { ACTIVE_BILLING_STATES } from "../../shared/guards/subscription.guard";
import type { BillingState } from "@roastr/shared";
import { RoastPipelineService } from "./roast-pipeline.service";
import { isValidTone, type ToneId } from "./tones";

type AutoGenerateBody = {
  userId: string;
  commentId: string;
  commentText: string;
  severityScore: number;
  platform: string;
  accountId: string;
  tone: string;
};

/**
 * Triggered by apps/worker's analysis processor when a YouTube comment is
 * decided eligible_for_response/correctiva — not reachable by end users.
 * Authenticated via a shared secret (the worker has no user session/JWT), so
 * this bypasses SupabaseAuthGuard (@Public()) and SubscriptionGuard, and
 * re-checks billing_state itself.
 */
@Controller("internal/roast")
@Public()
export class RoastInternalController {
  private readonly logger = new Logger(RoastInternalController.name);

  constructor(
    private readonly pipeline: RoastPipelineService,
    private readonly config: ConfigService,
  ) {}

  @Post("auto-generate")
  @HttpCode(HttpStatus.OK)
  async autoGenerate(
    @Body() body: AutoGenerateBody,
    @Headers("x-internal-secret") providedSecret: string | undefined,
  ) {
    this.verifySecret(providedSecret);

    if (!body.userId || !body.commentId || !body.commentText || !body.accountId || !body.platform) {
      throw new BadRequestException("userId, commentId, commentText, accountId and platform are required.");
    }

    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data } = await supabase
      .from("subscriptions_usage")
      .select("billing_state")
      .eq("user_id", body.userId)
      .maybeSingle();

    const billingState = (data?.billing_state as BillingState) ?? "trialing";
    if (!ACTIVE_BILLING_STATES.includes(billingState)) {
      this.logger.debug("Skipping auto-generate: inactive subscription", { billingState });
      return { skipped: true, reason: "inactive_subscription" };
    }

    const tone: ToneId = isValidTone(body.tone) ? body.tone : "balanceado";

    let result: Awaited<ReturnType<RoastPipelineService["generate"]>>;
    try {
      result = await this.pipeline.generate({
        userId: body.userId,
        commentId: body.commentId,
        commentText: body.commentText,
        severityScore: body.severityScore ?? 0.5,
        platform: body.platform,
        accountId: body.accountId,
        tone,
        // Stable per-comment key: a BullMQ retry of the triggering analysis
        // job calls this endpoint again for the same comment and must not
        // consume a second roast credit.
        jobId: `roast:${body.commentId}`,
      });
    } catch (e) {
      if (e instanceof ForbiddenException) {
        // Roast quota exhausted — a graceful skip, not a failure to retry.
        this.logger.debug("Skipping auto-generate: roast quota unavailable", {
          userId: body.userId,
        });
        return { skipped: true, reason: "quota_exceeded" };
      }
      throw e;
    }

    return {
      skipped: false,
      candidateId: result.candidateId,
      published: result.published,
    };
  }

  private verifySecret(providedSecret: string | undefined): void {
    const expected = this.config.get<string>("INTERNAL_API_SECRET");
    if (!expected) {
      const nodeEnv = this.config.get<string>("NODE_ENV") ?? "development";
      if (nodeEnv === "production") {
        // Fail closed: without a secret we cannot verify the caller, and
        // accepting unauthenticated requests in production would let anyone
        // trigger roast generation (and consume LLM/roast quota) for any user.
        this.logger.error("INTERNAL_API_SECRET is required in production but is not set — rejecting request");
        throw new ForbiddenException();
      }
      this.logger.warn("INTERNAL_API_SECRET not set, skipping verification (dev/test only)");
      return;
    }
    if (providedSecret !== expected) {
      throw new ForbiddenException();
    }
  }
}
