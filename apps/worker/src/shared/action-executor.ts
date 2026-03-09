import type { Platform, ReportReason } from "@roastr/shared";

export type ActionResult = { ok: boolean; error?: string };

const ACTION_TIMEOUT_MS = Number(process.env.ACTION_TIMEOUT_MS) || 10_000;

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Read up to 500 chars from a Response body for error messages. */
async function readErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return text.slice(0, 500);
}

export async function hideComment(
  platform: Platform,
  accessToken: string,
  commentId: string,
): Promise<ActionResult> {
  try {
    if (platform === "youtube") {
      const url = `https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=${encodeURIComponent(commentId)}&moderationStatus=rejected`;
      const res = await safeFetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await readErrorBody(res);
        return { ok: false, error: `YouTube setModerationStatus: ${res.status}${body ? ` — ${body}` : ""}` };
      }
      return { ok: true };
    }
    if (platform === "x") {
      const url = `https://api.x.com/2/tweets/${encodeURIComponent(commentId)}/hidden`;
      const res = await safeFetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hidden: true }),
      });
      if (!res.ok) {
        const body = await readErrorBody(res);
        return { ok: false, error: `X hide reply: ${res.status}${body ? ` — ${body}` : ""}` };
      }
      return { ok: true };
    }
    return { ok: false, error: `hideComment not supported for ${platform}` };
  } catch (e) {
    return { ok: false, error: `hideComment network error: ${(e as Error).message}` };
  }
}

/**
 * Block a user or author for the given platform.
 * `commentId` is only used for YouTube's banAuthor moderation endpoint.
 * X blocking requires Enterprise API access and is intentionally not supported.
 */
export async function blockUser(
  platform: Platform,
  accessToken: string,
  userId: string,
  commentId?: string,
): Promise<ActionResult> {
  try {
    if (platform === "youtube") {
      if (!commentId) {
        return { ok: false, error: "YouTube banAuthor requires a commentId" };
      }
      const url = `https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=${encodeURIComponent(commentId)}&moderationStatus=rejected&banAuthor=true`;
      const res = await safeFetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await readErrorBody(res);
        return { ok: false, error: `YouTube banAuthor: ${res.status}${body ? ` — ${body}` : ""}` };
      }
      return { ok: true };
    }
    if (platform === "x") {
      // X block requires Enterprise API access (POST /2/users/:id/blocking with OAuth2).
      // Regular OAuth2 Bearer tokens are not authorised for this endpoint.
      return { ok: false, error: "X blocking requires Enterprise API access" };
    }
    return { ok: false, error: `blockUser not supported for ${platform}` };
  } catch (e) {
    return { ok: false, error: `blockUser network error: ${(e as Error).message}` };
  }
}

/**
 * Attempt a platform-native comment report.
 *
 * Neither YouTube nor X currently exposes a public API endpoint for reporting
 * individual comments. When the platform has no native support, `onUnsupported`
 * is invoked as a caller-controlled fallback (e.g. `hideComment`) so the
 * executor can still take a meaningful action instead of silently failing.
 *
 * When platform support becomes available, add the fetch implementation in the
 * platform branch before calling `onUnsupported`.
 *
 * @param platform       - The social platform handling the report.
 * @param accessToken    - OAuth access token for the authenticated account.
 * @param commentId      - Platform-specific ID of the comment to report.
 * @param reason         - Abuse category to pass to the platform API.
 * @param onUnsupported  - Optional fallback invoked when the platform has no
 *                         native report API. Receives the same platform,
 *                         accessToken and commentId so the caller can delegate
 *                         to e.g. hideComment.
 */
export async function reportComment(
  platform: Platform,
  accessToken: string,
  commentId: string,
  _reason: ReportReason,
  onUnsupported?: (
    platform: Platform,
    accessToken: string,
    commentId: string,
  ) => Promise<ActionResult>,
): Promise<ActionResult> {
  const tryFallback = async (): Promise<ActionResult> => {
    if (!onUnsupported) {
      return { ok: false, error: `${platform}: no native report API; provide onUnsupported fallback` };
    }
    try {
      return await onUnsupported(platform, accessToken, commentId);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  };

  // TODO: add platform-specific report endpoints (YouTube, X, Reddit, etc.) here
  // when native APIs become available. Until then all platforms use the fallback.
  return tryFallback();
}
