import { Module } from "@nestjs/common";
import { ShieldController } from "./shield.controller";

@Module({
  controllers: [ShieldController],
})
export class ShieldModule {}
