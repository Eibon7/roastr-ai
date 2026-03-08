import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ShieldController } from "./shield.controller";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";

@Module({
  imports: [ConfigModule],
  controllers: [ShieldController],
  providers: [SubscriptionGuard],
})
export class ShieldModule {}
