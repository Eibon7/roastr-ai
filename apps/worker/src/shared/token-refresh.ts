import { createClient } from "@supabase/supabase-js";
import { decryptToken } from "./token-decrypt.js";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";

function encryptToken(plaintext: string): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ?? "development-only-32-char-secret-key!!";
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

/** Returns true if token expires within the next 5 minutes (or is already expired). */
export function isTokenExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  const buffer = 5 * 60 * 1000;
  return Date.now() + buffer >= expiry;
}

function toBuffer(raw: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (raw instanceof Buffer) return raw;
  return Buffer.from(raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer));
}

async function refreshYouTubeToken(refreshToken: string): Promise<RefreshedTokens> {
  const body = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID ?? "",
    client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
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
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const clientId = process.env.X_CLIENT_ID ?? "";
  const clientSecret = process.env.X_CLIENT_SECRET ?? "";
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

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
    return accessToken;
  }

  const refreshToken = decryptToken(toBuffer(account.refresh_token_encrypted));

  let newTokens: RefreshedTokens;

  if (account.platform === "youtube") {
    newTokens = await refreshYouTubeToken(refreshToken);
  } else if (account.platform === "x") {
    newTokens = await refreshXToken(refreshToken);
  } else {
    return accessToken;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const newAccessEncrypted = encryptToken(newTokens.accessToken);
  const newRefreshEncrypted = newTokens.refreshToken
    ? encryptToken(newTokens.refreshToken)
    : null;

  await supabase
    .from("accounts")
    .update({
      access_token_encrypted: Buffer.from(newAccessEncrypted),
      ...(newRefreshEncrypted
        ? { refresh_token_encrypted: Buffer.from(newRefreshEncrypted) }
        : {}),
      access_token_expires_at: newTokens.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return newTokens.accessToken;
}
