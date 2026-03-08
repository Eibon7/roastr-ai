import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

@Injectable()
export class TokenEncryptionService {
  // Lazily derived on first encrypt()/decrypt() call; never in constructor.
  private key: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  private getKey(): Buffer {
    if (this.key) return this.key;
    const secret =
      this.config?.get<string>("TOKEN_ENCRYPTION_KEY") ??
      process.env.TOKEN_ENCRYPTION_KEY;
    if (!secret) {
      throw new Error("TOKEN_ENCRYPTION_KEY is required");
    }
    this.key = scryptSync(secret, "roastr-token-salt", KEY_LENGTH);
    return this.key;
  }

  encrypt(plaintext: string): Buffer {
    const key = this.getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }

  decrypt(ciphertext: Buffer): string {
    const key = this.getKey();
    const iv = ciphertext.subarray(0, IV_LENGTH);
    const tag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  }
}
