import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import type { Plan } from "@roastr/shared";

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
}
