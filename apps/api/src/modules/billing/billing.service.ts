import { ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import type { BillingState, Plan } from "@roastr/shared";
import { PLAN_LIMITS } from "@roastr/shared";
import { billingReducer } from "../../domain/billing-reducer";

export type BillingUsage = {
  plan: Plan;
  billing_state: string;
  analysis_limit: number;
  analysis_used: number;
  roasts_limit: number;
  roasts_used: number;
  current_period_end: string | null;
  trial_end: string | null;
};

@Injectable()
export class BillingService {
  constructor(private readonly config: ConfigService) {}

  private getSupabase() {
    const url = this.config.getOrThrow("SUPABASE_URL");
    const key = this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key);
  }

  async getUsage(userId: string): Promise<BillingUsage | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("subscriptions_usage")
      .select("plan, billing_state, analysis_limit, analysis_used, roasts_limit, roasts_used, current_period_end, trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load billing usage: ${error.message}`);
    }
    if (!data) return null;
    return data as BillingUsage;
  }

  async createCheckoutUrl(
    userId: string,
    userEmail: string,
    plan: Plan,
  ): Promise<{ url: string } | null> {
    const token = this.config.get("POLAR_ACCESS_TOKEN");
    const productIds: Record<Plan, string | undefined> = {
      starter: this.config.get("POLAR_PRODUCT_STARTER_ID"),
      pro: this.config.get("POLAR_PRODUCT_PRO_ID"),
      plus: this.config.get("POLAR_PRODUCT_PLUS_ID"),
    };
    const productId = productIds[plan];
    if (!token || !productId) return null;

    const baseUrl = process.env.NODE_ENV === "production"
      ? "https://api.polar.sh"
      : "https://sandbox-api.polar.sh";
    const frontendUrl = this.config.get("FRONTEND_URL") ?? "http://localhost:5173";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/checkouts/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          products: [productId],
          customer_email: userEmail,
          external_customer_id: userId,
          success_url: `${frontendUrl}/onboarding?step=persona_setup`,
          allow_trial: plan !== "plus",
        }),
        signal: controller.signal,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Polar checkout failed: ${msg}`, { cause: e });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Polar checkout failed: ${err}`);
    }

    const json = (await res.json()) as { url?: string };
    return json?.url ? { url: json.url } : null;
  }

  /**
   * Cancels the caller's subscription. Calls Polar first (source of truth
   * for money) so a failed remote cancellation never leaves the user marked
   * as canceled locally while Polar keeps billing them. Local state is then
   * advanced via the same CAS RPC the webhook handler uses, so a concurrent
   * webhook delivery (e.g. Polar confirming the cancellation) just retries
   * instead of racing.
   */
  async cancelSubscription(userId: string): Promise<{ billing_state: BillingState }> {
    const supabase = this.getSupabase();
    const MAX_RETRIES = 4;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: existing, error: selectError } = await supabase
        .from("subscriptions_usage")
        .select("billing_state, plan, polar_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (selectError) {
        throw new Error(`Failed to read subscription usage: ${selectError.message}`);
      }

      const currentState = (existing?.billing_state ?? "trialing") as BillingState;
      const plan = (existing?.plan ?? "starter") as Plan;
      const polarSubscriptionId = (existing?.polar_subscription_id as string | null) ?? null;

      const result = billingReducer(currentState, { type: "SUBSCRIPTION_CANCELED" });
      if (result.newState === currentState) {
        throw new ConflictException(
          `No hay una suscripción activa que cancelar (estado actual: ${currentState}).`,
        );
      }

      if (polarSubscriptionId) {
        await this.cancelPolarSubscription(polarSubscriptionId);
      }

      const limits = PLAN_LIMITS[plan];
      const { data: rpcResult, error: rpcError } = await supabase.rpc("apply_billing_event", {
        p_user_id: userId,
        p_expected_state: currentState,
        p_new_state: result.newState,
        p_plan: plan,
        p_analysis_limit: limits.analysisLimit,
        p_roasts_limit: limits.roastsLimit,
        p_analysis_used: null,
        p_roasts_used: null,
        p_subscription_id: polarSubscriptionId,
      });

      if (rpcError) {
        throw new Error(`Failed to apply cancellation: ${rpcError.message}`);
      }

      if (rpcResult === "ok") {
        return { billing_state: result.newState };
      }
      // 'conflict' — state changed concurrently (e.g. a webhook already
      // advanced it); re-read and retry with the fresh state.
    }

    throw new Error("Billing state conflict after max retries while canceling subscription.");
  }

  private async cancelPolarSubscription(subscriptionId: string): Promise<void> {
    const token = this.config.get("POLAR_ACCESS_TOKEN");
    if (!token) {
      throw new Error("Polar cancellation not configured. Set POLAR_ACCESS_TOKEN.");
    }

    const baseUrl = process.env.NODE_ENV === "production"
      ? "https://api.polar.sh"
      : "https://sandbox-api.polar.sh";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancel_at_period_end: true }),
        signal: controller.signal,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Polar cancellation failed: ${msg}`, { cause: e });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Polar cancellation failed: ${err}`);
    }
  }
}
