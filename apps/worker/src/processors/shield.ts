import type { Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureFreshToken } from "../shared/token-refresh.js";
import { resolveShieldAction } from "@roastr/shared";
import { hideComment, blockUser, reportComment } from "../shared/action-executor.js";
import { createJobLogger } from "../shared/logger.js";
import type { Platform, ReportReason } from "@roastr/shared";

function getReportReason(flags: Record<string, unknown>): ReportReason {
  if (flags.has_threat) return "threat";
  if (flags.has_identity_attack) return "hate_speech";
  if (flags.has_spam) return "spam";
  return "other";
}

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
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

  const { data: account, error: accountError } = await getSupabase()
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

  const severityScore = (analysisResult.severity_score as number) ?? 0;
  const matchedRedLine = (analysisResult.flags as { matched_red_lines?: string[] })?.matched_red_lines?.[0] ?? null;

  // Claim the comment atomically before calling the platform API.
  // If another worker already claimed this comment (23505), skip entirely so
  // the platform API is never called twice for the same comment.
  const { data: claimRow, error: claimError } = await getSupabase()
    .from("shield_logs")
    .insert({
      user_id: userId,
      account_id: accountId,
      platform,
      comment_id: commentId,
      offender_id: authorId ?? null,
      action_taken: "pending",
      severity_score: severityScore,
      matched_red_line: matchedRedLine,
      using_aggressiveness: aggressiveness,
      platform_fallback: resolved.platformFallback,
    })
    .select("id")
    .single();

  if (claimError) {
    if ((claimError as { code?: string }).code === "23505") {
      log.debug("Comment already claimed by another worker, skipping", { commentId });
      return;
    }
    throw new Error(`Failed to claim shield_log: ${claimError.message}`);
  }

  const logId = (claimRow as { id: string }).id;

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
      // Track whether the fallback (hideComment) ran instead of a native report
      let fallbackRan = false;
      const result = await reportComment(
        platform,
        accessToken,
        commentId,
        getReportReason(flags),
        (p, tok, cid) => { fallbackRan = true; return hideComment(p, tok, cid); },
      );
      if (result.ok) {
        actionTaken = fallbackRan ? "hide" : "report";
        success = true;
        break;
      }
      log.warn("Report failed", { error: result.error });
    }
  }

  // Update the claimed row with the actual action taken
  const { error: updateError } = await getSupabase()
    .from("shield_logs")
    .update({ action_taken: actionTaken ?? "none" })
    .eq("id", logId);

  if (updateError) {
    log.error("Failed to update shield_log action_taken", { error: updateError.message });
  }

  if (success && authorId && actionTaken) {
    try {
      // Atomic increment via RPC — avoids TOCTOU race and resets to 1
      const { error: strikeError } = await getSupabase().rpc("increment_offender_strike", {
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
