import type { OAuthTokens } from "@roastr/shared";
import { createHash, randomBytes } from "node:crypto";
import { X_SCOPES, type XTokenResponse, type XUserResponse } from "./x.types.js";

const X_AUTH_URL = "https://x.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_ME_URL = "https://api.x.com/2/users/me";

export interface XOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Generate PKCE code_verifier (43-128 chars) and code_challenge (S256) */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = hash.toString("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildXAuthorizeUrl(
  config: XOAuthConfig,
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: X_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTH_URL}?${params.toString()}`;
}

export async function exchangeXCode(
  config: XOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<{ tokens: OAuthTokens; userId: string; username: string }> {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });

  const basicAuth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    "utf8",
  ).toString("base64");

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X token exchange failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as XTokenResponse;
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  const tokens: OAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
  };

  const user = await fetchXUser(data.access_token);
  return {
    tokens,
    userId: user.data.id,
    username: user.data.username,
  };
}

export async function refreshXToken(
  config: XOAuthConfig,
  refreshToken: string,
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const basicAuth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    "utf8",
  ).toString("base64");

  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X token refresh failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as XTokenResponse;
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt,
  };
}

async function fetchXUser(accessToken: string): Promise<XUserResponse> {
  const res = await fetch(X_ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Roastr/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`X users/me failed: ${res.status}`);
  }
  const json = (await res.json()) as XUserResponse;
  if (!json.data?.id) {
    throw new Error("No X user found for this account");
  }
  return json;
}
