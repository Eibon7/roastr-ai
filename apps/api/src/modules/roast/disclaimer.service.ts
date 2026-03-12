import { Injectable } from "@nestjs/common";

export type Platform = "youtube" | "x" | string;

const DISCLAIMER_YOUTUBE =
  "\n\n⚠️ Este comentario fue generado con asistencia de IA (Roastr). No representa la opinión personal del creador.";

const DISCLAIMER_X_PREFIX = "[AI] ";

const DISCLAIMER_DEFAULT =
  " [Generado con IA — Roastr]";

/**
 * Adds platform-appropriate AI disclaimers to roast content.
 * - YouTube: appended footer text
 * - X (Twitter): [AI] prefix (space-aware)
 * - Other: inline suffix
 */
@Injectable()
export class DisclaimerService {
  apply(content: string, platform: Platform): string {
    if (this.hasDisclaimer(content, platform)) {
      return content;
    }
    switch (platform.toLowerCase()) {
      case "youtube":
        return content + DISCLAIMER_YOUTUBE;
      case "x":
      case "twitter":
        return DISCLAIMER_X_PREFIX + content;
      default:
        return content + DISCLAIMER_DEFAULT;
    }
  }

  /**
   * Returns true if the content already has a disclaimer applied.
   */
  hasDisclaimer(content: string, platform: Platform): boolean {
    switch (platform.toLowerCase()) {
      case "youtube":
        return content.includes(DISCLAIMER_YOUTUBE);
      case "x":
      case "twitter":
        return content.startsWith(DISCLAIMER_X_PREFIX);
      default:
        return content.includes(DISCLAIMER_DEFAULT);
    }
  }
}
