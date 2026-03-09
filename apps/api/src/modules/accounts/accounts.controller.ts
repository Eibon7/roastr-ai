import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";
import { AccountsService } from "./accounts.service";

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
    const ok = await this.accounts.deleteByUserAndId(req.user.id, accountId);
    if (!ok) throw new NotFoundException();
    return { deleted: true };
  }
}
