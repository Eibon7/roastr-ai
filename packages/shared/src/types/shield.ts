export type ShieldAction =
  | "no_action"
  | "strike1_reply"
  | "strike1_silent"
  | "hide"
  | "report"
  | "block"
  | "eligible_for_response";

export type ShieldLog = {
  id: string;
  userId: string;
  accountId: string;
  platform: string;
  commentId: string;
  actionTaken: ShieldAction;
  severityScore: number;
  matchedRedLine: boolean;
  createdAt: string;
};

export type Thresholds = {
  tau_low: number;
  tau_shield: number;
  tau_critical: number;
};

export type Weights = {
  linea_roja: number;
  identidad: number;
  tolerancia: number;
};

export type OffenderProfile = {
  strikeLevel: 0 | 1 | 2 | "critical";
  lastStrike: string | null;
};
