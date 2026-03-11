import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes } from "node:crypto";
import {
  buildXAuthorizeUrl,
  exchangeXCode,
  generatePKCE,
} from "../../platforms/x/x.oauth.js";
import {
  buildYouTubeAuthorizeUrl,
  exchangeYouTubeCode,
} from "../../platforms/youtube/youtube.oauth.js";
import { TokenEncryptionService } from "../../shared/crypto/token-encryption.service";
import { PLAN_LIMITS } from "@roastr/shared";

const STATE_TTL_MS = 600_000; // 10 min

type StatePayload = {
  userId: string;
  nonce: string;
  exp: number;
  codeVerifier?: string;
};

@Injectable()
export class OAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  getYouTubeAuthorizeUrl(userId: string): { url: string; state: string } {
    const clientId = this.config.get("YOUTUBE_CLIENT_ID");
    const redirectUri = this.config.get("YOUTUBE_REDIRECT_URI");
    if (!clientId || !redirectUri) {
      throw new BadRequestException("YouTube OAuth is not configured");
    }
    const secret = this.config.getOrThrow("TOKEN_ENCRYPTION_KEY");
    const nonce = randomBytes(16).toString("hex");
    const payload: StatePayload = {
      userId,
      nonce,
      exp: Date.now() + STATE_TTL_MS,
    };
    const state = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", secret).update(state).digest("hex").slice(0, 16);
    const fullState = `${state}.${sig}`;

    const url = buildYouTubeAuthorizeUrl(
      { clientId, clientSecret: "", redirectUri },
      fullState,
    );
    return { url, state: fullState };
  }

  async handleYouTubeCallback(
    code: string,
    state: string,
  ): Promise<{ accountId: string }> {
    const clientId = this.config.get("YOUTUBE_CLIENT_ID");
    const clientSecret = this.config.get("YOUTUBE_CLIENT_SECRET");
    const redirectUri = this.config.get("YOUTUBE_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException("YouTube OAuth is not configured");
    }

    const [payloadB64, sig] = state.split(".");
    if (!payloadB64 || !sig) {
      throw new BadRequestException("Invalid state");
    }
    const secret = this.config.getOrThrow("TOKEN_ENCRYPTION_KEY");
    const expectedSig = createHmac("sha256", secret)
      .update(payloadB64)
      .digest("hex")
      .slice(0, 16);
    if (sig !== expectedSig) {
      throw new BadRequestException("Invalid state signature");
    }
    let payload: { userId: string; exp: number };
    try {
      payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      ) as { userId: string; exp: number };
    } catch {
      throw new BadRequestException("Invalid or expired state");
    }
    const userId = payload.userId;
    if (!userId || payload.exp < Date.now()) {
      throw new BadRequestException("Invalid or expired state");
    }

    const { tokens, channelId, channelTitle } = await exchangeYouTubeCode(
      { clientId, clientSecret, redirectUri },
      code,
    );

    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: sub } = await supabase
      .from("subscriptions_usage")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = (sub?.plan as keyof typeof PLAN_LIMITS) ?? "starter";
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
    const { count } = await supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("platform", "youtube");

    if ((count ?? 0) >= limits.accountsPerPlatform) {
      throw new BadRequestException(
        `Plan limit: max ${limits.accountsPerPlatform} YouTube account(s)`,
      );
    }

    const accessEncrypted = this.encryption.encrypt(tokens.accessToken);
    const refreshEncrypted = tokens.refreshToken
      ? this.encryption.encrypt(tokens.refreshToken)
      : null;

    const { data: account, error } = await supabase
      .from("accounts")
      .upsert(
        {
          user_id: userId,
          platform: "youtube",
          platform_user_id: channelId,
          username: channelTitle,
          status: "active",
          integration_health: "ok",
          access_token_encrypted: accessEncrypted,
          refresh_token_encrypted: refreshEncrypted ?? null,
          access_token_expires_at: tokens.expiresAt,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,platform,platform_user_id",
          ignoreDuplicates: false,
        },
      )
      .select("id")
      .single();

    if (error) throw error;
    return { accountId: account.id };
  }

  getXAuthorizeUrl(userId: string): { url: string; state: string } {
    const clientId = this.config.get("X_CLIENT_ID");
    const clientSecret = this.config.get("X_CLIENT_SECRET");
    const redirectUri = this.config.get("X_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException("X OAuth is not configured");
    }
    const secret = this.config.getOrThrow("TOKEN_ENCRYPTION_KEY");
    const nonce = randomBytes(16).toString("hex");
    const { codeVerifier, codeChallenge } = generatePKCE();
    const payload: StatePayload = {
      userId,
      nonce,
      exp: Date.now() + STATE_TTL_MS,
      codeVerifier,
    };
    const stateB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", secret).update(stateB64).digest("hex").slice(0, 16);
    const fullState = `${stateB64}.${sig}`;

    const url = buildXAuthorizeUrl(
      { clientId, clientSecret, redirectUri },
      fullState,
      codeChallenge,
    );
    return { url, state: fullState };
  }

  async handleXCallback(
    code: string,
    state: string,
  ): Promise<{ accountId: string }> {
    const clientId = this.config.get("X_CLIENT_ID");
    const clientSecret = this.config.get("X_CLIENT_SECRET");
    const redirectUri = this.config.get("X_REDIRECT_URI");
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException("X OAuth is not configured");
    }

    const [payloadB64, sig] = state.split(".");
    if (!payloadB64 || !sig) {
      throw new BadRequestException("Invalid state");
    }
    const secret = this.config.getOrThrow("TOKEN_ENCRYPTION_KEY");
    const expectedSig = createHmac("sha256", secret)
      .update(payloadB64)
      .digest("hex")
      .slice(0, 16);
    if (sig !== expectedSig) {
      throw new BadRequestException("Invalid state signature");
    }
    let payload: StatePayload;
    try {
      payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      ) as StatePayload;
    } catch {
      throw new BadRequestException("Invalid or expired state");
    }
    const userId = payload.userId;
    const codeVerifier = payload.codeVerifier;
    if (!userId || payload.exp < Date.now() || !codeVerifier) {
      throw new BadRequestException("Invalid or expired state");
    }

    const { tokens, userId: xUserId, username } = await exchangeXCode(
      { clientId, clientSecret, redirectUri },
      code,
      codeVerifier,
    );

    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: sub } = await supabase
      .from("subscriptions_usage")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = (sub?.plan as keyof typeof PLAN_LIMITS) ?? "starter";
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
    const { count } = await supabase
      .from("accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("platform", "x");

    if ((count ?? 0) >= limits.accountsPerPlatform) {
      throw new BadRequestException(
        `Plan limit: max ${limits.accountsPerPlatform} X account(s)`,
      );
    }

    const accessEncrypted = this.encryption.encrypt(tokens.accessToken);
    const refreshEncrypted = tokens.refreshToken
      ? this.encryption.encrypt(tokens.refreshToken)
      : null;

    const { data: account, error } = await supabase
      .from("accounts")
      .upsert(
        {
          user_id: userId,
          platform: "x",
          platform_user_id: xUserId,
          username,
          status: "active",
          integration_health: "ok",
          access_token_encrypted: accessEncrypted,
          refresh_token_encrypted: refreshEncrypted ?? null,
          access_token_expires_at: tokens.expiresAt,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,platform,platform_user_id",
          ignoreDuplicates: false,
        },
      )
      .select("id")
      .single();

    if (error) throw error;
    return { accountId: account.id };
  }
}
