import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>("REDIS_URL"), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });
  }

  async ping(): Promise<{ status: "ok" | "error"; latency?: number }> {
    const start = Date.now();
    try {
      await this.client.ping();
      return { status: "ok", latency: Date.now() - start };
    } catch {
      return { status: "error" };
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
