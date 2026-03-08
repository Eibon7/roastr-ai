import type { Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { checkBillingLimits } from "../shared/billing-guard.js";
import { decryptToken } from "../shared/token-decrypt.js";
import { resolveShieldAction } from "@roastr/shared";
import { hideComment, blockUser, reportComment } from "../shared/action-executor.js";
import { createJobLogger } from "../shared/logger.js";
import type { Platform } from "@roastr/shared";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function toBuffer(raw: unknown): Buffer {
  if (raw instanceof Buffer) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (raw instanceof ArrayBuffer) return Buffer.from(raw);
  return Buffer.from(new Uint8Array(0));
}

export async function shieldProcessor(job: Job): Promise<void> {
  const log = createJobLogger("shield", job.id ?? "unknown");
  const userId = job.data?.userId as string | undefined;
  const accountId = job.data?.accountId as string | undefined;
  const platform = job.data?.platform as Platform | undefined;
  const commentId = job.data?.commentId as string | undefined;
  const authorId = job.data?.authorId as string | undefined;
  const analysisResult = job.data?.analysisResult as Record<string, unknown> | undefined;
  const aggressiveness = (job.data?.aggressiveness as number) ?? 0.95;

  if (!userId || !accountId || !platform || !commentId || !analysisResult) {
    log.warn("Missing job data", { userId, accountId, platform, commentId });
    return;
  }

  const guard = await checkBillingLimits(userId);
  if (!guard.allowed) {
    if (guard.reason === "lookup_error") {
      throw new Error("Billing lookup failed, will retry");
    }
    return;
  }

  const resolved = resolveShieldAction(
    analysisResult as Parameters<typeof resolveShieldAction>[0],
    platform,
    aggressiveness,
  );

  if (resolved.primary === "none") {
    log.debug("No action to take", { primary: resolved.primary });
    return;
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("access_token_encrypted")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!account?.access_token_encrypted) {
    log.warn("Account has no access token");
    return;
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(toBuffer(account.access_token_encrypted));
  } catch (e) {
    log.error("Token decryption failed", { error: (e as Error).message });
    throw new Error("Token decryption failed, will retry");
  }

  const actionsToTry = [resolved.primary, ...resolved.fallbacks];
  let actionTaken: string = resolved.primary;
  let success = false;

  for (const action of actionsToTry) {
    if (action === "hide") {
      const result = await hideComment(platform, accessToken, commentId);
      if (result.ok) {
        actionTaken = "hide";
        success = true;
        break;
      }
      log.warn("Hide failed, trying fallback", { error: result.error });
    } else if (action === "block") {
      const result = await blockUser(platform, accessToken, authorId ?? "", commentId);
      if (result.ok) {
        actionTaken = "block";
        success = true;
        break;
      }
      log.warn("Block failed", { error: result.error });
    } else if (action === "report") {
      const result = await reportComment(platform, accessToken, commentId, "harassment");
      if (result.ok) {
        actionTaken = "report";
        success = true;
        break;
      }
      log.warn("Report failed", { error: result.error });
    } else if (action === "strike1" || action === "strike1_silent") {
      const result = await hideComment(platform, accessToken, commentId);
      if (result.ok) {
        actionTaken = action;
        success = true;
        break;
      }
    }
  }

  const severityScore = (analysisResult.severity_score as number) ?? 0;
  const matchedRedLine = (analysisResult.flags as { matched_red_lines?: string[] })?.matched_red_lines?.[0] ?? null;

  await supabase.from("shield_logs").insert({
    user_id: userId,
    account_id: accountId,
    platform,
    comment_id: commentId,
    offender_id: authorId ?? null,
    action_taken: actionTaken,
    severity_score: severityScore,
    matched_red_line: matchedRedLine,
    using_aggressiveness: aggressiveness,
    platform_fallback: resolved.platformFallback,
  });

  if (success && authorId && (actionTaken === "hide" || actionTaken === "block" || actionTaken === "report" || actionTaken.startsWith("strike"))) {
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from("offenders")
      .select("id, strike_level")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("offender_id", authorId)
      .maybeSingle();

    const newStrikeLevel = existing ? Math.min((existing.strike_level ?? 0) + 1, 3) : 1;

    await supabase.from("offenders").upsert(
      {
        user_id: userId,
        account_id: accountId,
        platform,
        offender_id: authorId,
        strike_level: newStrikeLevel,
        last_strike: now,
        updated_at: now,
      },
      {
        onConflict: "user_id,account_id,offender_id",
        ignoreDuplicates: false,
      },
    );
  }

  log.info("Shield action completed", {
    actionTaken,
    success,
    platform,
    commentId,
  });
}
