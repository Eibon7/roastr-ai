import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { AccountsController } from "../../src/modules/accounts/accounts.controller";
import type { AccountsService, AccountRow } from "../../src/modules/accounts/accounts.service";

function makeAccountsService(): AccountsService {
  return {
    listByUserId: vi.fn(),
    disconnectByUserAndId: vi.fn(),
    setPaused: vi.fn(),
  } as unknown as AccountsService;
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

describe("AccountsController", () => {
  let accountsService: AccountsService;
  let controller: AccountsController;

  beforeEach(() => {
    accountsService = makeAccountsService();
    controller = new AccountsController(accountsService);
  });

  describe("list", () => {
    it("throws 401 when there is no authenticated user", async () => {
      await expect(controller.list({ user: undefined })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(accountsService.listByUserId).not.toHaveBeenCalled();
    });

    it("returns the connected accounts for the authenticated user (happy path)", async () => {
      vi.mocked(accountsService.listByUserId).mockResolvedValue([sampleAccount]);

      const result = await controller.list({ user: { id: "user-123" } });

      expect(result).toEqual([sampleAccount]);
      expect(accountsService.listByUserId).toHaveBeenCalledWith("user-123");
    });

    it("propagates errors raised by the service (e.g. database down)", async () => {
      vi.mocked(accountsService.listByUserId).mockRejectedValue(new Error("db is down"));

      await expect(controller.list({ user: { id: "user-123" } })).rejects.toThrow(
        "db is down",
      );
    });
  });

  describe("disconnect", () => {
    it("throws 401 when there is no authenticated user", async () => {
      await expect(
        controller.disconnect("acc-1", { user: undefined }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(accountsService.disconnectByUserAndId).not.toHaveBeenCalled();
    });

    it("disconnects the account and returns { disconnected: true } (happy path)", async () => {
      vi.mocked(accountsService.disconnectByUserAndId).mockResolvedValue(true);

      const result = await controller.disconnect("acc-1", { user: { id: "user-123" } });

      expect(result).toEqual({ disconnected: true });
      expect(accountsService.disconnectByUserAndId).toHaveBeenCalledWith("user-123", "acc-1");
    });

    it("throws 404 when the account does not exist for that user", async () => {
      vi.mocked(accountsService.disconnectByUserAndId).mockResolvedValue(false);

      await expect(
        controller.disconnect("does-not-exist", { user: { id: "user-123" } }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws 404 when trying to disconnect another user's account", async () => {
      // The service scopes delete by user_id, so a cross-user attempt resolves to
      // "no rows matched" rather than leaking whether the account exists.
      vi.mocked(accountsService.disconnectByUserAndId).mockResolvedValue(false);

      await expect(
        controller.disconnect("victim-account-id", { user: { id: "attacker-id" } }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(accountsService.disconnectByUserAndId).toHaveBeenCalledWith(
        "attacker-id",
        "victim-account-id",
      );
    });

    it("propagates errors raised by the service (e.g. database down)", async () => {
      vi.mocked(accountsService.disconnectByUserAndId).mockRejectedValue(new Error("db is down"));

      await expect(
        controller.disconnect("acc-1", { user: { id: "user-123" } }),
      ).rejects.toThrow("db is down");
    });
  });

  describe("setPaused", () => {
    it("throws 401 when there is no authenticated user", async () => {
      await expect(
        controller.setPaused("acc-1", { paused: true }, { user: undefined }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(accountsService.setPaused).not.toHaveBeenCalled();
    });

    it("throws 400 when paused is not a boolean", async () => {
      await expect(
        controller.setPaused(
          "acc-1",
          { paused: "yes" as unknown as boolean },
          { user: { id: "user-123" } },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("pauses the account and returns { paused: true } (happy path)", async () => {
      vi.mocked(accountsService.setPaused).mockResolvedValue(true);

      const result = await controller.setPaused(
        "acc-1",
        { paused: true },
        { user: { id: "user-123" } },
      );

      expect(result).toEqual({ paused: true });
      expect(accountsService.setPaused).toHaveBeenCalledWith("user-123", "acc-1", true);
    });

    it("resumes the account and returns { paused: false }", async () => {
      vi.mocked(accountsService.setPaused).mockResolvedValue(true);

      const result = await controller.setPaused(
        "acc-1",
        { paused: false },
        { user: { id: "user-123" } },
      );

      expect(result).toEqual({ paused: false });
      expect(accountsService.setPaused).toHaveBeenCalledWith("user-123", "acc-1", false);
    });

    it("throws 404 when the account does not exist or is not in the expected source status", async () => {
      vi.mocked(accountsService.setPaused).mockResolvedValue(false);

      await expect(
        controller.setPaused("acc-1", { paused: true }, { user: { id: "user-123" } }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("propagates errors raised by the service (e.g. database down)", async () => {
      vi.mocked(accountsService.setPaused).mockRejectedValue(new Error("db is down"));

      await expect(
        controller.setPaused("acc-1", { paused: true }, { user: { id: "user-123" } }),
      ).rejects.toThrow("db is down");
    });
  });
});
