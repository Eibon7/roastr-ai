import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { DisclaimerService } from "./disclaimer.service";
import { LlmService } from "./llm.service";
import { PromptBuilderService } from "./prompt-builder.service";
import { StyleValidatorService } from "./style-validator.service";
import { RoastPipelineService } from "./roast-pipeline.service";
import { AutoApproveService } from "./auto-approve.service";
import { RoastController } from "./roast.controller";
import { RoastInternalController } from "./roast-internal.controller";

@Module({
  imports: [ConfigModule, FeatureFlagsModule],
  controllers: [RoastController, RoastInternalController],
  providers: [
    DisclaimerService,
    LlmService,
    PromptBuilderService,
    StyleValidatorService,
    RoastPipelineService,
    AutoApproveService,
  ],
  exports: [DisclaimerService, PromptBuilderService, StyleValidatorService, RoastPipelineService, AutoApproveService],
})
export class RoastModule {}
