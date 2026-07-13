import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("triggerAutoRoast", () => {
  const origEnv = process.env;
  const origFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const INPUT = {
    userId: "user-1",
    commentId: "comment-1",
    commentText: "you are trash",
    severityScore: 0.6,
    platform: "youtube",
    accountId: "acc-1",
    tone: "balanceado",
  };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...origEnv };
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = origEnv;
    globalThis.fetch = origFetch;
  });

  it("lanza si INTERNAL_API_SECRET no está configurado", async () => {
    delete process.env.INTERNAL_API_SECRET;
    const { triggerAutoRoast } = await import("../src/shared/roast-trigger.js");

    await expect(triggerAutoRoast(INPUT)).rejects.toThrow(
      "INTERNAL_API_SECRET is required to trigger automatic roast generation",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("llama al endpoint interno con la URL, headers y body correctos", async () => {
    process.env.INTERNAL_API_SECRET = "shared-secret-123";
    process.env.API_URL = "http://api.internal:3000";
    mockFetch.mockResolvedValue({ ok: true });
    const { triggerAutoRoast } = await import("../src/shared/roast-trigger.js");

    await triggerAutoRoast(INPUT);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://api.internal:3000/internal/roast/auto-generate",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": "shared-secret-123",
        },
        body: JSON.stringify(INPUT),
      }),
    );
  });

  it("usa http://localhost:3000 por defecto si no hay API_URL", async () => {
    process.env.INTERNAL_API_SECRET = "shared-secret-123";
    delete process.env.API_URL;
    mockFetch.mockResolvedValue({ ok: true });
    const { triggerAutoRoast } = await import("../src/shared/roast-trigger.js");

    await triggerAutoRoast(INPUT);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/internal/roast/auto-generate",
      expect.anything(),
    );
  });

  it("lanza con el status y body cuando la respuesta no es ok", async () => {
    process.env.INTERNAL_API_SECRET = "shared-secret-123";
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });
    const { triggerAutoRoast } = await import("../src/shared/roast-trigger.js");

    await expect(triggerAutoRoast(INPUT)).rejects.toThrow(
      "Auto-generate roast failed: 403 Forbidden",
    );
  });
});
