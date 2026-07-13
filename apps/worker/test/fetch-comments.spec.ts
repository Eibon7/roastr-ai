import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchComments } from "../src/shared/fetch-comments.js";

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    platform: "youtube" as const,
    accessToken: "token-123",
    accountId: "acc-1",
    userId: "user-1",
    channelId: "channel-1",
    cursor: null,
    ...overrides,
  };
}

describe("fetchComments", () => {
  const origFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  describe("plataforma youtube", () => {
    it("mapea los comentarios de commentThreads a NormalizedComment", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "c1",
              snippet: {
                topLevelComment: {
                  snippet: {
                    authorDisplayName: "Alice",
                    authorChannelId: { value: "author-1" },
                    textDisplay: "hello",
                    publishedAt: "2026-01-01T00:00:00Z",
                  },
                },
              },
            },
          ],
          nextPageToken: "next-1",
        }),
      });

      const page = await fetchComments(baseParams());

      expect(page).toEqual({
        comments: [
          {
            id: "c1",
            platform: "youtube",
            accountId: "acc-1",
            userId: "user-1",
            authorId: "author-1",
            text: "hello",
            timestamp: "2026-01-01T00:00:00Z",
            metadata: {},
          },
        ],
        nextCursor: "next-1",
        hasMore: true,
      });
    });

    it("usa el authorDisplayName cuando falta authorChannelId", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "c1",
              snippet: {
                topLevelComment: {
                  snippet: {
                    authorDisplayName: "Alice",
                    textDisplay: "hi",
                    publishedAt: "2026-01-01T00:00:00Z",
                  },
                },
              },
            },
          ],
        }),
      });

      const page = await fetchComments(baseParams());

      expect(page.comments[0].authorId).toBe("Alice");
      expect(page.nextCursor).toBeNull();
      expect(page.hasMore).toBe(false);
    });

    it("retorna comments vacío si items no viene en la respuesta (malformada)", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const page = await fetchComments(baseParams());

      expect(page).toEqual({ comments: [], nextCursor: null, hasMore: false });
    });

    it("incluye pageToken cuando se pasa cursor", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await fetchComments(baseParams({ cursor: "cursor-abc" }));

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get("pageToken")).toBe("cursor-abc");
    });

    it("lanza si la respuesta no es 2xx (para que BullMQ reintente)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "quota exceeded",
      });

      await expect(fetchComments(baseParams())).rejects.toThrow(
        "YouTube commentThreads failed: 403 quota exceeded",
      );
    });

    it("relanza si la respuesta viene con JSON malformado (json() rechaza)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      });

      await expect(fetchComments(baseParams())).rejects.toThrow(
        "Unexpected end of JSON input",
      );
    });
  });

  describe("plataforma x", () => {
    it("mapea tweets/mentions a NormalizedComment", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "t1", text: "hey", author_id: "author-2", created_at: "2026-02-01T00:00:00Z" }],
          meta: { next_token: "tok-2" },
        }),
      });

      const page = await fetchComments(baseParams({ platform: "x" }));

      expect(page).toEqual({
        comments: [
          {
            id: "t1",
            platform: "x",
            accountId: "acc-1",
            userId: "user-1",
            authorId: "author-2",
            text: "hey",
            timestamp: "2026-02-01T00:00:00Z",
            metadata: {},
          },
        ],
        nextCursor: "tok-2",
        hasMore: true,
      });
    });

    it("usa valores por defecto cuando faltan author_id/text/created_at", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "t1" }] }),
      });

      const page = await fetchComments(baseParams({ platform: "x" }));

      expect(page.comments[0].authorId).toBe("");
      expect(page.comments[0].text).toBe("");
      expect(typeof page.comments[0].timestamp).toBe("string");
    });

    it("retorna comments vacío si data no viene en la respuesta (malformada)", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      const page = await fetchComments(baseParams({ platform: "x" }));

      expect(page).toEqual({ comments: [], nextCursor: null, hasMore: false });
    });

    it("incluye pagination_token cuando se pasa cursor", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await fetchComments(baseParams({ platform: "x", cursor: "cursor-xyz" }));

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get("pagination_token")).toBe("cursor-xyz");
    });

    it("lanza si la respuesta no es 2xx (para que BullMQ reintente)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "rate limited",
      });

      await expect(fetchComments(baseParams({ platform: "x" }))).rejects.toThrow(
        "X mentions failed: 429 rate limited",
      );
    });

    it("relanza si la respuesta viene con JSON malformado (json() rechaza)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError("bad json");
        },
      });

      await expect(fetchComments(baseParams({ platform: "x" }))).rejects.toThrow("bad json");
    });
  });

  it("retorna página vacía sin llamar a fetch para plataformas no soportadas", async () => {
    const page = await fetchComments(baseParams({ platform: "instagram" as never }));

    expect(page).toEqual({ comments: [], nextCursor: null, hasMore: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
