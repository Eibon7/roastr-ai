import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

const VALID_AGGRESSIVENESS: readonly number[] = [0.9, 0.95, 0.98, 1.0];

@Injectable()
export class ShieldConfigService {
  constructor(private readonly config: ConfigService) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  async getConfig(
    userId: string,
    accountId: string,
  ): Promise<{ shieldAggressiveness: number } | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("accounts")
      .select("shield_aggressiveness")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return { shieldAggressiveness: data.shield_aggressiveness };
  }

  async updateConfig(
    userId: string,
    accountId: string,
    shieldAggressiveness: number,
  ): Promise<boolean> {
    if (typeof shieldAggressiveness !== "number" || !VALID_AGGRESSIVENESS.includes(shieldAggressiveness)) {
      return false;
    }
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from("accounts")
      .update({
        shield_aggressiveness: shieldAggressiveness,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("user_id", userId);

    return !error;
  }
}
