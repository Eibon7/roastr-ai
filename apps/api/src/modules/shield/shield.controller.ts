import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Req,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";
import { ShieldConfigService } from "./shield-config.service";
import { ShieldLogsService } from "./shield-logs.service";

@Controller("shield")
@UseGuards(SubscriptionGuard)
export class ShieldController {
  constructor(
    private readonly shieldConfig: ShieldConfigService,
    private readonly shieldLogs: ShieldLogsService,
  ) {}

  @Get("accounts/:accountId/config")
  async getConfig(
    @Param("accountId") accountId: string,
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    const config = await this.shieldConfig.getConfig(req.user.id, accountId);
    if (!config) throw new NotFoundException();
    return config;
  }

  @Patch("accounts/:accountId/config")
  async updateConfig(
    @Param("accountId") accountId: string,
    @Body() body: { shieldAggressiveness?: number },
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    const val = body.shieldAggressiveness;
    if (typeof val !== "number" || ![0.9, 0.95, 0.98, 1].includes(val)) {
      throw new BadRequestException(
        "shieldAggressiveness must be 0.9, 0.95, 0.98, or 1",
      );
    }
    const ok = await this.shieldConfig.updateConfig(
      req.user.id,
      accountId,
      val,
    );
    if (!ok) throw new NotFoundException();
    return { shieldAggressiveness: val };
  }

  @Get("logs")
  async getLogs(
    @Query("platform") platform: string | undefined,
    @Query("action_taken") actionTaken: string | undefined,
    @Query("limit") limitStr: string | undefined,
    @Query("offset") offsetStr: string | undefined,
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    const limit = limitStr ? Math.min(100, Math.max(1, parseInt(limitStr, 10) || 50)) : 50;
    const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10) || 0) : 0;
    const { logs, total } = await this.shieldLogs.getLogs(req.user.id, {
      platform,
      action_taken: actionTaken,
      limit,
      offset,
    });
    return { logs, total };
  }
}
