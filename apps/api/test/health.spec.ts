import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { INGESTION_QUEUE } from "../src/shared/queue/queue.config";
import { RedisHealthService } from "../src/modules/health/redis-health.service";

describe("HealthController", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Avoid a real Redis connection in tests — nothing here exercises queues.
      .overrideProvider(INGESTION_QUEUE)
      .useValue({ add: vi.fn().mockResolvedValue(undefined) })
      .overrideProvider(RedisHealthService)
      .useValue({ ping: vi.fn().mockResolvedValue({ status: "ok", latency: 1 }) })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("GET /health returns 200", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("GET /health/redis returns the ping result", async () => {
    const res = await fetch(`${baseUrl}/health/redis`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("GET /health/ready reports redis status from the ping", async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.redis.status).toBe("ok");
  });
});
