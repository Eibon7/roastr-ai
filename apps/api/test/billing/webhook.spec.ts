import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AppModule } from "../../src/app.module";

describe("PolarWebhookController", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("POST /webhooks/polar returns 200 for valid payload without secret", async () => {
    const res = await fetch(`${baseUrl}/webhooks/polar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "subscription.created",
        data: { user_id: "test-user-123", id: "sub_123" },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("POST /webhooks/polar ignores unknown event types", async () => {
    const res = await fetch(`${baseUrl}/webhooks/polar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "unknown.event",
        data: {},
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});
