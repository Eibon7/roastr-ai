import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { ShieldConfigService } from "../../src/modules/shield/shield-config.service";

const mockFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ["select", "eq", "maybeSingle", "update"]) {
    obj[m] = vi.fn(() => obj);
  }
  (obj as { then: PromiseLike<unknown>["then"] }).then = (resolve, reject) =>
    Promise.resolve(result).then(resolve, reject);
  return obj;
}

describe("ShieldConfigService", () => {
  let service: ShieldConfigService;
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
    service = new ShieldConfigService(config);
  });

  describe("getConfig", () => {
    it("loads the account's shield aggressiveness", async () => {
      mockFrom.mockReturnValueOnce(
        chain({ data: { shield_aggressiveness: 0.95 }, error: null }),
      );

      const result = await service.getConfig("u1", "a1");

      expect(result).toEqual({ shieldAggressiveness: 0.95 });
    });

    it("returns null when no config row exists for the account", async () => {
      mockFrom.mockReturnValueOnce(chain({ data: null, error: null }));

      const result = await service.getConfig("u1", "a1");

      expect(result).toBeNull();
    });

    it("propagates the error when the query fails", async () => {
      mockFrom.mockReturnValueOnce(
        chain({ data: null, error: new Error("db down") }),
      );

      await expect(service.getConfig("u1", "a1")).rejects.toThrow("db down");
    });
  });

  describe("updateConfig", () => {
    it("persists a valid aggressiveness value and returns true", async () => {
      mockFrom.mockReturnValueOnce(
        chain({ data: [{ id: "a1" }], error: null }),
      );

      const result = await service.updateConfig("u1", "a1", 0.98);

      expect(result).toBe(true);
    });

    it("throws BadRequestException when the aggressiveness value is not an allowed one (missing/invalid config)", async () => {
      await expect(service.updateConfig("u1", "a1", 0.5)).rejects.toThrow(
        BadRequestException,
      );
      // Supabase must never be hit with an invalid value.
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("returns false (not found) when the update affects zero rows without a DB error", async () => {
      mockFrom.mockReturnValueOnce(chain({ data: [], error: null }));

      const result = await service.updateConfig("u1", "a1", 0.98);

      expect(result).toBe(false);
    });

    it("propagates the error explicitly when the update fails, instead of silently reporting not-found", async () => {
      mockFrom.mockReturnValueOnce(
        chain({ data: null, error: new Error("db unavailable") }),
      );

      await expect(service.updateConfig("u1", "a1", 0.98)).rejects.toThrow(
        "db unavailable",
      );
    });
  });
});
