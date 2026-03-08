import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  type PerspectiveAttributeScores,
  type NormalizedScore,
  normalizePerspectiveScores,
  normalizeBothFailed,
} from "@roastr/shared";

const PERSPECTIVE_API_URL = "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";
const DEFAULT_TIMEOUT_MS = 3_000;
const ATTRIBUTES = [
  "TOXICITY",
  "SEVERE_TOXICITY",
  "IDENTITY_ATTACK",
  "INSULT",
  "THREAT",
];

@Injectable()
export class PerspectiveApiService {
  constructor(private readonly config: ConfigService) {}

  async analyze(text: string): Promise<NormalizedScore> {
    const apiKey = this.config.get("PERSPECTIVE_API_KEY");
    if (!apiKey) {
      return normalizeBothFailed();
    }

    const timeoutMs =
      Number(this.config.get("PERSPECTIVE_TIMEOUT_MS")) || DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${PERSPECTIVE_API_URL}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: { text },
          requestedAttributes: Object.fromEntries(
            ATTRIBUTES.map((a) => [a, {}]),
          ),
          languages: ["es", "en"],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 429) {
        return normalizeBothFailed();
      }
      if (!res.ok) {
        return normalizeBothFailed();
      }

      const json = (await res.json()) as {
        attributeScores?: PerspectiveAttributeScores;
      };
      const scores = json.attributeScores;
      if (!scores) {
        return normalizeBothFailed();
      }

      return normalizePerspectiveScores(scores);
    } catch {
      clearTimeout(timeout);
      return normalizeBothFailed();
    }
  }
}
