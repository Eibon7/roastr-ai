import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { AppModule } from "../../src/app.module";
import { server } from "../mocks/server";
import { INGESTION_QUEUE } from "../../src/shared/queue/queue.config";

// Avoid a real Redis connection in tests — nothing here exercises queues.
function testingModule() {
  return Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(INGESTION_QUEUE)
    .useValue({ add: vi.fn().mockResolvedValue(undefined) });
}

describe("PolarWebhookController", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await testingModule().compile();

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

  it("POST /webhooks/polar resumes paused accounts when ENABLE_INGESTION fires (payment succeeded)", async () => {
    const supabaseUrl = process.env.SUPABASE_URL ?? "http://localhost:54321";
    let capturedUrl: URL | undefined;
    server.use(
      http.patch(`${supabaseUrl}/rest/v1/accounts`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([], { status: 200 });
      }),
    );

    const res = await fetch(`${baseUrl}/webhooks/polar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "subscription.created",
        data: { user_id: "test-user-enable-ingestion", id: "sub_enable" },
      }),
    });

    expect(res.status).toBe(200);
    expect(capturedUrl).toBeDefined();
    expect(capturedUrl!.searchParams.get("user_id")).toBe("eq.test-user-enable-ingestion");
    expect(capturedUrl!.searchParams.get("status")).toBe("eq.paused");
  });

  it("POST /webhooks/polar does not touch accounts when only a SEND_EMAIL side effect fires (subscription canceled from active)", async () => {
    const supabaseUrl = process.env.SUPABASE_URL ?? "http://localhost:54321";
    let accountsPatchCalled = false;
    server.use(
      http.get(`${supabaseUrl}/rest/v1/subscriptions_usage`, () =>
        HttpResponse.json({ billing_state: "active" }, { status: 200 }),
      ),
      http.patch(`${supabaseUrl}/rest/v1/accounts`, () => {
        accountsPatchCalled = true;
        return HttpResponse.json([], { status: 200 });
      }),
    );

    const res = await fetch(`${baseUrl}/webhooks/polar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "subscription.canceled",
        data: { user_id: "test-user-active-cancel", id: "sub_active" },
      }),
    });

    expect(res.status).toBe(200);
    expect(accountsPatchCalled).toBe(false);
  });

  it("POST /webhooks/polar returns 500 when the billing state conflicts on every retry", async () => {
    const supabaseUrl = process.env.SUPABASE_URL ?? "http://localhost:54321";
    server.use(
      http.post(`${supabaseUrl}/rest/v1/rpc/apply_billing_event`, () => {
        return HttpResponse.json("conflict", { status: 200 });
      }),
    );

    const res = await fetch(`${baseUrl}/webhooks/polar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "subscription.created",
        data: { user_id: "test-user-conflict", id: "sub_conflict" },
      }),
    });

    expect(res.status).toBe(500);
  });
});

describe("PolarWebhookController with signature verification enabled", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.POLAR_WEBHOOK_SECRET = "whsec_dGVzdC13ZWJob29rLXNlY3JldC0xMjM0NQ==";

    const moduleRef = await testingModule().compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.POLAR_WEBHOOK_SECRET;
  });

  it("POST /webhooks/polar returns 403 when the webhook signature is invalid", async () => {
    const res = await fetch(`${baseUrl}/webhooks/polar`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": "msg_invalid",
        "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
        "webhook-signature": "v1,not-a-valid-signature",
      },
      body: JSON.stringify({
        type: "subscription.created",
        data: { user_id: "test-user-123", id: "sub_123" },
      }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /webhooks/polar returns 403 when no signature headers are sent at all", async () => {
    const res = await fetch(`${baseUrl}/webhooks/polar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "subscription.created",
        data: { user_id: "test-user-123", id: "sub_123" },
      }),
    });
    expect(res.status).toBe(403);
  });
});

describe("PolarWebhookController in production without a secret configured", () => {
  let app: INestApplication;
  let baseUrl: string;
  let originalNodeEnv: string | undefined;

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.POLAR_WEBHOOK_SECRET;

    const moduleRef = await testingModule().compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("rejects with 403 instead of skipping signature verification (fail closed)", async () => {
    const res = await fetch(`${baseUrl}/webhooks/polar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "subscription.created",
        data: { user_id: "test-user-123", id: "sub_123" },
      }),
    });
    expect(res.status).toBe(403);
  });
});
