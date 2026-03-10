import type { Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureFreshToken } from "../shared/token-refresh.js";
import { resolveShieldAction } from "@roastr/shared";
import { hideComment, blockUser, reportComment } from "../shared/action-executor.js";
import { createJobLogger } from "../shared/logger.js";
import type { Platform, ReportReason } from "@roastr/shared";

/** Stale-pending reclaim threshold: if a "pending" claim is older than this,
 *  another worker may reclaim it (the original worker likely died mid-job). */
const RECLAIM_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

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
    .select("platform, access_token_encrypted, refresh_token_encrypted, access_token_expires_at")
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

  // Use the platform from the account row (authoritative) for all API calls.
  const accountPlatform = (account.platform as Platform) ?? platform;

  let accessToken: string;
  try {
    const accessEncrypted = Buffer.from(account.access_token_encrypted as string, "base64");
    const refreshRaw = account.refresh_token_encrypted as string | null;
    const refreshEncrypted = refreshRaw ? Buffer.from(refreshRaw, "base64") : null;
    accessToken = await ensureFreshToken({
      id: accountId,
      platform: accountPlatform as string,
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

  // Claim the comment atomically before calling the platform API so concurrent
  // workers cannot both execute the moderation action for the same comment.
  const claimPayload = {
    user_id: userId,
    account_id: accountId,
    platform: accountPlatform,
    comment_id: commentId,
    offender_id: authorId ?? null,
    action_taken: "pending",
    severity_score: severityScore,
    matched_red_line: matchedRedLine,
    using_aggressiveness: aggressiveness,
    platform_fallback: resolved.platformFallback,
  };

  let logId: string;

  const { data: claimRow, error: claimError } = await getSupabase()
    .from("shield_logs")
    .insert(claimPayload)
    .select("id")
    .single();

  if (claimError) {
    if ((claimError as { code?: string }).code !== "23505") {
      throw new Error(`Failed to claim shield_log: ${claimError.message}`);
    }

    // Another row exists. Inspect it to decide whether to skip or reclaim.
    const { data: existing } = await getSupabase()
      .from("shield_logs")
      .select("id, action_taken, created_at")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("platform", accountPlatform)
      .eq("comment_id", commentId)
      .maybeSingle();

    if (!existing) {
      // Very unlikely race: the conflicting row disappeared — just skip.
      log.warn("Conflict on claim but existing row not found, skipping", { commentId });
      return;
    }

    const existingAction = (existing as { action_taken: string }).action_taken;
    if (existingAction !== "pending") {
      // Already finalized by another worker; nothing to do.
      log.debug("Comment already processed, skipping", { commentId, existingAction });
      return;
    }

    // Row is still "pending". Check staleness.
    const claimedAt = new Date((existing as { created_at: string }).created_at).getTime();
    const isStale = Date.now() - claimedAt > RECLAIM_THRESHOLD_MS;
    if (!isStale) {
      log.debug("Comment claim is recent, another worker is processing it", { commentId });
      return;
    }

    // Stale "pending" — the original worker likely died. Reclaim with an
    // optimistic-lock on created_at to avoid a double-reclaim race.
    const { data: reclaimRow } = await getSupabase()
      .from("shield_logs")
      .update({ ...claimPayload, action_taken: "pending" })
      .eq("id", (existing as { id: string }).id)
      .eq("action_taken", "pending")
      .select("id")
      .maybeSingle();

    if (!reclaimRow) {
      // Another worker reclaimed it in the meantime.
      log.debug("Lost reclaim race, skipping", { commentId });
      return;
    }

    log.info("Reclaimed stale pending shield_log", { commentId });
    logId = (reclaimRow as { id: string }).id;
  } else {
    logId = (claimRow as { id: string }).id;
  }

  const actionsToTry = [resolved.primary, ...resolved.fallbacks];
  let actionTaken: string | null = null;
  let success = false;

  for (const action of actionsToTry) {
    if (action === "hide" || action === "strike1" || action === "strike1_silent") {
      const result = await hideComment(accountPlatform, accessToken, commentId);
      if (result.ok) {
        actionTaken = action;
        success = true;
        break;
      }
      log.warn("Hide failed, trying fallback", { error: result.error });
    } else if (action === "block") {
      if (!authorId) {
        log.warn("Skipping block action without authorId", { accountPlatform, commentId });
        continue;
      }
      const result = await blockUser(accountPlatform, accessToken, authorId, commentId);
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
        accountPlatform,
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
        p_platform: accountPlatform,
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
    platform: accountPlatform,
    commentId,
  });
}
