import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ShieldLogsService } from "../../src/modules/shield/shield-logs.service";

const mockFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "range"]) {
    obj[m] = vi.fn(() => obj);
  }
  (obj as { then: PromiseLike<unknown>["then"] }).then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  return obj;
}

describe("ShieldLogsService", () => {
  let service: ShieldLogsService;
  let config: ConfigService;

  beforeEach(() => {
    mockFrom.mockReset();
    config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === "SUPABASE_URL") return "https://test.supabase.co";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-key";
        throw new Error(`Unknown config: ${key}`);
      }),
    } as unknown as ConfigService;
    service = new ShieldLogsService(config);
  });

  const sampleLog = {
    id: "l1",
    user_id: "u1",
    account_id: "a1",
    platform: "youtube",
    comment_id: "c1",
    offender_id: "off-1",
    action_taken: "hide",
    severity_score: 0.8,
    matched_red_line: null,
    using_aggressiveness: 0.95,
    platform_fallback: false,
    created_at: "2024-01-01T00:00:00.000Z",
  };

  it("returns paginated logs and total count on the happy path", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: [sampleLog], error: null, count: 1 }),
    );

    const result = await service.getLogs("u1", { limit: 10, offset: 0 });

    expect(result).toEqual({ logs: [sampleLog], total: 1 });
  });

  it("applies optional platform and action_taken filters", async () => {
    const builtChain = chain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValueOnce(builtChain);

    await service.getLogs("u1", {
      platform: "youtube",
      action_taken: "hide",
      limit: 10,
      offset: 0,
    });

    expect((builtChain.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      "platform",
      "youtube",
    ]);
    expect((builtChain.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      "action_taken",
      "hide",
    ]);
  });

  it("defaults to an empty log list and zero total when Supabase returns no data/count", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null, count: null }));

    const result = await service.getLogs("u1");

    expect(result).toEqual({ logs: [], total: 0 });
  });

  it("propagates the error when the database write/read fails (DB down)", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: new Error("connection refused"), count: null }),
    );

    await expect(service.getLogs("u1")).rejects.toThrow("connection refused");
  });
});
