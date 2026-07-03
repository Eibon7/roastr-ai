import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Job } from "bullmq";

const { mockCreateClient, tableState, tableBuilders, mockQueueInstance, QueueMock, logSpies } =
  vi.hoisted(() => {
    type TableResult = { data: unknown; error: { message: string } | null };
    const tableState: Record<string, TableResult> = {
      accounts: { data: { shield_aggressiveness: 0.9 }, error: null },
      profiles: { data: { roastr_persona_config: null }, error: null },
      offenders: { data: null, error: null },
    };

    function makeBuilder(table: string) {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve(tableState[table])),
      };
      return builder;
    }

    const tableBuilders = {
      accounts: makeBuilder("accounts"),
      profiles: makeBuilder("profiles"),
      offenders: makeBuilder("offenders"),
    };

    const mockCreateClient = vi.fn(() => ({
      from: vi.fn((table: string) => tableBuilders[table as keyof typeof tableBuilders]),
    }));

    const mockQueueInstance = { add: vi.fn().mockResolvedValue(undefined) };
    const QueueMock = vi.fn(() => mockQueueInstance);

    const logSpies = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };

    return { mockCreateClient, tableState, tableBuilders, mockQueueInstance, QueueMock, logSpies };
  });

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));
vi.mock("bullmq", () => ({ Queue: QueueMock }));
vi.mock("../src/shared/logger.js", () => ({ createJobLogger: () => logSpies }));

const mockTryConsumeAnalysisSlot = vi.fn();
vi.mock("../src/shared/billing-guard.js", () => ({
  tryConsumeAnalysisSlot: (...args: unknown[]) => mockTryConsumeAnalysisSlot(...args),
}));

const mockDecryptPersona = vi.fn();
vi.mock("../src/shared/persona-decrypt.js", () => ({
  decryptPersona: (...args: unknown[]) => mockDecryptPersona(...args),
}));

const { analysisProcessor } = await import("../src/processors/analysis.js");

function makeJob(data: Record<string, unknown> | undefined): Job {
  return { id: "job-1", data } as unknown as Job;
}

const VALID_DATA = {
  userId: "user-1",
  accountId: "acc-1",
  platform: "youtube",
  text: "you are trash",
  commentId: "c1",
  authorId: "author-1",
  timestamp: "2026-01-01T00:00:00Z",
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

describe("analysisProcessor", () => {
  const origEnv = process.env;
  const origFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = {
      ...origEnv,
      SUPABASE_URL: "http://test",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
    };
    delete process.env.PERSPECTIVE_API_KEY;
    delete process.env.OPENAI_API_KEY;

    vi.clearAllMocks();

    tableState.accounts = { data: { shield_aggressiveness: 0.9 }, error: null };
    tableState.profiles = { data: { roastr_persona_config: null }, error: null };
    tableState.offenders = { data: null, error: null };

    mockTryConsumeAnalysisSlot.mockResolvedValue({ allowed: true, remaining: 5 });
    mockDecryptPersona.mockReturnValue(null);
    mockQueueInstance.add.mockResolvedValue(undefined);

    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = origEnv;
    globalThis.fetch = origFetch;
  });

  it("no hace nada si falta userId, accountId, platform o text", async () => {
    await analysisProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }));

    expect(mockTryConsumeAnalysisSlot).not.toHaveBeenCalled();
  });

  it("lanza si faltan credenciales de Supabase", async () => {
    delete process.env.SUPABASE_URL;

    await expect(analysisProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
    expect(mockTryConsumeAnalysisSlot).not.toHaveBeenCalled();
  });

  it("lanza para reintento si el guard de billing falla en el lookup", async () => {
    mockTryConsumeAnalysisSlot.mockResolvedValue({ allowed: false, reason: "lookup_error" });

    await expect(analysisProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "Billing lookup failed, will retry",
    );
    expect(tableBuilders.accounts.select).not.toHaveBeenCalled();
  });

  it("hace skip silencioso si se supera el límite de billing", async () => {
    mockTryConsumeAnalysisSlot.mockResolvedValue({ allowed: false, reason: "over_limit" });

    await expect(analysisProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(tableBuilders.accounts.select).not.toHaveBeenCalled();
  });

  it("lanza si falla la consulta de configuración de la cuenta", async () => {
    tableState.accounts = { data: null, error: { message: "db down" } };

    await expect(analysisProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "Failed to fetch account config: db down",
    );
  });

  it("lanza si falla la consulta del perfil", async () => {
    tableState.profiles = { data: null, error: { message: "db down" } };

    await expect(analysisProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "Failed to fetch profile: db down",
    );
  });

  it("lanza si falla la consulta del offender", async () => {
    tableState.offenders = { data: null, error: { message: "db down" } };

    await expect(analysisProcessor(makeJob(VALID_DATA))).rejects.toThrow(
      "Failed to fetch offender data: db down",
    );
  });

  it("cuando ambas fuentes de score fallan, aplica tau_shield por defecto y encola shield_moderado", async () => {
    await analysisProcessor(makeJob(VALID_DATA));

    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
    const [name, payload] = mockQueueInstance.add.mock.calls[0];
    expect(name).toBe("shield-action");
    expect(payload).toEqual(
      expect.objectContaining({
        commentId: "c1",
        aggressiveness: 0.9,
        analysisResult: expect.objectContaining({ decision: "shield_moderado" }),
      }),
    );
    expect(logSpies.info).toHaveBeenCalledWith(
      "Analysis complete",
      expect.objectContaining({ decision: "shield_moderado" }),
    );
  });

  it("sin commentId no encola la acción de shield, solo loggea warning", async () => {
    await analysisProcessor(makeJob({ ...VALID_DATA, commentId: undefined }));

    expect(mockQueueInstance.add).not.toHaveBeenCalled();
    expect(logSpies.warn).toHaveBeenCalledWith(
      "Skipping shield action: missing commentId",
      expect.anything(),
    );
  });

  it("Perspective con score bajo produce no_action y no encola shield", async () => {
    process.env.PERSPECTIVE_API_KEY = "persp-key";
    mockFetch.mockResolvedValue(
      perspectiveResponse({ TOXICITY: 0.1, SEVERE_TOXICITY: 0.05, IDENTITY_ATTACK: 0, INSULT: 0, THREAT: 0 }),
    );

    await analysisProcessor(makeJob(VALID_DATA));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockQueueInstance.add).not.toHaveBeenCalled();
    expect(logSpies.info).toHaveBeenCalledWith(
      "Analysis complete",
      expect.objectContaining({ decision: "no_action", scoreSource: "perspective" }),
    );
  });

  it("una coincidencia de red line en la persona escala la decisión a shield_moderado", async () => {
    process.env.PERSPECTIVE_API_KEY = "persp-key";
    mockFetch.mockResolvedValue(
      perspectiveResponse({ TOXICITY: 0.5, SEVERE_TOXICITY: 0.4, IDENTITY_ATTACK: 0, INSULT: 0, THREAT: 0 }),
    );
    mockDecryptPersona.mockReturnValue({ identities: [], redLines: ["trash"], tolerances: [] });

    await analysisProcessor(makeJob(VALID_DATA));

    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
    const [, payload] = mockQueueInstance.add.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({ analysisResult: expect.objectContaining({ decision: "shield_moderado" }) }),
    );
  });

  it("un offender con strike level crítico escala la decisión a shield_moderado", async () => {
    process.env.PERSPECTIVE_API_KEY = "persp-key";
    mockFetch.mockResolvedValue(
      perspectiveResponse({ TOXICITY: 0.4, SEVERE_TOXICITY: 0.3, IDENTITY_ATTACK: 0, INSULT: 0, THREAT: 0 }),
    );
    tableState.offenders = { data: { strike_level: 3 }, error: null };

    await analysisProcessor(makeJob(VALID_DATA));

    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
    const [, payload] = mockQueueInstance.add.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({ analysisResult: expect.objectContaining({ decision: "shield_moderado" }) }),
    );
  });

  it("el fallback de LLM con identity attack produce shield_critico", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ score: 0.9, hasIdentityAttack: true, hasThreat: false }),
            },
          },
        ],
      }),
    });

    await analysisProcessor(makeJob(VALID_DATA));

    expect(mockQueueInstance.add).toHaveBeenCalledTimes(1);
    const [, payload] = mockQueueInstance.add.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({
        analysisResult: expect.objectContaining({ decision: "shield_critico", score_source: "llm_fallback" }),
      }),
    );
  });

  it("Perspective devolviendo 429 se trata como fallo sin lanzar", async () => {
    process.env.PERSPECTIVE_API_KEY = "persp-key";
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });

    await expect(analysisProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(logSpies.info).toHaveBeenCalledWith(
      "Analysis complete",
      expect.objectContaining({ scoreSource: "both_failed" }),
    );
  });

  it("una excepción de red en Perspective se trata como fallo sin lanzar", async () => {
    process.env.PERSPECTIVE_API_KEY = "persp-key";
    mockFetch.mockRejectedValue(new Error("network down"));

    await expect(analysisProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(logSpies.info).toHaveBeenCalledWith(
      "Analysis complete",
      expect.objectContaining({ scoreSource: "both_failed" }),
    );
  });

  it("una respuesta de LLM sin choices se trata como fallo sin lanzar", async () => {
    process.env.OPENAI_API_KEY = "openai-key";
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });

    await expect(analysisProcessor(makeJob(VALID_DATA))).resolves.toBeUndefined();
    expect(logSpies.info).toHaveBeenCalledWith(
      "Analysis complete",
      expect.objectContaining({ scoreSource: "both_failed" }),
    );
  });
});
