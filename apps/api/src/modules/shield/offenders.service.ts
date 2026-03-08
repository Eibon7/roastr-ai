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
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("offenders")
      .select("strike_level")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .eq("offender_id", offenderId)
      .maybeSingle();

    const newStrikeLevel = existing
      ? Math.min((existing.strike_level ?? 0) + 1, 3)
      : 1;

    const { data, error } = await supabase
      .from("offenders")
      .upsert(
        {
          user_id: userId,
          account_id: accountId,
          platform,
          offender_id: offenderId,
          strike_level: newStrikeLevel,
          last_strike: now,
          updated_at: now,
        },
        { onConflict: "user_id,account_id,offender_id" },
      )
      .select()
      .single();

    if (error) throw error;
    return data as OffenderRow;
  }
}
