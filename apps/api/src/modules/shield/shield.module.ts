import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ShieldController } from "./shield.controller";
import { ShieldConfigService } from "./shield-config.service";
import { ShieldLogsService } from "./shield-logs.service";
import { OffendersService } from "./offenders.service";
import { AnonymizeService } from "./anonymize.service";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";

@Module({
  imports: [ConfigModule],
  controllers: [ShieldController],
  providers: [ShieldConfigService, ShieldLogsService, OffendersService, AnonymizeService, SubscriptionGuard],
  exports: [ShieldConfigService, OffendersService, AnonymizeService],
})
export class ShieldModule {}
