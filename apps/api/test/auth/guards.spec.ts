import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionContext, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { SupabaseAuthGuard } from "../../src/shared/guards/supabase-auth.guard";
import { RolesGuard } from "../../src/shared/guards/roles.guard";

const mockSupabaseFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockSupabaseFrom,
  }),
}));
function createMockContext(overrides: {
  headers?: Record<string, string>;
  user?: unknown;
} = {}): ExecutionContext {
  const request = {
    headers: overrides.headers ?? {},
    user: overrides.user,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("SupabaseAuthGuard", () => {
  let guard: SupabaseAuthGuard;
  let config: ConfigService;
  let reflector: Reflector;

  beforeEach(() => {
    config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === "SUPABASE_URL") return "https://test.supabase.co";
        if (key === "SUPABASE_ANON_KEY") return "test-anon-key";
        throw new Error(`Unknown config: ${key}`);
      }),
    } as unknown as ConfigService;

    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;

    guard = new SupabaseAuthGuard(config, reflector);
  });

  it("allows request when @Public() is set", async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);
    const ctx = createMockContext();
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("rejects when no Authorization header", async () => {
    const ctx = createMockContext({ headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects when Authorization does not start with Bearer", async () => {
    const ctx = createMockContext({
      headers: { authorization: "Basic xxx" },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let config: ConfigService;

  beforeEach(() => {
    vi.mocked(mockSupabaseFrom).mockReset();
    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === "SUPABASE_URL") return "https://test.supabase.co";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-key";
        throw new Error(`Unknown config: ${key}`);
      }),
    } as unknown as ConfigService;
    guard = new RolesGuard(config, reflector);
  });

  it("allows when no roles required", async () => {
    const ctx = createMockContext({ user: { id: "u1" } });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("allows when user role matches required", async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["user", "admin"]);
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { role: "user" } }),
        }),
      }),
    });
    const ctx = createMockContext({ user: { id: "u1" } });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it("denies when user role does not match", async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["admin"]);
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { role: "user" } }),
        }),
      }),
    });
    const ctx = createMockContext({ user: { id: "u1" } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it("denies when user has no role", async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(["admin"]);
    const ctx = createMockContext({ user: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
