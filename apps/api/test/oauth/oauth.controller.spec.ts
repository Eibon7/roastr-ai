import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { OAuthController } from "../../src/modules/oauth/oauth.controller";
import { OAuthService } from "../../src/modules/oauth/oauth.service";

function makeRes() {
  return {
    redirect: vi.fn(),
  } as unknown as { redirect: ReturnType<typeof vi.fn> };
}

function makeService(overrides: Partial<Record<keyof OAuthService, unknown>> = {}) {
  return {
    getYouTubeAuthorizeUrl: vi.fn(),
    getXAuthorizeUrl: vi.fn(),
    handleYouTubeCallback: vi.fn(),
    handleXCallback: vi.fn(),
    ...overrides,
  } as unknown as OAuthService;
}

describe("OAuthController", () => {
  const FRONTEND_URL = "http://localhost:5173";
  let originalFrontendUrl: string | undefined;

  beforeEach(() => {
    originalFrontendUrl = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = FRONTEND_URL;
  });

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  describe("youtubeAuthorize", () => {
    it("throws UnauthorizedException when there is no authenticated user", async () => {
      const service = makeService();
      const controller = new OAuthController(service);

      await expect(controller.youtubeAuthorize({ user: undefined })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("returns the authorize URL for an authenticated user", async () => {
      const service = makeService({
        getYouTubeAuthorizeUrl: vi.fn().mockReturnValue({ url: "https://accounts.google.com/x", state: "s" }),
      });
      const controller = new OAuthController(service);

      const result = await controller.youtubeAuthorize({ user: { id: "user-1" } });

      expect(result).toEqual({ url: "https://accounts.google.com/x" });
      expect(service.getYouTubeAuthorizeUrl).toHaveBeenCalledWith("user-1", undefined);
    });

    it("forwards returnTo=onboarding to the service", async () => {
      const service = makeService({
        getYouTubeAuthorizeUrl: vi.fn().mockReturnValue({ url: "https://accounts.google.com/x", state: "s" }),
      });
      const controller = new OAuthController(service);

      await controller.youtubeAuthorize({ user: { id: "user-1" } }, "onboarding");

      expect(service.getYouTubeAuthorizeUrl).toHaveBeenCalledWith("user-1", "onboarding");
    });

    it("ignores an unrecognized returnTo value", async () => {
      const service = makeService({
        getYouTubeAuthorizeUrl: vi.fn().mockReturnValue({ url: "https://accounts.google.com/x", state: "s" }),
      });
      const controller = new OAuthController(service);

      await controller.youtubeAuthorize({ user: { id: "user-1" } }, "something-else");

      expect(service.getYouTubeAuthorizeUrl).toHaveBeenCalledWith("user-1", undefined);
    });
  });

  describe("xAuthorize", () => {
    it("throws UnauthorizedException when there is no authenticated user", async () => {
      const service = makeService();
      const controller = new OAuthController(service);

      await expect(controller.xAuthorize({ user: undefined })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("returns the authorize URL for an authenticated user", async () => {
      const service = makeService({
        getXAuthorizeUrl: vi.fn().mockReturnValue({ url: "https://x.com/i/oauth2/authorize?x=1", state: "s" }),
      });
      const controller = new OAuthController(service);

      const result = await controller.xAuthorize({ user: { id: "user-1" } });

      expect(result).toEqual({ url: "https://x.com/i/oauth2/authorize?x=1" });
      expect(service.getXAuthorizeUrl).toHaveBeenCalledWith("user-1", undefined);
    });

    it("forwards returnTo=onboarding to the service", async () => {
      const service = makeService({
        getXAuthorizeUrl: vi.fn().mockReturnValue({ url: "https://x.com/i/oauth2/authorize?x=1", state: "s" }),
      });
      const controller = new OAuthController(service);

      await controller.xAuthorize({ user: { id: "user-1" } }, "onboarding");

      expect(service.getXAuthorizeUrl).toHaveBeenCalledWith("user-1", "onboarding");
    });
  });

  describe("youtubeCallback", () => {
    it("redirects with the provider error when the provider reports one", async () => {
      const service = makeService();
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.youtubeCallback(undefined, undefined, "access_denied", res as never);

      expect(res.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/connect?error=access_denied`,
      );
      expect(service.handleYouTubeCallback).not.toHaveBeenCalled();
    });

    it("redirects to /onboarding on a provider error when the (unverified) state carries returnTo=onboarding", async () => {
      const service = makeService();
      const controller = new OAuthController(service);
      const res = makeRes();
      const fakeState =
        Buffer.from(JSON.stringify({ returnTo: "onboarding" }), "utf8").toString("base64url") +
        ".unsigned";

      await controller.youtubeCallback(undefined, fakeState, "access_denied", res as never);

      expect(res.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/onboarding?step=connect_accounts&error=access_denied`,
      );
    });

    it("redirects with missing_params when code is absent", async () => {
      const service = makeService();
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.youtubeCallback(undefined, "some-state", undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/connect?error=missing_params`);
    });

    it("redirects with missing_params when state is absent", async () => {
      const service = makeService();
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.youtubeCallback("some-code", undefined, undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/connect?error=missing_params`);
    });

    it("redirects with success and the accountId on a successful callback", async () => {
      const service = makeService({
        handleYouTubeCallback: vi.fn().mockResolvedValue({ accountId: "acc-1" }),
      });
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.youtubeCallback("code", "state", undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/connect?success=youtube&accountId=acc-1`,
      );
    });

    it("redirects to /onboarding when the callback was started from the onboarding wizard", async () => {
      const service = makeService({
        handleYouTubeCallback: vi.fn().mockResolvedValue({ accountId: "acc-1", returnTo: "onboarding" }),
      });
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.youtubeCallback("code", "state", undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/onboarding?step=connect_accounts&success=youtube&accountId=acc-1`,
      );
    });

    it("redirects with the error message when the service throws an Error", async () => {
      const service = makeService({
        handleYouTubeCallback: vi.fn().mockRejectedValue(new Error("Invalid state signature")),
      });
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.youtubeCallback("code", "state", undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/connect?error=${encodeURIComponent("Invalid state signature")}`,
      );
    });

    it("redirects with a generic oauth_failed message when the service throws a non-Error", async () => {
      const service = makeService({
        handleYouTubeCallback: vi.fn().mockRejectedValue({ message: "db explosion" }),
      });
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.youtubeCallback("code", "state", undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/connect?error=oauth_failed`);
    });
  });

  describe("xCallback", () => {
    it("redirects with the provider error when the provider reports one", async () => {
      const service = makeService();
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.xCallback(undefined, undefined, "access_denied", res as never);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/connect?error=access_denied`);
      expect(service.handleXCallback).not.toHaveBeenCalled();
    });

    it("redirects with missing_params when code or state is absent", async () => {
      const service = makeService();
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.xCallback(undefined, undefined, undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/connect?error=missing_params`);
    });

    it("redirects with success and the accountId on a successful callback", async () => {
      const service = makeService({
        handleXCallback: vi.fn().mockResolvedValue({ accountId: "acc-42" }),
      });
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.xCallback("code", "state", undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/connect?success=x&accountId=acc-42`,
      );
    });

    it("redirects with the error message when the service throws an Error", async () => {
      const service = makeService({
        handleXCallback: vi.fn().mockRejectedValue(new Error("X token exchange failed: 400 bad")),
      });
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.xCallback("code", "state", undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(
        `${FRONTEND_URL}/connect?error=${encodeURIComponent("X token exchange failed: 400 bad")}`,
      );
    });

    it("redirects with a generic oauth_failed message when the service throws a non-Error", async () => {
      const service = makeService({
        handleXCallback: vi.fn().mockRejectedValue("plain string failure"),
      });
      const controller = new OAuthController(service);
      const res = makeRes();

      await controller.xCallback("code", "state", undefined, res as never);

      expect(res.redirect).toHaveBeenCalledWith(`${FRONTEND_URL}/connect?error=oauth_failed`);
    });
  });
});
