import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ShieldModule } from "./modules/shield/shield.module";
import { AnalysisModule } from "./modules/analysis/analysis.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { PersonaModule } from "./modules/persona/persona.module";
import { FeatureFlagsModule } from "./modules/feature-flags/feature-flags.module";
import { validateEnv } from "./shared/config/env.validation";
import { SsotModule } from "./shared/config/ssot.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SsotModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>("REDIS_URL"),
        },
        prefix: config.getOrThrow<string>("QUEUE_PREFIX"),
      }),
    }),
    HealthModule,
    AuthModule,
    AccountsModule,
    BillingModule,
    ShieldModule,
    AnalysisModule,
    IngestionModule,
    PersonaModule,
    FeatureFlagsModule,
  ],
})
export class AppModule {}
