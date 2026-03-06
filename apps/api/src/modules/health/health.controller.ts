import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("db")
  async checkDb() {
    return { status: "ok", service: "supabase" };
  }

  @Get("redis")
  async checkRedis() {
    return { status: "ok", service: "redis" };
  }
}
