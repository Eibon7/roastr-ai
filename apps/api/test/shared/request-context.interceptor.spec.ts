import { describe, it, expect, vi } from "vitest";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, lastValueFrom, Observable } from "rxjs";
import { RequestContextInterceptor } from "../../src/shared/logging/request-context.interceptor";

function createMockContext(overrides: {
  headers?: Record<string, string>;
  headersSent?: boolean;
} = {}): {
  context: ExecutionContext;
  request: { headers: Record<string, string>; requestId?: string };
  response: {
    headersSent: boolean;
    setHeader: ReturnType<typeof vi.fn>;
  };
} {
  const request: { headers: Record<string, string>; requestId?: string } = {
    headers: overrides.headers ?? {},
  };
  const response = {
    headersSent: overrides.headersSent ?? false,
    setHeader: vi.fn(),
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { context, request, response };
}

function createHandler(): CallHandler {
  return { handle: () => of("result") };
}

describe("RequestContextInterceptor", () => {
  it("generates a request id when the x-request-id header is missing", async () => {
    const interceptor = new RequestContextInterceptor();
    const { context, request, response } = createMockContext();

    const result = await lastValueFrom(interceptor.intercept(context, createHandler()));

    expect(result).toBe("result");
    expect(request.requestId).toBeDefined();
    expect(typeof request.requestId).toBe("string");
    // randomUUID format sanity check.
    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(response.setHeader).toHaveBeenCalledWith("x-request-id", request.requestId);
    expect(response.setHeader).toHaveBeenCalledWith(
      "x-response-time",
      expect.stringMatching(/^\d+ms$/),
    );
  });

  it("propagates the incoming x-request-id header instead of generating a new one", async () => {
    const interceptor = new RequestContextInterceptor();
    const { context, request, response } = createMockContext({
      headers: { "x-request-id": "incoming-request-id" },
    });

    await lastValueFrom(interceptor.intercept(context, createHandler()));

    expect(request.requestId).toBe("incoming-request-id");
    expect(response.setHeader).toHaveBeenCalledWith(
      "x-request-id",
      "incoming-request-id",
    );
  });

  it("does not attempt to set headers when the response has already been sent", async () => {
    const interceptor = new RequestContextInterceptor();
    const { context, response } = createMockContext({ headersSent: true });

    await lastValueFrom(interceptor.intercept(context, createHandler()));

    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it("propagates errors from downstream handlers while still finalizing", async () => {
    const interceptor = new RequestContextInterceptor();
    const { context, response } = createMockContext();
    const failingHandler: CallHandler = {
      handle: () =>
        new Observable((subscriber) => {
          subscriber.error(new Error("downstream failure"));
        }),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, failingHandler)),
    ).rejects.toThrow("downstream failure");

    // finalize() still runs on error, so headers get set.
    expect(response.setHeader).toHaveBeenCalledWith(
      "x-request-id",
      expect.any(String),
    );
  });
});
