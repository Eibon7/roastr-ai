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

    const { data: existing } = await supabase
      .from("subscriptions_usage")
      .select("billing_state")
      .eq("user_id", userId)
      .maybeSingle();

    const currentState = (existing?.billing_state ?? "trialing") as BillingState;
    const result = billingReducer(currentState, billingEvent);

    const shouldResetUsage = result.sideEffects.some((e) => e.type === "RESET_USAGE");
    for (const effect of result.sideEffects) {
      this.logger.debug(`Side effect: ${effect.type}`, effect);
    }

    const limits = PLAN_LIMITS[planKey];
    const row: Record<string, unknown> = {
      user_id: userId,
      plan: planKey,
      billing_state: result.newState,
      analysis_limit: limits.analysisLimit,
      roasts_limit: limits.roastsLimit,
      polar_subscription_id: subscriptionId ?? null,
      updated_at: new Date().toISOString(),
    };
    if (shouldResetUsage) {
      row.analysis_used = 0;
      row.roasts_used = 0;
    }

    // Atomic upsert — avoids racy read-then-write branching.
    const { error: upsertError } = await supabase
      .from("subscriptions_usage")
      .upsert(row, { onConflict: "user_id" });
    if (upsertError) {
      // Log subscriptionId instead of userId to avoid PII in logs
      this.logger.error("Failed to upsert subscription usage", {
        error: upsertError.message,
        subscriptionId: subscriptionId ?? "unknown",
      });
      throw upsertError;
    }

    return { received: true };
  }
}
