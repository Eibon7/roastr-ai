import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { Webhook } from "standardwebhooks";
import { billingReducer, type BillingEvent, type BillingSideEffect } from "../../domain/billing-reducer";
import type { BillingState, Plan } from "@roastr/shared";
import { PLAN_LIMITS } from "@roastr/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Public } from "../../shared/guards/public.decorator";

type RawBodyRequest = Request & { rawBody?: Buffer };

function mapPolarToBillingEvent(type: string): BillingEvent | null {
  switch (type) {
    case "subscription.created":
    case "subscription.active":
      return { type: "PAYMENT_SUCCEEDED" };
    case "subscription.canceled":
      return { type: "SUBSCRIPTION_CANCELED" };
    case "subscription.updated":
      return { type: "PAYMENT_SUCCEEDED" };
    case "invoice.payment_failed":
      return { type: "PAYMENT_FAILED" };
    case "invoice.payment_succeeded":
      return { type: "PAYMENT_SUCCEEDED" };
    default:
      return null;
  }
}

function extractPlan(data: Record<string, unknown>): Plan {
  const plan = (data?.product as Record<string, unknown>)?.name ??
    data?.plan ??
    "starter";
  return ["starter", "pro", "plus"].includes(plan as string)
    ? (plan as Plan)
    : "starter";
}

@Controller("webhooks")
@Public()
export class PolarWebhookController {
  private readonly logger = new Logger(PolarWebhookController.name);

  constructor(private readonly config: ConfigService) {}

  @Post("polar")
  @HttpCode(HttpStatus.OK)
  async handlePolarWebhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest,
  ): Promise<{ received: boolean }> {
    const secret = this.config?.get?.("POLAR_WEBHOOK_SECRET") ?? process.env["POLAR_WEBHOOK_SECRET"];
    if (secret) {
      try {
        const wh = new Webhook(secret);
        const payload = req.rawBody?.toString("utf8") ?? JSON.stringify(body);
        wh.verify(payload, headers as Record<string, string>);
      } catch {
        this.logger.warn("Webhook signature verification failed");
        throw new ForbiddenException();
      }
    } else {
      const nodeEnv = this.config?.get?.("NODE_ENV") ?? process.env["NODE_ENV"] ?? "development";
      if (nodeEnv === "production") {
        // Fail closed: without a secret we cannot verify the sender, and
        // accepting unsigned payloads in production would let anyone forge
        // billing events (e.g. grant themselves a paid plan for free).
        this.logger.error("POLAR_WEBHOOK_SECRET is required in production but is not set — rejecting webhook");
        throw new ForbiddenException();
      }
      this.logger.warn("POLAR_WEBHOOK_SECRET not set, skipping verification (dev/test only)");
    }

    const eventType = body.type as string | undefined;
    if (!eventType) {
      this.logger.warn("Webhook missing type, ignoring");
      return { received: true };
    }

    const billingEvent = mapPolarToBillingEvent(eventType);
    if (!billingEvent) {
      this.logger.debug(`Unhandled Polar event: ${eventType}`);
      return { received: true };
    }

    const data = (body.data ?? body) as Record<string, unknown>;
    const userRef = data?.user as Record<string, unknown> | undefined;
    const userId = (data?.user_id ?? userRef?.id) as string | undefined;
    const subscriptionId = (data?.id ?? data?.subscription_id) as
      | string
      | undefined;
    const planKey = extractPlan(data);

    if (!userId) {
      this.logger.warn("Webhook missing user_id, ignoring");
      return { received: true };
    }

    const supabaseUrl = this.config?.get?.("SUPABASE_URL") ?? process.env["SUPABASE_URL"] ?? "http://localhost:54321";
    const supabaseKey = this.config?.get?.("SUPABASE_SERVICE_ROLE_KEY") ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "placeholder";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Atomic CAS: read current state → compute next state in memory → apply
    // under a FOR UPDATE lock via apply_billing_event().  Retry on conflict
    // so concurrent webhook deliveries serialize correctly.
    const MAX_RETRIES = 4;
    let applied = false;
    let appliedSideEffects: BillingSideEffect[] = [];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: existing, error: selectError } = await supabase
        .from("subscriptions_usage")
        .select("billing_state")
        .eq("user_id", userId)
        .maybeSingle();

      if (selectError) {
        this.logger.error("Failed to read subscription usage", {
          error: selectError.message,
          subscriptionId: subscriptionId ?? "unknown",
        });
        throw selectError;
      }

      const currentState = (existing?.billing_state ?? "trialing") as BillingState;
      const result = billingReducer(currentState, billingEvent);
      const shouldResetUsage = result.sideEffects.some((e) => e.type === "RESET_USAGE");
      const limits = PLAN_LIMITS[planKey];

      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "apply_billing_event",
        {
          p_user_id: userId,
          p_expected_state: currentState,
          p_new_state: result.newState,
          p_plan: planKey,
          p_analysis_limit: limits.analysisLimit,
          p_roasts_limit: limits.roastsLimit,
          p_analysis_used: shouldResetUsage ? 0 : null,
          p_roasts_used: shouldResetUsage ? 0 : null,
          p_subscription_id: subscriptionId ?? null,
        },
      );

      if (rpcError) {
        this.logger.error("Failed to apply billing event", {
          error: rpcError.message,
          subscriptionId: subscriptionId ?? "unknown",
        });
        throw rpcError;
      }

      if (rpcResult === "ok") {
        applied = true;
        appliedSideEffects = result.sideEffects;
        break;
      }

      // 'conflict' → another webhook advanced the state; re-read and retry
      this.logger.debug(`Billing CAS conflict on attempt ${attempt + 1}, retrying`);
    }

    if (!applied) {
      throw new Error("Billing state conflict after max retries — concurrent webhook deliveries");
    }

    // Run side effects only once, after the state transition is confirmed
    // committed — not speculatively on every CAS retry attempt.
    await this.runSideEffects(supabase, userId, appliedSideEffects);

    return { received: true };
  }

  private async runSideEffects(
    supabase: SupabaseClient,
    userId: string,
    effects: BillingSideEffect[],
  ): Promise<void> {
    for (const effect of effects) {
      switch (effect.type) {
        case "DISABLE_INGESTION":
          await this.pauseAllAccountsForBilling(supabase, userId);
          break;
        case "ENABLE_INGESTION":
          await this.resumeAllAccountsForBilling(supabase, userId);
          break;
        case "SEND_EMAIL":
          // No email provider is configured in this repo (see
          // env.validation.ts) — log with full context instead of silently
          // claiming an email was sent, so this doesn't promise behavior
          // that doesn't exist yet.
          this.logger.warn(`Email not sent (no provider configured): ${effect.template}`, {
            userId,
            template: effect.template,
          });
          break;
        case "RESET_USAGE":
          // Already applied atomically by apply_billing_event's
          // p_analysis_used/p_roasts_used reset — nothing further to do here.
          break;
      }
    }
  }

  /**
   * DISABLE_INGESTION: suspends every actively-ingesting account for this
   * user when their subscription stops being billable. Tagged
   * status_reason='billing_paused' (distinct from the 'user_action' the
   * per-account pause button uses) so resumeAllAccountsForBilling only
   * reactivates accounts *it* paused — an account the user paused manually
   * stays paused after payment recovers.
   */
  private async pauseAllAccountsForBilling(supabase: SupabaseClient, userId: string): Promise<void> {
    const { error } = await supabase
      .from("accounts")
      .update({
        status: "paused",
        status_reason: "billing_paused",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      this.logger.error("Failed to pause accounts for billing", { error: error.message, userId });
      throw error;
    }
  }

  /** ENABLE_INGESTION: the inverse of pauseAllAccountsForBilling. */
  private async resumeAllAccountsForBilling(supabase: SupabaseClient, userId: string): Promise<void> {
    const { error } = await supabase
      .from("accounts")
      .update({
        status: "active",
        status_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "paused")
      .eq("status_reason", "billing_paused");

    if (error) {
      this.logger.error("Failed to resume accounts for billing", { error: error.message, userId });
      throw error;
    }
  }
}
