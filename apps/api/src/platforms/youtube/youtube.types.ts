/** YouTube platform types — scopes, constants, API responses */

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
] as const;

export type YouTubeScope = (typeof YOUTUBE_SCOPES)[number];

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface YouTubeChannelItem {
  id: string;
  snippet: { title: string };
}
