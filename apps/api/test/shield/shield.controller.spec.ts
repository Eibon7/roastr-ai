import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ShieldController } from "../../src/modules/shield/shield.controller";
import { ShieldConfigService } from "../../src/modules/shield/shield-config.service";
import { ShieldLogsService } from "../../src/modules/shield/shield-logs.service";

describe("ShieldController", () => {
  let controller: ShieldController;
  let shieldConfig: { getConfig: ReturnType<typeof vi.fn>; updateConfig: ReturnType<typeof vi.fn> };
  let shieldLogs: { getLogs: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    shieldConfig = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
    };
    shieldLogs = {
      getLogs: vi.fn(),
    };
    controller = new ShieldController(
      shieldConfig as unknown as ShieldConfigService,
      shieldLogs as unknown as ShieldLogsService,
    );
  });

  describe("GET accounts/:accountId/config", () => {
    it("returns 200 with the config on success", async () => {
      shieldConfig.getConfig.mockResolvedValueOnce({ shieldAggressiveness: 0.95 });

      const result = await controller.getConfig("a1", { user: { id: "u1" } });

      expect(result).toEqual({ shieldAggressiveness: 0.95 });
      expect(shieldConfig.getConfig).toHaveBeenCalledWith("u1", "a1");
    });

    it("throws 401 Unauthorized when there is no authenticated user", async () => {
      const promise = controller.getConfig("a1", {});
      await expect(promise).rejects.toThrow(UnauthorizedException);
      await promise.catch((err: UnauthorizedException) => {
        expect(err.getStatus()).toBe(401);
      });
      expect(shieldConfig.getConfig).not.toHaveBeenCalled();
    });

    it("throws 404 Not Found when the config does not exist", async () => {
      shieldConfig.getConfig.mockResolvedValueOnce(null);

      const promise = controller.getConfig("a1", { user: { id: "u1" } });
      await expect(promise).rejects.toThrow(NotFoundException);
      await promise.catch((err: NotFoundException) => {
        expect(err.getStatus()).toBe(404);
      });
    });
  });

  describe("PATCH accounts/:accountId/config", () => {
    it("returns 200 with the updated value on success", async () => {
      shieldConfig.updateConfig.mockResolvedValueOnce(true);

      const result = await controller.updateConfig(
        "a1",
        { shieldAggressiveness: 0.98 },
        { user: { id: "u1" } },
      );

      expect(result).toEqual({ shieldAggressiveness: 0.98 });
      expect(shieldConfig.updateConfig).toHaveBeenCalledWith("u1", "a1", 0.98);
    });

    it("throws 401 Unauthorized when there is no authenticated user", async () => {
      const promise = controller.updateConfig(
        "a1",
        { shieldAggressiveness: 0.98 },
        {},
      );
      await expect(promise).rejects.toThrow(UnauthorizedException);
      await promise.catch((err: UnauthorizedException) => {
        expect(err.getStatus()).toBe(401);
      });
    });

    it("throws 400 Bad Request when shieldAggressiveness is missing or not a number", async () => {
      const promise = controller.updateConfig(
        "a1",
        { shieldAggressiveness: undefined },
        { user: { id: "u1" } },
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await promise.catch((err: BadRequestException) => {
        expect(err.getStatus()).toBe(400);
      });
      expect(shieldConfig.updateConfig).not.toHaveBeenCalled();
    });

    it("throws 404 Not Found when the account/config row does not exist", async () => {
      shieldConfig.updateConfig.mockResolvedValueOnce(false);

      const promise = controller.updateConfig(
        "a1",
        { shieldAggressiveness: 0.98 },
        { user: { id: "u1" } },
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await promise.catch((err: NotFoundException) => {
        expect(err.getStatus()).toBe(404);
      });
    });

    it("propagates a real service failure instead of masking it as not-found", async () => {
      shieldConfig.updateConfig.mockRejectedValueOnce(new Error("db unavailable"));

      await expect(
        controller.updateConfig(
          "a1",
          { shieldAggressiveness: 0.98 },
          { user: { id: "u1" } },
        ),
      ).rejects.toThrow("db unavailable");
    });
  });

  describe("GET logs", () => {
    it("returns 200 with logs and total on success", async () => {
      shieldLogs.getLogs.mockResolvedValueOnce({ logs: [{ id: "l1" }], total: 1 });

      const result = await controller.getLogs(
        "youtube",
        "hide",
        "10",
        "0",
        { user: { id: "u1" } },
      );

      expect(result).toEqual({ logs: [{ id: "l1" }], total: 1 });
      expect(shieldLogs.getLogs).toHaveBeenCalledWith("u1", {
        platform: "youtube",
        action_taken: "hide",
        limit: 10,
        offset: 0,
      });
    });

    it("clamps limit to [1, 100] and offset to >= 0", async () => {
      shieldLogs.getLogs.mockResolvedValueOnce({ logs: [], total: 0 });

      await controller.getLogs(undefined, undefined, "9999", "-5", {
        user: { id: "u1" },
      });

      expect(shieldLogs.getLogs).toHaveBeenCalledWith("u1", {
        platform: undefined,
        action_taken: undefined,
        limit: 100,
        offset: 0,
      });
    });

    it("throws 401 Unauthorized when there is no authenticated user", async () => {
      const promise = controller.getLogs(undefined, undefined, undefined, undefined, {});
      await expect(promise).rejects.toThrow(UnauthorizedException);
      await promise.catch((err: UnauthorizedException) => {
        expect(err.getStatus()).toBe(401);
      });
      expect(shieldLogs.getLogs).not.toHaveBeenCalled();
    });

    it("propagates a service failure (e.g. DB down) without swallowing it", async () => {
      shieldLogs.getLogs.mockRejectedValueOnce(new Error("db down"));

      await expect(
        controller.getLogs(undefined, undefined, undefined, undefined, {
          user: { id: "u1" },
        }),
      ).rejects.toThrow("db down");
    });
  });
});
