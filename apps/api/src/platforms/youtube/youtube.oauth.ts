import type { OAuthTokens } from "@roastr/shared";
import {
  YOUTUBE_SCOPES,
  type GoogleTokenResponse,
  type YouTubeChannelItem,
} from "./youtube.types.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_URL =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

export interface YouTubeOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildYouTubeAuthorizeUrl(
  config: YouTubeOAuthConfig,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeYouTubeCode(
  config: YouTubeOAuthConfig,
  code: string,
): Promise<{ tokens: OAuthTokens; channelId: string; channelTitle: string }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube token exchange failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  const tokens: OAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
  };

  const channel = await fetchYouTubeChannel(data.access_token);
  return {
    tokens,
    channelId: channel.id,
    channelTitle: channel.snippet.title,
  };
}

export async function refreshYouTubeToken(
  config: YouTubeOAuthConfig,
  refreshToken: string,
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube token refresh failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt,
  };
}

async function fetchYouTubeChannel(
  accessToken: string,
): Promise<YouTubeChannelItem> {
  const res = await fetch(YOUTUBE_CHANNELS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`YouTube channels failed: ${res.status}`);
  }
  const json = (await res.json()) as { items?: YouTubeChannelItem[] };
  const item = json.items?.[0];
  if (!item) {
    throw new Error("No YouTube channel found for this account");
  }
  return item;
}
