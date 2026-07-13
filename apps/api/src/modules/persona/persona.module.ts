import { Module } from "@nestjs/common";
import { PersonaController } from "./persona.controller";
import { PersonaService } from "./persona.service";
import { TokenEncryptionService } from "../../shared/crypto/token-encryption.service";

@Module({
  controllers: [PersonaController],
  providers: [PersonaService, TokenEncryptionService],
})
export class PersonaModule {}
