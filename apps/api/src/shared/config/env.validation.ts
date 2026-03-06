import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url().default("http://localhost:54321"),
  SUPABASE_ANON_KEY: z.string().min(1).default("placeholder"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default("placeholder"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  QUEUE_PREFIX: z.enum(["dev", "stg", "prod"]).default("dev"),
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  API_URL: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  PORT: z.coerce.number().default(3000),
});

export function envValidation(config: Record<string, unknown>) {
  const parsed = schema.parse(config);
  return parsed;
}
