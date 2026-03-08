import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalysisController } from "./analysis.controller";
import { PerspectiveApiService } from "./perspective-api.service";

@Module({
  imports: [ConfigModule],
  controllers: [AnalysisController],
  providers: [PerspectiveApiService],
  exports: [PerspectiveApiService],
})
export class AnalysisModule {}
