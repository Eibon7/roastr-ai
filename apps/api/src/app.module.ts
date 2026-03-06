import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ShieldModule } from "./modules/shield/shield.module";
import { AnalysisModule } from "./modules/analysis/analysis.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { PersonaModule } from "./modules/persona/persona.module";
import { envValidation } from "./shared/config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || "redis://localhost:6379",
      },
      prefix: process.env.QUEUE_PREFIX || "dev",
    }),
    HealthModule,
    AuthModule,
    AccountsModule,
    BillingModule,
    ShieldModule,
    AnalysisModule,
    IngestionModule,
    PersonaModule,
  ],
})
export class AppModule {}
