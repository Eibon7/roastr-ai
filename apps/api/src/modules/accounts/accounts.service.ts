import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

export type AccountRow = {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id: string;
  username: string;
  status: string;
  status_reason: string | null;
  integration_health: string;
  shield_aggressiveness: number;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AccountsService {
  constructor(private readonly config: ConfigService) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  async listByUserId(userId: string): Promise<AccountRow[]> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("accounts")
      .select(
        "id,user_id,platform,platform_user_id,username,status,status_reason,integration_health,shield_aggressiveness,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as AccountRow[];
  }

  async deleteByUserAndId(userId: string, accountId: string): Promise<boolean> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", userId)
      .select("id");

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
}
