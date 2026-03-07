import { Module } from "@nestjs/common";
import { FeatureFlagService } from "./feature-flag.service";
import { FeatureFlagsController } from "./feature-flags.controller";
import { RequireFlagGuard } from "./require-flag.guard";

@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagService, RequireFlagGuard],
  exports: [FeatureFlagService, RequireFlagGuard],
})
export class FeatureFlagsModule {}
