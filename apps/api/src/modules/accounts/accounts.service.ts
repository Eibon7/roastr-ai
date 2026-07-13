import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "@supabase/supabase-js";
import type { Queue } from "bullmq";
import { INGESTION_QUEUE } from "../../shared/queue/queue.config";

// Keep in sync with RETENTION_DAYS in apps/worker/src/processors/maintenance.ts,
// which purges accounts once retention_until elapses (docs/04-conexion-redes-sociales.md §4.5).
const RETENTION_DAYS = 90;

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
  retention_until: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AccountsService {
  // Property injection (not a constructor param) — same reason as
  // OAuthService: adding INGESTION_QUEUE as a constructor parameter makes
  // Test.createTestingModule().compile() hang indefinitely.
  @Inject(INGESTION_QUEUE) private readonly ingestionQueue!: Queue;

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
        "id,user_id,platform,platform_user_id,username,status,status_reason,integration_health,shield_aggressiveness,retention_until,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as AccountRow[];
  }

  /**
   * Disconnects an account per docs/04-conexion-redes-sociales.md §4.5: this
   * is NOT a hard delete. It revokes access (status='revoked'), clears the
   * refresh token (access_token_encrypted can't be null — NOT NULL column —
   * but it becomes inert once the account is no longer 'active'), stops the
   * recurring ingestion job, and starts the 90-day GDPR retention window.
   * apps/worker/src/processors/maintenance.ts purges the row once
   * retention_until elapses.
   */
  async disconnectByUserAndId(userId: string, accountId: string): Promise<boolean> {
    const supabase = this.getSupabase();
    const retentionUntil = new Date(Date.now() + RETENTION_DAYS * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from("accounts")
      .update({
        status: "revoked",
        status_reason: "user_action",
        refresh_token_encrypted: null,
        retention_until: retentionUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("user_id", userId)
      .select("id");

    if (error) throw error;
    const disconnected = (data?.length ?? 0) > 0;
    if (disconnected) {
      await this.unscheduleIngestion(accountId);
    }
    return disconnected;
  }

  /**
   * Pauses or resumes an account (docs/04-conexion-redes-sociales.md §4.3):
   * paused accounts keep their data/config but ingestion, Shield and Roasts
   * stop (ingestionProcessor already skips any account whose status isn't
   * 'active'). Only toggles between 'active' and 'paused' — a broken
   * ('error') or disconnected ('revoked') account can't be paused/resumed
   * this way, since the eq("status", ...) guard below won't match.
   */
  async setPaused(userId: string, accountId: string, paused: boolean): Promise<boolean> {
    const supabase = this.getSupabase();
    const fromStatus = paused ? "active" : "paused";

    const { data, error } = await supabase
      .from("accounts")
      .update({
        status: paused ? "paused" : "active",
        status_reason: paused ? "user_action" : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("user_id", userId)
      .eq("status", fromStatus)
      .select("id");

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  /**
   * Removes the recurring ingestion job scheduled for this account (see
   * OAuthService.scheduleIngestion), so a disconnected account stops being
   * polled instead of leaving a permanent zombie job in BullMQ.
   */
  private async unscheduleIngestion(accountId: string): Promise<void> {
    const jobId = `ingestion:${accountId}`;
    const repeatableJobs = await this.ingestionQueue.getRepeatableJobs();
    const match = repeatableJobs.find((job) => job.id === jobId);
    if (match) {
      await this.ingestionQueue.removeRepeatableByKey(match.key);
    }
  }
}
