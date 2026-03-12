import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "@roastr/shared";
import { Public } from "../../shared/guards/public.decorator";

const REVOCATION_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const ONBOARDING_STATES = [
  "welcome",
  "select_plan",
  "payment",
  "persona_setup",
  "connect_accounts",
  "done",
] as const;

type OnboardingState = (typeof ONBOARDING_STATES)[number];

function isOnboardingState(value: unknown): value is OnboardingState {
  return ONBOARDING_STATES.includes(value as OnboardingState);
}

@Controller("auth")
export class AuthController {
  private readonly logger = new Logger({ service: AuthController.name });

  constructor(private readonly config: ConfigService) {}

  @Post("register")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: { email: string; password: string },
  ): Promise<{ id: string }> {
    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data, error } = await supabase.auth.admin.createUser({
      email: body.email?.toLowerCase().trim(),
      password: body.password,
      email_confirm: true,
    });
    if (error) {
      const msg = (error as { message?: string }).message?.toLowerCase() ?? "";
      const code = (error as { code?: string }).code ?? "";
      const isDuplicate =
        code === "user_already_exists" ||
        msg.includes("already registered") ||
        msg.includes("already exists");
      if (isDuplicate) {
        return { id: "00000000-0000-0000-0000-000000000000" };
      }
      throw error;
    }
    return { id: data.user.id };
  }

  @Get("onboarding")
  async getOnboarding(@Req() req: { user?: { id: string } }): Promise<{ state: OnboardingState }> {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarding_state")
      .eq("id", req.user.id)
      .maybeSingle();
    if (error) {
      this.logger.error("Supabase error fetching onboarding state", { code: (error as { code?: string }).code });
      throw new InternalServerErrorException("Authentication service error");
    }
    if (data === null) {
      throw new NotFoundException("Profile not found");
    }
    const raw = data?.onboarding_state;
    const validState: OnboardingState = isOnboardingState(raw) ? raw : "welcome";
    return { state: validState };
  }

  @Post("onboarding")
  @HttpCode(HttpStatus.OK)
  async setOnboarding(
    @Req() req: { user?: { id: string } },
    @Body() body: { state: OnboardingState },
  ): Promise<{ state: OnboardingState }> {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }

    if (!body || typeof body !== "object" || !("state" in body) || !isOnboardingState(body.state)) {
      throw new BadRequestException("Invalid onboarding state");
    }

    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_state: body.state, updated_at: new Date().toISOString() })
      .eq("id", req.user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      this.logger.error("Supabase error updating onboarding state", { code: (error as { code?: string }).code });
      throw new InternalServerErrorException("Authentication service error");
    }
    if (!data) {
      throw new NotFoundException("Profile not found");
    }

    return { state: body.state };
  }

  @Delete("account")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @Req() req: { user?: { id: string } },
    @Body() body?: { password?: string },
  ): Promise<void> {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    const password = body?.password;
    if (!password) {
      throw new BadRequestException("Password is required");
    }

    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Verify password by attempting sign-in with the user's email
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", req.user.id)
      .maybeSingle();

    if (profileErr || !profile?.email) {
      throw new InternalServerErrorException("Could not retrieve account");
    }

    const anonClient = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_ANON_KEY"),
    );
    const { error: signInErr } = await anonClient.auth.signInWithPassword({
      email: profile.email,
      password,
    });
    if (signInErr) {
      throw new UnauthorizedException("Invalid password");
    }

    // Revoke OAuth tokens for all connected accounts
    const { data: accounts, error: accountsErr } = await supabase
      .from("accounts")
      .select("id, platform, access_token")
      .eq("user_id", req.user.id);

    if (accountsErr) {
      throw new InternalServerErrorException(
        `Failed to load accounts for revocation: ${accountsErr.message}`,
      );
    }

    if (accounts) {
      for (const account of accounts) {
        if (account.access_token) {
          let revoked = false;
          try {
            if (account.platform === "youtube") {
              const res = await fetchWithTimeout(
                "https://oauth2.googleapis.com/revoke",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: new URLSearchParams({ token: account.access_token }).toString(),
                },
                REVOCATION_TIMEOUT_MS,
              );
              revoked = res.ok;
            } else if (account.platform === "x") {
              const res = await fetchWithTimeout(
                "https://api.twitter.com/2/oauth2/revoke",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/x-www-form-urlencoded" },
                  body: new URLSearchParams({
                    token: account.access_token,
                    token_type_hint: "access_token",
                  }).toString(),
                },
                REVOCATION_TIMEOUT_MS,
              );
              revoked = res.ok;
            } else {
              // Unknown platform — no revocation endpoint; treat as revoked
              revoked = true;
            }
          } catch (err) {
            this.logger.error("OAuth token revocation request threw", {
              accountId: account.id,
              platform: account.platform,
              error: err instanceof Error ? err.message : String(err),
            });
          }

          if (!revoked) {
            // Abort deletion so the token stays in the DB and the user can retry.
            // Deleting the account row before confirming revocation would
            // leave the token non-revokable forever.
            throw new InternalServerErrorException(
              `OAuth token revocation failed for account ${account.id} (${account.platform}). ` +
                "Please try again; if the issue persists contact support.",
            );
          }
        }
      }
    }

    // Cascade delete: user data in order of FK dependencies
    const tables = ["subscriptions_usage", "shield_logs", "offenders", "accounts"] as const;
    for (const table of tables) {
      const { error: delErr } = await supabase.from(table).delete().eq("user_id", req.user.id);
      if (delErr) {
        throw new InternalServerErrorException(
          `Failed to delete ${table}: ${delErr.message}`,
        );
      }
    }

    // Delete auth user — triggers cascade on profiles via DB trigger
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(req.user.id);
    if (deleteErr) {
      throw new InternalServerErrorException(deleteErr.message);
    }
  }
}
