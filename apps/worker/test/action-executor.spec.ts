import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hideComment, blockUser, reportComment } from "../src/shared/action-executor.js";

describe("hideComment", () => {
  const origFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("youtube: éxito retorna ok true", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => "" });

    const result = await hideComment("youtube", "tok", "c1");

    expect(result).toEqual({ ok: true });
    expect(mockFetch.mock.calls[0][0]).toContain("setModerationStatus");
  });

  it("youtube: falla si la API responde no-2xx", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: async () => "forbidden" });

    const result = await hideComment("youtube", "tok", "c1");

    expect(result).toEqual({ ok: false, error: "YouTube setModerationStatus: 403 — forbidden" });
  });

  it("youtube: no incluye el cuerpo en el error si viene vacío", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "" });

    const result = await hideComment("youtube", "tok", "c1");

    expect(result).toEqual({ ok: false, error: "YouTube setModerationStatus: 500" });
  });

  it("youtube: trunca el cuerpo del error a 500 caracteres", async () => {
    const longBody = "x".repeat(1000);
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => longBody });

    const result = await hideComment("youtube", "tok", "c1");

    expect(result.error).toBe(`YouTube setModerationStatus: 400 — ${"x".repeat(500)}`);
  });

  it("youtube: si leer el cuerpo del error falla, usa cadena vacía", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error("stream closed");
      },
    });

    const result = await hideComment("youtube", "tok", "c1");

    expect(result).toEqual({ ok: false, error: "YouTube setModerationStatus: 500" });
  });

  it("x: éxito retorna ok true", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => "" });

    const result = await hideComment("x", "tok", "t1");

    expect(result).toEqual({ ok: true });
    expect(mockFetch.mock.calls[0][0]).toContain("/hidden");
  });

  it("x: falla si la API responde no-2xx", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" });

    const result = await hideComment("x", "tok", "t1");

    expect(result).toEqual({ ok: false, error: "X hide reply: 401 — unauthorized" });
  });

  it("plataforma no soportada retorna ok false", async () => {
    const result = await hideComment("instagram" as never, "tok", "c1");

    expect(result).toEqual({ ok: false, error: "hideComment not supported for instagram" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("error de red retorna ok false con el mensaje de la excepción", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNRESET"));

    const result = await hideComment("youtube", "tok", "c1");

    expect(result).toEqual({ ok: false, error: "hideComment network error: ECONNRESET" });
  });
});

describe("blockUser", () => {
  const origFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("youtube: éxito con commentId retorna ok true", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => "" });

    const result = await blockUser("youtube", "tok", "author-1", "c1");

    expect(result).toEqual({ ok: true });
    expect(mockFetch.mock.calls[0][0]).toContain("banAuthor=true");
  });

  it("youtube: falla sin commentId (requerido por banAuthor)", async () => {
    const result = await blockUser("youtube", "tok", "author-1");

    expect(result).toEqual({ ok: false, error: "YouTube banAuthor requires a commentId" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("youtube: falla si la API responde no-2xx", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "server error" });

    const result = await blockUser("youtube", "tok", "author-1", "c1");

    expect(result).toEqual({ ok: false, error: "YouTube banAuthor: 500 — server error" });
  });

  it("x: siempre falla porque requiere Enterprise API", async () => {
    const result = await blockUser("x", "tok", "author-1", "t1");

    expect(result).toEqual({ ok: false, error: "X blocking requires Enterprise API access" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("plataforma no soportada retorna ok false", async () => {
    const result = await blockUser("tiktok" as never, "tok", "author-1");

    expect(result).toEqual({ ok: false, error: "blockUser not supported for tiktok" });
  });

  it("error de red retorna ok false con el mensaje de la excepción", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));

    const result = await blockUser("youtube", "tok", "author-1", "c1");

    expect(result).toEqual({ ok: false, error: "blockUser network error: timeout" });
  });
});

describe("reportComment", () => {
  it("sin onUnsupported retorna ok false indicando que falta el fallback", async () => {
    const result = await reportComment("youtube", "tok", "c1", "spam");

    expect(result).toEqual({
      ok: false,
      error: "youtube: no native report API; provide onUnsupported fallback",
    });
  });

  it("delega en onUnsupported y retorna su resultado si tiene éxito", async () => {
    const onUnsupported = vi.fn().mockResolvedValue({ ok: true });

    const result = await reportComment("youtube", "tok", "c1", "harassment", onUnsupported);

    expect(result).toEqual({ ok: true });
    expect(onUnsupported).toHaveBeenCalledWith("youtube", "tok", "c1");
  });

  it("propaga el resultado de fallo de onUnsupported (todas las acciones fallaron)", async () => {
    const onUnsupported = vi.fn().mockResolvedValue({ ok: false, error: "hide failed too" });

    const result = await reportComment("x", "tok", "t1", "threat", onUnsupported);

    expect(result).toEqual({ ok: false, error: "hide failed too" });
  });

  it("si onUnsupported lanza una excepción, la convierte en ActionResult ok:false", async () => {
    const onUnsupported = vi.fn().mockRejectedValue(new Error("fallback exploded"));

    const result = await reportComment("youtube", "tok", "c1", "other", onUnsupported);

    expect(result).toEqual({ ok: false, error: "fallback exploded" });
  });

  it("si onUnsupported lanza un valor no-Error, usa String(err) como mensaje", async () => {
    const onUnsupported = vi.fn().mockRejectedValue("boom");

    const result = await reportComment("youtube", "tok", "c1", "other", onUnsupported);

    expect(result).toEqual({ ok: false, error: "boom" });
  });
});
