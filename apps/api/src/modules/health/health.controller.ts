import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      version: process.env.npm_package_version || "0.0.1",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get("ready")
  readiness() {
    const checks: Record<string, { status: string; latency?: number }> = {};

    checks.supabase = {
      status: process.env.SUPABASE_URL ? "ok" : "degraded",
    };

    checks.redis = {
      status: process.env.REDIS_URL ? "ok" : "degraded",
    };

    const allOk = Object.values(checks).every((c) => c.status === "ok");

    return {
      status: allOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("metrics")
  metrics() {
    const mem = process.memoryUsage();
    return {
      uptime: process.uptime(),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
