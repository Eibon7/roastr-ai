import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthController } from "../../src/modules/auth/auth.controller";

type MockMethods = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

type MockChain = Promise<{ data: unknown; error: unknown }> & MockMethods;

function makeChain(defaultResult = { data: null as unknown, error: null as unknown }): MockChain {
  const chain = Promise.resolve(defaultResult) as unknown as MockChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(defaultResult));
  return chain;
}

const adminCreateUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { createUser: adminCreateUser } },
  })),
}));

function makeConfig(): ConfigService {
  const defaults: Record<string, string> = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    SUPABASE_ANON_KEY: "anon-key",
  };
  return {
    getOrThrow: vi.fn((key: string) => defaults[key] ?? ""),
  } as unknown as ConfigService;
}

function makeReq(userId = "user-123") {
  return { user: { id: userId } };
}

describe("AuthController.register", () => {
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(makeConfig());
  });

  it("creates a user and returns its id", async () => {
    adminCreateUser.mockResolvedValue({ data: { user: { id: "new-user-1" } }, error: null });

    await expect(
      controller.register({ email: "Foo@Bar.com ", password: "s3cret" }),
    ).resolves.toEqual({ id: "new-user-1" });

    expect(adminCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "foo@bar.com", password: "s3cret", email_confirm: true }),
    );
  });

  it("returns a fixed placeholder id when the user already exists (by code)", async () => {
    adminCreateUser.mockResolvedValue({
      data: null,
      error: { code: "user_already_exists", message: "User already exists" },
    });

    await expect(
      controller.register({ email: "dup@test.com", password: "s3cret" }),
    ).resolves.toEqual({ id: "00000000-0000-0000-0000-000000000000" });
  });

  it("returns a fixed placeholder id when the error message says already registered", async () => {
    adminCreateUser.mockResolvedValue({
      data: null,
      error: { message: "Email already registered" },
    });

    await expect(
      controller.register({ email: "dup@test.com", password: "s3cret" }),
    ).resolves.toEqual({ id: "00000000-0000-0000-0000-000000000000" });
  });

  it("propagates any other Supabase error", async () => {
    const err = { message: "unexpected failure" };
    adminCreateUser.mockResolvedValue({ data: null, error: err });

    await expect(
      controller.register({ email: "x@test.com", password: "s3cret" }),
    ).rejects.toBe(err);
  });
});

describe("AuthController.getOnboarding", () => {
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(makeConfig());
  });

  it("throws 401 when no authenticated user", async () => {
    await expect(controller.getOnboarding({ user: undefined })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("throws 500 when Supabase errors while fetching the profile", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { code: "500" } }));

    await expect(controller.getOnboarding(makeReq())).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it("throws 404 when no profile row exists", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    await expect(controller.getOnboarding(makeReq())).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns the stored onboarding state", async () => {
    mockFrom.mockReturnValue(makeChain({ data: { onboarding_state: "persona_setup" }, error: null }));

    await expect(controller.getOnboarding(makeReq())).resolves.toEqual({
      state: "persona_setup",
    });
  });

  it("falls back to 'welcome' when the stored state is not a recognized value", async () => {
    mockFrom.mockReturnValue(makeChain({ data: { onboarding_state: "not_a_real_state" }, error: null }));

    await expect(controller.getOnboarding(makeReq())).resolves.toEqual({ state: "welcome" });
  });
});

describe("AuthController.setOnboarding", () => {
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(makeConfig());
  });

  it("throws 401 when no authenticated user", async () => {
    await expect(
      controller.setOnboarding({ user: undefined }, { state: "welcome" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws 400 when the state is not a recognized onboarding state", async () => {
    await expect(
      // @ts-expect-error testing runtime validation of an invalid state
      controller.setOnboarding(makeReq(), { state: "not_a_real_state" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws 400 when the body has no state field", async () => {
    await expect(
      // @ts-expect-error testing runtime validation of a missing state field
      controller.setOnboarding(makeReq(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws 500 when Supabase errors while updating the profile", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { code: "500" } }));

    await expect(
      controller.setOnboarding(makeReq(), { state: "select_plan" }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it("throws 404 when no matching profile row was updated", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

    await expect(
      controller.setOnboarding(makeReq(), { state: "select_plan" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates and returns the new onboarding state", async () => {
    mockFrom.mockReturnValue(makeChain({ data: { id: "user-123" }, error: null }));

    await expect(
      controller.setOnboarding(makeReq(), { state: "connect_accounts" }),
    ).resolves.toEqual({ state: "connect_accounts" });
  });
});
