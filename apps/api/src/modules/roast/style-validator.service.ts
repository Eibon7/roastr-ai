import { Injectable } from "@nestjs/common";

const PLATFORM_MAX_CHARS: Record<string, number> = {
  youtube: 1_000,
  x: 280,
  instagram: 2_200,
  tiktok: 500,
  twitch: 500,
  reddit: 10_000,
};

const DEFAULT_MAX_CHARS = 500;

export type ValidationRule = {
  id: string;
  description: string;
  /** Returns error message if fails, null if passes */
  check: (text: string, platform: string) => string | null;
};

export type ValidationResult = {
  valid: boolean;
  violations: Array<{ ruleId: string; message: string }>;
};

export const STYLE_RULES: ValidationRule[] = [
  {
    id: "max_length",
    description: "Respeta el límite de caracteres de la plataforma",
    check(text, platform) {
      const limit = PLATFORM_MAX_CHARS[platform] ?? DEFAULT_MAX_CHARS;
      if (text.length > limit) {
        return `Supera el límite de ${limit} caracteres (tiene ${text.length}).`;
      }
      return null;
    },
  },
  {
    id: "no_urls",
    description: "No incluye URLs",
    check(text) {
      const urlPattern = /https?:\/\/\S+/i;
      if (urlPattern.test(text)) {
        return "El texto contiene una URL, lo que está prohibido en roasts generados.";
      }
      return null;
    },
  },
  {
    id: "no_mentions",
    description: "No incluye menciones @usuario",
    check(text) {
      const mentionPattern = /@\w+/;
      if (mentionPattern.test(text)) {
        return "El texto contiene menciones (@usuario), lo que no está permitido.";
      }
      return null;
    },
  },
  {
    id: "no_all_caps",
    description: "Evita mayúsculas sostenidas (ALL CAPS)",
    check(text) {
      const words = text.split(/\s+/).filter((w) => w.length > 3);
      if (words.length === 0) return null;
      const capsRatio = words.filter((w) => w === w.toUpperCase() && /[A-Z]/.test(w)).length / words.length;
      if (capsRatio > 0.5) {
        return "Más del 50% de las palabras están en mayúsculas sostenidas.";
      }
      return null;
    },
  },
  {
    id: "min_length",
    description: "El texto tiene contenido mínimo",
    check(text) {
      const trimmed = text.trim();
      if (trimmed.length < 10) {
        return `El texto es demasiado corto (${trimmed.length} caracteres). Mínimo 10.`;
      }
      return null;
    },
  },
  {
    id: "no_empty_lines_excess",
    description: "No tiene exceso de líneas en blanco consecutivas",
    check(text) {
      if (/\n{3,}/.test(text)) {
        return "El texto contiene 3 o más líneas en blanco consecutivas.";
      }
      return null;
    },
  },
];

@Injectable()
export class StyleValidatorService {
  validate(text: string, platform: string): ValidationResult {
    const violations: Array<{ ruleId: string; message: string }> = [];

    for (const rule of STYLE_RULES) {
      const error = rule.check(text, platform);
      if (error) {
        violations.push({ ruleId: rule.id, message: error });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /** Returns the text trimmed to fit within platform limits if too long */
  truncate(text: string, platform: string): string {
    const limit = PLATFORM_MAX_CHARS[platform] ?? DEFAULT_MAX_CHARS;
    if (text.length <= limit) return text;
    return text.slice(0, limit - 1).trimEnd() + "…";
  }
}
