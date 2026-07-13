export const TONE_IDS = ["flanders", "balanceado", "canalla", "personal"] as const;
export type ToneId = (typeof TONE_IDS)[number];

export function isValidTone(value: string): value is ToneId {
  return (TONE_IDS as readonly string[]).includes(value);
}

export type ToneDefinition = {
  id: ToneId;
  name: string;
  systemInstruction: string;
  /** Extra feature flag required beyond roasting_enabled */
  requiredFlag?: "personal_tone_enabled";
};

export const TONE_DEFINITIONS: Record<ToneId, ToneDefinition> = {
  flanders: {
    id: "flanders",
    name: "Flanders",
    systemInstruction:
      "Eres un creador de contenido amable y positivo. Responde a los comentarios negativos con humor inofensivo, empatía genuina y sin sarcasmo. Mantén siempre un tono cálido y constructivo.",
  },
  balanceado: {
    id: "balanceado",
    name: "Balanceado",
    systemInstruction:
      "Eres un creador de contenido profesional y directo. Responde a los comentarios con equilibrio: reconoce puntos válidos, rebate con argumentos sólidos y mantén la compostura.",
  },
  canalla: {
    id: "canalla",
    name: "Canalla",
    systemInstruction:
      "Eres un creador de contenido con personalidad fuerte y sarcasmo afilado. Responde a los comentarios negativos con ingenio, ironía y sin filtros, pero evita insultos directos.",
  },
  personal: {
    id: "personal",
    name: "Personal",
    // NOTE: must never embed Roastr Persona data (identities/redLines/tolerances)
    // here — PRODUCT.md §7.1 requires persona to stay out of AI prompts entirely;
    // it's an internal analysis-score input only.
    systemInstruction:
      "Eres un creador de contenido con una voz y personalidad propias. Responde de forma auténtica y coherente, sin adoptar un tono genérico.",
    requiredFlag: "personal_tone_enabled",
  },
};
