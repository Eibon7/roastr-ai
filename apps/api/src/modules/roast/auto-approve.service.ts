import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

/**
 * Manages per-account auto-approve configuration for roast generation.
 * When auto_approve_roasts is true for an account, generated roasts are
 * immediately published without going through the pending_review queue.
 */
@Injectable()
export class AutoApproveService {
  constructor(private readonly config: ConfigService) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow<string>("SUPABASE_URL"),
      this.config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  async isAutoApproveEnabled(userId: string, accountId: string): Promise<boolean> {
    const supabase = this.getSupabase();
    const { data } = await supabase
      .from("accounts")
      .select("auto_approve_roasts")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    return (data as { auto_approve_roasts?: boolean } | null)?.auto_approve_roasts ?? false;
  }

  async setAutoApprove(userId: string, accountId: string, enabled: boolean): Promise<void> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from("accounts")
      .update({ auto_approve_roasts: enabled })
      .eq("id", accountId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to update auto-approve setting: ${error.message}`);
    }
  }

  async getConfig(userId: string, accountId: string): Promise<{ autoApproveRoasts: boolean }> {
    const enabled = await this.isAutoApproveEnabled(userId, accountId);
    return { autoApproveRoasts: enabled };
  }
}
