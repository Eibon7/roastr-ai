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
import { billingReducer, type BillingEvent } from "../../domain/billing-reducer";
import type { BillingState, Plan } from "@roastr/shared";
import { PLAN_LIMITS } from "@roastr/shared";
import { createClient } from "@supabase/supabase-js";
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
      this.logger.warn("POLAR_WEBHOOK_SECRET not set, skipping verification");
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
      for (const effect of result.sideEffects) {
        this.logger.debug(`Side effect: ${effect.type}`, effect);
      }

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
        break;
      }

      // 'conflict' → another webhook advanced the state; re-read and retry
      this.logger.debug(`Billing CAS conflict on attempt ${attempt + 1}, retrying`);
    }

    if (!applied) {
      throw new Error("Billing state conflict after max retries — concurrent webhook deliveries");
    }

    return { received: true };
  }
}
