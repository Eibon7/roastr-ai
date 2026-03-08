import type { Platform, ReportReason } from "@roastr/shared";

export type ActionResult = { ok: boolean; error?: string };

export async function hideComment(
  platform: Platform,
  accessToken: string,
  commentId: string,
): Promise<ActionResult> {
  if (platform === "youtube") {
    const url = `https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=${encodeURIComponent(commentId)}&moderationStatus=rejected`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `YouTube setModerationStatus: ${res.status} ${err}` };
    }
    return { ok: true };
  }
  if (platform === "x") {
    const url = `https://api.x.com/2/tweets/${encodeURIComponent(commentId)}/hidden`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hidden: true }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `X hide reply: ${res.status} ${err}` };
    }
    return { ok: true };
  }
  return { ok: false, error: `hideComment not supported for ${platform}` };
}

export async function blockUser(
  platform: Platform,
  accessToken: string,
  userId: string,
  commentId: string,
): Promise<ActionResult> {
  if (platform === "youtube") {
    const url = `https://www.googleapis.com/youtube/v3/comments/setModerationStatus?id=${encodeURIComponent(commentId)}&moderationStatus=rejected&banAuthor=true`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `YouTube banAuthor: ${res.status} ${err}` };
    }
    return { ok: true };
  }
  if (platform === "x") {
    const url = "https://api.x.com/2/users/me/blocking";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target_user_id: userId }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `X block: ${res.status} ${err}` };
    }
    return { ok: true };
  }
  return { ok: false, error: `blockUser not supported for ${platform}` };
}

export async function reportComment(
  platform: Platform,
  accessToken: string,
  commentId: string,
  _reason: ReportReason,
): Promise<ActionResult> {
  if (platform === "youtube") {
    return hideComment(platform, accessToken, commentId);
  }
  if (platform === "x") {
    return { ok: false, error: "X does not support report via API" };
  }
  return { ok: false, error: `reportComment not supported for ${platform}` };
}
