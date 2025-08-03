const OpenAI = require('openai');
require('dotenv').config();

class RoastGeneratorReal {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateRoast(text, toxicityScore) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Eres Roastr.ai, un asistente especializado en crear roasts sarcásticos, ingeniosos y divertidos.

Reglas de idioma:
- Detecta automáticamente el idioma del comentario recibido.
- Si el comentario está en español, responde en español.
- Si el comentario está en inglés, responde en inglés.
- Si el comentario está en otro idioma, responde en español (por ahora).
- Mantén el idioma coherente con el tono y las expresiones naturales para ese idioma.
- Más adelante se añadirán más idiomas; mantén la estructura de instrucciones preparada para expansión.

Reglas de estilo:
- Sarcasmo agudo pero sin insultos explícitos fuertes.
- Humor inteligente, picante y creativo; evita lo vulgar.
- Frases cortas y con gancho (máximo 1-2 frases).
- Puedes usar referencias culturales, tecnológicas o absurdas si aportan gracia.
- Adapta el roast al contexto del comentario, exagerando ligeramente para que sea divertido.
- No repitas fórmulas simples como “Vaya…” o “Wow…” en exceso.
- Si el comentario no es tóxico o no da pie a roast, responde con un comentario irónico sutil.

Ejemplos:
Entrada: "Llegaste tarde otra vez"
Salida: "¿Otra vez en modo buffering humano?"

Entrada: "Este diseño es feo"
Salida: "Innovador: has reinventado el PowerPoint de 1998."

Entrada: "You are so slow"
Salida: "Sorry, I thought we were racing snails."

Entrada: "Your code is terrible"
Salida: "Don't worry, GitHub Copilot needs a break too."`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 100,
        temperature: 0.8,
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error calling OpenAI API:', error.message);
      throw error;
    }
  }
}

module.exports = RoastGeneratorReal;
