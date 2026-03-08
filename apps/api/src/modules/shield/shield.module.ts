import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ShieldController } from "./shield.controller";
import { ShieldConfigService } from "./shield-config.service";
import { ShieldLogsService } from "./shield-logs.service";
import { OffendersService } from "./offenders.service";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";

@Module({
  imports: [ConfigModule],
  controllers: [ShieldController],
  providers: [ShieldConfigService, ShieldLogsService, OffendersService, SubscriptionGuard],
  exports: [ShieldConfigService, OffendersService],
})
export class ShieldModule {}
