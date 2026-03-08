import type { Job } from "bullmq";
import { Queue } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { createJobLogger } from "../shared/logger.js";
import {
  checkBillingLimits,
  incrementAnalysisUsed,
} from "../shared/billing-guard.js";
import {
  analysisReducer,
  normalizePerspectiveScores,
  normalizeBothFailed,
  normalizeFromLLM,
  matchPersona,
  FALLBACK_THRESHOLDS,
  FALLBACK_WEIGHTS,
} from "@roastr/shared";
import { decryptPersona } from "../shared/persona-decrypt.js";
import {
  getConnection,
  getQueuePrefix,
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
} from "../shared/queue.config.js";

const PERSPECTIVE_API_URL =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";
const ATTRIBUTES = [
  "TOXICITY",
  "SEVERE_TOXICITY",
  "IDENTITY_ATTACK",
  "INSULT",
  "THREAT",
];

let shieldQueue: Queue | null = null;

function getShieldQueue(): Queue {
  if (!shieldQueue) {
    shieldQueue = new Queue(QUEUE_NAMES.SHIELD, {
      connection: getConnection(),
      prefix: getQueuePrefix(),
    });
  }
  return shieldQueue;
}

async function callPerspective(text: string): Promise<ReturnType<typeof normalizePerspectiveScores> | ReturnType<typeof normalizeBothFailed>> {
  const apiKey = process.env.PERSPECTIVE_API_KEY;
  if (!apiKey) return normalizeBothFailed();

  const timeoutMs = Number(process.env.PERSPECTIVE_TIMEOUT_MS) || 3_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${PERSPECTIVE_API_URL}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: { text },
        requestedAttributes: Object.fromEntries(ATTRIBUTES.map((a) => [a, {}])),
        languages: ["es", "en"],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 429 || !res.ok) return normalizeBothFailed();

    const json = (await res.json()) as { attributeScores?: Record<string, { summaryScore?: { value?: number } }> };
    if (!json.attributeScores) return normalizeBothFailed();

    return normalizePerspectiveScores(json.attributeScores);
  } catch {
    clearTimeout(timeout);
    return normalizeBothFailed();
  }
}

async function callLLMFallback(text: string): Promise<ReturnType<typeof normalizeFromLLM> | ReturnType<typeof normalizeBothFailed>> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallbackEnabled = process.env.ENABLE_PERSPECTIVE_FALLBACK !== "false";
  if (!apiKey || !fallbackEnabled) return normalizeBothFailed();

  const timeoutMs = 5_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres un clasificador de toxicidad. Responde SOLO con un JSON válido: {\"score\": 0.0-1.0, \"hasIdentityAttack\": boolean, \"hasThreat\": boolean}. score=0 no tóxico, score=1 muy tóxico. hasIdentityAttack/hasThreat true si el texto ataca identidad o amenaza.",
          },
          { role: "user", content: text.slice(0, 2000) },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return normalizeBothFailed();

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return normalizeBothFailed();

    const parsed = JSON.parse(content) as { score?: number; hasIdentityAttack?: boolean; hasThreat?: boolean };
    const score = typeof parsed.score === "number" ? parsed.score : 0.5;
    return normalizeFromLLM({
      score,
      hasIdentityAttack: parsed.hasIdentityAttack,
      hasThreat: parsed.hasThreat,
    });
  } catch {
    clearTimeout(timeout);
    return normalizeBothFailed();
  }
}

export async function analysisProcessor(job: Job): Promise<void> {
  const log = createJobLogger("analysis", job.id ?? "unknown");
  const userId = job.data?.userId as string | undefined;
  const accountId = job.data?.accountId as string | undefined;
  const platform = job.data?.platform as string | undefined;
  const text = job.data?.text as string | undefined;
  const commentId = job.data?.commentId as string | undefined;
  const authorId = job.data?.authorId as string | undefined;

  if (!userId || !accountId || !platform || !text) {
    log.warn("Missing job data", { userId, accountId, platform });
    return;
  }

  const guard = await checkBillingLimits(userId);
  if (!guard.allowed) {
    if (guard.reason === "lookup_error") {
      throw new Error("Billing lookup failed, will retry");
    }
    log.debug("Skipping job: billing limit", { reason: guard.reason });
    return;
  }

  let normalized = await callPerspective(text);
  if (normalized.scoreSource === "both_failed") {
    normalized = await callLLMFallback(text);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("shield_aggressiveness")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Failed to fetch account config: ${accountError.message}`);
  }

  const aggressiveness = (account?.shield_aggressiveness as number) ?? 0.95;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("roastr_persona_config")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }

  const persona = decryptPersona(
    profile?.roastr_persona_config as Buffer | Uint8Array | null | undefined,
  );
  const personaMatches = matchPersona(text, persona);

  const { data: offenderRow, error: offenderError } = await supabase
    .from("offenders")
    .select("strike_level")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("offender_id", authorId ?? "")
    .maybeSingle();

  if (offenderError) {
    throw new Error(`Failed to fetch offender data: ${offenderError.message}`);
  }

  const mapStrikeLevel = (
    n: number,
  ): 0 | 1 | 2 | "critical" =>
    n >= 3 ? "critical" : (n as 0 | 1 | 2);

  const offender = offenderRow
    ? {
        strikeLevel: mapStrikeLevel(offenderRow.strike_level ?? 0),
        lastStrike: null as string | null,
      }
    : null;

  const result = analysisReducer({
    scoreBase: normalized.scoreBase,
    scoreSource: normalized.scoreSource,
    personaMatches,
    offender,
    thresholds: FALLBACK_THRESHOLDS,
    weights: FALLBACK_WEIGHTS,
    remainingAnalysis: guard.allowed ? guard.remaining : 0,
    insultDensity: normalized.insultDensity,
    hasIdentityAttack: normalized.hasIdentityAttack,
    hasThreat: normalized.hasThreat,
    hasInsultWithArgument: normalized.hasInsultWithArgument,
  });

  await incrementAnalysisUsed(userId);

  if (
    result.decision === "shield_moderado" ||
    result.decision === "shield_critico"
  ) {
    if (!commentId || !authorId) {
      log.warn("Skipping shield action: missing platform identifiers", {
        commentId,
        authorId,
        accountId,
        platform,
      });
    } else {
      const queue = getShieldQueue();
      await queue.add(
        "shield-action",
        {
          commentId,
          userId,
          accountId,
          platform,
          authorId,
          analysisResult: result,
          aggressiveness,
        },
        DEFAULT_JOB_OPTIONS,
      );
      log.debug("Enqueued shield action", {
        decision: result.decision,
        severity: result.severity_score,
      });
    }
  }

  log.info("Analysis complete", {
    decision: result.decision,
    scoreSource: result.score_source,
  });
}
