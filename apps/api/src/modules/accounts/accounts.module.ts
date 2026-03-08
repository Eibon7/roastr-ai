import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountsController } from "./accounts.controller";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";

@Module({
  imports: [ConfigModule],
  controllers: [AccountsController],
  providers: [SubscriptionGuard],
})
export class AccountsModule {}
