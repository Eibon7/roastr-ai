import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";

@Module({
  imports: [ConfigModule],
  controllers: [AccountsController],
  providers: [AccountsService, SubscriptionGuard],
})
export class AccountsModule {}
