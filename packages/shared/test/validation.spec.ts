import { describe, it, expect } from "vitest";
import { envSchema } from "../src/schemas/validation";

const validEnv = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  REDIS_URL: "redis://localhost:6379",
};

describe("envSchema", () => {
  it("accepts the minimal required set of variables and applies defaults", () => {
    const parsed = envSchema.parse(validEnv);
    expect(parsed.QUEUE_PREFIX).toBe("dev");
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.API_URL).toBe("http://localhost:3000");
    expect(parsed.FRONTEND_URL).toBe("http://localhost:5173");
  });

  it("leaves optional fields undefined when not provided", () => {
    const parsed = envSchema.parse(validEnv);
    expect(parsed.YOUTUBE_CLIENT_ID).toBeUndefined();
    expect(parsed.OPENAI_API_KEY).toBeUndefined();
    expect(parsed.PERSPECTIVE_API_KEY).toBeUndefined();
    expect(parsed.POLAR_WEBHOOK_SECRET).toBeUndefined();
  });

  it.each([
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "REDIS_URL",
  ] as const)("fails validation when required field %s is missing", (key) => {
    const { [key]: _omit, ...rest } = validEnv;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  it("rejects an invalid URL for SUPABASE_URL", () => {
    expect(() => envSchema.parse({ ...validEnv, SUPABASE_URL: "not-a-url" })).toThrow();
  });

  it("rejects an invalid URL for REDIS_URL", () => {
    expect(() => envSchema.parse({ ...validEnv, REDIS_URL: "not-a-url" })).toThrow();
  });

  it("rejects an empty string for SUPABASE_ANON_KEY (min length 1)", () => {
    expect(() => envSchema.parse({ ...validEnv, SUPABASE_ANON_KEY: "" })).toThrow();
  });

  it("accepts explicit QUEUE_PREFIX enum values", () => {
    expect(envSchema.parse({ ...validEnv, QUEUE_PREFIX: "prod" }).QUEUE_PREFIX).toBe("prod");
    expect(envSchema.parse({ ...validEnv, QUEUE_PREFIX: "stg" }).QUEUE_PREFIX).toBe("stg");
  });

  it("rejects a QUEUE_PREFIX value outside the enum", () => {
    expect(() => envSchema.parse({ ...validEnv, QUEUE_PREFIX: "qa" })).toThrow();
  });

  it("rejects a NODE_ENV value outside the enum", () => {
    expect(() => envSchema.parse({ ...validEnv, NODE_ENV: "test" })).toThrow();
  });

  it("accepts optional OAuth fields when provided as valid URLs/strings", () => {
    const parsed = envSchema.parse({
      ...validEnv,
      YOUTUBE_CLIENT_ID: "client-id",
      YOUTUBE_CLIENT_SECRET: "client-secret",
      YOUTUBE_REDIRECT_URI: "https://app.example.com/callback",
    });
    expect(parsed.YOUTUBE_CLIENT_ID).toBe("client-id");
    expect(parsed.YOUTUBE_REDIRECT_URI).toBe("https://app.example.com/callback");
  });

  it("rejects an invalid optional redirect URI when provided", () => {
    expect(() =>
      envSchema.parse({ ...validEnv, YOUTUBE_REDIRECT_URI: "not-a-url" }),
    ).toThrow();
  });
});
