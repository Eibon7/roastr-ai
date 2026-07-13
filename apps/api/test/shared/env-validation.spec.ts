import { describe, it, expect } from "vitest";
import { validateEnv } from "../../src/shared/config/env.validation";

const FULL_VALID_ENV = {
  NODE_ENV: "staging",
  PORT: "4000",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-value",
  REDIS_URL: "redis://localhost:6379",
  QUEUE_PREFIX: "stg",
  API_URL: "https://api.example.com",
  FRONTEND_URL: "https://app.example.com",
  WORKER_CONCURRENCY: "10",
  TOKEN_ENCRYPTION_KEY: "a-valid-32-character-secret-key!",
  YOUTUBE_CLIENT_ID: "yt-client-id",
  YOUTUBE_CLIENT_SECRET: "yt-client-secret",
  YOUTUBE_REDIRECT_URI: "https://app.example.com/oauth/youtube",
  X_CLIENT_ID: "x-client-id",
  X_CLIENT_SECRET: "x-client-secret",
  X_REDIRECT_URI: "https://app.example.com/oauth/x",
  OPENAI_API_KEY: "sk-openai",
  PERSPECTIVE_API_KEY: "perspective-key",
  PERSPECTIVE_TIMEOUT_MS: "5000",
  POLAR_ACCESS_TOKEN: "polar-token",
  POLAR_WEBHOOK_SECRET: "polar-secret",
  POLAR_PRODUCT_STARTER_ID: "9d3b6b1e-4f2a-4b3a-8f1a-1e2d3c4b5a6f",
  POLAR_PRODUCT_PRO_ID: "9d3b6b1e-4f2a-4b3a-8f1a-1e2d3c4b5a70",
  POLAR_PRODUCT_PLUS_ID: "9d3b6b1e-4f2a-4b3a-8f1a-1e2d3c4b5a71",
  RESEND_API_KEY: "resend-key",
};

describe("validateEnv", () => {
  it("accepts a fully populated, valid environment", () => {
    const result = validateEnv(FULL_VALID_ENV);
    expect(result.NODE_ENV).toBe("staging");
    expect(result.PORT).toBe(4000);
    expect(result.SUPABASE_URL).toBe("https://project.supabase.co");
    expect(result.WORKER_CONCURRENCY).toBe(10);
    expect(result.TOKEN_ENCRYPTION_KEY).toBe(FULL_VALID_ENV.TOKEN_ENCRYPTION_KEY);
    expect(result.POLAR_PRODUCT_PRO_ID).toBe(FULL_VALID_ENV.POLAR_PRODUCT_PRO_ID);
  });

  it("accepts an empty env in dev/test — defaults fill every required field", () => {
    const result = validateEnv({});
    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(3000);
    expect(result.SUPABASE_URL).toBe("http://localhost:54321");
    expect(result.QUEUE_PREFIX).toBe("dev");
  });

  it("rejects an invalid NODE_ENV value", () => {
    expect(() => validateEnv({ NODE_ENV: "not-a-real-env" })).toThrow(
      /Environment validation failed/,
    );
  });

  it("rejects a PORT outside the valid range", () => {
    expect(() => validateEnv({ PORT: "70000" })).toThrow(
      /Environment validation failed/,
    );
  });

  it("rejects a PORT that is not numeric", () => {
    expect(() => validateEnv({ PORT: "not-a-number" })).toThrow(
      /Environment validation failed/,
    );
  });

  it("rejects a malformed SUPABASE_URL", () => {
    expect(() => validateEnv({ SUPABASE_URL: "not-a-url" })).toThrow(
      /Environment validation failed/,
    );
  });

  it("rejects a malformed POLAR_PRODUCT_STARTER_ID (not a UUID)", () => {
    expect(() =>
      validateEnv({ POLAR_PRODUCT_STARTER_ID: "not-a-uuid" }),
    ).toThrow(/Environment validation failed/);
  });

  it("rejects a TOKEN_ENCRYPTION_KEY shorter than 32 characters", () => {
    expect(() =>
      validateEnv({ TOKEN_ENCRYPTION_KEY: "too-short" }),
    ).toThrow(/Environment validation failed/);
  });

  it("requires TOKEN_ENCRYPTION_KEY outside development/test environments", () => {
    expect(() => validateEnv({ NODE_ENV: "production" })).toThrow(
      /TOKEN_ENCRYPTION_KEY: Required in non-development environments/,
    );
  });

  it("does not require TOKEN_ENCRYPTION_KEY in development or test", () => {
    expect(() => validateEnv({ NODE_ENV: "development" })).not.toThrow();
    expect(() => validateEnv({ NODE_ENV: "test" })).not.toThrow();
  });

  it("passes for production when a valid TOKEN_ENCRYPTION_KEY is supplied", () => {
    const result = validateEnv({
      NODE_ENV: "production",
      TOKEN_ENCRYPTION_KEY: "a-valid-32-character-secret-key!",
    });
    expect(result.NODE_ENV).toBe("production");
  });
});
