import { Injectable, ForbiddenException, BadRequestException } from "@nestjs/common";
import type { PersonaProfile } from "@roastr/shared";
import { FeatureFlagService } from "../feature-flags/feature-flag.service";
import {
  TONE_DEFINITIONS,
  buildPersonalToneInstruction,
  isValidTone,
  type ToneId,
} from "./tones";

/** Platform-level character limits for generated roasts */
const PLATFORM_MAX_CHARS: Record<string, number> = {
  youtube: 1_000,
  x: 280,
  instagram: 2_200,
  tiktok: 500,
  twitch: 500,
  reddit: 10_000,
};

const DEFAULT_MAX_CHARS = 500;

export type RoastContext = {
  /** Raw comment text */
  commentText: string;
  /** Severity score 0–1 */
  severityScore: number;
  /** Platform identifier */
  platform: string;
  /** Tone to use */
  tone: ToneId;
  /** Required when tone === 'personal' */
  persona?: PersonaProfile;
};

export type BuiltPrompt = {
  /** System message (Block A) */
  system: string;
  /** User message combining Block B + Block C */
  user: string;
  /** Character limit applied */
  maxChars: number;
};

@Injectable()
export class PromptBuilderService {
  constructor(private readonly flags: FeatureFlagService) {}

  build(ctx: RoastContext): BuiltPrompt {
    if (!this.flags.isEnabled("roasting_enabled")) {
      throw new ForbiddenException("El módulo de roasting no está habilitado.");
    }

    if (!isValidTone(ctx.tone)) {
      throw new BadRequestException(`Tono inválido: ${ctx.tone}`);
    }

    const toneDef = TONE_DEFINITIONS[ctx.tone];

    if (toneDef.requiredFlag && !this.flags.isEnabled(toneDef.requiredFlag)) {
      throw new ForbiddenException(
        `El tono "${ctx.tone}" requiere el flag "${toneDef.requiredFlag}" habilitado.`,
      );
    }

    // Block A — System prompt: tone + persona
    const system = this.buildBlockA(ctx);

    // Blocks B+C — User message: comment context + generation instructions
    const user = this.buildBlockBC(ctx);

    const maxChars = PLATFORM_MAX_CHARS[ctx.platform] ?? DEFAULT_MAX_CHARS;

    return { system, user, maxChars };
  }

  private buildBlockA(ctx: RoastContext): string {
    const toneDef = TONE_DEFINITIONS[ctx.tone];

    const toneInstruction =
      ctx.tone === "personal" && ctx.persona
        ? buildPersonalToneInstruction(ctx.persona)
        : toneDef.systemInstruction;

    return [
      toneInstruction,
      "Genera EXCLUSIVAMENTE el texto de la respuesta, sin explicaciones adicionales.",
      "IMPORTANTE: Este contenido ha sido generado con IA. Incluye siempre la transparencia requerida según la plataforma.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private buildBlockBC(ctx: RoastContext): string {
    const maxChars = PLATFORM_MAX_CHARS[ctx.platform] ?? DEFAULT_MAX_CHARS;
    const severityLabel = this.severityLabel(ctx.severityScore);
    const platformLabel = ctx.platform.charAt(0).toUpperCase() + ctx.platform.slice(1);

    // Block B — Comment context
    const blockB = [
      `Plataforma: ${platformLabel}`,
      `Nivel de toxicidad del comentario: ${severityLabel} (${Math.round(ctx.severityScore * 100)}%)`,
      `Comentario a responder:`,
      `"${ctx.commentText}"`,
    ].join("\n");

    // Block C — Generation instructions
    const blockC = [
      `Genera una respuesta para este comentario siguiendo estas instrucciones:`,
      `- Longitud máxima: ${maxChars} caracteres`,
      `- Idioma: el mismo que el comentario original`,
      `- NO incluyas URLs ni menciones (@usuario)`,
      `- NO uses mayúsculas sostenidas (ALL CAPS)`,
      ctx.severityScore >= 0.85
        ? `- Atención: comentario de alta toxicidad. Sé especialmente cuidadoso.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    return `${blockB}\n\n${blockC}`;
  }

  private severityLabel(score: number): string {
    if (score >= 0.85) return "muy alta";
    if (score >= 0.55) return "alta";
    if (score >= 0.25) return "media";
    return "baja";
  }
}
