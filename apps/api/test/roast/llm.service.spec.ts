import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LlmService } from "../../src/modules/roast/llm.service";
import type { BuiltPrompt } from "../../src/modules/roast/prompt-builder.service";

const mockFetch = vi.fn();

function makeConfig(apiKey: string | undefined): ConfigService {
  return {
    get: vi.fn((key: string) => (key === "OPENAI_API_KEY" ? apiKey : undefined)),
  } as unknown as ConfigService;
}

const PROMPT: BuiltPrompt = {
  system: "Eres un asistente.",
  user: "Responde al comentario.",
  maxChars: 280,
};

function okResponse(body: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  };
}

describe("LlmService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("no API key configured", () => {
    it("returns a mock response without calling fetch", async () => {
      const svc = new LlmService(makeConfig(undefined));
      const result = await svc.generate(PROMPT);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.model).toBe("mock");
      expect(result.tokens_used).toBe(0);
      expect(result.text).toContain("[MOCK]");
      expect(result.text).toContain(PROMPT.user.slice(0, 80));
    });
  });

  describe("happy path", () => {
    it("calls OpenAI with the built prompt and returns parsed text", async () => {
      mockFetch.mockResolvedValue(
        okResponse({
          choices: [{ message: { content: "  Un roast afilado.  " } }],
          model: "gpt-4o-mini",
          usage: { total_tokens: 42 },
        }),
      );

      const svc = new LlmService(makeConfig("sk-test"));
      const result = await svc.generate(PROMPT);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk-test",
          }),
        }),
      );
      const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(sentBody.messages).toEqual([
        { role: "system", content: PROMPT.system },
        { role: "user", content: PROMPT.user },
      ]);
      expect(sentBody.max_tokens).toBe(Math.ceil(PROMPT.maxChars / 3));

      // trimmed content
      expect(result.text).toBe("Un roast afilado.");
      expect(result.model).toBe("gpt-4o-mini");
      expect(result.tokens_used).toBe(42);
    });

    it("defaults tokens_used to 0 when usage is missing", async () => {
      mockFetch.mockResolvedValue(
        okResponse({
          choices: [{ message: { content: "Respuesta" } }],
          model: "gpt-4o-mini",
        }),
      );

      const svc = new LlmService(makeConfig("sk-test"));
      const result = await svc.generate(PROMPT);
      expect(result.tokens_used).toBe(0);
    });
  });

  describe("HTTP error responses", () => {
    it("throws InternalServerErrorException with the error body when the API responds non-ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("rate limit exceeded"),
      });

      const svc = new LlmService(makeConfig("sk-test"));
      await expect(svc.generate(PROMPT)).rejects.toBeInstanceOf(InternalServerErrorException);
      await expect(svc.generate(PROMPT)).rejects.toThrow(/rate limit exceeded/);
    });

    it("falls back to 'unknown error' when reading the error body itself fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error("body stream broken")),
      });

      const svc = new LlmService(makeConfig("sk-test"));
      await expect(svc.generate(PROMPT)).rejects.toThrow(/unknown error/);
    });
  });

  describe("malformed / unexpected responses", () => {
    it("returns empty text when choices array is empty (no throw)", async () => {
      mockFetch.mockResolvedValue(
        okResponse({ choices: [], model: "gpt-4o-mini", usage: { total_tokens: 5 } }),
      );

      const svc = new LlmService(makeConfig("sk-test"));
      const result = await svc.generate(PROMPT);
      expect(result.text).toBe("");
    });

    it("throws an uncaught TypeError when 'choices' is entirely missing from the payload", async () => {
      // SUSPICIOUS: llm.service.ts accesses `data.choices[0]` without optional-chaining
      // the array index itself (only chains after it). If the upstream API ever omits
      // `choices` (e.g. a malformed/edge-case payload), this throws a raw TypeError
      // instead of a controlled HttpException. This test pins down that behavior;
      // it is NOT fixed here per instructions (report-only finding).
      mockFetch.mockResolvedValue(okResponse({ model: "gpt-4o-mini", usage: { total_tokens: 1 } }));

      const svc = new LlmService(makeConfig("sk-test"));
      await expect(svc.generate(PROMPT)).rejects.toThrow(TypeError);
    });
  });

  describe("network failures / timeouts", () => {
    it("propagates a network error thrown by fetch (no retry, no catch)", async () => {
      // SUSPICIOUS: there is no try/catch around `fetch(...)` in llm.service.ts, no
      // AbortController/timeout configured, and no retry logic. A rejected fetch
      // (network failure, DNS error, or an aborted/timed-out request) propagates
      // as-is out of generate(). This test documents that current behavior.
      const networkError = new Error("fetch failed: ECONNRESET");
      mockFetch.mockRejectedValue(networkError);

      const svc = new LlmService(makeConfig("sk-test"));
      await expect(svc.generate(PROMPT)).rejects.toThrow("fetch failed: ECONNRESET");
    });

    it("propagates an AbortError when the request is aborted (simulated timeout)", async () => {
      const abortError = new DOMException("The operation was aborted.", "AbortError");
      mockFetch.mockRejectedValue(abortError);

      const svc = new LlmService(makeConfig("sk-test"));
      await expect(svc.generate(PROMPT)).rejects.toThrow(/aborted/i);
    });
  });
});
