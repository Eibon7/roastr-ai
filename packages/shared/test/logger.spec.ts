import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../src/logging/logger";

function lastCallArg(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const raw = (spy as unknown as { mock: { calls: string[][] } }).mock.calls.at(-1)?.[0];
  return JSON.parse(raw!) as Record<string, unknown>;
}

describe("Logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs structured JSON with level, message, and timestamp", () => {
    const logger = new Logger({ service: "test" }, "info");
    logger.info("hello");
    expect(console.log).toHaveBeenCalledOnce();
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.level).toBe("info");
    expect(output.message).toBe("hello");
    expect(output.service).toBe("test");
    expect(output.timestamp).toBeDefined();
  });

  it("respects minimum log level — suppresses lower levels", () => {
    const logger = new Logger({}, "warn");
    logger.debug("skip");
    logger.info("skip");
    logger.warn("show");
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("allows all levels when minLevel is debug", () => {
    const logger = new Logger({}, "debug");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("creates child loggers that inherit context", () => {
    const parent = new Logger({ service: "api" }, "info");
    const child = parent.child({ requestId: "123" });
    child.info("test");
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.service).toBe("api");
    expect(output.requestId).toBe("123");
  });

  it("child logger does not mutate parent context", () => {
    const parent = new Logger({ service: "api" }, "info");
    parent.child({ requestId: "abc" });
    parent.info("parent-msg");
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.requestId).toBeUndefined();
  });

  it("redacts sensitive top-level fields", () => {
    const logger = new Logger({}, "info");
    logger.info("data", { password: "secret123", name: "John" });
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.password).toBe("[REDACTED]");
    expect(output.name).toBe("John");
  });

  it("redacts nested sensitive fields", () => {
    const logger = new Logger({}, "info");
    logger.info("nested", { auth: { token: "abc", user: "me" } });
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    const auth = output.auth as Record<string, unknown>;
    expect(auth.token).toBe("[REDACTED]");
    expect(auth.user).toBe("me");
  });

  it("redacts multiple known fields: apikey, authorization, cookie, creditcard, secret", () => {
    const logger = new Logger({}, "info");
    logger.info("multi", {
      apikey: "k1",
      api_key: "k2",
      authorization: "Bearer x",
      cookie: "session=abc",
      creditcard: "4111",
      secret: "shh",
    });
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.apikey).toBe("[REDACTED]");
    expect(output.api_key).toBe("[REDACTED]");
    expect(output.authorization).toBe("[REDACTED]");
    expect(output.cookie).toBe("[REDACTED]");
    expect(output.creditcard).toBe("[REDACTED]");
    expect(output.secret).toBe("[REDACTED]");
  });

  it("routes error level to console.error", () => {
    const logger = new Logger({}, "info");
    logger.error("fail");
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.log).not.toHaveBeenCalled();
  });

  it("routes warn level to console.warn", () => {
    const logger = new Logger({}, "info");
    logger.warn("caution");
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.log).not.toHaveBeenCalled();
  });

  it("routes debug and info to console.log", () => {
    const logger = new Logger({}, "debug");
    logger.debug("d");
    logger.info("i");
    expect(console.log).toHaveBeenCalledTimes(2);
  });

  it("merges extra data into log entry", () => {
    const logger = new Logger({ service: "api" }, "info");
    logger.info("req", { method: "GET", path: "/health" });
    const output = lastCallArg(console.log as ReturnType<typeof vi.spyOn>);
    expect(output.method).toBe("GET");
    expect(output.path).toBe("/health");
    expect(output.service).toBe("api");
  });
});
