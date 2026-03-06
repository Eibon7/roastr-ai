import type { Platform } from "./analysis.js";

export type AccountStatus = "active" | "paused" | "revoked" | "error";
export type StatusReason =
  | "user_action"
  | "token_expired"
  | "rate_limited"
  | "platform_error"
  | "billing_paused";
export type IntegrationHealth = "ok" | "degraded" | "failing";

export type Account = {
  id: string;
  userId: string;
  platform: Platform;
  platformUserId: string;
  username: string;
  status: AccountStatus;
  statusReason: StatusReason | null;
  integrationHealth: IntegrationHealth;
  shieldAggressiveness: number;
  autoApprove: boolean;
  tone: string;
  ingestionCursor: string | null;
  lastSuccessfulIngestion: string | null;
  consecutiveErrors: number;
  retentionUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformCapabilities = {
  canHide: boolean;
  canReport: boolean;
  canBlock: boolean;
  canReply: boolean;
  rateLimits: {
    requestsPerMinute: number;
    dailyQuota: number | null;
  };
};

export type CommentPage = {
  comments: import("./analysis.js").NormalizedComment[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ActionResult = {
  success: boolean;
  error?: string;
  fallbackUsed?: boolean;
};

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
};

export type ReportReason = "spam" | "harassment" | "hate_speech" | "threat" | "other";
