import { createClient } from "@supabase/supabase-js";
import { decryptToken } from "./token-decrypt.js";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
// Fallback only in test environments — never in development or production
const TEST_FALLBACK_SECRET = "development-only-32-char-secret-key!!";
const TOKEN_REFRESH_TIMEOUT_MS = Number(process.env.TOKEN_REFRESH_TIMEOUT_MS) || 8_000;

function encryptToken(plaintext: string): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ??
    (process.env.NODE_ENV === "test" ? TEST_FALLBACK_SECRET : undefined);
  if (!secret) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required");
  }
  const key = scryptSync(secret, "roastr-token-salt", KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export type AccountTokenRow = {
  id: string;
  platform: string;
  access_token_encrypted: Buffer | Uint8Array | ArrayBuffer;
  refresh_token_encrypted: Buffer | Uint8Array | ArrayBuffer | null;
  access_token_expires_at: string | null;
};

type RefreshedTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
};

/** Returns true if token expires within the next 5 minutes, is already expired, or has an invalid timestamp. */
export function isTokenExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  // Treat malformed timestamps (NaN) as expiring so we always attempt refresh
  if (Number.isNaN(expiry)) return true;
  const buffer = 5 * 60 * 1000;
  return Date.now() + buffer >= expiry;
}

function toBuffer(raw: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (raw instanceof Buffer) return raw;
  return Buffer.from(raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function refreshYouTubeToken(refreshToken: string): Promise<RefreshedTokens> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetchWithTimeout(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
    TOKEN_REFRESH_TIMEOUT_MS,
  );

  if (!res.ok) {
    throw new Error(`YouTube token refresh failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

async function refreshXToken(refreshToken: string): Promise<RefreshedTokens> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing X_CLIENT_ID or X_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

  const res = await fetchWithTimeout(
    X_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: body.toString(),
    },
    TOKEN_REFRESH_TIMEOUT_MS,
  );

  if (!res.ok) {
    throw new Error(`X token refresh failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

/**
 * Returns a valid access token for the given account.
 * If the token is expiring soon, it refreshes automatically and persists the new tokens.
 */
export async function ensureFreshToken(account: AccountTokenRow): Promise<string> {
  const accessToken = decryptToken(toBuffer(account.access_token_encrypted));

  if (!isTokenExpiringSoon(account.access_token_expires_at)) {
    return accessToken;
  }

  if (!account.refresh_token_encrypted) {
    throw new Error(`Token expired for account ${account.id} and no refresh token available`);
  }

  const refreshToken = decryptToken(toBuffer(account.refresh_token_encrypted));

  let newTokens: RefreshedTokens;

  if (account.platform === "youtube") {
    newTokens = await refreshYouTubeToken(refreshToken);
  } else if (account.platform === "x") {
    newTokens = await refreshXToken(refreshToken);
  } else {
    throw new Error(`Token refresh not supported for platform: ${account.platform}`);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const newAccessEncrypted = encryptToken(newTokens.accessToken);
  const newRefreshEncrypted = newTokens.refreshToken
    ? encryptToken(newTokens.refreshToken)
    : null;

  // Conditional write: only update if the stored expiry still matches what we read.
  // If another worker already refreshed concurrently, skip overwriting.
  const { data, error } = await supabase
    .from("accounts")
    .update({
      access_token_encrypted: Buffer.from(newAccessEncrypted),
      ...(newRefreshEncrypted
        ? { refresh_token_encrypted: Buffer.from(newRefreshEncrypted) }
        : {}),
      access_token_expires_at: newTokens.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id)
    // Only commit if the expiry we observed is still the current one (optimistic lock)
    .eq("access_token_expires_at", account.access_token_expires_at ?? "")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to persist refreshed tokens for account ${account.id}: ${error.message}`);
  }

  // data === null means another worker already refreshed (conditional write missed).
  // The current in-memory token is still valid for this job's lifetime.
  if (!data) {
    return newTokens.accessToken;
  }

  return newTokens.accessToken;
}
