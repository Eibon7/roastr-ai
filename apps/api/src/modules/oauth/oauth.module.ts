import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { OAuthController } from "./oauth.controller";
import { OAuthService } from "./oauth.service";
import { TokenEncryptionService } from "../../shared/crypto/token-encryption.service";
import { QUEUE_NAMES, INGESTION_QUEUE } from "../../shared/queue/queue.config";

@Module({
  imports: [ConfigModule],
  controllers: [OAuthController],
  providers: [
    OAuthService,
    TokenEncryptionService,
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
  exports: [OAuthService],
})
export class OAuthModule {}
