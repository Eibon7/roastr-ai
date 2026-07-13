import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Job } from "bullmq";

const { mockCreateClient, accountBuilder, queryState, mockQueueInstance, QueueMock } =
  vi.hoisted(() => {
    const queryState: {
      select: { data: unknown; error: { message: string } | null };
      update: { error: { message: string } | null };
    } = {
      select: { data: null, error: null },
      update: { error: null },
    };

    const accountBuilder: {
      select: (...args: unknown[]) => typeof accountBuilder;
      eq: (...args: unknown[]) => typeof accountBuilder;
      update: (...args: unknown[]) => typeof accountBuilder;
      maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
      then: (
        resolve: (value: { error: { message: string } | null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => unknown;
    } = {
      select: vi.fn(() => accountBuilder),
      eq: vi.fn(() => accountBuilder),
      update: vi.fn(() => accountBuilder),
      maybeSingle: vi.fn(() => Promise.resolve(queryState.select)),
      then: (resolve, reject) => Promise.resolve(queryState.update).then(resolve, reject),
    };

    const mockCreateClient = vi.fn(() => ({ from: vi.fn(() => accountBuilder) }));
    const mockQueueInstance = { addBulk: vi.fn().mockResolvedValue(undefined) };
    const QueueMock = vi.fn(() => mockQueueInstance);

    return { mockCreateClient, accountBuilder, queryState, mockQueueInstance, QueueMock };
  });

vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));
vi.mock("bullmq", () => ({ Queue: QueueMock }));

vi.mock("../src/shared/logger.js", () => ({
  createJobLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockCheckBillingLimits = vi.fn();
vi.mock("../src/shared/billing-guard.js", () => ({
  checkBillingLimits: (...args: unknown[]) => mockCheckBillingLimits(...args),
}));

const mockEnsureFreshToken = vi.fn();
vi.mock("../src/shared/token-refresh.js", () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
  toBuffer: (v: unknown) => v,
  NoRefreshTokenError: class NoRefreshTokenError extends Error {},
}));

const mockFetchComments = vi.fn();
vi.mock("../src/shared/fetch-comments.js", () => ({
  fetchComments: (...args: unknown[]) => mockFetchComments(...args),
}));

const mockSanitize = vi.fn((text: string) => `sanitized:${text}`);
vi.mock("../src/shared/sanitize-text.js", () => ({
  sanitizeCommentText: (text: string) => mockSanitize(text),
}));

const { ingestionProcessor } = await import("../src/processors/ingestion.js");
const { NoRefreshTokenError } = await import("../src/shared/token-refresh.js");

const VALID_ACCOUNT = {
  id: "acc-1",
  user_id: "user-1",
  platform: "youtube",
  status: "active",
  integration_health: "healthy",
  ingestion_cursor: null,
  access_token_encrypted: "enc-access",
  refresh_token_encrypted: "enc-refresh",
  access_token_expires_at: null,
  platform_user_id: "channel-123",
};

function makeJob(
  data: Record<string, unknown> | undefined,
  overrides: Partial<{ attemptsMade: number; opts: { attempts: number } }> = {},
): Job {
  return { id: "job-1", data, ...overrides } as unknown as Job;
}

describe("ingestionProcessor", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv, SUPABASE_URL: "http://test", SUPABASE_SERVICE_ROLE_KEY: "test-key" };
    vi.clearAllMocks();
    queryState.select = { data: { ...VALID_ACCOUNT }, error: null };
    queryState.update = { error: null };
    mockCheckBillingLimits.mockResolvedValue({ allowed: true, remaining: 10 });
    mockEnsureFreshToken.mockResolvedValue("fresh-access-token");
    mockFetchComments.mockResolvedValue({
      comments: [
        {
          id: "c1",
          userId: "user-1",
          accountId: "acc-1",
          platform: "youtube",
          text: "hello world",
          authorId: "author-1",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ],
      nextCursor: "cursor-2",
      hasMore: false,
    });
    mockSanitize.mockImplementation((text: string) => `sanitized:${text}`);
    mockQueueInstance.addBulk.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("no hace nada si falta userId, accountId o platform", async () => {
    await ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1" }));

    expect(mockCheckBillingLimits).not.toHaveBeenCalled();
    expect(accountBuilder.select).not.toHaveBeenCalled();
  });

  it("lanza para reintento si el lookup de billing falla", async () => {
    mockCheckBillingLimits.mockResolvedValue({ allowed: false, reason: "lookup_error" });

    await expect(
      ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" })),
    ).rejects.toThrow("Billing lookup failed, will retry");

    expect(accountBuilder.select).not.toHaveBeenCalled();
  });

  it("hace skip silencioso si el límite de billing está superado", async () => {
    mockCheckBillingLimits.mockResolvedValue({ allowed: false, reason: "over_limit" });

    await expect(
      ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" })),
    ).resolves.toBeUndefined();

    expect(accountBuilder.select).not.toHaveBeenCalled();
  });

  it("lanza para reintento si falla el lookup de la cuenta", async () => {
    queryState.select = { data: null, error: { message: "db down" } };

    await expect(
      ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" })),
    ).rejects.toThrow("Account lookup failed, will retry");
  });

  it("retorna sin error si la cuenta no existe", async () => {
    queryState.select = { data: null, error: null };

    await expect(
      ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" })),
    ).resolves.toBeUndefined();

    expect(mockEnsureFreshToken).not.toHaveBeenCalled();
  });

  it("hace skip si la cuenta no está activa", async () => {
    queryState.select = { data: { ...VALID_ACCOUNT, status: "paused" }, error: null };

    await ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }));

    expect(mockEnsureFreshToken).not.toHaveBeenCalled();
  });

  it("hace skip si la integración está congelada", async () => {
    queryState.select = { data: { ...VALID_ACCOUNT, integration_health: "frozen" }, error: null };

    await ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }));

    expect(mockEnsureFreshToken).not.toHaveBeenCalled();
  });

  it("hace skip si no hay access token guardado", async () => {
    queryState.select = { data: { ...VALID_ACCOUNT, access_token_encrypted: null }, error: null };

    await ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }));

    expect(mockEnsureFreshToken).not.toHaveBeenCalled();
  });

  it("lanza para reintento si falla el refresco del token", async () => {
    mockEnsureFreshToken.mockRejectedValue(new Error("decrypt failed"));

    await expect(
      ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" })),
    ).rejects.toThrow("Token unavailable, will retry");

    expect(mockFetchComments).not.toHaveBeenCalled();
  });

  it("no marca la cuenta como rota si el fallo del refresco no fue en el último intento", async () => {
    mockEnsureFreshToken.mockRejectedValue(new Error("decrypt failed"));

    await expect(
      ingestionProcessor(
        makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }, { attemptsMade: 0, opts: { attempts: 5 } }),
      ),
    ).rejects.toThrow("Token unavailable, will retry");

    expect(accountBuilder.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
  });

  it("marca la cuenta como rota cuando el refresco del token falla en el último intento permitido", async () => {
    mockEnsureFreshToken.mockRejectedValue(new Error("YouTube token refresh failed: 400"));

    await expect(
      ingestionProcessor(
        makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }, { attemptsMade: 4, opts: { attempts: 5 } }),
      ),
    ).rejects.toThrow("Token unavailable, will retry");

    expect(accountBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        status_reason: "token_expired",
        integration_health: "failing",
      }),
    );
    expect(mockFetchComments).not.toHaveBeenCalled();
  });

  it("lanza si falla la escritura al marcar la cuenta como rota en el último intento", async () => {
    mockEnsureFreshToken.mockRejectedValue(new Error("decrypt failed"));
    queryState.update = { error: { message: "db down" } };

    await expect(
      ingestionProcessor(
        makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }, { attemptsMade: 4, opts: { attempts: 5 } }),
      ),
    ).rejects.toThrow("Failed to mark account acc-1 as broken: db down");
  });

  it("no relanza cuando no hay refresh token en absoluto (NoRefreshTokenError, ya marcada por ensureFreshToken)", async () => {
    mockEnsureFreshToken.mockRejectedValue(
      new NoRefreshTokenError("Token expired for account acc-1 and no refresh token available"),
    );

    await expect(
      ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" })),
    ).resolves.toBeUndefined();

    expect(mockFetchComments).not.toHaveBeenCalled();
    // ensureFreshToken already wrote the broken status itself — ingestion.ts must not touch it again.
    expect(accountBuilder.update).not.toHaveBeenCalled();
  });

  it("repropaga el error original si falla fetchComments", async () => {
    mockFetchComments.mockRejectedValue(new Error("YouTube API down"));

    await expect(
      ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" })),
    ).rejects.toThrow("YouTube API down");
  });

  it("sanea y encola los comentarios nuevos, y actualiza el cursor", async () => {
    await ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }));

    expect(mockSanitize).toHaveBeenCalledWith("hello world");
    expect(mockQueueInstance.addBulk).toHaveBeenCalledTimes(1);
    const jobs = mockQueueInstance.addBulk.mock.calls[0][0];
    expect(jobs).toEqual([
      expect.objectContaining({
        name: "analyze",
        data: expect.objectContaining({
          commentId: "c1",
          userId: "user-1",
          accountId: "acc-1",
          platform: "youtube",
          text: "sanitized:hello world",
        }),
        opts: expect.objectContaining({ jobId: "analysis_youtube_acc-1_c1" }),
      }),
    ]);

    expect(accountBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ ingestion_cursor: "cursor-2", consecutive_errors: 0 }),
    );
  });

  it("no encola nada si no hay comentarios nuevos, pero sí actualiza el cursor", async () => {
    mockFetchComments.mockResolvedValue({ comments: [], nextCursor: "cursor-3", hasMore: false });

    await ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" }));

    expect(mockQueueInstance.addBulk).not.toHaveBeenCalled();
    expect(accountBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ ingestion_cursor: "cursor-3" }),
    );
  });

  it("lanza para reintento si falla la actualización del cursor", async () => {
    queryState.update = { error: { message: "update failed" } };

    await expect(
      ingestionProcessor(makeJob({ userId: "user-1", accountId: "acc-1", platform: "youtube" })),
    ).rejects.toThrow("Cursor update failed, will retry");
  });
});
