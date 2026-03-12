import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
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
import { OAuthModule } from "./modules/oauth/oauth.module";
import { RoastModule } from "./modules/roast/roast.module";
import { validateEnv } from "./shared/config/env.validation";
import { SsotModule } from "./shared/config/ssot.module";
import { SupabaseAuthGuard } from "./shared/guards/supabase-auth.guard";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 100 },
    ]),
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
    OAuthModule,
    RoastModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_GUARD,
      useFactory: (config: ConfigService, reflector: Reflector) =>
        new SupabaseAuthGuard(config, reflector),
      inject: [ConfigService, Reflector],
    },
  ],
})
export class AppModule {}
