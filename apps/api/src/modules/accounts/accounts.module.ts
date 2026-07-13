import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";
import { QUEUE_NAMES, INGESTION_QUEUE } from "../../shared/queue/queue.config";

@Module({
  imports: [ConfigModule],
  controllers: [AccountsController],
  providers: [
    AccountsService,
    SubscriptionGuard,
    {
      provide: INGESTION_QUEUE,
      useFactory: (config: ConfigService) =>
        new Queue(QUEUE_NAMES.INGESTION, {
          connection: { url: config.getOrThrow<string>("REDIS_URL") },
          prefix: config.getOrThrow<string>("QUEUE_PREFIX"),
        }),
      inject: [ConfigService],
    },
  ],
})
export class AccountsModule {}
