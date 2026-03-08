import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { LlmService } from "./llm.service";
import { PromptBuilderService } from "./prompt-builder.service";
import { StyleValidatorService } from "./style-validator.service";
import { RoastPipelineService } from "./roast-pipeline.service";
import { AutoApproveService } from "./auto-approve.service";
import { RoastController } from "./roast.controller";

@Module({
  imports: [ConfigModule, FeatureFlagsModule],
  controllers: [RoastController],
  providers: [LlmService, PromptBuilderService, StyleValidatorService, RoastPipelineService, AutoApproveService],
  exports: [PromptBuilderService, StyleValidatorService, RoastPipelineService, AutoApproveService],
})
export class RoastModule {}
