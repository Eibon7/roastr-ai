import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import { ConfigService } from "@nestjs/config";

const ACTIVE_STATES = ["trialing", "active", "payment_retry", "canceled_pending"];

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) throw new ForbiddenException();

    const supabase = createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data } = await supabase
      .from("subscriptions_usage")
      .select("billing_state")
      .eq("user_id", user.id)
      .maybeSingle();

    const state = (data?.billing_state as string) ?? "trialing";
    if (!ACTIVE_STATES.includes(state)) {
      throw new ForbiddenException("Active subscription required");
    }
    return true;
  }
}
