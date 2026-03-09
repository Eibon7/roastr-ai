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
        const body = await res.text().catch(() => "");
        return { ok: false, error: `YouTube setModerationStatus: ${res.status}${body ? ` — ${body.slice(0, 500)}` : ""}` };
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
        const body = await res.text().catch(() => "");
        return { ok: false, error: `X hide reply: ${res.status}${body ? ` — ${body.slice(0, 500)}` : ""}` };
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
        const body = await res.text().catch(() => "");
        return { ok: false, error: `YouTube banAuthor: ${res.status}${body ? ` — ${body.slice(0, 500)}` : ""}` };
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

export async function reportComment(
  platform: Platform,
  _accessToken: string,
  _commentId: string,
  _reason: ReportReason,
): Promise<ActionResult> {
  if (platform === "youtube") {
    // YouTube has no dedicated report API endpoint; signal fallback to caller
    return { ok: false, error: "reportComment fallback required for youtube" };
  }
  if (platform === "x") {
    return { ok: false, error: "X does not support report via API" };
  }
  return { ok: false, error: `reportComment not supported for ${platform}` };
}
