import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "http://test";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-key";

const { mockCreateClient, state, mockRpc } = vi.hoisted(() => {
  type Result<T> = { data: T; error: { message: string } | null };

  const state = {
    selectResult: { data: null, error: null } as Result<unknown>,
  };

  const builder = {
    select: vi.fn(function selectFn() {
      return this;
    }),
    eq: vi.fn(function eqFn() {
      return this;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(state.selectResult)),
  };

  const mockRpc = vi.fn();

  const mockCreateClient = vi.fn(() => ({
    from: vi.fn(() => builder),
    rpc: mockRpc,
  }));

  return { mockCreateClient, state, mockRpc };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));

const { checkBillingLimits, incrementAnalysisUsed, tryConsumeAnalysisSlot } = await import(
  "../src/shared/billing-guard.js"
);

describe("checkBillingLimits", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    vi.clearAllMocks();
    state.selectResult = { data: null, error: null };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("retorna lookup_error si falla la query", async () => {
    state.selectResult = { data: null, error: { message: "db down" } };

    const result = await checkBillingLimits("user-1");

    expect(result).toEqual({ allowed: false, reason: "lookup_error" });
  });

  it("retorna not_found si no hay fila de uso para el usuario", async () => {
    state.selectResult = { data: null, error: null };

    const result = await checkBillingLimits("user-1");

    expect(result).toEqual({ allowed: false, reason: "not_found" });
  });

  it("retorna paused si billing_state es paused", async () => {
    state.selectResult = {
      data: { billing_state: "paused", analysis_limit: 100, analysis_used: 0 },
      error: null,
    };

    const result = await checkBillingLimits("user-1");

    expect(result).toEqual({ allowed: false, reason: "paused" });
  });

  it("retorna inactive_subscription si billing_state es expired_trial_pending_payment (mismo estado que bloquea HTTP en SubscriptionGuard)", async () => {
    state.selectResult = {
      data: {
        billing_state: "expired_trial_pending_payment",
        analysis_limit: 100,
        analysis_used: 0,
      },
      error: null,
    };

    const result = await checkBillingLimits("user-1");

    expect(result).toEqual({ allowed: false, reason: "inactive_subscription" });
  });

  it.each(["trialing", "active", "payment_retry", "canceled_pending"])(
    "permite continuar cuando billing_state es %s (mismo set de estados activos que SubscriptionGuard)",
    async (billingState) => {
      state.selectResult = {
        data: { billing_state: billingState, analysis_limit: 10, analysis_used: 0 },
        error: null,
      };

      const result = await checkBillingLimits("user-1");

      expect(result).toEqual({ allowed: true, remaining: 10 });
    },
  );

  it("retorna over_limit si el uso alcanzó o superó el límite", async () => {
    state.selectResult = {
      data: { billing_state: "active", analysis_limit: 10, analysis_used: 10 },
      error: null,
    };

    const result = await checkBillingLimits("user-1");

    expect(result).toEqual({ allowed: false, reason: "over_limit" });
  });

  it("retorna allowed con el remaining correcto si hay cupo", async () => {
    state.selectResult = {
      data: { billing_state: "active", analysis_limit: 10, analysis_used: 3 },
      error: null,
    };

    const result = await checkBillingLimits("user-1");

    expect(result).toEqual({ allowed: true, remaining: 7 });
  });

  it("trata analysis_limit/analysis_used nulos como 0 (over_limit)", async () => {
    state.selectResult = {
      data: { billing_state: "active", analysis_limit: null, analysis_used: null },
      error: null,
    };

    const result = await checkBillingLimits("user-1");

    expect(result).toEqual({ allowed: false, reason: "over_limit" });
  });
});

describe("incrementAnalysisUsed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  it("llama al rpc increment_analysis_used con el userId", async () => {
    await incrementAnalysisUsed("user-1");

    expect(mockRpc).toHaveBeenCalledWith("increment_analysis_used", { p_user_id: "user-1" });
  });

  it("relanza el error si el rpc falla (para que BullMQ reintente)", async () => {
    mockRpc.mockResolvedValue({ error: { message: "db down" } });

    await expect(incrementAnalysisUsed("user-1")).rejects.toThrow(
      "Failed to increment analysis_used: db down",
    );
  });
});

describe("tryConsumeAnalysisSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lookup_error si falla la query de conteo/consumo", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "db down" } });

    const result = await tryConsumeAnalysisSlot("user-1", "job-1");

    expect(result).toEqual({ allowed: false, reason: "lookup_error" });
    expect(mockRpc).toHaveBeenCalledWith("try_consume_analysis_slot", {
      p_user_id: "user-1",
      p_job_id: "job-1",
    });
  });

  it("retorna el reason indicado cuando allowed es false y límite excedido", async () => {
    mockRpc.mockResolvedValue({ data: { allowed: false, reason: "over_limit" }, error: null });

    const result = await tryConsumeAnalysisSlot("user-1", "job-1");

    expect(result).toEqual({ allowed: false, reason: "over_limit" });
  });

  it("usa over_limit como reason por defecto si allowed es false sin reason", async () => {
    mockRpc.mockResolvedValue({ data: { allowed: false }, error: null });

    const result = await tryConsumeAnalysisSlot("user-1", "job-1");

    expect(result).toEqual({ allowed: false, reason: "over_limit" });
  });

  it("retorna allowed true con el remaining del rpc", async () => {
    mockRpc.mockResolvedValue({ data: { allowed: true, remaining: 4 }, error: null });

    const result = await tryConsumeAnalysisSlot("user-1", "job-1");

    expect(result).toEqual({ allowed: true, remaining: 4 });
  });

  it("usa 0 como remaining por defecto si allowed es true sin remaining", async () => {
    mockRpc.mockResolvedValue({ data: { allowed: true }, error: null });

    const result = await tryConsumeAnalysisSlot("user-1", "job-1");

    expect(result).toEqual({ allowed: true, remaining: 0 });
  });
});
