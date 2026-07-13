import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildYouTubeAuthorizeUrl,
  exchangeYouTubeCode,
  type YouTubeOAuthConfig,
} from "../../src/platforms/youtube/youtube.oauth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

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

const config: YouTubeOAuthConfig = {
  clientId: "yt-client-id",
  clientSecret: "yt-client-secret",
  redirectUri: "https://app.test/oauth/youtube/callback",
};

describe("buildYouTubeAuthorizeUrl", () => {
  it("builds an authorize URL requesting offline access and consent, with required scopes", () => {
    const url = buildYouTubeAuthorizeUrl(config, "state-xyz");
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(parsed.searchParams.get("client_id")).toBe(config.clientId);
    expect(parsed.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("state")).toBe("state-xyz");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
    expect(parsed.searchParams.get("scope")).toContain("youtube.readonly");
    expect(parsed.searchParams.get("scope")).toContain("youtube.force-ssl");
  });
});

describe("exchangeYouTubeCode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exchanges a code for tokens and fetches the channel (happy path)", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u === GOOGLE_TOKEN_URL) {
        return jsonResponse({
          access_token: "yt-access-token",
          refresh_token: "yt-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        });
      }
      if (u === YOUTUBE_CHANNELS_URL) {
        return jsonResponse({
          items: [{ id: "channel-1", snippet: { title: "My Channel" } }],
        });
      }
      throw new Error(`Unexpected fetch to ${u}`);
    });

    const result = await exchangeYouTubeCode(config, "auth-code");

    expect(result.tokens.accessToken).toBe("yt-access-token");
    expect(result.tokens.refreshToken).toBe("yt-refresh-token");
    expect(result.tokens.expiresAt).not.toBeNull();
    expect(result.channelId).toBe("channel-1");
    expect(result.channelTitle).toBe("My Channel");

    const [, tokenCallInit] = mockFetch.mock.calls.find(
      ([u]) => u.toString() === GOOGLE_TOKEN_URL,
    )!;
    expect(tokenCallInit.method).toBe("POST");
    const sentBody = new URLSearchParams(tokenCallInit.body);
    expect(sentBody.get("code")).toBe("auth-code");
    expect(sentBody.get("client_id")).toBe("yt-client-id");
    expect(sentBody.get("client_secret")).toBe("yt-client-secret");
    expect(sentBody.get("grant_type")).toBe("authorization_code");
  });

  it("returns null expiresAt and null refreshToken when the provider omits them", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u === GOOGLE_TOKEN_URL) {
        return jsonResponse({ access_token: "tok", token_type: "Bearer" });
      }
      return jsonResponse({ items: [{ id: "c1", snippet: { title: "T" } }] });
    });

    const result = await exchangeYouTubeCode(config, "code");
    expect(result.tokens.expiresAt).toBeNull();
    expect(result.tokens.refreshToken).toBeNull();
  });

  it("throws when the token endpoint responds with a non-ok status", async () => {
    mockFetch.mockResolvedValue(textResponse("invalid_grant", 400));

    await expect(exchangeYouTubeCode(config, "bad-code")).rejects.toThrow(
      "YouTube token exchange failed: 400 invalid_grant",
    );
  });

  it("propagates a network error from the token exchange", async () => {
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));

    await expect(exchangeYouTubeCode(config, "code")).rejects.toThrow("fetch failed");
  });

  it("throws when the channels endpoint responds with a non-ok status", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u === GOOGLE_TOKEN_URL) {
        return jsonResponse({ access_token: "tok", expires_in: 10, token_type: "Bearer" });
      }
      return textResponse("forbidden", 403);
    });

    await expect(exchangeYouTubeCode(config, "code")).rejects.toThrow(
      "YouTube channels failed: 403",
    );
  });

  it("throws on a malformed channels response with no items", async () => {
    mockFetch.mockImplementation(async (url: string | URL) => {
      const u = url.toString();
      if (u === GOOGLE_TOKEN_URL) {
        return jsonResponse({ access_token: "tok", expires_in: 10, token_type: "Bearer" });
      }
      return jsonResponse({ items: [] });
    });

    await expect(exchangeYouTubeCode(config, "code")).rejects.toThrow(
      "No YouTube channel found for this account",
    );
  });
});

