import { Injectable, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { PromptBuilderService } from "./prompt-builder.service";
import { StyleValidatorService } from "./style-validator.service";
import { LlmService } from "./llm.service";
import { DisclaimerService } from "./disclaimer.service";
import { AutoApproveService } from "./auto-approve.service";
import type { ToneId } from "./tones";

export type GenerateRoastInput = {
  userId: string;
  commentId: string;
  commentText: string;
  severityScore: number;
  platform: string;
  accountId: string;
  tone: ToneId;
  /**
   * Idempotency key for the roasts_used quota RPC. Pass a stable value (e.g.
   * `roast:${commentId}`) for automatic generation so a BullMQ retry of the
   * triggering analysis job doesn't double-charge the quota; omit for manual
   * generation so every explicit user action consumes its own credit.
   */
  jobId?: string;
};

export type GenerateRoastResult = {
  /** Generated text (includes platform disclaimer) — NOT persisted (GDPR). Shown once to user for review. */
  generatedText: string;
  /** Candidate metadata record ID */
  candidateId: string;
  /** Validation result */
  isValid: boolean;
  violations: Array<{ ruleId: string; message: string }>;
  /** Truncated text (if too long) */
  truncatedText: string;
  /** True if auto-approve published this candidate immediately instead of queuing it for review */
  published: boolean;
};

@Injectable()
export class RoastPipelineService {
  constructor(
    private readonly promptBuilder: PromptBuilderService,
    private readonly styleValidator: StyleValidatorService,
    private readonly llm: LlmService,
    private readonly disclaimer: DisclaimerService,
    private readonly autoApprove: AutoApproveService,
    private readonly config: ConfigService,
  ) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow<string>("SUPABASE_URL"),
      this.config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  async generate(input: GenerateRoastInput): Promise<GenerateRoastResult> {
    const supabase = this.getSupabase();

    // 0. Atomically check and consume a roast slot (roasts_used/roasts_limit)
    // before doing any expensive work — mirrors tryConsumeAnalysisSlot for
    // analysis quota. Idempotent per jobId: retries with the same jobId
    // don't double-charge.
    const jobId = input.jobId ?? randomUUID();
    const { data: quota, error: quotaError } = await supabase.rpc("try_consume_roast_slot", {
      p_user_id: input.userId,
      p_job_id: jobId,
    });
    if (quotaError) {
      throw new Error(`Failed to check roast quota: ${quotaError.message}`);
    }
    const quotaResult = quota as { allowed: boolean; reason?: string };
    if (!quotaResult.allowed) {
      throw new ForbiddenException(
        `Roast quota unavailable (${quotaResult.reason ?? "over_limit"}).`,
      );
    }

    // 1. Build prompts (also validates flag gate)
    const prompt = this.promptBuilder.build({
      commentText: input.commentText,
      severityScore: input.severityScore,
      platform: input.platform,
      tone: input.tone,
    });

    // 2. Call LLM
    const { text: llmText } = await this.llm.generate(prompt);

    // 3. Apply the platform disclaimer before validating/truncating, so the
    // reviewed and (if auto-approved) published text always matches what
    // was actually checked.
    const generatedText = this.disclaimer.apply(llmText, input.platform);

    // 4. Validate generated text
    const validation = this.styleValidator.validate(generatedText, input.platform);

    // 5. Truncate if needed (even if invalid due to length)
    const truncatedText = this.styleValidator.truncate(generatedText, input.platform);

    // 6. Auto-approve only publishes immediately when the content is valid;
    // anything with violations still goes through manual review regardless
    // of the account's auto-approve setting.
    const autoApproveEnabled = await this.autoApprove.isAutoApproveEnabled(
      input.userId,
      input.accountId,
    );
    const published = autoApproveEnabled && validation.valid;
    const status = published ? "published" : "pending_review";

    // 7. Save METADATA ONLY to roast_candidates (GDPR: no generated text stored)
    const { data, error } = await supabase
      .from("roast_candidates")
      .insert({
        user_id: input.userId,
        account_id: input.accountId,
        platform: input.platform,
        tone: input.tone,
        status,
        has_validation_errors: !validation.valid,
        violation_count: validation.violations.length,
        ...(published ? { published_at: new Date().toISOString() } : {}),
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Failed to save roast candidate: ${error?.message}`);
    }

    return {
      generatedText,
      candidateId: data.id as string,
      isValid: validation.valid,
      violations: validation.violations,
      truncatedText,
      published,
    };
  }

  async discard(candidateId: string, userId: string): Promise<void> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from("roast_candidates")
      .update({ status: "discarded", discarded_at: new Date().toISOString() })
      .eq("id", candidateId)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to discard candidate: ${error.message}`);
  }

  async markPublished(candidateId: string, userId: string): Promise<void> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from("roast_candidates")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", candidateId)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to mark candidate as published: ${error.message}`);
  }

  async listPendingReview(userId: string): Promise<Array<Record<string, unknown>>> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("roast_candidates")
      .select("id, platform, tone, status, has_validation_errors, created_at, account_id")
      .eq("user_id", userId)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(`Failed to list candidates: ${error.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
  }
}
