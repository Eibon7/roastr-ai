import { describe, it, expect } from "vitest";
import { matchPersona } from "../src/domain/persona-matcher";
import type { PersonaProfile } from "../src/types/persona";

describe("matchPersona", () => {
  it("returns all-false with no matched red lines when persona is null", () => {
    const result = matchPersona("cualquier texto ofensivo", null);
    expect(result).toEqual({
      matchesLineaRoja: false,
      matchesIdentidad: false,
      matchesTolerancia: false,
      matchedRedLines: [],
    });
  });

  it("matches a red line keyword and reports it in matchedRedLines", () => {
    const persona: PersonaProfile = { redLines: ["gordo"], identities: [], tolerances: [] };
    const result = matchPersona("eres un gordo asqueroso", persona);
    expect(result.matchesLineaRoja).toBe(true);
    expect(result.matchedRedLines).toEqual(["gordo"]);
  });

  it("returns every matched red line, not just the first", () => {
    const persona: PersonaProfile = {
      redLines: ["gordo", "feo", "tonto"],
      identities: [],
      tolerances: [],
    };
    const result = matchPersona("eres un gordo y tonto", persona);
    expect(result.matchedRedLines.sort()).toEqual(["gordo", "tonto"].sort());
  });

  it("matches identity keywords case-insensitively", () => {
    const persona: PersonaProfile = { redLines: [], identities: ["trans"], tolerances: [] };
    const result = matchPersona("comentario sobre gente TRANS", persona);
    expect(result.matchesIdentidad).toBe(true);
  });

  it("matches tolerance keywords case-insensitively", () => {
    const persona: PersonaProfile = { redLines: [], identities: [], tolerances: ["broma"] };
    const result = matchPersona("solo era una BROMA", persona);
    expect(result.matchesTolerancia).toBe(true);
  });

  it("trims whitespace around keywords before matching", () => {
    const persona: PersonaProfile = { redLines: ["  idiota  "], identities: [], tolerances: [] };
    const result = matchPersona("no seas idiota", persona);
    expect(result.matchesLineaRoja).toBe(true);
  });

  it("filters out empty/whitespace-only keywords instead of matching everything", () => {
    const persona: PersonaProfile = { redLines: ["", "   "], identities: [], tolerances: [] };
    const result = matchPersona("un texto totalmente inofensivo", persona);
    expect(result.matchesLineaRoja).toBe(false);
    expect(result.matchedRedLines).toEqual([]);
  });

  it("returns false for all categories when no keyword is present in the text", () => {
    const persona: PersonaProfile = {
      redLines: ["insulto"],
      identities: ["identidad"],
      tolerances: ["tolerable"],
    };
    const result = matchPersona("un mensaje neutro y amable", persona);
    expect(result.matchesLineaRoja).toBe(false);
    expect(result.matchesIdentidad).toBe(false);
    expect(result.matchesTolerancia).toBe(false);
  });

  it("handles empty text input without throwing", () => {
    const persona: PersonaProfile = { redLines: ["x"], identities: [], tolerances: [] };
    const result = matchPersona("", persona);
    expect(result.matchesLineaRoja).toBe(false);
  });

  it("handles a persona with entirely empty keyword lists", () => {
    const persona: PersonaProfile = { redLines: [], identities: [], tolerances: [] };
    const result = matchPersona("texto cualquiera", persona);
    expect(result).toEqual({
      matchesLineaRoja: false,
      matchesIdentidad: false,
      matchesTolerancia: false,
      matchedRedLines: [],
    });
  });

  it("can match all three categories simultaneously", () => {
    const persona: PersonaProfile = {
      redLines: ["rojo"],
      identities: ["identidad"],
      tolerances: ["broma"],
    };
    const result = matchPersona("rojo, identidad y broma en un mismo texto", persona);
    expect(result.matchesLineaRoja).toBe(true);
    expect(result.matchesIdentidad).toBe(true);
    expect(result.matchesTolerancia).toBe(true);
  });
});
