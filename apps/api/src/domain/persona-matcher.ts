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

  const redLines = persona.redLines.map(k => k.trim()).filter(Boolean);
  const identities = persona.identities.map(k => k.trim()).filter(Boolean);
  const tolerances = persona.tolerances.map(k => k.trim()).filter(Boolean);

  const matchedRedLines = redLines.filter((keyword) =>
    normalizedText.includes(keyword.toLowerCase()),
  );

  return {
    matchesLineaRoja: matchedRedLines.length > 0,
    matchesIdentidad: identities.some((keyword) =>
      normalizedText.includes(keyword.toLowerCase()),
    ),
    matchesTolerancia: tolerances.some((keyword) =>
      normalizedText.includes(keyword.toLowerCase()),
    ),
    matchedRedLines,
  };
}
