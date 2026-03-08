import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BillingController } from "./billing.controller";
import { PolarWebhookController } from "./polar-webhook.controller";
import { BillingService } from "./billing.service";

@Module({
  imports: [ConfigModule],
  controllers: [BillingController, PolarWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
