import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OAuthController } from "./oauth.controller";
import { OAuthService } from "./oauth.service";
import { TokenEncryptionService } from "../../shared/crypto/token-encryption.service";

@Module({
  imports: [ConfigModule],
  controllers: [OAuthController],
  providers: [OAuthService, TokenEncryptionService],
  exports: [OAuthService],
})
export class OAuthModule {}
