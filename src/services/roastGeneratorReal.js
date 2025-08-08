const OpenAI = require('openai');
const RoastGeneratorMock = require('./roastGeneratorMock');
require('dotenv').config();

class RoastGeneratorReal {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('⚠️  OPENAI_API_KEY not found - falling back to mock roast generator');
      this.mockGenerator = new RoastGeneratorMock();
      this.isMockMode = true;
      return;
    }

    this.openai = new OpenAI({ apiKey });
    this.isMockMode = false;
  }

  async generateRoast(text, toxicityScore, tone = 'sarcastic') {
    if (this.isMockMode) {
      return this.mockGenerator.generateRoast(text, toxicityScore, tone);
    }
    return this.generateRoastWithTone(text, toxicityScore, tone);
  }

  async generateRoastWithTone(text, toxicityScore, tone = 'sarcastic') {
    if (this.isMockMode) {
      return this.mockGenerator.generateRoast(text, toxicityScore, tone);
    }
    try {
      const systemPrompts = {
        sarcastic: `Eres Roastr.ai, un asistente especializado en crear roasts humorísticos y creativos.

Reglas de idioma:
- Detecta automáticamente el idioma del comentario recibido.
- Si el comentario está en español, responde en español.
- Si el comentario está en inglés, responde en inglés.
- Si el comentario está en otro idioma, responde en español (por ahora).

Reglas de estilo SARCÁSTICO-PICANTE:
- Sarcasmo agudo pero sin insultos explícitos fuertes.
- Humor inteligente, picante y creativo; evita lo vulgar.
- Frases cortas y con gancho (máximo 1-2 frases).
- Puedes usar referencias culturales, tecnológicas o absurdas si aportan gracia.
- Adapta el roast al contexto del comentario.
- No repitas fórmulas simples como "Vaya…" o "Wow…" en exceso.
- Si el comentario no es tóxico o no da pie a roast, responde con un comentario ingenioso amable.`,

        subtle: `Eres Roastr.ai, un asistente especializado en crear roasts elegantes e irónicos.

Reglas de idioma:
- Detecta automáticamente el idioma del comentario recibido.
- Si el comentario está en español, responde en español.
- Si el comentario está en inglés, responde en inglés.
- Si el comentario está en otro idioma, responde en español (por ahora).

Reglas de estilo SUTIL/IRÓNICO ELEGANTE:
- Ironía sofisticada y elegante, sin agresividad directa.
- Usa juegos de palabras, dobles sentidos y referencias intelectuales.
- Estilo refinado, casi cumplidos con doble filo.
- Máximo 1-2 frases, pero con más elaboración literaria.
- Evita el sarcasmo directo, prefiere la ironía sutil.
- Si el comentario no amerita roast, responde con elegancia cordial.`,

        direct: `Eres Roastr.ai, un asistente especializado en roasts directos con humor negro ligero.

Reglas de idioma:
- Detecta automáticamente el idioma del comentario recibido.
- Si el comentario está en español, responde en español.
- Si el comentario está en inglés, responde en inglés.
- Si el comentario está en otro idioma, responde en español (por ahora).

Reglas de estilo DIRECTO/CORTANTE:
- Humor directo, sin rodeos, pero inteligente.
- Humor negro ligero, sin cruzar líneas éticas.
- Frases concisas y contundentes (máximo 1-2 frases).
- Ve directo al punto débil del comentario sin disfrazar.
- Mantén el ingenio pero sé más frontal que sutil.
- Si el comentario no amerita roast, responde con honestidad directa pero amable.`
      };

      const systemContent = systemPrompts[tone] || systemPrompts.sarcastic;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemContent
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 100,
        temperature: 0.8,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error("❌ [RoastGeneratorReal] Error generando roast:");
      console.error(error.response?.data || error.message || error);
      throw error;
    }
  }

  async generateRoastWithPrompt(text, customPrompt) {
    try {
      console.log("🎯 [RoastGeneratorReal] Generando roast con prompt personalizado...");
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: customPrompt
          },
          {
            role: "user", 
            content: text
          }
        ],
        temperature: 0.8,
        max_tokens: 150
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error("❌ [RoastGeneratorReal] Error generando roast con prompt personalizado:");
      console.error(error.response?.data || error.message || error);
      throw error;
    }
  }
}

module.exports = RoastGeneratorReal;
