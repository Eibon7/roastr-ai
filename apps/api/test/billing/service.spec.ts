import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { BillingService } from "../../src/modules/billing/billing.service";
import { BillingController } from "../../src/modules/billing/billing.controller";

const mockSupabaseFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockSupabaseFrom,
    rpc: mockRpc,
  }),
}));

function createConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    ...overrides,
  };
  return {
    get: vi.fn((key: string) => values[key]),
    getOrThrow: vi.fn((key: string) => {
      if (values[key] === undefined) throw new Error(`Unknown config: ${key}`);
      return values[key];
    }),
  } as unknown as ConfigService;
}

describe("BillingService", () => {
  let config: ConfigService;
  let service: BillingService;

  beforeEach(() => {
    vi.mocked(mockSupabaseFrom).mockReset();
    vi.mocked(mockRpc).mockReset();
    config = createConfig();
    service = new BillingService(config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getUsage", () => {
    it("returns the usage row when a subscription exists", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  plan: "pro",
                  billing_state: "active",
                  analysis_limit: 5000,
                  analysis_used: 120,
                  roasts_limit: 500,
                  roasts_used: 30,
                  current_period_end: "2026-08-01T00:00:00.000Z",
                  trial_end: null,
                },
                error: null,
              }),
          }),
        }),
      });

      const result = await service.getUsage("user-1");
      expect(result).toMatchObject({ plan: "pro", billing_state: "active", analysis_used: 120 });
    });

    it("returns null when the user has no subscription row (no plan/subscription yet)", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      });

      const result = await service.getUsage("user-1");
      expect(result).toBeNull();
    });

    it("throws when Supabase returns an error", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: { message: "connection refused" } }),
          }),
        }),
      });

      await expect(service.getUsage("user-1")).rejects.toThrow(
        "Failed to load billing usage: connection refused",
      );
    });
  });

  describe("createCheckoutUrl", () => {
    it("returns null when Polar is not configured (missing token/product id)", async () => {
      config = createConfig({
        POLAR_ACCESS_TOKEN: undefined,
        POLAR_PRODUCT_STARTER_ID: undefined,
      });
      service = new BillingService(config);

      const result = await service.createCheckoutUrl("user-1", "user@test.com", "starter");
      expect(result).toBeNull();
    });

    it("creates a checkout session and returns the url on success", async () => {
      config = createConfig({
        POLAR_ACCESS_TOKEN: "polar-token",
        POLAR_PRODUCT_STARTER_ID: "prod-starter",
      });
      service = new BillingService(config);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: "https://sandbox-checkout.polar.sh/abc" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await service.createCheckoutUrl("user-1", "user@test.com", "starter");
      expect(result).toEqual({ url: "https://sandbox-checkout.polar.sh/abc" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://sandbox-api.polar.sh/v1/checkouts/",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws when the Polar API responds with a non-ok HTTP status", async () => {
      config = createConfig({
        POLAR_ACCESS_TOKEN: "polar-token",
        POLAR_PRODUCT_STARTER_ID: "prod-starter",
      });
      service = new BillingService(config);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("invalid product"),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        service.createCheckoutUrl("user-1", "user@test.com", "starter"),
      ).rejects.toThrow("Polar checkout failed: invalid product");
    });

    it("throws when the Polar API is unreachable (network error / Polar down)", async () => {
      config = createConfig({
        POLAR_ACCESS_TOKEN: "polar-token",
        POLAR_PRODUCT_STARTER_ID: "prod-starter",
      });
      service = new BillingService(config);

      const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        service.createCheckoutUrl("user-1", "user@test.com", "starter"),
      ).rejects.toThrow("Polar checkout failed: ECONNREFUSED");
    });

    it("returns null when the plan has no configured product id", async () => {
      config = createConfig({
        POLAR_ACCESS_TOKEN: "polar-token",
        POLAR_PRODUCT_STARTER_ID: "prod-starter",
        POLAR_PRODUCT_PRO_ID: undefined,
      });
      service = new BillingService(config);

      const result = await service.createCheckoutUrl("user-1", "user@test.com", "pro");
      expect(result).toBeNull();
    });
  });

  describe("cancelSubscription", () => {
    function mockUsageRow(row: {
      billing_state: string;
      plan?: string;
      polar_subscription_id?: string | null;
    }) {
      mockSupabaseFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  plan: row.plan ?? "pro",
                  billing_state: row.billing_state,
                  polar_subscription_id:
                    row.polar_subscription_id === undefined ? "sub_123" : row.polar_subscription_id,
                },
                error: null,
              }),
          }),
        }),
      });
    }

    it("cancels an active subscription: calls Polar then applies the local transition to canceled_pending", async () => {
      config = createConfig({ POLAR_ACCESS_TOKEN: "polar-token" });
      service = new BillingService(config);
      mockUsageRow({ billing_state: "active", polar_subscription_id: "sub_123" });
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);
      mockRpc.mockResolvedValue({ data: "ok", error: null });

      const result = await service.cancelSubscription("user-1");

      expect(result).toEqual({ billing_state: "canceled_pending" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://sandbox-api.polar.sh/v1/subscriptions/sub_123",
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(mockRpc).toHaveBeenCalledWith("apply_billing_event", expect.objectContaining({
        p_user_id: "user-1",
        p_expected_state: "active",
        p_new_state: "canceled_pending",
      }));
    });

    it("cancels a trialing subscription without an active Polar subscription: skips the Polar call", async () => {
      mockUsageRow({ billing_state: "trialing", polar_subscription_id: null });
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      mockRpc.mockResolvedValue({ data: "ok", error: null });

      const result = await service.cancelSubscription("user-1");

      expect(result).toEqual({ billing_state: "paused" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws a ConflictException when there is no active subscription to cancel", async () => {
      mockUsageRow({ billing_state: "canceled_pending" });

      await expect(service.cancelSubscription("user-1")).rejects.toThrow(
        "No hay una suscripción activa que cancelar",
      );
    });

    it("throws when the Polar cancellation call fails, without mutating local state", async () => {
      config = createConfig({ POLAR_ACCESS_TOKEN: "polar-token" });
      service = new BillingService(config);
      mockUsageRow({ billing_state: "active", polar_subscription_id: "sub_123" });
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("not found") });
      vi.stubGlobal("fetch", fetchMock);

      await expect(service.cancelSubscription("user-1")).rejects.toThrow(
        "Polar cancellation failed: not found",
      );
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("retries on a CAS conflict and succeeds once the state stabilizes", async () => {
      config = createConfig({ POLAR_ACCESS_TOKEN: "polar-token" });
      service = new BillingService(config);
      mockUsageRow({ billing_state: "active", polar_subscription_id: "sub_123" });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
      mockRpc
        .mockResolvedValueOnce({ data: "conflict", error: null })
        .mockResolvedValueOnce({ data: "ok", error: null });

      const result = await service.cancelSubscription("user-1");

      expect(result).toEqual({ billing_state: "canceled_pending" });
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });
});

describe("BillingController", () => {
  let billingMock: {
    getUsage: ReturnType<typeof vi.fn>;
    createCheckoutUrl: ReturnType<typeof vi.fn>;
    cancelSubscription: ReturnType<typeof vi.fn>;
  };
  let controller: BillingController;

  beforeEach(() => {
    billingMock = {
      getUsage: vi.fn(),
      createCheckoutUrl: vi.fn(),
      cancelSubscription: vi.fn(),
    };
    controller = new BillingController(billingMock as never);
  });

  describe("getUsage", () => {
    it("returns the usage reported by the service", async () => {
      const usage = {
        plan: "pro",
        billing_state: "active",
        analysis_limit: 5000,
        analysis_used: 10,
        roasts_limit: 500,
        roasts_used: 5,
        current_period_end: null,
        trial_end: null,
      };
      billingMock.getUsage.mockResolvedValue(usage);

      const result = await controller.getUsage({ user: { id: "user-1" } });
      expect(result).toEqual(usage);
      expect(billingMock.getUsage).toHaveBeenCalledWith("user-1");
    });

    it("falls back to a default trialing starter plan when the user has no plan/subscription", async () => {
      billingMock.getUsage.mockResolvedValue(null);

      const result = await controller.getUsage({ user: { id: "user-1" } });
      expect(result).toMatchObject({
        plan: "starter",
        billing_state: "trialing",
        analysis_limit: 1000,
        analysis_used: 0,
        roasts_limit: 0,
      });
    });
  });

  describe("createCheckout", () => {
    it("creates a checkout url for the requested plan", async () => {
      billingMock.createCheckoutUrl.mockResolvedValue({ url: "https://checkout.example/abc" });

      const result = await controller.createCheckout(
        { plan: "pro" },
        { user: { id: "user-1", email: "user@test.com" } },
      );

      expect(result).toEqual({ url: "https://checkout.example/abc" });
      expect(billingMock.createCheckoutUrl).toHaveBeenCalledWith("user-1", "user@test.com", "pro");
    });

    it("defaults to the starter plan when no plan is provided in the body", async () => {
      billingMock.createCheckoutUrl.mockResolvedValue({ url: "https://checkout.example/xyz" });

      await controller.createCheckout({} as never, {
        user: { id: "user-1", email: "user@test.com" },
      });

      expect(billingMock.createCheckoutUrl).toHaveBeenCalledWith("user-1", "user@test.com", "starter");
    });

    it("throws when checkout is not configured (Polar not set up)", async () => {
      billingMock.createCheckoutUrl.mockResolvedValue(null);

      await expect(
        controller.createCheckout(
          { plan: "starter" },
          { user: { id: "user-1", email: "user@test.com" } },
        ),
      ).rejects.toThrow("Checkout not configured");
    });

    it("propagates errors thrown by the billing service (e.g. Polar API down)", async () => {
      billingMock.createCheckoutUrl.mockRejectedValue(new Error("Polar checkout failed: ECONNREFUSED"));

      await expect(
        controller.createCheckout(
          { plan: "starter" },
          { user: { id: "user-1", email: "user@test.com" } },
        ),
      ).rejects.toThrow("Polar checkout failed: ECONNREFUSED");
    });
  });

  describe("cancelSubscription", () => {
    it("cancels the caller's subscription and returns the resulting billing_state", async () => {
      billingMock.cancelSubscription.mockResolvedValue({ billing_state: "canceled_pending" });

      const result = await controller.cancelSubscription({ user: { id: "user-1" } });

      expect(result).toEqual({ billing_state: "canceled_pending" });
      expect(billingMock.cancelSubscription).toHaveBeenCalledWith("user-1");
    });

    it("propagates errors from the billing service (e.g. nothing to cancel)", async () => {
      billingMock.cancelSubscription.mockRejectedValue(
        new Error("No hay una suscripción activa que cancelar (estado actual: paused)."),
      );

      await expect(
        controller.cancelSubscription({ user: { id: "user-1" } }),
      ).rejects.toThrow("No hay una suscripción activa que cancelar");
    });
  });
});
