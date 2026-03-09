import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { createJobLogger } from "../shared/logger.js";
import { checkBillingLimits } from "../shared/billing-guard.js";
import { ensureFreshToken, toBuffer } from "../shared/token-refresh.js";
import { fetchComments } from "../shared/fetch-comments.js";
import { sanitizeCommentText } from "../shared/sanitize-text.js";
import {
  getConnection,
  getQueuePrefix,
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
} from "../shared/queue.config.js";
import type { NormalizedComment } from "@roastr/shared";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
const supabase = createClient(supabaseUrl, supabaseKey);

let analysisQueue: Queue | null = null;

function getAnalysisQueue(): Queue {
  if (!analysisQueue) {
    analysisQueue = new Queue(QUEUE_NAMES.ANALYSIS, {
      connection: getConnection(),
      prefix: getQueuePrefix(),
    });
  }
  return analysisQueue;
}

export async function ingestionProcessor(job: Job): Promise<void> {
  const log = createJobLogger("ingestion", job.id ?? "unknown");
  const userId = job.data?.userId as string | undefined;
  const accountId = job.data?.accountId as string | undefined;
  const platform = job.data?.platform as string | undefined;

  if (!userId || !accountId || !platform) {
    log.warn("Missing job data", { userId, accountId, platform });
    return;
  }

  const guard = await checkBillingLimits(userId);
  if (!guard.allowed) {
    if (guard.reason === "lookup_error") {
      throw new Error("Billing lookup failed, will retry");
    }
    log.debug("Skipping job: billing limit", { userId, reason: guard.reason });
    return;
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select(
      "id, user_id, platform, status, integration_health, ingestion_cursor, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, platform_user_id",
    )
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (accountError) {
    log.error("Account lookup failed", {
      accountId,
      error: accountError.message,
    });
    throw new Error("Account lookup failed, will retry");
  }

  if (!account) {
    log.warn("Account not found", { accountId });
    return;
  }

  if (account.status !== "active") {
    log.debug("Skipping: account not active", { status: account.status });
    return;
  }

  if (account.integration_health === "frozen") {
    log.debug("Skipping: integration frozen");
    return;
  }

  if (!account.access_token_encrypted) {
    log.warn("Account has no access token");
    return;
  }

  // Use the persisted platform from the account row, not the job payload
  const accountPlatform = account.platform as "youtube" | "x";

  let accessToken: string;
  try {
    const accessRaw = account.access_token_encrypted as string | Buffer;
    const refreshRaw = account.refresh_token_encrypted as string | Buffer | null;
    accessToken = await ensureFreshToken({
      id: account.id as string,
      platform: accountPlatform,
      access_token_encrypted: typeof accessRaw === "string" ? Buffer.from(accessRaw, "base64") : toBuffer(accessRaw),
      refresh_token_encrypted: refreshRaw
        ? (typeof refreshRaw === "string" ? Buffer.from(refreshRaw, "base64") : toBuffer(refreshRaw))
        : null,
      access_token_expires_at: (account.access_token_expires_at as string | null) ?? null,
    });
  } catch (e) {
    log.error("Token refresh/decryption failed", { error: (e as Error).message });
    throw new Error("Token unavailable, will retry");
  }

  const cursor = (account.ingestion_cursor as string | null) ?? null;
  const channelId = account.platform_user_id as string;

  let page: Awaited<ReturnType<typeof fetchComments>>;
  try {
    page = await fetchComments({
      platform: accountPlatform,
      accessToken,
      accountId,
      userId,
      channelId,
      cursor,
    });
  } catch (e) {
    log.error("Fetch comments failed", { error: (e as Error).message });
    throw e;
  }

  const queue = getAnalysisQueue();
  const sanitized: NormalizedComment[] = page.comments.map((c) => ({
    ...c,
    text: sanitizeCommentText(c.text),
  }));

  if (sanitized.length > 0) {
    await queue.addBulk(
      sanitized.map((comment) => ({
        name: "analyze",
        data: {
          commentId: comment.id,
          userId: comment.userId,
          accountId: comment.accountId,
          platform: comment.platform,
          text: comment.text,
          authorId: comment.authorId,
          timestamp: comment.timestamp,
        },
        opts: {
          ...DEFAULT_JOB_OPTIONS,
          // Stable jobId prevents duplicate analysis jobs on ingestion retry
          jobId: `analysis_${comment.platform}_${comment.accountId}_${comment.id}`,
        },
      })),
    );
  }

  const nextCursor = page.nextCursor;
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("accounts")
    .update({
      ingestion_cursor: nextCursor,
      last_successful_ingestion: now,
      consecutive_errors: 0,
      updated_at: now,
    })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (updateError) {
    log.error("Failed to update cursor", { error: updateError.message });
    throw new Error("Cursor update failed, will retry");
  }

  log.info("Ingestion complete", {
    commentsEnqueued: sanitized.length,
    nextCursor: nextCursor ?? "none",
  });
}
