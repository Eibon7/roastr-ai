import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Job } from "bullmq";
import { hashIdentifier, isAnonymized } from "@roastr/shared";

type QueryResult = { data: unknown; error: { message: string } | null };

const { mockCreateClient, state } = vi.hoisted(() => {
  const state: {
    shieldLogsResult: QueryResult;
    roastCandidatesResult: QueryResult;
    accountsResult: QueryResult;
    offendersPageQueue: QueryResult[];
    offendersUpsertQueue: Array<{ error: { message: string } | null }>;
  } = {
    shieldLogsResult: { data: [], error: null },
    roastCandidatesResult: { data: [], error: null },
    accountsResult: { data: [], error: null },
    offendersPageQueue: [],
    offendersUpsertQueue: [],
  };

  function chainableDelete(getResult: () => QueryResult) {
    const b = {
      delete: vi.fn(() => b),
      lt: vi.fn(() => b),
      not: vi.fn(() => b),
      select: vi.fn(() => b),
      then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(getResult()).then(resolve, reject),
    };
    return b;
  }

  function chainablePage(getResult: () => QueryResult) {
    const b = {
      or: vi.fn(() => b),
      lt: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(getResult()).then(resolve, reject),
    };
    return b;
  }

  const mockFrom = vi.fn((table: string) => {
    if (table === "shield_logs") return chainableDelete(() => state.shieldLogsResult);
    if (table === "roast_candidates") return chainableDelete(() => state.roastCandidatesResult);
    if (table === "accounts") return chainableDelete(() => state.accountsResult);
    if (table === "offenders") {
      return {
        select: vi.fn(() =>
          chainablePage(() => state.offendersPageQueue.shift() ?? { data: [], error: null }),
        ),
        upsert: vi.fn(() =>
          Promise.resolve(state.offendersUpsertQueue.shift() ?? { error: null }),
        ),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  const mockCreateClient = vi.fn(() => ({ from: mockFrom }));

  return { mockCreateClient, state };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));

const logSpies = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
vi.mock("../src/shared/logger.js", () => ({ createJobLogger: () => logSpies }));

const { maintenanceProcessor } = await import("../src/processors/maintenance.js");

function makeJob(data: Record<string, unknown> | undefined): Job {
  return { id: "job-1", data } as unknown as Job;
}

const SECRET = "test-anonymize-secret";

describe("maintenanceProcessor", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...origEnv,
      SUPABASE_URL: "http://test",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
      ANONYMIZE_HMAC_KEY: SECRET,
    };
    vi.clearAllMocks();

    state.shieldLogsResult = { data: [], error: null };
    state.roastCandidatesResult = { data: [], error: null };
    state.accountsResult = { data: [], error: null };
    state.offendersPageQueue = [];
    state.offendersUpsertQueue = [];
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("hace skip si el job type no es gdpr_cleanup", async () => {
    await maintenanceProcessor(makeJob({ type: "other" }));

    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(logSpies.debug).toHaveBeenCalledWith("Unknown job type, skipping", { jobType: "other" });
  });

  it("usa gdpr_cleanup por defecto si no se especifica type", async () => {
    await maintenanceProcessor(makeJob({}));

    expect(mockCreateClient).toHaveBeenCalled();
  });

  it("lanza si faltan todas las variables de entorno requeridas", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANONYMIZE_HMAC_KEY;

    await expect(maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }))).rejects.toThrow(
      "Required environment variables missing: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANONYMIZE_HMAC_KEY",
    );
  });

  it("lanza mencionando solo la variable faltante", async () => {
    delete process.env.ANONYMIZE_HMAC_KEY;

    await expect(maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }))).rejects.toThrow(
      "Required environment variables missing: ANONYMIZE_HMAC_KEY",
    );
  });

  it("lanza y loggea error si falla el borrado de shield_logs", async () => {
    state.shieldLogsResult = { data: null, error: { message: "db down" } };

    await expect(maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }))).rejects.toThrow();
    expect(logSpies.error).toHaveBeenCalledWith("Failed to purge shield_logs", { error: "db down" });
  });

  it("lanza si falla el borrado de roast_candidates", async () => {
    state.roastCandidatesResult = { data: null, error: { message: "db down" } };

    await expect(maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }))).rejects.toThrow();
    expect(logSpies.error).toHaveBeenCalledWith("Failed to purge roast_candidates", { error: "db down" });
  });

  it("anonimiza offenders no anonimizados en una única página", async () => {
    state.offendersPageQueue = [
      {
        data: [{ id: "o1", offender_id: "raw-author-1", created_at: "2020-01-01T00:00:00.000Z" }],
        error: null,
      },
    ];
    state.offendersUpsertQueue = [{ error: null }];

    await maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }));

    expect(logSpies.info).toHaveBeenCalledWith(
      "GDPR cleanup completed",
      expect.objectContaining({ offendersAnonymized: 1 }),
    );
  });

  it("no reanonimiza offenders que ya están anonimizados", async () => {
    const alreadyAnon = hashIdentifier("someone", SECRET);
    expect(isAnonymized(alreadyAnon)).toBe(true);
    state.offendersPageQueue = [
      { data: [{ id: "o1", offender_id: alreadyAnon, created_at: "2020-01-01T00:00:00.000Z" }], error: null },
    ];

    await maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }));

    expect(logSpies.info).toHaveBeenCalledWith(
      "GDPR cleanup completed",
      expect.objectContaining({ offendersAnonymized: 0 }),
    );
  });

  it("pagina hasta que una página devuelve menos filas que PAGE_SIZE", async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => ({
      id: `o-${i}`,
      offender_id: `raw-${i}`,
      created_at: "2020-01-01T00:00:00.000Z",
    }));
    const lastPage = [{ id: "o-500", offender_id: "raw-500", created_at: "2020-01-02T00:00:00.000Z" }];
    state.offendersPageQueue = [
      { data: fullPage, error: null },
      { data: lastPage, error: null },
    ];
    state.offendersUpsertQueue = [{ error: null }, { error: null }];

    await maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }));

    expect(logSpies.info).toHaveBeenCalledWith(
      "GDPR cleanup completed",
      expect.objectContaining({ offendersAnonymized: 501 }),
    );
  });

  it("lanza si falla la consulta de una página de offenders", async () => {
    state.offendersPageQueue = [{ data: null, error: { message: "page failed" } }];

    await expect(maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }))).rejects.toBeTruthy();
    // pageErr is a plain object (not an Error instance), so the outer catch's
    // `err instanceof Error ? err.message : String(err)` falls back to String(err).
    expect(logSpies.error).toHaveBeenCalledWith(
      "GDPR cleanup failed",
      expect.objectContaining({ error: "[object Object]" }),
    );
  });

  it("lanza si falla el upsert de anonimización", async () => {
    state.offendersPageQueue = [
      { data: [{ id: "o1", offender_id: "raw-author-1", created_at: "2020-01-01T00:00:00.000Z" }], error: null },
    ];
    state.offendersUpsertQueue = [{ error: { message: "upsert failed" } }];

    await expect(maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }))).rejects.toThrow();
  });

  it("lanza y loggea error si falla la purga de cuentas expiradas", async () => {
    state.accountsResult = { data: null, error: { message: "db down" } };

    await expect(maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }))).rejects.toThrow();
    expect(logSpies.error).toHaveBeenCalledWith("Failed to purge expired accounts", { error: "db down" });
  });

  it("happy path completo: loggea el resumen final con los 4 contadores", async () => {
    state.shieldLogsResult = { data: [{ id: "s1" }, { id: "s2" }], error: null };
    state.roastCandidatesResult = { data: [{ id: "r1" }], error: null };
    state.accountsResult = { data: [{ id: "a1" }], error: null };

    await maintenanceProcessor(makeJob({ type: "gdpr_cleanup" }));

    expect(logSpies.info).toHaveBeenCalledWith("GDPR cleanup completed", {
      shieldLogsDeleted: 2,
      roastCandidatesDeleted: 1,
      offendersAnonymized: 0,
      accountsPurged: 1,
    });
  });
});
