export type Platform =
  | "youtube"
  | "x"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "twitch"
  | "reddit"
  | "discord"
  | "bluesky"
  | "linkedin";

export type NormalizedComment = {
  id: string;
  platform: Platform;
  accountId: string;
  userId: string;
  authorId: string;
  text: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type AnalysisDecision =
  | "no_action"
  | "correctiva"
  | "eligible_for_response"
  | "shield_moderado"
  | "shield_critico";

export type ScoreSource = "perspective" | "llm_fallback" | "both_failed";

export type AnalysisResult = {
  decision: AnalysisDecision;
  severity_score: number;
  flags: {
    has_identity_attack: boolean;
    has_threat: boolean;
    has_insult_with_argument: boolean;
    matched_red_lines: string[];
    insult_density: number;
  };
  adjustments: {
    persona_applied: boolean;
    persona_factor: number;
    recurrence_factor: number;
    severity_score_final: number;
  };
  score_source: ScoreSource;
};
