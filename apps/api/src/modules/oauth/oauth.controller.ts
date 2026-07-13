import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import { OAuthService } from "./oauth.service";
import { Public } from "../../shared/guards/public.decorator";

function buildRedirectUrl(
  frontendUrl: string,
  returnTo: "onboarding" | undefined,
  params: Record<string, string>,
): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return returnTo === "onboarding"
    ? `${frontendUrl}/onboarding?step=connect_accounts&${query}`
    : `${frontendUrl}/connect?${query}`;
}

@Controller("oauth")
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Get("youtube/authorize")
  async youtubeAuthorize(
    @Req() req: { user?: { id: string } },
    @Query("returnTo") returnTo?: string,
  ): Promise<{ url: string }> {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    const { url } = this.oauth.getYouTubeAuthorizeUrl(
      req.user.id,
      returnTo === "onboarding" ? "onboarding" : undefined,
    );
    return { url };
  }

  @Get("x/authorize")
  async xAuthorize(
    @Req() req: { user?: { id: string } },
    @Query("returnTo") returnTo?: string,
  ): Promise<{ url: string }> {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    const { url } = this.oauth.getXAuthorizeUrl(
      req.user.id,
      returnTo === "onboarding" ? "onboarding" : undefined,
    );
    return { url };
  }

  @Get("x/callback")
  @Public()
  async xCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    if (error) {
      res.redirect(
        buildRedirectUrl(frontendUrl, OAuthService.peekReturnTo(state), { error }),
      );
      return;
    }
    if (!code || !state) {
      res.redirect(
        buildRedirectUrl(frontendUrl, OAuthService.peekReturnTo(state), {
          error: "missing_params",
        }),
      );
      return;
    }
    try {
      const { accountId, returnTo } = await this.oauth.handleXCallback(code, state);
      res.redirect(buildRedirectUrl(frontendUrl, returnTo, { success: "x", accountId }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "oauth_failed";
      res.redirect(
        buildRedirectUrl(frontendUrl, OAuthService.peekReturnTo(state), { error: msg }),
      );
    }
  }

  @Get("youtube/callback")
  @Public()
  async youtubeCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    if (error) {
      res.redirect(
        buildRedirectUrl(frontendUrl, OAuthService.peekReturnTo(state), { error }),
      );
      return;
    }
    if (!code || !state) {
      res.redirect(
        buildRedirectUrl(frontendUrl, OAuthService.peekReturnTo(state), {
          error: "missing_params",
        }),
      );
      return;
    }
    try {
      const { accountId, returnTo } = await this.oauth.handleYouTubeCallback(code, state);
      res.redirect(
        buildRedirectUrl(frontendUrl, returnTo, { success: "youtube", accountId }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "oauth_failed";
      res.redirect(
        buildRedirectUrl(frontendUrl, OAuthService.peekReturnTo(state), { error: msg }),
      );
    }
  }
}
