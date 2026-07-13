import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch } from "@/lib/api";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a JSON body on a normal 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ hello: "world" })),
      }),
    );

    const result = await apiFetch("/anything");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns undefined instead of throwing on a 204 No Content response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: () => Promise.resolve(""),
      }),
    );

    const result = await apiFetch("/roast/candidates/id-1/discard", { method: "PATCH" });
    expect(result).toBeUndefined();
  });

  it("returns undefined instead of throwing on any other empty-body success response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      }),
    );

    const result = await apiFetch("/anything");
    expect(result).toBeUndefined();
  });

  it("throws with the status and statusText when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    let caught: unknown;
    try {
      await apiFetch("/anything");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("API 500: Internal Server Error");
  });
});
