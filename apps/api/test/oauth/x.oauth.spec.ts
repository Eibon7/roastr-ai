import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import {
  buildXAuthorizeUrl,
  exchangeXCode,
  generatePKCE,
  type XOAuthConfig,
} from "../../src/platforms/x/x.oauth";

const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_ME_URL = "https://api.x.com/2/users/me";

const mockFetch = vi.fn();

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

const config: XOAuthConfig = {
  clientId: "x-client-id",
  clientSecret: "x-client-secret",
  redirectUri: "https://app.test/oauth/x/callback",
};

describe("generatePKCE", () => {
  it("generates a code_verifier and S256 code_challenge derived from it", () => {
    const { codeVerifier, codeChallenge } = generatePKCE();

    // RFC 7636: verifier must be 43-128 chars of unreserved base64url charset
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
    expect(codeVerifier).toMatch(/^[A-Za-z0-9\-_]+$/);

    const expectedChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest()
      .toString("base64url");
    expect(codeChallenge).toBe(expectedChallenge);
  });

  it("generates a different verifier on every call", () => {
    const a = generatePKCE();
    const b = generatePKCE();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe("buildXAuthorizeUrl", () => {
  it("builds an authorize URL with state, PKCE challenge and required scopes", () => {
    const url = buildXAuthorizeUrl(config, "state-123", "challenge-abc");
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe(config.clientId);
    expect(parsed.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(parsed.searchParams.get("state")).toBe("state-123");
    expect(parsed.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("scope")).toContain("tweet.read");
    expect(parsed.searchParams.get("scope")).toContain("offline.access");
  });
});

describe("exchangeXCode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exchanges a code for tokens and fetches the X user (happy path)", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u === X_TOKEN_URL) {
        return jsonResponse({
          token_type: "bearer",
          expires_in: 7200,
          access_token: "x-access-token",
          refresh_token: "x-refresh-token",
        });
      }
      if (u === X_ME_URL) {
        return jsonResponse({
          data: { id: "x-user-1", name: "Test User", username: "testhandle" },
        });
      }
      throw new Error(`Unexpected fetch to ${u}`);
    });

    const result = await exchangeXCode(config, "auth-code", "code-verifier-value");

    expect(result.tokens.accessToken).toBe("x-access-token");
    expect(result.tokens.refreshToken).toBe("x-refresh-token");
    expect(result.tokens.expiresAt).not.toBeNull();
    expect(result.userId).toBe("x-user-1");
    expect(result.username).toBe("testhandle");

    // Verify the token exchange request is a correctly-formed Basic-auth POST
    const [, tokenCallInit] = mockFetch.mock.calls.find(
      ([u]) => u.toString() === X_TOKEN_URL,
    )!;
    expect(tokenCallInit.method).toBe("POST");
    expect(tokenCallInit.headers.Authorization).toBe(
      `Basic ${Buffer.from("x-client-id:x-client-secret").toString("base64")}`,
    );
    const sentBody = new URLSearchParams(tokenCallInit.body);
    expect(sentBody.get("code")).toBe("auth-code");
    expect(sentBody.get("code_verifier")).toBe("code-verifier-value");
    expect(sentBody.get("grant_type")).toBe("authorization_code");
  });

  it("returns null expiresAt when the provider omits expires_in", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u === X_TOKEN_URL) {
        return jsonResponse({ token_type: "bearer", access_token: "tok" });
      }
      return jsonResponse({ data: { id: "u1", name: "n", username: "h" } });
    });

    const result = await exchangeXCode(config, "code", "verifier");
    expect(result.tokens.expiresAt).toBeNull();
    expect(result.tokens.refreshToken).toBeNull();
  });

  it("throws when the token endpoint responds with a non-ok status", async () => {
    mockFetch.mockResolvedValue(textResponse("invalid_grant", 400));

    await expect(exchangeXCode(config, "bad-code", "verifier")).rejects.toThrow(
      "X token exchange failed: 400 invalid_grant",
    );
  });

  it("propagates a network error from the token exchange", async () => {
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));

    await expect(exchangeXCode(config, "code", "verifier")).rejects.toThrow(
      "fetch failed",
    );
  });

  it("throws when the users/me endpoint responds with a non-ok status", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u === X_TOKEN_URL) {
        return jsonResponse({ token_type: "bearer", expires_in: 100, access_token: "tok" });
      }
      return textResponse("forbidden", 403);
    });

    await expect(exchangeXCode(config, "code", "verifier")).rejects.toThrow(
      "X users/me failed: 403",
    );
  });

  it("throws on a malformed users/me response missing the user id", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u === X_TOKEN_URL) {
        return jsonResponse({ token_type: "bearer", expires_in: 100, access_token: "tok" });
      }
      return jsonResponse({ data: {} });
    });

    await expect(exchangeXCode(config, "code", "verifier")).rejects.toThrow(
      "No X user found for this account",
    );
  });
});

