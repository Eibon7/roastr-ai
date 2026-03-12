import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthController } from "../../src/modules/auth/auth.controller";

// Global fetch mock — replaced per-test as needed
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Supabase mock factory ───────────────────────────────────────────────────

type MockMethods = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  _resolve: (result: { data: unknown; error: unknown }) => void;
};

type MockChain = Promise<{ data: unknown; error: unknown }> & MockMethods;

function makeChain(defaultResult = { data: null as unknown, error: null as unknown }): MockChain {
  // Start from a real Promise so the chain is a true thenable — no manual
  // `.then` property needed, which avoids lint/noThenProperty violations.
  const chain = Promise.resolve(defaultResult) as unknown as MockChain;

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.gt = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(defaultResult));
  chain._resolve = () => {};

  return chain;
}

const adminDeleteUser = vi.fn();
const signInWithPassword = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((_url: string, key: string) => {
    // Service role key → admin client; anon key → anon client
    if (key === "service-key") {
      return {
        from: mockFrom,
        auth: {
          admin: { deleteUser: adminDeleteUser },
        },
      };
    }
    return {
      from: mockFrom,
      auth: {
        signInWithPassword,
      },
    };
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const defaults: Record<string, string> = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    SUPABASE_ANON_KEY: "anon-key",
  };
  return {
    getOrThrow: vi.fn((key: string) => overrides[key] ?? defaults[key] ?? ""),
  } as unknown as ConfigService;
}

function makeReq(userId = "user-123") {
  return { user: { id: userId } };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AuthController.deleteAccount", () => {
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: fetch succeeds (revocation ok)
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    controller = new AuthController(makeConfig());
  });

  it("throws 401 when no authenticated user", async () => {
    await expect(
      controller.deleteAccount({ user: undefined }, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws 400 when body is missing", async () => {
    await expect(
      controller.deleteAccount(makeReq(), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws 400 when password is empty", async () => {
    await expect(
      controller.deleteAccount(makeReq(), { password: "" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws 401 when password verification fails", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    mockFrom.mockReturnValue(profileChain);
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });

    await expect(
      controller.deleteAccount(makeReq(), { password: "wrong" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws 500 when profile lookup fails", async () => {
    const profileChain = makeChain({ data: null, error: { message: "db error" } });
    mockFrom.mockReturnValue(profileChain);

    await expect(
      controller.deleteAccount(makeReq(), { password: "pw" }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it("throws 500 when accounts query fails before revocation", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    const accountsErrorChain = makeChain({ data: null, error: { message: "network error" } });
    mockFrom
      .mockReturnValueOnce(profileChain)       // profiles lookup
      .mockReturnValueOnce(accountsErrorChain); // accounts select fails
    signInWithPassword.mockResolvedValue({ error: null });

    await expect(
      controller.deleteAccount(makeReq(), { password: "correct" }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it("throws 500 when OAuth token revocation fails (non-ok response)", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    const accountsChain = makeChain({
      data: [{ id: "acc-1", platform: "youtube", access_token: "tok" }],
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(profileChain)  // profiles lookup
      .mockReturnValueOnce(accountsChain); // accounts select
    signInWithPassword.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({ ok: false, status: 400 });

    await expect(
      controller.deleteAccount(makeReq(), { password: "correct" }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    // Cascade delete must NOT have been called — account data is preserved for retry
    expect(adminDeleteUser).not.toHaveBeenCalled();
  });

  it("throws 500 when a cascade delete fails", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    const accountsChain = makeChain({ data: [], error: null });
    const failChain = makeChain({ data: null, error: { message: "constraint violation" } });
    mockFrom
      .mockReturnValueOnce(profileChain)   // profiles lookup
      .mockReturnValueOnce(accountsChain)  // accounts select (no tokens to revoke)
      .mockReturnValueOnce(failChain);     // first cascade delete fails
    signInWithPassword.mockResolvedValue({ error: null });

    await expect(
      controller.deleteAccount(makeReq(), { password: "correct" }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it("throws 500 when auth.admin.deleteUser fails after successful deletion cascade", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    const accountsChain = makeChain({ data: [], error: null });
    mockFrom
      .mockReturnValueOnce(profileChain)   // profiles lookup
      .mockReturnValueOnce(accountsChain)  // accounts select (no tokens to revoke)
      .mockReturnValue(accountsChain);     // all cascade deletes succeed
    signInWithPassword.mockResolvedValue({ error: null });
    adminDeleteUser.mockResolvedValue({ error: { message: "delete failed" } });

    await expect(
      controller.deleteAccount(makeReq(), { password: "correct" }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it("completes deletion cascade and returns 204", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    const accountsChain = makeChain({ data: [], error: null });
    mockFrom
      .mockReturnValueOnce(profileChain)   // profiles lookup
      .mockReturnValueOnce(accountsChain)  // accounts select (no tokens to revoke)
      .mockReturnValue(accountsChain);     // all cascade deletes
    signInWithPassword.mockResolvedValue({ error: null });
    adminDeleteUser.mockResolvedValue({ error: null });

    await expect(
      controller.deleteAccount(makeReq(), { password: "correct" }),
    ).resolves.toBeUndefined();

    expect(adminDeleteUser).toHaveBeenCalledWith("user-123");
  });

  it("completes deletion cascade with successful YouTube token revocation", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    const accountsChain = makeChain({
      data: [{ id: "acc-1", platform: "youtube", access_token: "yt-tok" }],
      error: null,
    });
    const okChain = makeChain({ data: [], error: null });
    mockFrom
      .mockReturnValueOnce(profileChain)   // profiles lookup
      .mockReturnValueOnce(accountsChain)  // accounts select
      .mockReturnValue(okChain);           // all cascade deletes
    signInWithPassword.mockResolvedValue({ error: null });
    adminDeleteUser.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await expect(
      controller.deleteAccount(makeReq(), { password: "correct" }),
    ).resolves.toBeUndefined();

    // Google revocation must be a form-encoded POST (not raw URL interpolation)
    expect(mockFetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/revoke",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: "yt-tok" }).toString(),
      }),
    );
    expect(adminDeleteUser).toHaveBeenCalledWith("user-123");
  });
});
