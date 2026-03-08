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
    @Body() body: { password: string },
  ): Promise<void> {
    if (!req.user?.id) {
      throw new UnauthorizedException();
    }
    if (!body.password) {
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
      password: body.password,
    });
    if (signInErr) {
      throw new UnauthorizedException("Invalid password");
    }

    // Revoke OAuth tokens for all connected accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, platform, access_token, refresh_token")
      .eq("user_id", req.user.id);

    if (accounts) {
      for (const account of accounts) {
        if (account.access_token) {
          try {
            if (account.platform === "youtube") {
              await fetch(
                `https://oauth2.googleapis.com/revoke?token=${account.access_token}`,
                { method: "POST" },
              );
            } else if (account.platform === "x") {
              await fetch("https://api.twitter.com/2/oauth2/revoke", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  token: account.access_token,
                  token_type_hint: "access_token",
                }),
              });
            }
          } catch {
            // Best-effort revocation; proceed with deletion regardless
          }
        }
      }
    }

    // Cascade delete: user data in order of FK dependencies
    await supabase.from("subscriptions_usage").delete().eq("user_id", req.user.id);
    await supabase.from("shield_logs").delete().eq("user_id", req.user.id);
    await supabase.from("offenders").delete().eq("user_id", req.user.id);
    await supabase.from("accounts").delete().eq("user_id", req.user.id);

    // Delete auth user — triggers cascade on profiles via DB trigger
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(req.user.id);
    if (deleteErr) {
      throw new InternalServerErrorException(deleteErr.message);
    }
  }
}
