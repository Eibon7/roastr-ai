import type { PersonaProfile } from "@roastr/shared";

export type PersonaMatchResult = {
  matchesLineaRoja: boolean;
  matchesIdentidad: boolean;
  matchesTolerancia: boolean;
  matchedRedLines: string[];
};

export function matchPersona(
  text: string,
  persona: PersonaProfile | null,
): PersonaMatchResult {
  if (!persona) {
    return {
      matchesLineaRoja: false,
      matchesIdentidad: false,
      matchesTolerancia: false,
      matchedRedLines: [],
    };
  }

  const normalizedText = text.toLowerCase();

  const matchedRedLines = persona.redLines.filter((keyword) =>
    normalizedText.includes(keyword.toLowerCase()),
  );

  return {
    matchesLineaRoja: matchedRedLines.length > 0,
    matchesIdentidad: persona.identities.some((keyword) =>
      normalizedText.includes(keyword.toLowerCase()),
    ),
    matchesTolerancia: persona.tolerances.some((keyword) =>
      normalizedText.includes(keyword.toLowerCase()),
    ),
    matchedRedLines,
  };
}
