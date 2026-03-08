import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

export type OffenderRow = {
  id: string;
  user_id: string;
  account_id: string;
  platform: string;
  offender_id: string;
  strike_level: number;
  last_strike: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class OffendersService {
  constructor(private readonly config: ConfigService) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  async getOffender(
    userId: string,
    accountId: string,
    offenderId: string,
  ): Promise<OffenderRow | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("offenders")
      .select("*")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("offender_id", offenderId)
      .maybeSingle();

    if (error) throw error;
    return data as OffenderRow | null;
  }

  async incrementStrike(
    userId: string,
    accountId: string,
    platform: string,
    offenderId: string,
  ): Promise<OffenderRow> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase.rpc("increment_offender_strike", {
      p_user_id: userId,
      p_account_id: accountId,
      p_platform: platform,
      p_offender_id: offenderId,
    });
    if (error) throw error;
    return data as OffenderRow;
  }
}
