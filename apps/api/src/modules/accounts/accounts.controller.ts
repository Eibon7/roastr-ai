import { Controller, UseGuards } from "@nestjs/common";
import { SubscriptionGuard } from "../../shared/guards/subscription.guard";

@Controller("accounts")
@UseGuards(SubscriptionGuard)
export class AccountsController {}
