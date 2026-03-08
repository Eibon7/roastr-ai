import { Module } from "@nestjs/common";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { PromptBuilderService } from "./prompt-builder.service";
import { StyleValidatorService } from "./style-validator.service";

@Module({
  imports: [FeatureFlagsModule],
  providers: [PromptBuilderService, StyleValidatorService],
  exports: [PromptBuilderService, StyleValidatorService],
})
export class RoastModule {}
