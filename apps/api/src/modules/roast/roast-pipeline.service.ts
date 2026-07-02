import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import type { PersonaProfile } from "@roastr/shared";
import { PromptBuilderService } from "./prompt-builder.service";
import { StyleValidatorService } from "./style-validator.service";
import { LlmService } from "./llm.service";
import type { ToneId } from "./tones";

export type GenerateRoastInput = {
  userId: string;
  commentId: string;
  commentText: string;
  severityScore: number;
  platform: string;
  accountId: string;
  tone: ToneId;
  persona?: PersonaProfile;
};

export type GenerateRoastResult = {
  /** Generated text — NOT persisted (GDPR). Shown once to user for review. */
  generatedText: string;
  /** Candidate metadata record ID */
  candidateId: string;
  /** Validation result */
  isValid: boolean;
  violations: Array<{ ruleId: string; message: string }>;
  /** Truncated text (if too long) */
  truncatedText: string;
};

@Injectable()
export class RoastPipelineService {
  constructor(
    private readonly promptBuilder: PromptBuilderService,
    private readonly styleValidator: StyleValidatorService,
    private readonly llm: LlmService,
    private readonly config: ConfigService,
  ) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow<string>("SUPABASE_URL"),
      this.config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  async generate(input: GenerateRoastInput): Promise<GenerateRoastResult> {
    // 1. Build prompts (also validates flag gate)
    const prompt = this.promptBuilder.build({
      commentText: input.commentText,
      severityScore: input.severityScore,
      platform: input.platform,
      tone: input.tone,
      persona: input.persona,
    });

    // 2. Call LLM
    const { text: generatedText } = await this.llm.generate(prompt);

    // 3. Validate generated text
    const validation = this.styleValidator.validate(generatedText, input.platform);

    // 4. Truncate if needed (even if invalid due to length)
    const truncatedText = this.styleValidator.truncate(generatedText, input.platform);

    // 5. Save METADATA ONLY to roast_candidates (GDPR: no generated text stored)
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("roast_candidates")
      .insert({
        user_id: input.userId,
        account_id: input.accountId,
        platform: input.platform,
        tone: input.tone,
        status: "pending_review",
        has_validation_errors: !validation.valid,
        violation_count: validation.violations.length,
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
