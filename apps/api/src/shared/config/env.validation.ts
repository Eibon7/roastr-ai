import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),

  SUPABASE_URL: z.string().url().default("http://localhost:54321"),
  SUPABASE_ANON_KEY: z.string().min(1).default("placeholder"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default("placeholder"),

  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  QUEUE_PREFIX: z.enum(["dev", "stg", "prod"]).default("dev"),

  API_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  WORKER_CONCURRENCY: z.coerce.number().default(5),

  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REDIRECT_URI: z.string().url().optional(),

  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_REDIRECT_URI: z.string().url().optional(),

  OPENAI_API_KEY: z.string().optional(),
  PERSPECTIVE_API_KEY: z.string().optional(),

  POLAR_ACCESS_TOKEN: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}
