import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";

export type ShieldLogRow = {
  id: string;
  user_id: string;
  account_id: string;
  platform: string;
  comment_id: string;
  offender_id: string | null;
  action_taken: string;
  severity_score: number;
  matched_red_line: string | null;
  using_aggressiveness: number | null;
  platform_fallback: boolean;
  created_at: string;
};

export type ShieldLogsQuery = {
  platform?: string;
  action_taken?: string;
  limit?: number;
  offset?: number;
};

@Injectable()
export class ShieldLogsService {
  constructor(private readonly config: ConfigService) {}

  private getSupabase() {
    return createClient(
      this.config.getOrThrow("SUPABASE_URL"),
      this.config.getOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }

  async getLogs(
    userId: string,
    query: ShieldLogsQuery = {},
  ): Promise<{ logs: ShieldLogRow[]; total: number }> {
    const { platform, action_taken, limit = 50, offset = 0 } = query;
    const supabase = this.getSupabase();

    let q = supabase
      .from("shield_logs")
      .select(
        "id,user_id,account_id,platform,comment_id,offender_id,action_taken,severity_score,matched_red_line,using_aggressiveness,platform_fallback,created_at",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (platform) q = q.eq("platform", platform);
    if (action_taken) q = q.eq("action_taken", action_taken);

    const { data, error, count } = await q;

    if (error) throw error;
    return {
      logs: (data ?? []) as ShieldLogRow[],
      total: count ?? 0,
    };
  }
}
