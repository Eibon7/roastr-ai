import type { Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { ensureFreshToken } from "../shared/token-refresh.js";
import { resolveShieldAction } from "@roastr/shared";
import { hideComment, blockUser, reportComment } from "../shared/action-executor.js";
import { createJobLogger } from "../shared/logger.js";
import type { Platform, ReportReason } from "@roastr/shared";

function getReportReason(flags: Record<string, unknown>): ReportReason {
  if (flags.has_threat) return "threat";
  if (flags.has_identity_attack) return "hate_speech";
  return "harassment";
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  // Billing slot was already consumed by analysisProcessor; no re-check here.

  const resolved = resolveShieldAction(
    analysisResult as Parameters<typeof resolveShieldAction>[0],
    platform,
    aggressiveness,
  );

  if (resolved.primary === "none") {
    log.debug("No action to take", { primary: resolved.primary });
    return;
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("access_token_encrypted, refresh_token_encrypted, access_token_expires_at")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Failed to fetch account for shield action: ${accountError.message}`);
  }

  if (!account?.access_token_encrypted) {
    log.warn("Account has no access token");
    return;
  }

  let accessToken: string;
  try {
    const accessEncrypted = Buffer.from(account.access_token_encrypted as string, "base64");
    const refreshRaw = account.refresh_token_encrypted as string | null;
    const refreshEncrypted = refreshRaw ? Buffer.from(refreshRaw, "base64") : null;
    accessToken = await ensureFreshToken({
      id: accountId,
      platform: platform as string,
      access_token_encrypted: accessEncrypted,
      refresh_token_encrypted: refreshEncrypted,
      access_token_expires_at: (account.access_token_expires_at as string | null) ?? null,
    });
  } catch (e) {
    log.error("Token refresh/decryption failed", { error: (e as Error).message });
    throw new Error("Token unavailable, will retry");
  }

  const actionsToTry = [resolved.primary, ...resolved.fallbacks];
  let actionTaken: string | null = null;
  let success = false;

  for (const action of actionsToTry) {
    if (action === "hide" || action === "strike1" || action === "strike1_silent") {
      const result = await hideComment(platform, accessToken, commentId);
      if (result.ok) {
        actionTaken = action;
        success = true;
        break;
      }
      log.warn("Hide failed, trying fallback", { error: result.error });
    } else if (action === "block") {
      if (!authorId) {
        log.warn("Skipping block action without authorId", { platform, commentId });
        continue;
      }
      const result = await blockUser(platform, accessToken, authorId, commentId);
      if (result.ok) {
        actionTaken = "block";
        success = true;
        break;
      }
      log.warn("Block failed", { error: result.error });
    } else if (action === "report") {
      const flags = (analysisResult.flags ?? {}) as Record<string, unknown>;
      const result = await reportComment(
        platform,
        accessToken,
        commentId,
        getReportReason(flags),
        (p, tok, cid) => hideComment(p, tok, cid),
      );
      if (result.ok) {
        actionTaken = "report";
        success = true;
        break;
      }
      log.warn("Report failed", { error: result.error });
    }
  }

  const severityScore = (analysisResult.severity_score as number) ?? 0;
  const matchedRedLine = (analysisResult.flags as { matched_red_lines?: string[] })?.matched_red_lines?.[0] ?? null;

  try {
    const { error: logError } = await supabase.from("shield_logs").insert({
      user_id: userId,
      account_id: accountId,
      platform,
      comment_id: commentId,
      offender_id: authorId ?? null,
      action_taken: actionTaken ?? "none",
      severity_score: severityScore,
      matched_red_line: matchedRedLine,
      using_aggressiveness: aggressiveness,
      platform_fallback: resolved.platformFallback,
    });
    if (logError) {
      log.error("Failed to insert shield_log", { error: logError.message });
    }
  } catch (e) {
    log.error("Unexpected error inserting shield_log", { error: (e as Error).message });
  }

  if (success && authorId && actionTaken) {
    try {
      // Atomic increment via RPC — avoids TOCTOU race and resets to 1
      const { error: strikeError } = await supabase.rpc("increment_offender_strike", {
        p_user_id: userId,
        p_account_id: accountId,
        p_platform: platform,
        p_offender_id: authorId,
      });
      if (strikeError) {
        log.error("Failed to increment offender strike", { error: strikeError.message });
      }
    } catch (e) {
      log.error("Unexpected error updating offender", { error: (e as Error).message });
    }
  }

  log.info("Shield action completed", {
    actionTaken: actionTaken ?? "none",
    success,
    platform,
    commentId,
  });
}
