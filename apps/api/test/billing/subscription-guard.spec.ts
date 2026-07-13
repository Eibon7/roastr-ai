import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SubscriptionGuard } from "../../src/shared/guards/subscription.guard";

const mockSupabaseFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

function createMockContext(overrides: { user?: unknown } = {}): ExecutionContext {
  const request = { user: overrides.user };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("SubscriptionGuard", () => {
  let guard: SubscriptionGuard;
  let config: ConfigService;

  beforeEach(() => {
    vi.mocked(mockSupabaseFrom).mockReset();
    config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === "SUPABASE_URL") return "https://test.supabase.co";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-key";
        throw new Error(`Unknown config: ${key}`);
      }),
    } as unknown as ConfigService;
    guard = new SubscriptionGuard(config);
  });

  it("throws ForbiddenException when there is no authenticated user in the request", async () => {
    const ctx = createMockContext({ user: undefined });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(mockSupabaseFrom).not.toHaveBeenCalled();
  });

  it.each(["trialing", "active", "payment_retry", "canceled_pending"])(
    "allows access when billing_state is %s",
    async (state) => {
      mockSupabaseFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { billing_state: state } }),
          }),
        }),
      });

      const ctx = createMockContext({ user: { id: "user-1" } });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    },
  );

  it("denies access with ForbiddenException when billing_state is paused (no active subscription)", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { billing_state: "paused" } }),
        }),
      }),
    });

    const ctx = createMockContext({ user: { id: "user-1" } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it("denies access with ForbiddenException when billing_state is expired_trial_pending_payment", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { billing_state: "expired_trial_pending_payment" } }),
        }),
      }),
    });

    const ctx = createMockContext({ user: { id: "user-1" } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
