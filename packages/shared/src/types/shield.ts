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

export type RecurrenceFactors = {
  strike1: number;
  strike2: number;
  critical: number;
};

export const FALLBACK_THRESHOLDS: Thresholds = {
  tau_low: 0.25,
  tau_shield: 0.55,
  tau_critical: 0.85,
};

export const FALLBACK_WEIGHTS: Weights = {
  linea_roja: 1.15,
  identidad: 1.1,
  tolerancia: 0.95,
};

export const FALLBACK_RECURRENCE_FACTORS: RecurrenceFactors = {
  strike1: 1.1,
  strike2: 1.25,
  critical: 1.5,
};

export const N_DENSIDAD = 3;
