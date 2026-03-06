import type {
  Platform,
  PlatformCapabilities,
  CommentPage,
  ActionResult,
  OAuthTokens,
  ReportReason,
} from "@roastr/shared";

export interface PlatformPort {
  readonly platform: Platform;
  readonly capabilities: PlatformCapabilities;

  authenticate(code: string, state: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;

  fetchComments(cursor: string | null, accountId: string): Promise<CommentPage>;

  hideComment(commentId: string): Promise<ActionResult>;
  reportComment(commentId: string, reason: ReportReason): Promise<ActionResult>;
  blockUser(userId: string): Promise<ActionResult>;
  replyToComment(commentId: string, text: string): Promise<ActionResult>;
}
