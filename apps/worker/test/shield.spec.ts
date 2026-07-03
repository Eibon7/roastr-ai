import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Job } from "bullmq";

const {
  mockCreateClient,
  state,
  mockRpc,
  shieldLogsTable,
  accountsTable,
  logSpies,
} = vi.hoisted(() => {
  type Result<T> = { data: T; error: { message: string; code?: string } | null };

  const state = {
    accountResult: {
      data: {
        platform: "youtube",
        access_token_encrypted: Buffer.from("access").toString("base64"),
        refresh_token_encrypted: null,
        access_token_expires_at: null,
      },
      error: null,
    } as Result<unknown>,
    insertResult: { data: { id: "log-1" }, error: null } as Result<{ id: string } | null>,
    existingResult: { data: null, error: null } as Result<unknown>,
    updateQueue: [] as Array<Result<unknown>>,
    updateDefault: { data: null, error: null } as Result<unknown>,
  };

  function makeUpdateBuilder(result: Result<unknown>) {
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
      select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve(state.insertResult)) })),
    })),
    select: vi.fn(() => {
      const b = {
        eq: vi.fn(() => b),
        maybeSingle: vi.fn(() => Promise.resolve(state.existingResult)),
      };
      return b;
    }),
    update: vi.fn(() => makeUpdateBuilder(state.updateQueue.shift() ?? state.updateDefault)),
  };

  const accountsTable = {
    select: vi.fn(function selectFn() {
      return this;
    }),
    eq: vi.fn(function eqFn() {
      return this;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(state.accountResult)),
  };

  const mockRpc = vi.fn().mockResolvedValue({ error: null });

  const mockCreateClient = vi.fn(() => ({
    from: vi.fn((table: string) => (table === "shield_logs" ? shieldLogsTable : accountsTable)),
    rpc: mockRpc,
  }));

  const logSpies = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };

  return { mockCreateClient, state, mockRpc, shieldLogsTable, accountsTable, logSpies };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));
vi.mock("../src/shared/logger.js", () => ({ createJobLogger: () => logSpies }));

const mockEnsureFreshToken = vi.fn();
vi.mock("../src/shared/token-refresh.js", () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}));

const mockHideComment = vi.fn();
const mockBlockUser = vi.fn();
const mockReportComment = vi.fn();
vi.mock("../src/shared/action-executor.js", () => ({
  hideComment: (...args: unknown[]) => mockHideComment(...args),
  blockUser: (...args: unknown[]) => mockBlockUser(...args),
  reportComment: (...args: unknown[]) => mockReportComment(...args),
}));

const { shieldProcessor } = await import("../src/processors/shield.js");

function makeJob(data: Record<string, unknown> | undefined): Job {
  return { id: "job-1", data } as unknown as Job;
}

const MODERADO_RESULT = {
  decision: "shield_moderado",
  severity_score: 0.7,
  score_source: "perspective",
  flags: {
    has_identity_attack: false,
    has_threat: false,
    has_insult_with_argument: false,
    matched_red_lines: ["badword"],
    insult_density: 0,
  },
  adjustments: { persona_applied: false, persona_factor: 1, recurrence_factor: 1, severity_score_final: 0.7 },
};

const CRITICO_IDENTITY_RESULT = {
  ...MODERADO_RESULT,
  decision: "shield_critico",
  flags: { ...MODERADO_RESULT.flags, has_identity_attack: true },
};

const NO_ACTION_RESULT = {
  ...MODERADO_RESULT,
  decision: "no_action",
  severity_score: 0,
  flags: { ...MODERADO_RESULT.flags, matched_red_lines: [] },
};

const VALID_DATA = {
  userId: "user-1",
  accountId: "acc-1",
  platform: "youtube",
  commentId: "c1",
  authorId: "author-1",
  aggressiveness: 0.95,
  analysisResult: MODERADO_RESULT,
};

describe("shieldProcessor", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv, SUPABASE_URL: "http://test", SUPABASE_SERVICE_ROLE_KEY: "test-key" };
    vi.clearAllMocks();

    state.accountResult = {
      data: {
        platform: "youtube",
        access_token_encrypted: Buffer.from("access").toString("base64"),
        refresh_token_encrypted: null,
        access_token_expires_at: null,
      },
      error: null,
    };
    state.insertResult = { data: { id: "log-1" }, error: null };
    state.existingResult = { data: null, error: null };
    state.updateQueue = [];
    state.updateDefault = { data: null, error: null };

    mockEnsureFreshToken.mockResolvedValue("fresh-token");
    mockHideComment.mockResolvedValue({ ok: true });
    mockBlockUser.mockResolvedValue({ ok: true });
    mockReportComment.mockResolvedValue({ ok: true });
    mockRpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("no hace nada si falta un campo requerido del job", async () => {
    await shieldProcessor(makeJob({ userId: "user-1", accountId: "acc-1" }));
    expect(accountsTable.select).not.toHaveBeenCalled();
  });

  it("lanza si falla el fetch de la cuenta", async () => {
    state.accountResult = { data: null, error: { message: "db down" } };
    await expect(shieldProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "Failed to fetch account for shield action: db down",
    );
  });

  it("hace skip si la cuenta no tiene access token", async () => {
    state.accountResult = { data: { platform: "youtube", access_token_encrypted: null }, error: null };
    await expect(shieldProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(shieldLogsTable.insert).not.toHaveBeenCalled();
  });

  it("resolveShieldAction primary 'none' (no_action) no hace nada", async () => {
    await shieldProcessor(makeJob({ ...VALID_DATA, analysisResult: NO_ACTION_RESULT }));
    expect(mockEnsureFreshToken).not.toHaveBeenCalled();
    expect(shieldLogsTable.insert).not.toHaveBeenCalled();
  });

  it("lanza para reintento si falla el refresco del token", async () => {
    mockEnsureFreshToken.mockRejectedValue(new Error("decrypt failed"));
    await expect(shieldProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "Token unavailable, will retry",
    );
  });

  it("lanza si falla el claim (insert) del shield_log por un error que no es de conflicto", async () => {
    state.insertResult = { data: null, error: { message: "db error", code: "other" } };
    await expect(shieldProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "Failed to claim shield_log: db error",
    );
  });

  it("en conflicto de claim, si la fila existente no aparece hace skip", async () => {
    state.insertResult = { data: null, error: { message: "duplicate", code: "23505" } };
    state.existingResult = { data: null, error: null };
    await expect(shieldProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(logSpies.warn).toHaveBeenCalledWith(
      "Conflict on claim but existing row not found, skipping",
      expect.anything(),
    );
  });

  it("en conflicto de claim, si ya está finalizado hace skip", async () => {
    state.insertResult = { data: null, error: { message: "duplicate", code: "23505" } };
    state.existingResult = {
      data: { id: "log-2", action_taken: "hide", updated_at: new Date().toISOString() },
      error: null,
    };
    await expect(shieldProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(logSpies.debug).toHaveBeenCalledWith(
      "Comment already processed, skipping",
      expect.anything(),
    );
  });

  it("en conflicto de claim, si está pendiente y reciente hace skip", async () => {
    state.insertResult = { data: null, error: { message: "duplicate", code: "23505" } };
    state.existingResult = {
      data: { id: "log-2", action_taken: "pending", updated_at: new Date(Date.now() - 60_000).toISOString() },
      error: null,
    };
    await expect(shieldProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(logSpies.debug).toHaveBeenCalledWith(
      "Comment claim is recent, another worker is processing it",
      expect.anything(),
    );
  });

  it("en conflicto de claim, si está pendiente y obsoleto (stale) lo reclama y continúa", async () => {
    state.insertResult = { data: null, error: { message: "duplicate", code: "23505" } };
    state.existingResult = {
      data: { id: "log-2", action_taken: "pending", updated_at: new Date(Date.now() - 11 * 60_000).toISOString() },
      error: null,
    };
    state.updateQueue = [
      { data: { id: "log-2" }, error: null }, // reclaim
      { data: null, error: null }, // finalize
    ];

    await shieldProcessor(makeJob(VALID_DATA));

    expect(logSpies.info).toHaveBeenCalledWith(
      "Reclaimed stale pending shield_log",
      expect.objectContaining({ previousState: "pending" }),
    );
    expect(mockHideComment).toHaveBeenCalledTimes(1);
  });

  it("si pierde la carrera de reclamo (reclaimRow null) hace skip", async () => {
    state.insertResult = { data: null, error: { message: "duplicate", code: "23505" } };
    state.existingResult = {
      data: { id: "log-2", action_taken: "pending", updated_at: new Date(Date.now() - 11 * 60_000).toISOString() },
      error: null,
    };
    state.updateQueue = [{ data: null, error: null }]; // reclaim lost

    await expect(shieldProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(logSpies.debug).toHaveBeenCalledWith("Lost reclaim race, skipping", expect.anything());
    expect(mockHideComment).not.toHaveBeenCalled();
  });

  it("happy path: hide exitoso finaliza el log y suma un strike al offender", async () => {
    await shieldProcessor(makeJob(VALID_DATA));

    expect(mockHideComment).toHaveBeenCalledWith("youtube", "fresh-token", "c1");
    expect(mockRpc).toHaveBeenCalledWith(
      "increment_offender_strike",
      expect.objectContaining({ p_offender_id: "author-1" }),
    );
    expect(logSpies.info).toHaveBeenCalledWith(
      "Shield action completed",
      expect.objectContaining({ actionTaken: "hide", success: true }),
    );
  });

  it("si hide falla, hace fallback a block y tiene éxito", async () => {
    mockHideComment.mockResolvedValue({ ok: false, error: "hide boom" });

    await shieldProcessor(makeJob(VALID_DATA));

    expect(mockBlockUser).toHaveBeenCalledWith("youtube", "fresh-token", "author-1", "c1");
    expect(logSpies.info).toHaveBeenCalledWith(
      "Shield action completed",
      expect.objectContaining({ actionTaken: "block", success: true }),
    );
  });

  it("si todas las acciones fallan, libera el claim y lanza", async () => {
    mockHideComment.mockResolvedValue({ ok: false, error: "hide boom" });
    mockBlockUser.mockResolvedValue({ ok: false, error: "block boom" });

    await expect(shieldProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      /All shield actions failed for comment c1/,
    );

    const releaseCall = shieldLogsTable.update.mock.calls[0][0];
    expect(releaseCall).toEqual(expect.objectContaining({ action_taken: "failed" }));
  });

  it("si el primer intento de finalizar falla, reintenta y tiene éxito", async () => {
    state.updateQueue = [
      { data: null, error: { message: "transient" } },
      { data: null, error: null },
    ];

    await shieldProcessor(makeJob(VALID_DATA));

    expect(logSpies.warn).toHaveBeenCalledWith(
      "First attempt to finalize shield_log failed, retrying",
      expect.anything(),
    );
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("si ambos intentos de finalizar fallan, lanza", async () => {
    state.updateQueue = [
      { data: null, error: { message: "e1" } },
      { data: null, error: { message: "e2" } },
    ];

    await expect(shieldProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "Failed to finalize shield_log after retry: e2",
    );
  });

  it("sin authorId, se salta el fallback de block y el resultado final es fallo", async () => {
    mockReportComment.mockResolvedValue({ ok: false, error: "report boom" });
    mockHideComment.mockResolvedValue({ ok: false, error: "hide boom" });

    await expect(
      shieldProcessor(
        makeJob({ ...VALID_DATA, authorId: undefined, analysisResult: CRITICO_IDENTITY_RESULT }),
      ),
    ).rejects.toThrow(/All shield actions failed/);

    expect(mockBlockUser).not.toHaveBeenCalled();
    expect(logSpies.warn).toHaveBeenCalledWith(
      "Skipping block action without authorId",
      expect.anything(),
    );
  });

  it("cuando report cae al fallback de hide (plataforma sin soporte nativo), registra actionTaken 'hide'", async () => {
    mockReportComment.mockImplementation(
      async (
        platform: string,
        token: string,
        commentId: string,
        _reason: string,
        onUnsupported?: (p: string, t: string, c: string) => Promise<{ ok: boolean }>,
      ) => onUnsupported!(platform, token, commentId),
    );
    mockHideComment.mockResolvedValue({ ok: true });

    await shieldProcessor(makeJob({ ...VALID_DATA, analysisResult: CRITICO_IDENTITY_RESULT }));

    expect(logSpies.info).toHaveBeenCalledWith(
      "Shield action completed",
      expect.objectContaining({ actionTaken: "hide", success: true }),
    );
  });
});
