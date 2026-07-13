import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";
import { AccountsService } from "./accounts.service";

type SetPausedBody = { paused: boolean };

@Controller("accounts")
@UseGuards(SubscriptionGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  async list(@Req() req: { user?: { id: string } }) {
    if (!req.user?.id) throw new UnauthorizedException();
    return this.accounts.listByUserId(req.user.id);
  }

  @Delete(":accountId")
  async disconnect(
    @Param("accountId") accountId: string,
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    const ok = await this.accounts.disconnectByUserAndId(req.user.id, accountId);
    if (!ok) throw new NotFoundException();
    return { disconnected: true };
  }

  @Patch(":accountId/pause")
  async setPaused(
    @Param("accountId") accountId: string,
    @Body() body: SetPausedBody,
    @Req() req: { user?: { id: string } },
  ) {
    if (!req.user?.id) throw new UnauthorizedException();
    if (typeof body.paused !== "boolean") {
      throw new BadRequestException("paused must be a boolean.");
    }
    const ok = await this.accounts.setPaused(req.user.id, accountId, body.paused);
    if (!ok) throw new NotFoundException();
    return { paused: body.paused };
  }
}
