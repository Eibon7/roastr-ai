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

@Controller("oauth")
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Get("youtube/authorize")
  async youtubeAuthorize(
    @Req() req: { user?: { id: string } },
  ): Promise<{ url: string }> {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    const { url } = this.oauth.getYouTubeAuthorizeUrl(req.user.id);
    return { url };
  }

  @Get("x/authorize")
  async xAuthorize(
    @Req() req: { user?: { id: string } },
  ): Promise<{ url: string }> {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    const { url } = this.oauth.getXAuthorizeUrl(req.user.id);
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
      res.redirect(`${frontendUrl}/connect?error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || !state) {
      res.redirect(`${frontendUrl}/connect?error=missing_params`);
      return;
    }
    try {
      const { accountId } = await this.oauth.handleXCallback(code, state);
      res.redirect(
        `${frontendUrl}/connect?success=x&accountId=${accountId}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "oauth_failed";
      res.redirect(`${frontendUrl}/connect?error=${encodeURIComponent(msg)}`);
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
      res.redirect(`${frontendUrl}/connect?error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || !state) {
      res.redirect(`${frontendUrl}/connect?error=missing_params`);
      return;
    }
    try {
      const { accountId } =
        await this.oauth.handleYouTubeCallback(code, state);
      res.redirect(
        `${frontendUrl}/connect?success=youtube&accountId=${accountId}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "oauth_failed";
      res.redirect(`${frontendUrl}/connect?error=${encodeURIComponent(msg)}`);
    }
  }
}
