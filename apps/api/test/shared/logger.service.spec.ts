import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger as SharedLogger } from "@roastr/shared";
import { LoggerService } from "../../src/shared/logging/logger.service";

function lastCallArg(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const raw = (spy as unknown as { mock: { calls: string[][] } }).mock.calls.at(-1)?.[0];
  return JSON.parse(raw!) as Record<string, unknown>;
}

describe("LoggerService", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is an instance of the shared Logger", () => {
    const logger = new LoggerService();
    expect(logger).toBeInstanceOf(SharedLogger);
  });

  it("tags every log entry with service: 'api'", () => {
    const logger = new LoggerService();
    logger.info("hello from api");
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.service).toBe("api");
    expect(output.message).toBe("hello from api");
    expect(output.level).toBe("info");
  });

  it("does not throw for info/warn/error/debug and formats the payload as JSON", () => {
    const logger = new LoggerService();
    expect(() => logger.info("info-msg", { userId: "u1" })).not.toThrow();
    expect(() => logger.warn("warn-msg", { jobId: "j1" })).not.toThrow();
    expect(() => logger.error("error-msg", { queue: "q1" })).not.toThrow();
    expect(() => logger.debug("debug-msg")).not.toThrow();

    expect(console.warn).toHaveBeenCalledOnce();
    const warnOutput = lastCallArg(console.warn as ReturnType<typeof vi.spyOn>);
    expect(warnOutput.jobId).toBe("j1");

    expect(console.error).toHaveBeenCalledOnce();
    const errorOutput = lastCallArg(console.error as ReturnType<typeof vi.spyOn>);
    expect(errorOutput.queue).toBe("q1");
  });

  it("redacts sensitive fields just like the shared logger", () => {
    const logger = new LoggerService();
    logger.info("auth attempt", { token: "secret-value" });
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.token).toBe("[REDACTED]");
  });

  it("child loggers inherit the api service context", () => {
    const logger = new LoggerService();
    const child = logger.child({ requestId: "req-123" });
    child.info("child log");
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.service).toBe("api");
    expect(output.requestId).toBe("req-123");
  });
});
