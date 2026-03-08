import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { BuiltPrompt } from "./prompt-builder.service";

type LlmResponse = {
  text: string;
  model: string;
  tokens_used: number;
};

@Injectable()
export class LlmService {
  constructor(private readonly config: ConfigService) {}

  async generate(prompt: BuiltPrompt): Promise<LlmResponse> {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (!apiKey) {
      return this.mockResponse(prompt);
    }

    const body = {
      model: "gpt-4o-mini",
      max_tokens: Math.ceil(prompt.maxChars / 3),
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text().catch(() => "unknown error");
      throw new InternalServerErrorException(`LLM error: ${error}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: { total_tokens: number };
    };

    const text = data.choices[0]?.message?.content?.trim() ?? "";
    return {
      text,
      model: data.model,
      tokens_used: data.usage?.total_tokens ?? 0,
    };
  }

  private mockResponse(prompt: BuiltPrompt): LlmResponse {
    return {
      text: `[MOCK] Respuesta generada para: ${prompt.user.slice(0, 80)}...`,
      model: "mock",
      tokens_used: 0,
    };
  }
}
