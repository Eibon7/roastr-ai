const OpenAI = require('openai');
require('dotenv').config();

class RoastGeneratorReal {
  constructor() {
    // === DEBUG: Diagnóstico API Key ===
    const apiKey = process.env.OPENAI_API_KEY;
    console.log("🔍 [RoastGeneratorReal] Diagnóstico de API Key:");
    console.log("   - Presente?:", !!apiKey);
    if (apiKey) {
      console.log("   - Empieza por:", apiKey.slice(0, 10));
      console.log("   - Longitud:", apiKey.length, "caracteres");
    } else {
      console.warn("⚠️  No se encontró OPENAI_API_KEY en el entorno.");
    }
    console.log("=============================================");

    if (!apiKey) {
      throw new Error('❌ OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({ apiKey });
  }

  async generateRoast(text, toxicityScore) {
    console.log("📝 [RoastGeneratorReal] Generando roast para texto:", text);
    console.log("📊 [RoastGeneratorReal] Puntuación de toxicidad (si disponible):", toxicityScore);

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Eres Roastr.ai, un asistente especializado en crear roasts humorísticos y creativos.

Reglas de idioma:
- Detecta automáticamente el idioma del comentario recibido.
- Si el comentario está en español, responde en español.
- Si el comentario está en inglés, responde en inglés.
- Si el comentario está en otro idioma, responde en español (por ahora).

Reglas de estilo:
- Sarcasmo agudo pero sin insultos explícitos fuertes.
- Humor inteligente, picante y creativo; evita lo vulgar.
- Frases cortas y con gancho (máximo 1-2 frases).
- Puedes usar referencias culturales, tecnológicas o absurdas si aportan gracia.
- Adapta el roast al contexto del comentario.
- No repitas fórmulas simples como “Vaya…” o “Wow…” en exceso.
- Si el comentario no es tóxico o no da pie a roast, responde con un comentario ingenioso amable.`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 100,
        temperature: 0.8,
      });

      console.log("✅ [RoastGeneratorReal] Respuesta recibida de OpenAI");
      console.log("🗣 [RoastGeneratorReal] Roast generado:", completion.choices[0].message.content);

      return completion.choices[0].message.content;
    } catch (error) {
      console.error("❌ [RoastGeneratorReal] Error generando roast:");
      console.error(error.response?.data || error.message || error);
      throw error;
    }
  }
}

module.exports = RoastGeneratorReal;
