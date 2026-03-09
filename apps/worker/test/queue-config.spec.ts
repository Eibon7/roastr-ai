import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  getConnection,
  getQueuePrefix,
} from "../src/shared/queue.config.js";

describe("queue.config", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  describe("QUEUE_NAMES", () => {
    it("tiene nombres centralizados", () => {
      expect(QUEUE_NAMES.INGESTION).toBe("ingestion");
      expect(QUEUE_NAMES.ANALYSIS).toBe("analysis");
      expect(QUEUE_NAMES.SHIELD).toBe("shield");
      expect(QUEUE_NAMES.BILLING).toBe("billing");
      expect(QUEUE_NAMES.MAINTENANCE).toBe("maintenance");
    });
  });

  describe("DEFAULT_JOB_OPTIONS", () => {
    it("5 intentos con backoff exponencial", () => {
      expect(DEFAULT_JOB_OPTIONS.attempts).toBe(5);
      expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({
        type: "exponential",
        delay: 60_000,
      });
    });

    it("removeOnComplete true, removeOnFail false", () => {
      expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toBe(true);
      expect(DEFAULT_JOB_OPTIONS.removeOnFail).toBe(false);
    });
  });

  describe("getConnection", () => {
    it("usa REDIS_URL o fallback localhost", () => {
      delete process.env.REDIS_URL;
      expect(getConnection()).toEqual({ url: "redis://localhost:6379" });
      process.env.REDIS_URL = "redis://custom:6380";
      expect(getConnection()).toEqual({ url: "redis://custom:6380" });
    });
  });

  describe("getQueuePrefix", () => {
    it("dev por defecto en development", () => {
      process.env.NODE_ENV = "development";
      delete process.env.QUEUE_PREFIX;
      expect(getQueuePrefix()).toBe("dev");
    });

    it("prod en production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.QUEUE_PREFIX;
      expect(getQueuePrefix()).toBe("prod");
    });

    it("stg en staging", () => {
      process.env.NODE_ENV = "staging";
      delete process.env.QUEUE_PREFIX;
      expect(getQueuePrefix()).toBe("stg");
    });

    it("stg cuando NODE_ENV es 'stg'", () => {
      process.env.NODE_ENV = "stg";
      delete process.env.QUEUE_PREFIX;
      expect(getQueuePrefix()).toBe("stg");
    });

    it("QUEUE_PREFIX explícito tiene prioridad", () => {
      process.env.QUEUE_PREFIX = "custom";
      expect(getQueuePrefix()).toBe("custom");
    });
  });
});
