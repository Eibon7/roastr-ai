const API_URL = process.env.API_URL || "http://localhost:3000";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

export type AutoGenerateRoastInput = {
  userId: string;
  commentId: string;
  commentText: string;
  severityScore: number;
  platform: string;
  accountId: string;
  tone: string;
};

/**
 * Triggers automatic roast generation via apps/api's internal endpoint.
 * Reuses RoastPipelineService (feature flags, auto-approve, style validation,
 * GDPR-safe persistence) instead of duplicating that logic in the worker.
 */
export async function triggerAutoRoast(input: AutoGenerateRoastInput): Promise<void> {
  if (!INTERNAL_API_SECRET) {
    throw new Error("INTERNAL_API_SECRET is required to trigger automatic roast generation");
  }

  const res = await fetch(`${API_URL}/internal/roast/auto-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": INTERNAL_API_SECRET,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Auto-generate roast failed: ${res.status} ${body}`);
  }
}
