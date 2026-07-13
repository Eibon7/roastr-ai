import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { AutoApproveService } from "../../src/modules/roast/auto-approve.service";

type MockMethods = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};
type MockChain = Promise<{ data: unknown; error: unknown }> & MockMethods;

function makeChain(defaultResult: { data: unknown; error: unknown } = { data: null, error: null }): MockChain {
  const chain = Promise.resolve(defaultResult) as unknown as MockChain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(defaultResult));
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

describe("AutoApproveService", () => {
  let service: AutoApproveService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AutoApproveService(makeConfig());
  });

  describe("isAutoApproveEnabled()", () => {
    it("returns true when the account has auto_approve enabled", async () => {
      mockFrom.mockReturnValue(makeChain({ data: { auto_approve: true }, error: null }));
      const result = await service.isAutoApproveEnabled("user-1", "account-1");
      expect(result).toBe(true);
    });

    it("returns false when the account has auto_approve disabled", async () => {
      mockFrom.mockReturnValue(makeChain({ data: { auto_approve: false }, error: null }));
      const result = await service.isAutoApproveEnabled("user-1", "account-1");
      expect(result).toBe(false);
    });

    it("defaults to false when no row is found", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
      const result = await service.isAutoApproveEnabled("user-1", "account-1");
      expect(result).toBe(false);
    });

    it("defaults to false when data has no auto_approve field", async () => {
      mockFrom.mockReturnValue(makeChain({ data: {}, error: null }));
      const result = await service.isAutoApproveEnabled("user-1", "account-1");
      expect(result).toBe(false);
    });
  });

  describe("setAutoApprove()", () => {
    it("updates the account's auto_approve flag", async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      await service.setAutoApprove("user-1", "account-1", true);

      expect(mockFrom).toHaveBeenCalledWith("accounts");
      expect(chain.update).toHaveBeenCalledWith({ auto_approve: true });
      expect(chain.eq).toHaveBeenCalledWith("id", "account-1");
      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("throws when the update fails", async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: "row not found" } }));
      await expect(service.setAutoApprove("user-1", "account-1", false)).rejects.toThrow(
        /Failed to update auto-approve setting: row not found/,
      );
    });
  });

  describe("getConfig()", () => {
    it("wraps isAutoApproveEnabled as { autoApproveRoasts }", async () => {
      mockFrom.mockReturnValue(makeChain({ data: { auto_approve: true }, error: null }));
      const result = await service.getConfig("user-1", "account-1");
      expect(result).toEqual({ autoApproveRoasts: true });
    });
  });
});
