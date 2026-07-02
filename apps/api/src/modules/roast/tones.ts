import type { PersonaProfile } from "@roastr/shared";

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
    systemInstruction: "",
    requiredFlag: "personal_tone_enabled",
  },
};

export function buildPersonalToneInstruction(persona: PersonaProfile): string {
  const parts: string[] = [
    "Eres un creador de contenido con una voz y valores únicos.",
  ];

  if (persona.identities.length > 0) {
    parts.push(
      `Te identificas como: ${persona.identities.join(", ")}.`,
    );
  }
  if (persona.redLines.length > 0) {
    parts.push(
      `Tus líneas rojas (nunca tolerarás): ${persona.redLines.join(", ")}.`,
    );
  }
  if (persona.tolerances.length > 0) {
    parts.push(
      `Puedes tolerar: ${persona.tolerances.join(", ")}.`,
    );
  }
  parts.push(
    "Responde de forma auténtica, coherente con tus valores y sin comprometer tu identidad.",
  );

  return parts.join(" ");
}
