import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SECRET = "test-secret-32-characters-long!!";

function encryptToken(plaintext: string): Buffer {
  const key = scryptSync(SECRET, "roastr-token-salt", KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

type Result<T> = { data: T; error: { message: string } | null };

const { mockCreateClient, state } = vi.hoisted(() => {
  const state = {
    // Consumed in strict call order by every `.maybeSingle()` resolution
    // (lease claim, poll iterations, persist selection).
    maybeSingleQueue: [] as Result<unknown>[],
    maybeSingleDefault: { data: null, error: null } as Result<unknown>,
    // Consumed only when the builder itself is awaited directly (release-on-error path).
    releaseResult: { error: null } as { error: { message: string } | null },
  };

  function makeBuilder() {
    const builder = {
      select: vi.fn(() => builder),
      update: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      or: vi.fn(() => builder),
      is: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve(state.maybeSingleQueue.shift() ?? state.maybeSingleDefault)),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(state.releaseResult).then(resolve, reject),
    };
    return builder;
  }

  const builder = makeBuilder();
  const mockCreateClient = vi.fn(() => ({ from: vi.fn(() => builder) }));

  return { mockCreateClient, state };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));

const {
  ensureFreshToken,
  isTokenExpiringSoon,
  toBuffer,
  NoRefreshTokenError,
} = await import("../src/shared/token-refresh.js");

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-1",
    platform: "youtube",
    access_token_encrypted: encryptToken("old-access-token"),
    refresh_token_encrypted: encryptToken("refresh-token-abc"),
    access_token_expires_at: new Date(Date.now() - 60_000).toISOString(), // expired
    ...overrides,
  };
}

describe("isTokenExpiringSoon", () => {
  it("retorna true si expiresAt es null", () => {
    expect(isTokenExpiringSoon(null)).toBe(true);
  });

  it("retorna true si expiresAt es undefined", () => {
    expect(isTokenExpiringSoon(undefined)).toBe(true);
  });

  it("retorna true si el timestamp es inválido", () => {
    expect(isTokenExpiringSoon("not-a-date")).toBe(true);
  });

  it("retorna true si expira dentro del buffer de 5 minutos", () => {
    expect(isTokenExpiringSoon(new Date(Date.now() + 60_000).toISOString())).toBe(true);
  });

  it("retorna false si la expiración está lejos en el futuro", () => {
    expect(isTokenExpiringSoon(new Date(Date.now() + 60 * 60_000).toISOString())).toBe(false);
  });
});

describe("toBuffer", () => {
  it("decodifica un string base64", () => {
    const original = Buffer.from("hello");
    expect(toBuffer(original.toString("base64"))).toEqual(original);
  });

  it("retorna el mismo Buffer si ya es un Buffer", () => {
    const buf = Buffer.from("hello");
    expect(toBuffer(buf)).toBe(buf);
  });

  it("convierte un Uint8Array", () => {
    const view = new Uint8Array([1, 2, 3]);
    expect(toBuffer(view)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("convierte un ArrayBuffer", () => {
    const arrBuf = new Uint8Array([4, 5, 6]).buffer;
    expect(toBuffer(arrBuf)).toEqual(Buffer.from([4, 5, 6]));
  });
});

describe("ensureFreshToken", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...origEnv,
      TOKEN_ENCRYPTION_KEY: SECRET,
      SUPABASE_URL: "http://test",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
      YOUTUBE_CLIENT_ID: "yt-client",
      YOUTUBE_CLIENT_SECRET: "yt-secret",
      X_CLIENT_ID: "x-client",
      X_CLIENT_SECRET: "x-secret",
    };
    vi.clearAllMocks();
    state.maybeSingleQueue = [];
    state.maybeSingleDefault = { data: null, error: null };
    state.releaseResult = { error: null };
  });

  afterEach(() => {
    process.env = origEnv;
    vi.useRealTimers();
  });

  it("retorna el access token desencriptado sin tocar supabase si no está por expirar", async () => {
    const account = makeAccount({ access_token_expires_at: new Date(Date.now() + 60 * 60_000).toISOString() });

    const token = await ensureFreshToken(account);

    expect(token).toBe("old-access-token");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("lanza NoRefreshTokenError y marca la cuenta como rota si el token expiró y no hay refresh token disponible", async () => {
    const account = makeAccount({ refresh_token_encrypted: null });

    await expect(ensureFreshToken(account)).rejects.toThrow(
      "Token expired for account acc-1 and no refresh token available",
    );

    const client = mockCreateClient.mock.results[0].value;
    const builder = client.from();
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        status_reason: "token_expired",
        integration_health: "failing",
      }),
    );
  });

  it("el error lanzado por falta de refresh token es una instancia de NoRefreshTokenError", async () => {
    const account = makeAccount({ refresh_token_encrypted: null });

    await expect(ensureFreshToken(account)).rejects.toBeInstanceOf(NoRefreshTokenError);
  });

  it("lanza si faltan las credenciales de Supabase", async () => {
    delete process.env.SUPABASE_URL;
    const account = makeAccount();

    await expect(ensureFreshToken(account)).rejects.toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for token refresh",
    );
  });

  it("refresca un token de youtube exitosamente y persiste el resultado", async () => {
    const account = makeAccount();
    state.maybeSingleQueue = [
      { data: { id: "acc-1" }, error: null }, // lease claim succeeds
      { data: { id: "acc-1" }, error: null }, // persist succeeds
    ];

    const origFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const token = await ensureFreshToken(account);
      expect(token).toBe("new-access");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("refresca un token de x exitosamente", async () => {
    const account = makeAccount({ platform: "x" });
    state.maybeSingleQueue = [
      { data: { id: "acc-1" }, error: null },
      { data: { id: "acc-1" }, error: null },
    ];

    const origFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-x-access", expires_in: 1800 }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      const token = await ensureFreshToken(account);
      expect(token).toBe("new-x-access");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.x.com/2/oauth2/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: expect.stringContaining("Basic ") }),
        }),
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('lanza "Token refresh not supported for platform" para una plataforma sin adapter, y libera el lease', async () => {
    const account = makeAccount({ platform: "tiktok" });
    state.maybeSingleQueue = [{ data: { id: "acc-1" }, error: null }]; // lease claim succeeds

    await expect(ensureFreshToken(account)).rejects.toThrow(
      "Token refresh not supported for platform: tiktok",
    );

    // 1 update para reclamar el lease + 1 update para liberarlo en el catch
    const client = mockCreateClient.mock.results[0].value;
    const builder = client.from();
    expect(builder.update).toHaveBeenCalledTimes(2);
  });

  it("lanza si faltan las credenciales de OAuth de youtube", async () => {
    delete process.env.YOUTUBE_CLIENT_ID;
    const account = makeAccount();
    state.maybeSingleQueue = [{ data: { id: "acc-1" }, error: null }];

    await expect(ensureFreshToken(account)).rejects.toThrow(
      "Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET",
    );
  });

  it("lanza si la API de youtube responde con error al refrescar", async () => {
    const account = makeAccount();
    state.maybeSingleQueue = [{ data: { id: "acc-1" }, error: null }];

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch;

    try {
      await expect(ensureFreshToken(account)).rejects.toThrow("YouTube token refresh failed: 400");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("lanza y libera el lease si falla la persistencia tras un refresh exitoso", async () => {
    const account = makeAccount();
    state.maybeSingleQueue = [
      { data: { id: "acc-1" }, error: null }, // lease claim succeeds
      { data: null, error: { message: "optimistic lock conflict" } }, // persist fails
    ];

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access", expires_in: 3600 }),
    }) as unknown as typeof fetch;

    try {
      await expect(ensureFreshToken(account)).rejects.toThrow(
        "Failed to persist refreshed tokens for account acc-1: optimistic lock conflict",
      );

      const client = mockCreateClient.mock.results[0].value;
      const builder = client.from();
      // lease claim + persist attempt + release-on-error = 3 update() calls
      expect(builder.update).toHaveBeenCalledTimes(3);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("retorna el nuevo access token igualmente si la persistencia no matchea ninguna fila (data null sin error)", async () => {
    const account = makeAccount();
    state.maybeSingleQueue = [
      { data: { id: "acc-1" }, error: null }, // lease claim succeeds
      { data: null, error: null }, // persist: no row matched, but no error
    ];

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access", expires_in: 3600 }),
    }) as unknown as typeof fetch;

    try {
      const token = await ensureFreshToken(account);
      expect(token).toBe("new-access");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("cuando otro worker sostiene el lease, hace poll hasta detectar el token ya refrescado", async () => {
    const account = makeAccount();
    const refreshedEncrypted = encryptToken("refreshed-by-other-worker").toString("base64");
    state.maybeSingleQueue = [
      { data: null, error: null }, // lease claim lost (another worker holds it)
      {
        data: {
          access_token_encrypted: refreshedEncrypted,
          access_token_expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          refresh_lease_at: null,
        },
        error: null,
      }, // poll: token is now fresh
    ];

    vi.useFakeTimers();
    const promise = ensureFreshToken(account);
    await vi.advanceTimersByTimeAsync(1_500);
    const token = await promise;

    expect(token).toBe("refreshed-by-other-worker");
  });

  it("lanza timeout del lease si el poll agota todos los reintentos sin ver el token fresco", async () => {
    const account = makeAccount();
    state.maybeSingleQueue = [
      { data: null, error: null }, // lease claim lost
      // 12 poll iterations, todas retornan el mismo token expirado (nunca refresca)
      ...Array.from({ length: 12 }, () => ({
        data: {
          access_token_encrypted: account.access_token_encrypted.toString("base64"),
          access_token_expires_at: account.access_token_expires_at,
          refresh_lease_at: new Date(Date.now() + 30_000).toISOString(),
        },
        error: null,
      })),
    ];

    vi.useFakeTimers();
    const promise = ensureFreshToken(account);
    promise.catch(() => {}); // evita unhandled rejection mientras avanzamos los timers
    await vi.advanceTimersByTimeAsync(1_500 * 12);

    await expect(promise).rejects.toThrow("Refresh lease timeout for account acc-1");
  });
});
