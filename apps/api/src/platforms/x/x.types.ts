/** X (Twitter) OAuth 2.0 scopes per docs/04-conexion-redes-sociales.md */
export const X_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "block.write",
  "hide.write",
  "offline.access",
] as const;

export type XTokenResponse = {
  token_type: "bearer";
  expires_in: number;
  access_token: string;
  refresh_token?: string;
  scope?: string;
};

export type XUserResponse = {
  data: {
    id: string;
    name: string;
    username: string;
  };
};
