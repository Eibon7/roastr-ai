import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { OffendersService } from "../../src/modules/shield/offenders.service";

const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ["select", "eq", "maybeSingle"]) {
    obj[m] = vi.fn(() => obj);
  }
  (obj as { then: PromiseLike<unknown>["then"] }).then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  return obj;
}

describe("OffendersService", () => {
  let service: OffendersService;
  let config: ConfigService;

  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
    config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === "SUPABASE_URL") return "https://test.supabase.co";
        if (key === "SUPABASE_SERVICE_ROLE_KEY") return "test-service-key";
        throw new Error(`Unknown config: ${key}`);
      }),
    } as unknown as ConfigService;
    service = new OffendersService(config);
  });

  describe("getOffender", () => {
    it("returns the offender row when found", async () => {
      const row = {
        id: "o1",
        user_id: "u1",
        account_id: "a1",
        platform: "youtube",
        offender_id: "off-1",
        strike_level: 2,
        last_strike: "2024-01-01T00:00:00.000Z",
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      };
      mockFrom.mockReturnValueOnce(chain({ data: row, error: null }));

      const result = await service.getOffender("u1", "a1", "youtube", "off-1");

      expect(result).toEqual(row);
    });

    it("returns null when no offender matches", async () => {
      mockFrom.mockReturnValueOnce(chain({ data: null, error: null }));

      const result = await service.getOffender("u1", "a1", "youtube", "off-1");

      expect(result).toBeNull();
    });

    it("propagates the error when the query fails", async () => {
      const dbError = new Error("query failed");
      mockFrom.mockReturnValueOnce(chain({ data: null, error: dbError }));

      await expect(
        service.getOffender("u1", "a1", "youtube", "off-1"),
      ).rejects.toThrow("query failed");
    });
  });

  describe("incrementStrike", () => {
    it("calls the RPC with the correct params and returns the updated row", async () => {
      const row = {
        id: "o1",
        user_id: "u1",
        account_id: "a1",
        platform: "youtube",
        offender_id: "off-1",
        strike_level: 3,
        last_strike: "2024-06-01T00:00:00.000Z",
        created_at: "2023-01-01T00:00:00.000Z",
        updated_at: "2024-06-01T00:00:00.000Z",
      };
      mockRpc.mockResolvedValueOnce({ data: row, error: null });

      const result = await service.incrementStrike("u1", "a1", "youtube", "off-1");

      expect(mockRpc).toHaveBeenCalledWith("increment_offender_strike", {
        p_user_id: "u1",
        p_account_id: "a1",
        p_platform: "youtube",
        p_offender_id: "off-1",
      });
      expect(result).toEqual(row);
    });

    it("propagates the Supabase RPC error explicitly instead of silencing it", async () => {
      const rpcError = new Error("rpc unavailable");
      mockRpc.mockResolvedValueOnce({ data: null, error: rpcError });

      await expect(
        service.incrementStrike("u1", "a1", "youtube", "off-1"),
      ).rejects.toThrow("rpc unavailable");
    });

    it("throws explicitly when the RPC succeeds but returns no data", async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        service.incrementStrike("u1", "a1", "youtube", "off-1"),
      ).rejects.toThrow("increment_offender_strike returned null");
    });
  });
});
