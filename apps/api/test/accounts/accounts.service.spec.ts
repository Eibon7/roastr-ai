import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import { AccountsService, type AccountRow } from "../../src/modules/accounts/accounts.service";

// ─── Supabase mock factory (same shape used in auth/account-deletion.spec.ts) ──

type MockMethods = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
};

type MockChain = Promise<{ data: unknown; error: unknown }> & MockMethods;

function makeChain(defaultResult = { data: null as unknown, error: null as unknown }): MockChain {
  const chain = Promise.resolve(defaultResult) as unknown as MockChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  return chain;
}

const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

function makeConfig(): ConfigService {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (key === "SUPABASE_URL") return "https://test.supabase.co";
      if (key === "SUPABASE_SERVICE_ROLE_KEY") return "service-key";
      throw new Error(`Unknown config: ${key}`);
    }),
  } as unknown as ConfigService;
}

const sampleAccount: AccountRow = {
  id: "acc-1",
  user_id: "user-123",
  platform: "twitter",
  platform_user_id: "pu-1",
  username: "someuser",
  status: "connected",
  status_reason: null,
  integration_health: "ok",
  shield_aggressiveness: 50,
  retention_until: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// ingestionQueue is property-injected (@Inject on the field, not the
// constructor) — see accounts.service.ts for why. Plain `new` doesn't run
// Nest's property injection, so tests must assign it manually.
function makeService(cfg: ConfigService, queue: Queue): AccountsService {
  const svc = new AccountsService(cfg);
  (svc as unknown as { ingestionQueue: Queue }).ingestionQueue = queue;
  return svc;
}

describe("AccountsService", () => {
  let service: AccountsService;
  let mockQueue: Queue;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue = {
      getRepeatableJobs: vi.fn().mockResolvedValue([]),
      removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
    } as unknown as Queue;
    service = makeService(makeConfig(), mockQueue);
  });

  describe("listByUserId", () => {
    it("returns the connected accounts for a user (happy path)", async () => {
      mockFrom.mockReturnValue(makeChain({ data: [sampleAccount], error: null }));

      const result = await service.listByUserId("user-123");

      expect(result).toEqual([sampleAccount]);
      expect(mockFrom).toHaveBeenCalledWith("accounts");
    });

    it("returns an empty array when the user has no accounts", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

      const result = await service.listByUserId("user-123");

      expect(result).toEqual([]);
    });

    it("propagates the error when the database call fails", async () => {
      const dbError = { message: "connection refused" };
      mockFrom.mockReturnValue(makeChain({ data: null, error: dbError }));

      await expect(service.listByUserId("user-123")).rejects.toEqual(dbError);
    });

    it("scopes the query to the requesting user only", async () => {
      const chain = makeChain({ data: [sampleAccount], error: null });
      mockFrom.mockReturnValue(chain);

      await service.listByUserId("user-123");

      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-123");
    });
  });

  describe("disconnectByUserAndId", () => {
    it("returns true when the account was disconnected (happy path)", async () => {
      mockFrom.mockReturnValue(makeChain({ data: [{ id: "acc-1" }], error: null }));

      const result = await service.disconnectByUserAndId("user-123", "acc-1");

      expect(result).toBe(true);
    });

    it("returns false when no row matches (account not found)", async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }));

      const result = await service.disconnectByUserAndId("user-123", "does-not-exist");

      expect(result).toBe(false);
    });

    it("returns false when data is null", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: null }));

      const result = await service.disconnectByUserAndId("user-123", "acc-1");

      expect(result).toBe(false);
    });

    it("does not disconnect an account belonging to another user (scoped by user_id)", async () => {
      // The update query filters by BOTH accountId and user_id, so a user trying to
      // disconnect someone else's account will simply match zero rows.
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.disconnectByUserAndId("attacker-id", "victim-account-id");

      expect(result).toBe(false);
      expect(chain.eq).toHaveBeenCalledWith("id", "victim-account-id");
      expect(chain.eq).toHaveBeenCalledWith("user_id", "attacker-id");
    });

    it("propagates the error when the database call fails", async () => {
      const dbError = { message: "db is down" };
      mockFrom.mockReturnValue(makeChain({ data: null, error: dbError }));

      await expect(service.disconnectByUserAndId("user-123", "acc-1")).rejects.toEqual(dbError);
    });

    it("performs a soft update (revoked + 90-day retention), not a hard delete", async () => {
      const chain = makeChain({ data: [{ id: "acc-1" }], error: null });
      mockFrom.mockReturnValue(chain);

      await service.disconnectByUserAndId("user-123", "acc-1");

      expect(chain.delete).not.toHaveBeenCalled();
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "revoked",
          status_reason: "user_action",
          refresh_token_encrypted: null,
        }),
      );

      const [updatePayload] = chain.update.mock.calls[0];
      const retentionUntil = new Date(updatePayload.retention_until as string).getTime();
      const expected90d = Date.now() + 90 * 86_400_000;
      // Allow a small tolerance for time elapsed during the test run
      expect(Math.abs(retentionUntil - expected90d)).toBeLessThan(5_000);
    });

    it("removes the matching repeatable ingestion job after a successful disconnect", async () => {
      mockFrom.mockReturnValue(makeChain({ data: [{ id: "acc-1" }], error: null }));
      vi.mocked(mockQueue.getRepeatableJobs).mockResolvedValue([
        { key: "ingestion:acc-1-key", name: "ingest", id: "ingestion:acc-1", endDate: null, tz: null, pattern: null },
        { key: "ingestion:other-key", name: "ingest", id: "ingestion:other-account", endDate: null, tz: null, pattern: null },
      ]);

      await service.disconnectByUserAndId("user-123", "acc-1");

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith("ingestion:acc-1-key");
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    });

    it("does not touch the ingestion queue when no account was disconnected", async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }));

      await service.disconnectByUserAndId("user-123", "does-not-exist");

      expect(mockQueue.getRepeatableJobs).not.toHaveBeenCalled();
      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    });

    it("does not throw when there is no matching repeatable job (already stopped/never scheduled)", async () => {
      mockFrom.mockReturnValue(makeChain({ data: [{ id: "acc-1" }], error: null }));
      vi.mocked(mockQueue.getRepeatableJobs).mockResolvedValue([]);

      await expect(service.disconnectByUserAndId("user-123", "acc-1")).resolves.toBe(true);
      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    });
  });

  describe("setPaused", () => {
    it("pauses an active account", async () => {
      const chain = makeChain({ data: [{ id: "acc-1" }], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.setPaused("user-123", "acc-1", true);

      expect(result).toBe(true);
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "paused", status_reason: "user_action" }),
      );
      expect(chain.eq).toHaveBeenCalledWith("status", "active");
    });

    it("resumes a paused account, clearing status_reason", async () => {
      const chain = makeChain({ data: [{ id: "acc-1" }], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.setPaused("user-123", "acc-1", false);

      expect(result).toBe(true);
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", status_reason: null }),
      );
      expect(chain.eq).toHaveBeenCalledWith("status", "paused");
    });

    it("returns false when the account is not in the expected source status (e.g. broken or revoked)", async () => {
      mockFrom.mockReturnValue(makeChain({ data: [], error: null }));

      const result = await service.setPaused("user-123", "acc-1", true);

      expect(result).toBe(false);
    });

    it("does not pause an account belonging to another user (scoped by user_id)", async () => {
      const chain = makeChain({ data: [], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await service.setPaused("attacker-id", "victim-account-id", true);

      expect(result).toBe(false);
      expect(chain.eq).toHaveBeenCalledWith("id", "victim-account-id");
      expect(chain.eq).toHaveBeenCalledWith("user_id", "attacker-id");
    });

    it("propagates the error when the database call fails", async () => {
      const dbError = { message: "db is down" };
      mockFrom.mockReturnValue(makeChain({ data: null, error: dbError }));

      await expect(service.setPaused("user-123", "acc-1", true)).rejects.toEqual(dbError);
    });
  });
});
