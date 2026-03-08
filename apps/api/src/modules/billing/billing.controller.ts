import { Controller, Get, Post, Body, Req } from "@nestjs/common";
import { BillingService } from "./billing.service";
import type { Plan } from "@roastr/shared";

type RequestWithUser = { user: { id: string; email?: string } };

@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("usage")
  async getUsage(@Req() req: RequestWithUser) {
    const user = req.user;
    const usage = await this.billing.getUsage(user.id);
    return usage ?? {
      plan: "starter" as Plan,
      billing_state: "trialing",
      analysis_limit: 1000,
      analysis_used: 0,
      roasts_limit: 0,
      roasts_used: 0,
      current_period_end: null,
      trial_end: null,
    };
  }

  @Post("checkout")
  async createCheckout(
    @Body() body: { plan: Plan },
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    const plan = body?.plan ?? "starter";
    const email = user.email ?? "";
    const result = await this.billing.createCheckoutUrl(user.id, email, plan);
    if (!result) {
      throw new Error("Checkout not configured. Set POLAR_ACCESS_TOKEN and POLAR_PRODUCT_*_ID.");
    }
    return result;
  }
}
