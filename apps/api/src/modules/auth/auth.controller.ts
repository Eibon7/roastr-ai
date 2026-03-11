import {
  Controller,
  Post,
  Get,
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
}
