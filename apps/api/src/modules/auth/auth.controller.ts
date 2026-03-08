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
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import { Public } from "../../shared/guards/public.decorator";

type OnboardingState = "welcome" | "select_plan" | "payment" | "persona_setup" | "connect_accounts" | "done";

@Controller("auth")
export class AuthController {
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
      throw new InternalServerErrorException(error.message);
    }
    return { state: (data?.onboarding_state as OnboardingState) ?? "welcome" };
  }

  @Post("onboarding")
  @HttpCode(HttpStatus.OK)
  async setOnboarding(
    @Req() req: { user?: { id: string } },
    @Body() body: { state: OnboardingState },
  ): Promise<{ state: OnboardingState }> {
    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
    await supabase
      .from("profiles")
      .update({ onboarding_state: body.state, updated_at: new Date().toISOString() })
      .eq("id", req.user!.id);
    return { state: body.state };
  }
}
