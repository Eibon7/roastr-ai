import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Job } from "bullmq";

/**
 * Integration test chaining the three real processor functions that make up
 * the "ingestion -> analysis -> Shield" core flow:
 *   apps/worker/src/processors/ingestion.ts
 *     -> enqueues an "analyze" job on the analysis queue
 *   apps/worker/src/processors/analysis.ts
 *     -> classifies the comment (Perspective + Roastr Persona via the real
 *        @roastr/shared analysisReducer/thresholdRouter/score-normalizer)
 *        and, on a shield_* decision, enqueues a "shield-action" job
 *   apps/worker/src/processors/shield.ts
 *     -> resolves the concrete action (via the real resolveShieldAction) and
 *        executes it through the real action-executor.ts functions
 *
 * What is real here vs. mocked:
 * - Real: analysisReducer, thresholdRouter, score-normalizer, matchPersona,
 *   resolveShieldAction, platform-capabilities, and action-executor.ts
 *   (hideComment/blockUser/reportComment) — i.e. all the actual business
 *   logic that decides "is this toxic enough to block, and how".
 * - Mocked: Supabase (@supabase/supabase-js), BullMQ's Queue (so job data is
 *   captured instead of really going through Redis), token-refresh,
 *   billing-guard, persona-decrypt, roast-trigger, and global.fetch (the
 *   Perspective API call and the actual YouTube moderation HTTP call that
 *   action-executor.ts performs).
 *
 * Honest limitation: this does NOT exercise BullMQ/Redis at all — there is
 * no real worker consuming a real queue. Each processor is invoked directly
 * with the exact job payload the previous processor's mocked Queue.add/
 * addBulk call captured, which proves the three stages compose correctly at
 * the business-logic level (a real comment's data flowing end-to-end through
 * all three decisions), but says nothing about BullMQ wiring, retries, or
 * concurrency across the real queues. That infra-level behavior is already
 * covered per-processor by ingestion.spec.ts, analysis.spec.ts and
 * shield.spec.ts's dedicated retry/reclaim/DLQ test cases.
 */

const {
  mockCreateClient,
  tableState,
  accountsBuilder,
  offendersBuilder,
  profilesBuilder,
  shieldLogsTable,
  mockRpc,
  queueInstances,
  QueueMock,
  logSpies,
} = vi.hoisted(() => {
  type Result<T> = { data: T; error: { message: string; code?: string } | null };

  const tableState: {
    account: Result<Record<string, unknown> | null>;
    accountUpdate: Result<null>;
    offender: Result<Record<string, unknown> | null>;
    profile: Result<Record<string, unknown> | null>;
    shieldInsert: Result<{ id: string } | null>;
    shieldExisting: Result<Record<string, unknown> | null>;
    shieldUpdate: Result<null>;
  } = {
    account: { data: null, error: null },
    accountUpdate: { data: null, error: null },
    offender: { data: null, error: null },
    profile: { data: null, error: null },
    shieldInsert: { data: null, error: null },
    shieldExisting: { data: null, error: null },
    shieldUpdate: { data: null, error: null },
  };

  // accounts: supports select().eq().eq().maybeSingle() (ingestion/analysis/
  // shield all read from it) AND update({...}).eq().eq() as a thenable
  // (ingestion's cursor update).
  const accountsBuilder = {
    select: vi.fn(function selectFn() {
      return accountsBuilder;
    }),
    eq: vi.fn(function eqFn() {
      return accountsBuilder;
    }),
    update: vi.fn(function updateFn() {
      return accountsBuilder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(tableState.account)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(tableState.accountUpdate).then(resolve, reject),
  };

  const offendersBuilder = {
    select: vi.fn(function selectFn() {
      return offendersBuilder;
    }),
    eq: vi.fn(function eqFn() {
      return offendersBuilder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(tableState.offender)),
  };

  const profilesBuilder = {
    select: vi.fn(function selectFn() {
      return profilesBuilder;
    }),
    eq: vi.fn(function eqFn() {
      return profilesBuilder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(tableState.profile)),
  };

  function makeShieldUpdateBuilder(result: Result<unknown>) {
    const builder = {
      eq: vi.fn(() => builder),
      select: vi.fn(() => ({ maybeSingle: () => Promise.resolve(result) })),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  }

  const shieldLogsTable = {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve(tableState.shieldInsert)) })),
    })),
    select: vi.fn(() => {
      const b = {
        eq: vi.fn(() => b),
        maybeSingle: vi.fn(() => Promise.resolve(tableState.shieldExisting)),
      };
      return b;
    }),
    update: vi.fn(() => makeShieldUpdateBuilder(tableState.shieldUpdate)),
  };

  const mockRpc = vi.fn().mockResolvedValue({ error: null });

  const mockCreateClient = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "accounts") return accountsBuilder;
      if (table === "offenders") return offendersBuilder;
      if (table === "profiles") return profilesBuilder;
      if (table === "shield_logs") return shieldLogsTable;
      throw new Error(`Unexpected table in test: ${table}`);
    }),
    rpc: mockRpc,
  }));

  // Queue is instantiated once per queue *name* (QUEUE_NAMES.ANALYSIS from
  // ingestion.ts, QUEUE_NAMES.SHIELD from analysis.ts) — a real per-name
  // singleton map lets the test inspect exactly what each stage enqueued for
  // the next one, without any real BullMQ/Redis involved.
  const queueInstances: Record<
    string,
    { add: ReturnType<typeof vi.fn>; addBulk: ReturnType<typeof vi.fn> }
  > = {};
  const QueueMock = vi.fn((name: string) => {
    queueInstances[name] ??= {
      add: vi.fn().mockResolvedValue(undefined),
      addBulk: vi.fn().mockResolvedValue(undefined),
    };
    return queueInstances[name];
  });

  const logSpies = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };

  return {
    mockCreateClient,
    tableState,
    accountsBuilder,
    offendersBuilder,
    profilesBuilder,
    shieldLogsTable,
    mockRpc,
    queueInstances,
    QueueMock,
    logSpies,
  };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));
vi.mock("bullmq", () => ({ Queue: QueueMock }));
vi.mock("../src/shared/logger.js", () => ({ createJobLogger: () => logSpies }));

const mockCheckBillingLimits = vi.fn();
const mockTryConsumeAnalysisSlot = vi.fn();
vi.mock("../src/shared/billing-guard.js", () => ({
  checkBillingLimits: (...args: unknown[]) => mockCheckBillingLimits(...args),
  tryConsumeAnalysisSlot: (...args: unknown[]) => mockTryConsumeAnalysisSlot(...args),
}));

const mockEnsureFreshToken = vi.fn();
vi.mock("../src/shared/token-refresh.js", () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
  toBuffer: (v: unknown) => v,
  NoRefreshTokenError: class NoRefreshTokenError extends Error {},
}));

const mockFetchComments = vi.fn();
vi.mock("../src/shared/fetch-comments.js", () => ({
  fetchComments: (...args: unknown[]) => mockFetchComments(...args),
}));

const mockDecryptPersona = vi.fn();
vi.mock("../src/shared/persona-decrypt.js", () => ({
  decryptPersona: (...args: unknown[]) => mockDecryptPersona(...args),
}));

const mockTriggerAutoRoast = vi.fn();
vi.mock("../src/shared/roast-trigger.js", () => ({
  triggerAutoRoast: (...args: unknown[]) => mockTriggerAutoRoast(...args),
}));

// sanitize-text.ts and every @roastr/shared domain function (analysisReducer,
// thresholdRouter, score-normalizer, matchPersona, resolveShieldAction,
// platform-capabilities) are intentionally NOT mocked — this is the real
// business logic the pipeline is supposed to prove out end-to-end.

const { ingestionProcessor } = await import("../src/processors/ingestion.js");
const { analysisProcessor } = await import("../src/processors/analysis.js");
const { shieldProcessor } = await import("../src/processors/shield.js");

function makeJob(data: Record<string, unknown> | undefined, id = "job-1"): Job {
  return { id, data } as unknown as Job;
}

const USER_ID = "user-1";
const ACCOUNT_ID = "acc-1";

const ACCOUNT_ROW = {
  id: ACCOUNT_ID,
  user_id: USER_ID,
  platform: "youtube",
  status: "active",
  integration_health: "healthy",
  ingestion_cursor: null,
  access_token_encrypted: "enc-access",
  refresh_token_encrypted: "enc-refresh",
  access_token_expires_at: null,
  platform_user_id: "channel-123",
  shield_aggressiveness: 0.9,
  tone: "balanceado",
};

function perspectiveResponse(scores: Record<string, number>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      attributeScores: Object.fromEntries(
        Object.entries(scores).map(([k, v]) => [k, { summaryScore: { value: v } }]),
      ),
    }),
  };
}

describe("pipeline: ingestion -> analysis -> shield (bloqueo automático)", () => {
  const origEnv = process.env;
  const origFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = {
      ...origEnv,
      SUPABASE_URL: "http://test",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
      PERSPECTIVE_API_KEY: "persp-key",
    };
    delete process.env.OPENAI_API_KEY;

    vi.clearAllMocks();
    for (const name of Object.keys(queueInstances)) {
      queueInstances[name].add.mockClear().mockResolvedValue(undefined);
      queueInstances[name].addBulk.mockClear().mockResolvedValue(undefined);
    }

    tableState.account = { data: { ...ACCOUNT_ROW }, error: null };
    tableState.accountUpdate = { data: null, error: null };
    tableState.offender = { data: null, error: null };
    tableState.profile = { data: { roastr_persona_config: null }, error: null };
    tableState.shieldInsert = { data: { id: "shield-log-1" }, error: null };
    tableState.shieldExisting = { data: null, error: null };
    tableState.shieldUpdate = { data: null, error: null };

    mockCheckBillingLimits.mockResolvedValue({ allowed: true, remaining: 10 });
    mockTryConsumeAnalysisSlot.mockResolvedValue({ allowed: true, remaining: 5 });
    mockEnsureFreshToken.mockResolvedValue("fresh-access-token");
    mockDecryptPersona.mockReturnValue(null);
    mockTriggerAutoRoast.mockResolvedValue(undefined);

    mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("commentanalyzer.googleapis.com")) {
        // Highly toxic comment with an identity attack — thresholdRouter
        // forces "shield_critico" on any hasIdentityAttack, regardless of
        // score (see packages/shared/src/domain/threshold-router.ts).
        return perspectiveResponse({
          TOXICITY: 0.95,
          SEVERE_TOXICITY: 0.9,
          IDENTITY_ATTACK: 0.85,
          INSULT: 0,
          THREAT: 0,
        });
      }
      if (url.includes("youtube/v3/comments/setModerationStatus")) {
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      }
      throw new Error(`Unexpected fetch in pipeline test: ${url}`);
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = origEnv;
    globalThis.fetch = origFetch;
  });

  it("un comentario tóxico simulado en la ingestión termina bloqueado automáticamente por Shield", async () => {
    // --- Stage 1: ingestion ---
    // A single new toxic comment comes in from the platform API.
    mockFetchComments.mockResolvedValue({
      comments: [
        {
          id: "c1",
          userId: USER_ID,
          accountId: ACCOUNT_ID,
          platform: "youtube",
          text: "you are a disgusting subhuman",
          authorId: "author-1",
          timestamp: "2026-07-11T00:00:00Z",
        },
      ],
      nextCursor: "cursor-2",
      hasMore: false,
    });

    await ingestionProcessor(makeJob({ userId: USER_ID, accountId: ACCOUNT_ID, platform: "youtube" }, "ingest-1"));

    expect(mockFetchComments).toHaveBeenCalledTimes(1);
    expect(queueInstances.analysis.addBulk).toHaveBeenCalledTimes(1);

    const enqueuedAnalysisJobs = queueInstances.analysis.addBulk.mock.calls[0][0] as Array<{
      name: string;
      data: Record<string, unknown>;
    }>;
    expect(enqueuedAnalysisJobs).toHaveLength(1);
    expect(enqueuedAnalysisJobs[0]).toEqual(
      expect.objectContaining({
        name: "analyze",
        data: expect.objectContaining({
          commentId: "c1",
          userId: USER_ID,
          accountId: ACCOUNT_ID,
          platform: "youtube",
          authorId: "author-1",
        }),
      }),
    );
    // sanitizeCommentText ran for real — plain ASCII text passes through unchanged.
    expect(enqueuedAnalysisJobs[0].data.text).toBe("you are a disgusting subhuman");

    // The account's ingestion cursor really advances via the (mocked) DB call.
    expect(accountsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ ingestion_cursor: "cursor-2" }),
    );

    // --- Stage 2: analysis ---
    // Feed the exact job data ingestion enqueued into the real analysis
    // processor — this is what a real analysis worker consuming that BullMQ
    // job would have received.
    const analysisJobData = enqueuedAnalysisJobs[0].data;
    await analysisProcessor(makeJob(analysisJobData, "analyze-1"));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("commentanalyzer.googleapis.com"),
      expect.anything(),
    );
    expect(queueInstances.shield).toBeDefined();
    expect(queueInstances.shield.add).toHaveBeenCalledTimes(1);

    const [jobName, shieldPayload] = queueInstances.shield.add.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(jobName).toBe("shield-action");
    expect(shieldPayload).toEqual(
      expect.objectContaining({
        commentId: "c1",
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        platform: "youtube",
        authorId: "author-1",
        aggressiveness: 0.9,
        analysisResult: expect.objectContaining({
          decision: "shield_critico",
          flags: expect.objectContaining({ has_identity_attack: true }),
        }),
      }),
    );
    // The eligible_for_response/correctiva auto-roast path must NOT fire for
    // a shield decision.
    expect(mockTriggerAutoRoast).not.toHaveBeenCalled();

    // --- Stage 3: shield ---
    // Feed analysis's exact enqueued payload into the real shield processor.
    await shieldProcessor(makeJob(shieldPayload, "shield-1"));

    // resolveShieldAction (real) picks "report" as primary for a critical
    // decision on YouTube (canReport=true), but the real reportComment in
    // action-executor.ts has no native report endpoint implemented yet and
    // always falls back to hideComment — so the actual HTTP call and the
    // finalized action are both "hide". This is the real, current production
    // behavior, not a simplification made for this test.
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("youtube/v3/comments/setModerationStatus"),
      expect.objectContaining({ method: "POST" }),
    );

    // The comment was actually claimed and finalized in shield_logs.
    expect(shieldLogsTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: "c1", account_id: ACCOUNT_ID, action_taken: "pending" }),
    );
    const finalizeCall = shieldLogsTable.update.mock.calls.find(
      (call) => (call[0] as Record<string, unknown>).action_taken === "hide",
    );
    expect(finalizeCall).toBeDefined();

    // The offending author's strike count is incremented.
    expect(mockRpc).toHaveBeenCalledWith(
      "increment_offender_strike",
      expect.objectContaining({ p_user_id: USER_ID, p_account_id: ACCOUNT_ID, p_offender_id: "author-1" }),
    );

    expect(logSpies.info).toHaveBeenCalledWith(
      "Shield action completed",
      expect.objectContaining({ actionTaken: "hide", success: true }),
    );
  });

  it("un comentario benigno en la ingestión NO llega a encolar una acción de Shield", async () => {
    mockFetchComments.mockResolvedValue({
      comments: [
        {
          id: "c2",
          userId: USER_ID,
          accountId: ACCOUNT_ID,
          platform: "youtube",
          text: "great video, thanks!",
          authorId: "author-2",
          timestamp: "2026-07-11T00:00:00Z",
        },
      ],
      nextCursor: "cursor-3",
      hasMore: false,
    });
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("commentanalyzer.googleapis.com")) {
        return perspectiveResponse({
          TOXICITY: 0.02,
          SEVERE_TOXICITY: 0.01,
          IDENTITY_ATTACK: 0,
          INSULT: 0,
          THREAT: 0,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await ingestionProcessor(makeJob({ userId: USER_ID, accountId: ACCOUNT_ID, platform: "youtube" }, "ingest-2"));
    const analysisJobData = (
      queueInstances.analysis.addBulk.mock.calls[0][0] as Array<{ data: Record<string, unknown> }>
    )[0].data;

    await analysisProcessor(makeJob(analysisJobData, "analyze-2"));

    expect(logSpies.info).toHaveBeenCalledWith(
      "Analysis complete",
      expect.objectContaining({ decision: "no_action" }),
    );
    // No shield-action job was enqueued because no shield-worthy decision was made.
    // (analysis.ts's shield Queue instance is a module-level singleton shared
    // across tests in this file, so we assert on calls rather than existence.)
    expect(queueInstances.shield?.add).not.toHaveBeenCalled();
  });
});
