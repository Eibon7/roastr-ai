import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import type { Queue } from "bullmq";
import { OAuthService } from "../../src/modules/oauth/oauth.service";
import { TokenEncryptionService } from "../../src/shared/crypto/token-encryption.service";

const TOKEN_ENCRYPTION_KEY = "test-only-encryption-key-32chars!";

const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_ME_URL = "https://api.x.com/2/users/me";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

const mockFetch = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function textResponse(body: string, status: number) {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => {
      throw new Error("json() should not be called on an error response");
    },
  } as Response;
}

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  const defaults: Record<string, string> = {
    YOUTUBE_CLIENT_ID: "yt-client-id",
    YOUTUBE_CLIENT_SECRET: "yt-client-secret",
    YOUTUBE_REDIRECT_URI: "https://app.test/oauth/youtube/callback",
    X_CLIENT_ID: "x-client-id",
    X_CLIENT_SECRET: "x-client-secret",
    X_REDIRECT_URI: "https://app.test/oauth/x/callback",
    TOKEN_ENCRYPTION_KEY,
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
  };
  const map: Record<string, string | undefined> = { ...defaults, ...overrides };
  return {
    get: vi.fn((key: string) => map[key]),
    getOrThrow: vi.fn((key: string) => {
      if (map[key] === undefined) {
        throw new Error(`Missing config: ${key}`);
      }
      return map[key];
    }),
  } as unknown as ConfigService;
}

/** Build a Supabase chain that resolves to `result` and is also chainable
 * (select/eq return itself), plus a separate upsert().select().single() path. */
function makeChain(
  result: { data: unknown; error: unknown; count?: number },
  upsertResult: { data: unknown; error: unknown } = { data: { id: "acc-1" }, error: null },
) {
  const chain = Promise.resolve(result) as unknown as Record<string, unknown> &
    Promise<typeof result>;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.upsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(upsertResult),
    }),
  });
  return chain;
}

function setupSupabase(
  opts: {
    plan?: string | null;
    accountCount?: number;
    upsertResult?: { data: unknown; error: unknown };
  } = {},
) {
  const { plan = null, accountCount = 0, upsertResult = { data: { id: "acc-1" }, error: null } } =
    opts;
  mockFrom.mockImplementation((table: string) => {
    if (table === "subscriptions_usage") {
      return makeChain({ data: plan ? { plan } : null, error: null });
    }
    return makeChain({ data: null, error: null, count: accountCount }, upsertResult);
  });
}

function signState(payloadB64: string, secret = TOKEN_ENCRYPTION_KEY) {
  return createHmac("sha256", secret).update(payloadB64).digest("hex").slice(0, 16);
}

function buildState(
  payload: Record<string, unknown>,
  opts: { secret?: string; corruptSig?: boolean } = {},
): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = opts.corruptSig ? "0".repeat(16) : signState(payloadB64, opts.secret);
  return `${payloadB64}.${sig}`;
}

function mockYouTubeProviderSuccess(overrides: Partial<Record<string, unknown>> = {}) {
  mockFetch.mockImplementation(async (url: string | URL) => {
    const u = url.toString();
    if (u === GOOGLE_TOKEN_URL) {
      return jsonResponse({
        access_token: "yt-access-token",
        refresh_token: "yt-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        ...overrides,
      });
    }
    if (u === YOUTUBE_CHANNELS_URL) {
      return jsonResponse({ items: [{ id: "channel-1", snippet: { title: "My Channel" } }] });
    }
    throw new Error(`Unexpected fetch to ${u}`);
  });
}

function mockXProviderSuccess(overrides: Partial<Record<string, unknown>> = {}) {
  mockFetch.mockImplementation(async (url: string | URL) => {
    const u = url.toString();
    if (u === X_TOKEN_URL) {
      return jsonResponse({
        token_type: "bearer",
        expires_in: 7200,
        access_token: "x-access-token",
        refresh_token: "x-refresh-token",
        ...overrides,
      });
    }
    if (u === X_ME_URL) {
      return jsonResponse({ data: { id: "x-user-1", name: "Test", username: "handle" } });
    }
    throw new Error(`Unexpected fetch to ${u}`);
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// ingestionQueue is property-injected (@Inject on the field, not the
// constructor) — see oauth.service.ts for why. Plain `new` doesn't run
// Nest's property injection, so tests must assign it manually.
function makeService(cfg: ConfigService, queue: Queue): OAuthService {
  const svc = new OAuthService(cfg, new TokenEncryptionService(cfg));
  (svc as unknown as { ingestionQueue: Queue }).ingestionQueue = queue;
  return svc;
}

describe("OAuthService", () => {
  let config: ConfigService;
  let service: OAuthService;
  let mockQueue: Queue;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    config = makeConfig();
    mockQueue = { add: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
    service = makeService(config, mockQueue);
    setupSupabase();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── YouTube: authorize URL ────────────────────────────────────────────

  describe("getYouTubeAuthorizeUrl", () => {
    it("throws BadRequestException when YouTube OAuth is not configured", () => {
      const unconfigured = makeConfig({ YOUTUBE_CLIENT_ID: undefined });
      const svc = makeService(unconfigured, mockQueue);
      expect(() => svc.getYouTubeAuthorizeUrl("user-1")).toThrow(BadRequestException);
      expect(() => svc.getYouTubeAuthorizeUrl("user-1")).toThrow(
        "YouTube OAuth is not configured",
      );
    });

    it("generates a valid authorize URL with a signed, decodable state", () => {
      const { url, state } = service.getYouTubeAuthorizeUrl("user-123");

      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url).toContain(`state=${encodeURIComponent(state)}`);

      const [payloadB64, sig] = state.split(".");
      expect(sig).toHaveLength(16);
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
      expect(payload.userId).toBe("user-123");
      expect(typeof payload.nonce).toBe("string");
      expect(payload.exp).toBeGreaterThan(Date.now());
    });
  });

  // ─── YouTube: callback ──────────────────────────────────────────────────

  describe("handleYouTubeCallback", () => {
    it("throws BadRequestException when YouTube OAuth is not configured", async () => {
      const unconfigured = makeConfig({ YOUTUBE_CLIENT_SECRET: undefined });
      const svc = makeService(unconfigured, mockQueue);
      await expect(svc.handleYouTubeCallback("code", "any.state")).rejects.toThrow(
        "YouTube OAuth is not configured",
      );
    });

    it("throws BadRequestException when state has no signature separator", async () => {
      await expect(service.handleYouTubeCallback("code", "no-dot-here")).rejects.toThrow(
        "Invalid state",
      );
    });

    it("throws BadRequestException when state is an empty string", async () => {
      await expect(service.handleYouTubeCallback("code", "")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException when the state signature does not match (tampered state)", async () => {
      const state = buildState(
        { userId: "user-1", nonce: "n", exp: Date.now() + 60_000 },
        { corruptSig: true },
      );
      await expect(service.handleYouTubeCallback("code", state)).rejects.toThrow(
        "Invalid state signature",
      );
    });

    it("throws BadRequestException when the state was signed with a different secret", async () => {
      const state = buildState(
        { userId: "user-1", nonce: "n", exp: Date.now() + 60_000 },
        { secret: "a-completely-different-secret" },
      );
      await expect(service.handleYouTubeCallback("code", state)).rejects.toThrow(
        "Invalid state signature",
      );
    });

    it("throws BadRequestException when the state payload is not valid JSON", async () => {
      const payloadB64 = Buffer.from("not json at all", "utf8").toString("base64url");
      const sig = signState(payloadB64);
      await expect(
        service.handleYouTubeCallback("code", `${payloadB64}.${sig}`),
      ).rejects.toThrow("Invalid or expired state");
    });

    it("throws BadRequestException when the state has expired", async () => {
      const state = buildState({
        userId: "user-1",
        nonce: "n",
        exp: Date.now() - 1_000,
      });
      await expect(service.handleYouTubeCallback("code", state)).rejects.toThrow(
        "Invalid or expired state",
      );
    });

    it("throws BadRequestException when the state is missing a userId", async () => {
      const state = buildState({ nonce: "n", exp: Date.now() + 60_000 });
      await expect(service.handleYouTubeCallback("code", state)).rejects.toThrow(
        "Invalid or expired state",
      );
    });

    it("exchanges the code, persists the account and returns the accountId (happy path)", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockYouTubeProviderSuccess();
      setupSupabase({ plan: "starter", accountCount: 0, upsertResult: { data: { id: "acc-42" }, error: null } });

      const result = await service.handleYouTubeCallback("auth-code", state);

      expect(result.accountId).toBe("acc-42");
      expect(result.returnTo).toBeUndefined();
    });

    it("round-trips returnTo=onboarding through the signed state", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123", "onboarding");
      mockYouTubeProviderSuccess();
      setupSupabase({ plan: "starter", accountCount: 0, upsertResult: { data: { id: "acc-42" }, error: null } });

      const result = await service.handleYouTubeCallback("auth-code", state);

      expect(result.returnTo).toBe("onboarding");
    });

    it("schedules the recurring ingestion job with the plan's cadence", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockYouTubeProviderSuccess();
      setupSupabase({ plan: "pro", accountCount: 0, upsertResult: { data: { id: "acc-42" }, error: null } });

      await service.handleYouTubeCallback("auth-code", state);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "ingest",
        { userId: "user-123", accountId: "acc-42", platform: "youtube" },
        expect.objectContaining({
          jobId: "ingestion:acc-42",
          repeat: { every: 600_000 }, // pro: 10 min
        }),
      );
    });

    it("stores a null refresh token when the provider does not return one", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockYouTubeProviderSuccess({ refresh_token: undefined });
      let capturedUpsertPayload: Record<string, unknown> | undefined;
      mockFrom.mockImplementation((table: string) => {
        if (table === "subscriptions_usage") {
          return makeChain({ data: null, error: null });
        }
        const chain = makeChain({ data: null, error: null, count: 0 });
        chain.upsert = vi.fn((payload: Record<string, unknown>) => {
          capturedUpsertPayload = payload;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "acc-1" }, error: null }),
            }),
          };
        });
        return chain;
      });

      await service.handleYouTubeCallback("auth-code", state);

      expect(capturedUpsertPayload?.refresh_token_encrypted).toBeNull();
    });

    it("throws BadRequestException when the account limit for the plan is reached", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockYouTubeProviderSuccess();
      setupSupabase({ plan: "starter", accountCount: 1 }); // starter allows 1 account/platform

      await expect(service.handleYouTubeCallback("auth-code", state)).rejects.toThrow(
        "Plan limit: max 1 YouTube account(s)",
      );
    });

    it("only counts active/paused accounts against the plan limit (broken/disconnected accounts don't block reconnecting)", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockYouTubeProviderSuccess();
      setupSupabase({ plan: "starter", accountCount: 0 });

      await service.handleYouTubeCallback("auth-code", state);

      const accountsChain = mockFrom.mock.results.find(
        (r, i) => mockFrom.mock.calls[i][0] === "accounts",
      )?.value;
      expect(accountsChain.in).toHaveBeenCalledWith("status", ["active", "paused"]);
    });

    it("propagates a provider HTTP error from the token exchange", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockFetch.mockResolvedValue(textResponse("invalid_grant", 400));

      await expect(service.handleYouTubeCallback("auth-code", state)).rejects.toThrow(
        "YouTube token exchange failed: 400 invalid_grant",
      );
    });

    it("propagates a malformed-response error when no channel is found", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockFetch.mockImplementation(async (url: string | URL) => {
        const u = url.toString();
        if (u === GOOGLE_TOKEN_URL) {
          return jsonResponse({ access_token: "tok", expires_in: 10, token_type: "Bearer" });
        }
        return jsonResponse({ items: [] });
      });

      await expect(service.handleYouTubeCallback("auth-code", state)).rejects.toThrow(
        "No YouTube channel found for this account",
      );
    });

    it("propagates a network error during the token exchange", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockFetch.mockRejectedValue(new TypeError("fetch failed"));

      await expect(service.handleYouTubeCallback("auth-code", state)).rejects.toThrow(
        "fetch failed",
      );
    });

    it("propagates the raw Supabase error when the account upsert fails", async () => {
      const { state } = service.getYouTubeAuthorizeUrl("user-123");
      mockYouTubeProviderSuccess();
      setupSupabase({
        plan: "starter",
        accountCount: 0,
        upsertResult: { data: null, error: { message: "constraint violation" } },
      });

      await expect(service.handleYouTubeCallback("auth-code", state)).rejects.toMatchObject({
        message: "constraint violation",
      });
    });
  });

  // ─── X: authorize URL ───────────────────────────────────────────────────

  describe("getXAuthorizeUrl", () => {
    it("throws BadRequestException when X OAuth is not configured", () => {
      const unconfigured = makeConfig({ X_CLIENT_ID: undefined });
      const svc = makeService(unconfigured, mockQueue);
      expect(() => svc.getXAuthorizeUrl("user-1")).toThrow("X OAuth is not configured");
    });

    it("generates a valid authorize URL with PKCE challenge and a state carrying the code_verifier", () => {
      const { url, state } = service.getXAuthorizeUrl("user-123");

      expect(url).toContain("https://x.com/i/oauth2/authorize");
      expect(url).toContain("code_challenge_method=S256");

      const [payloadB64] = state.split(".");
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
      expect(payload.userId).toBe("user-123");
      expect(typeof payload.codeVerifier).toBe("string");
      expect(payload.codeVerifier.length).toBeGreaterThanOrEqual(43);
    });
  });

  // ─── X: callback ────────────────────────────────────────────────────────

  describe("handleXCallback", () => {
    it("throws BadRequestException when X OAuth is not configured", async () => {
      const unconfigured = makeConfig({ X_REDIRECT_URI: undefined });
      const svc = makeService(unconfigured, mockQueue);
      await expect(svc.handleXCallback("code", "any.state")).rejects.toThrow(
        "X OAuth is not configured",
      );
    });

    it("throws BadRequestException when state has no signature separator", async () => {
      await expect(service.handleXCallback("code", "no-dot-here")).rejects.toThrow(
        "Invalid state",
      );
    });

    it("throws BadRequestException when the state signature does not match (tampered state)", async () => {
      const state = buildState(
        {
          userId: "user-1",
          nonce: "n",
          exp: Date.now() + 60_000,
          codeVerifier: "verifier",
        },
        { corruptSig: true },
      );
      await expect(service.handleXCallback("code", state)).rejects.toThrow(
        "Invalid state signature",
      );
    });

    it("throws BadRequestException when the state payload is not valid JSON", async () => {
      const payloadB64 = Buffer.from("garbage", "utf8").toString("base64url");
      const sig = signState(payloadB64);
      await expect(service.handleXCallback("code", `${payloadB64}.${sig}`)).rejects.toThrow(
        "Invalid or expired state",
      );
    });

    it("throws BadRequestException when the state has expired", async () => {
      const state = buildState({
        userId: "user-1",
        nonce: "n",
        exp: Date.now() - 1_000,
        codeVerifier: "verifier",
      });
      await expect(service.handleXCallback("code", state)).rejects.toThrow(
        "Invalid or expired state",
      );
    });

    it("throws BadRequestException when the state is missing the PKCE code_verifier", async () => {
      const state = buildState({
        userId: "user-1",
        nonce: "n",
        exp: Date.now() + 60_000,
        // codeVerifier intentionally omitted
      });
      await expect(service.handleXCallback("code", state)).rejects.toThrow(
        "Invalid or expired state",
      );
    });

    it("exchanges the code, persists the account and returns the accountId (happy path)", async () => {
      const { state } = service.getXAuthorizeUrl("user-123");
      mockXProviderSuccess();
      setupSupabase({ plan: "starter", accountCount: 0, upsertResult: { data: { id: "acc-99" }, error: null } });

      const result = await service.handleXCallback("auth-code", state);

      expect(result.accountId).toBe("acc-99");
      expect(result.returnTo).toBeUndefined();
    });

    it("round-trips returnTo=onboarding through the signed state", async () => {
      const { state } = service.getXAuthorizeUrl("user-123", "onboarding");
      mockXProviderSuccess();
      setupSupabase({ plan: "starter", accountCount: 0, upsertResult: { data: { id: "acc-99" }, error: null } });

      const result = await service.handleXCallback("auth-code", state);

      expect(result.returnTo).toBe("onboarding");
    });

    it("schedules the recurring ingestion job with the plan's cadence", async () => {
      const { state } = service.getXAuthorizeUrl("user-123");
      mockXProviderSuccess();
      setupSupabase({ plan: "plus", accountCount: 0, upsertResult: { data: { id: "acc-99" }, error: null } });

      await service.handleXCallback("auth-code", state);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "ingest",
        { userId: "user-123", accountId: "acc-99", platform: "x" },
        expect.objectContaining({
          jobId: "ingestion:acc-99",
          repeat: { every: 300_000 }, // plus: 5 min
        }),
      );
    });

    it("throws BadRequestException when the account limit for the plan is reached", async () => {
      const { state } = service.getXAuthorizeUrl("user-123");
      mockXProviderSuccess();
      setupSupabase({ plan: "starter", accountCount: 1 }); // starter allows 1 account/platform

      await expect(service.handleXCallback("auth-code", state)).rejects.toThrow(
        "Plan limit: max 1 X account(s)",
      );
    });

    it("allows a second account on plans with a higher accountsPerPlatform limit", async () => {
      const { state } = service.getXAuthorizeUrl("user-123");
      mockXProviderSuccess();
      setupSupabase({ plan: "pro", accountCount: 1 }); // pro allows 2 accounts/platform

      await expect(service.handleXCallback("auth-code", state)).resolves.toMatchObject({
        accountId: expect.any(String),
      });
    });

    it("propagates a provider HTTP error from the token exchange", async () => {
      const { state } = service.getXAuthorizeUrl("user-123");
      mockFetch.mockResolvedValue(textResponse("invalid_grant", 400));

      await expect(service.handleXCallback("auth-code", state)).rejects.toThrow(
        "X token exchange failed: 400 invalid_grant",
      );
    });

    it("propagates a malformed-response error when no X user is found", async () => {
      const { state } = service.getXAuthorizeUrl("user-123");
      mockFetch.mockImplementation(async (url: string | URL) => {
        const u = url.toString();
        if (u === X_TOKEN_URL) {
          return jsonResponse({ token_type: "bearer", expires_in: 10, access_token: "tok" });
        }
        return jsonResponse({ data: {} });
      });

      await expect(service.handleXCallback("auth-code", state)).rejects.toThrow(
        "No X user found for this account",
      );
    });

    it("propagates a network error during the token exchange", async () => {
      const { state } = service.getXAuthorizeUrl("user-123");
      mockFetch.mockRejectedValue(new TypeError("fetch failed"));

      await expect(service.handleXCallback("auth-code", state)).rejects.toThrow("fetch failed");
    });

    it("propagates the raw Supabase error when the account upsert fails", async () => {
      const { state } = service.getXAuthorizeUrl("user-123");
      mockXProviderSuccess();
      setupSupabase({
        plan: "starter",
        accountCount: 0,
        upsertResult: { data: null, error: { message: "constraint violation" } },
      });

      await expect(service.handleXCallback("auth-code", state)).rejects.toMatchObject({
        message: "constraint violation",
      });
    });
  });

  describe("peekReturnTo", () => {
    it("returns 'onboarding' when the (unverified) state payload carries it", () => {
      const state = Buffer.from(JSON.stringify({ returnTo: "onboarding" }), "utf8").toString(
        "base64url",
      );
      expect(OAuthService.peekReturnTo(`${state}.anything`)).toBe("onboarding");
    });

    it("returns undefined when returnTo is absent", () => {
      const state = Buffer.from(JSON.stringify({ userId: "user-1" }), "utf8").toString(
        "base64url",
      );
      expect(OAuthService.peekReturnTo(`${state}.anything`)).toBeUndefined();
    });

    it("returns undefined for malformed input instead of throwing", () => {
      expect(OAuthService.peekReturnTo("not-valid-base64.sig")).toBeUndefined();
      expect(OAuthService.peekReturnTo(undefined)).toBeUndefined();
      expect(OAuthService.peekReturnTo("")).toBeUndefined();
    });
  });
});
