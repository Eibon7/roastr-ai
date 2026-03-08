import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the worker",
  );
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type BillingGuardResult =
  | { allowed: true }
  | { allowed: false; reason: "paused" | "over_limit" | "lookup_error" };

export async function checkBillingLimits(
  userId: string,
): Promise<BillingGuardResult> {
  const { data, error } = await supabase
    .from("subscriptions_usage")
    .select("billing_state, analysis_limit, analysis_used")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { allowed: false, reason: "lookup_error" };
  }
  if (!data) {
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
  const { error } = await supabase.rpc("increment_analysis_used", {
    p_user_id: userId,
  });
  if (error) {
    throw new Error(`Failed to increment analysis_used: ${error.message}`);
  }
}
