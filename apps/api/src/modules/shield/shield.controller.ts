import { Controller, UseGuards } from "@nestjs/common";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";

@Controller("shield")
@UseGuards(SubscriptionGuard)
export class ShieldController {}
