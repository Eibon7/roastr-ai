import { Module } from "@nestjs/common";
import { PersonaController } from "./persona.controller";

@Module({
  controllers: [PersonaController],
})
export class PersonaModule {}
