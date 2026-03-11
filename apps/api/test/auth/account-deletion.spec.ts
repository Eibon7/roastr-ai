import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthController } from "../../src/modules/auth/auth.controller";

// ─── Supabase mock factory ───────────────────────────────────────────────────

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise<unknown>;
  _resolve: (result: { data: unknown; error: unknown }) => void;
};

function makeChain(defaultResult = { data: null, error: null }): MockChain {
  const chain = {} as MockChain;

  // Make the chain itself thenable so `await chain` resolves to defaultResult
  chain.then = (onFulfilled, onRejected) =>
    Promise.resolve(defaultResult).then(onFulfilled, onRejected);

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
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
    controller = new AuthController(makeConfig());
  });

  it("throws 401 when no authenticated user", async () => {
    await expect(
      controller.deleteAccount({ user: undefined }, { password: "pw" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws 400 when password is missing", async () => {
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

  it("throws 500 when a cascade delete fails", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    const accountsChain = makeChain({ data: [], error: null });
    const failChain = makeChain({ data: null, error: { message: "constraint violation" } });
    mockFrom
      .mockReturnValueOnce(profileChain)  // profiles lookup
      .mockReturnValueOnce(accountsChain) // accounts select (OAuth revocation fetch)
      .mockReturnValueOnce(failChain);    // first cascade delete fails
    signInWithPassword.mockResolvedValue({ error: null });

    await expect(
      controller.deleteAccount(makeReq(), { password: "correct" }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it("throws 500 when auth.admin.deleteUser fails after successful deletion cascade", async () => {
    const profileChain = makeChain({ data: { email: "user@test.com" }, error: null });
    mockFrom.mockReturnValue(profileChain);
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
      .mockReturnValue(accountsChain);      // accounts select + all cascade deletes
    signInWithPassword.mockResolvedValue({ error: null });
    adminDeleteUser.mockResolvedValue({ error: null });

    await expect(
      controller.deleteAccount(makeReq(), { password: "correct" }),
    ).resolves.toBeUndefined();

    expect(adminDeleteUser).toHaveBeenCalledWith("user-123");
  });
});
