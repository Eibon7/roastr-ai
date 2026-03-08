import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? "http://localhost:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder",
);

export type BillingGuardResult =
  | { allowed: true }
  | { allowed: false; reason: "paused" | "over_limit" };

export async function checkBillingLimits(
  userId: string,
): Promise<BillingGuardResult> {
  const { data, error } = await supabase
    .from("subscriptions_usage")
    .select("billing_state, analysis_limit, analysis_used")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { allowed: false, reason: "paused" };
  }

  if (data.billing_state === "paused") {
    return { allowed: false, reason: "paused" };
  }

  const remaining = (data.analysis_limit ?? 0) - (data.analysis_used ?? 0);
  if (remaining <= 0) {
    return { allowed: false, reason: "over_limit" };
  }

  return { allowed: true };
}

export async function incrementAnalysisUsed(userId: string): Promise<void> {
  const { data } = await supabase
    .from("subscriptions_usage")
    .select("id, analysis_used")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from("subscriptions_usage")
    .update({
      analysis_used: (data.analysis_used ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
}
