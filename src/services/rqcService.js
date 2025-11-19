/**
 * RQC (Roast Quality Control) Service
 * 
 * Implements 3 parallel reviewers for Creator+ plans:
 * 1. Moderator: Checks compliance and intensity
 * 2. Comedian: Evaluates humor quality
 * 3. Style Reviewer: Checks style adherence
 */

const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class RQCService {
  constructor(openaiClient) {
    this.openai = openaiClient;
  }

  /**
   * Main RQC review process with 3 parallel reviewers
   * @param {Object} params - Review parameters
   * @returns {Promise<Object>} - Review results and decision
   */
  async reviewRoast(params) {
    const { originalComment, roastText, userConfig, attempt } = params;
    const startTime = Date.now();

    try {
      logger.info('🔬 Starting RQC review process', {
        userId: userConfig.user_id,
        attempt,
        roastLength: roastText.length
      });

      // Run all 3 reviewers in parallel for efficiency
      const [moderatorResult, comedianResult, styleResult] = await Promise.all([
        this.runModerator(originalComment, roastText, userConfig),
        this.runComedian(originalComment, roastText, userConfig),
        this.runStyleReviewer(originalComment, roastText, userConfig)
      ]);

      const reviewDuration = Date.now() - startTime;
      const totalTokens = moderatorResult.tokensUsed + comedianResult.tokensUsed + styleResult.tokensUsed;

      // Apply decision logic
      const decision = this.makeRQCDecision(moderatorResult, comedianResult, styleResult);

      const result = {
        // Individual reviewer results
        moderatorPass: moderatorResult.verdict === 'pass',
        moderatorReason: moderatorResult.reason,
        comedianPass: comedianResult.verdict === 'pass', 
        comedianReason: comedianResult.reason,
        stylePass: styleResult.verdict === 'pass',
        styleReason: styleResult.reason,
        
        // Final decision
        decision: decision.action,
        decisionReason: decision.reason,
        
        // Metadata
        reviewDuration,
        tokensUsed: totalTokens,
        costCents: Math.ceil(totalTokens * 0.002), // Rough cost estimate
        userConfig
      };

      logger.info('✅ RQC review completed', {
        decision: result.decision,
        moderatorPass: result.moderatorPass,
        comedianPass: result.comedianPass,
        stylePass: result.stylePass,
        duration: reviewDuration,
        tokens: totalTokens
      });

      return result;
    } catch (error) {
      logger.error('❌ Error in RQC review process:', error);
      throw error;
    }
  }

  /**
   * Moderator: Checks compliance and intensity level
   */
  async runModerator(originalComment, roastText, userConfig) {
    const prompt = `Eres un moderador especializado en contenido de redes sociales y roasts humorísticos.

Tu trabajo es evaluar si este roast cumple con las reglas de las plataformas y el nivel de intensidad configurado por el usuario.

REGLAS A VERIFICAR:
1. ✅ Cumple políticas de plataformas (sin odio, discriminación, acoso directo, violencia)
2. ✅ No contiene insultos excesivamente fuertes o vulgares  
3. ✅ Tono apropiado según configuración del usuario (Issue #868: Solo tone, sin intensity)
4. ✅ No contiene contenido sexual explícito
5. ✅ No usa términos que activen filtros automáticos

COMENTARIO ORIGINAL: "${originalComment}"
ROAST A EVALUAR: "${roastText}"

TONO DEL USUARIO: ${userConfig.tone || 'balanceado'} (Flanders/Balanceado/Canalla)
- Flanders: Amable pero irónico
- Balanceado: Equilibrio entre ingenio y firmeza
- Canalla: Directo y sin filtros

INSTRUCCIONES:
- Responde ÚNICAMENTE con "PASS" o "FAIL"
- Si es FAIL, agrega en nueva línea el motivo específico
- Sé estricto pero justo

RESPUESTA:`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un moderador experto. Responde solo con PASS/FAIL y el motivo si es necesario."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.1, // Low temperature for consistency
      });

      const response = completion.choices[0].message.content.trim();
      const lines = response.split('\n');
      const verdict = lines[0].toLowerCase().includes('pass') ? 'pass' : 'fail';
      const reason = lines.length > 1 ? lines.slice(1).join(' ').trim() : null;

      return {
        verdict,
        reason,
        tokensUsed: this.estimateTokens(prompt + response)
      };
    } catch (error) {
      logger.error('❌ Error in moderator review:', error);
      return { verdict: 'fail', reason: 'Error en revisión de moderación', tokensUsed: 0 };
    }
  }

  /**
   * Comedian: Evaluates humor quality and punchiness
   */
  async runComedian(originalComment, roastText, userConfig) {
    const prompt = `Eres un comediante profesional especializado en roasts y humor inteligente.

Tu trabajo es evaluar si este roast es suficientemente gracioso, punchy e ingenioso.

CRITERIOS DE EVALUACIÓN:
✅ ¿Es genuinamente divertido/gracioso?
✅ ¿Tiene un buen "punch" o gancho?
✅ ¿Es ingenioso y creativo (no genérico)?
✅ ¿Aprovecha bien el comentario original?
✅ ¿Está bien estructurado para impacto cómico?

COMENTARIO ORIGINAL: "${originalComment}"
ROAST A EVALUAR: "${roastText}"

ESTÁNDARES:
- El roast debe provocar al menos una sonrisa
- No debe ser aburrido o demasiado genérico
- Debe tener algo de ingenio o creatividad
- Ajusta expectativas según el tono: ${userConfig.tone || 'balanceado'} (Issue #868)

INSTRUCCIONES:
- Responde ÚNICAMENTE con "PASS" o "FAIL"
- Si es FAIL, agrega en nueva línea qué le falta (ej: "Muy genérico, sin gancho")
- Sé un crítico de comedia honesto

RESPUESTA:`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un comediante profesional evaluando roasts. Responde solo con PASS/FAIL y motivo."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.2,
      });

      const response = completion.choices[0].message.content.trim();
      const lines = response.split('\n');
      const verdict = lines[0].toLowerCase().includes('pass') ? 'pass' : 'fail';
      const reason = lines.length > 1 ? lines.slice(1).join(' ').trim() : null;

      return {
        verdict,
        reason,
        tokensUsed: this.estimateTokens(prompt + response)
      };
    } catch (error) {
      logger.error('❌ Error in comedian review:', error);
      return { verdict: 'fail', reason: 'Error en revisión de comedia', tokensUsed: 0 };
    }
  }

  /**
   * Style Reviewer: Checks adherence to configured style and tone
   */
  async runStyleReviewer(originalComment, roastText, userConfig) {
    let styleInstructions = `Evalúa si el roast sigue el estilo y tono esperado.

TONO: ${userConfig.tone || 'balanceado'} (Flanders/Balanceado/Canalla) - Issue #868`;

    // Add custom style prompt if configured by admin and feature flag is enabled
    if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && userConfig.custom_style_prompt) {
      styleInstructions += `\n\nESTILO PERSONALIZADO CONFIGURADO:
${userConfig.custom_style_prompt}`;
    } else {
      styleInstructions += `\n\nESTILO ESTÁNDAR:
- Ingenioso y sarcástico
- Apropiado para redes sociales
- Equilibrio entre humor y respeto`;
    }

    const prompt = `Eres un revisor de estilo especializado en contenido humorístico.

${styleInstructions}

COMENTARIO ORIGINAL: "${originalComment}"
ROAST A EVALUAR: "${roastText}"

CRITERIOS DE EVALUACIÓN:
✅ ¿Sigue el estilo configurado?
✅ ¿El tono es el apropiado según ${userConfig.tone || 'balanceado'}?
✅ ¿Es consistente con las preferencias del usuario? (Issue #868)

INSTRUCCIONES:
- Responde ÚNICAMENTE con "PASS" o "FAIL"
- Si es FAIL, agrega en nueva línea qué no encaja con el estilo
- Enfócate en adherencia al estilo, no en la calidad del humor

RESPUESTA:`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un revisor de estilo. Responde solo con PASS/FAIL y motivo si aplica."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content.trim();
      const lines = response.split('\n');
      const verdict = lines[0].toLowerCase().includes('pass') ? 'pass' : 'fail';
      const reason = lines.length > 1 ? lines.slice(1).join(' ').trim() : null;

      return {
        verdict,
        reason,
        tokensUsed: this.estimateTokens(prompt + response)
      };
    } catch (error) {
      logger.error('❌ Error in style review:', error);
      return { verdict: 'fail', reason: 'Error en revisión de estilo', tokensUsed: 0 };
    }
  }

  /**
   * Apply RQC decision logic based on reviewer results
   */
  makeRQCDecision(moderatorResult, comedianResult, styleResult) {
    const passes = [moderatorResult.verdict, comedianResult.verdict, styleResult.verdict]
      .filter(v => v === 'pass').length;

    // Moderator MUST pass - non-negotiable
    if (moderatorResult.verdict === 'fail') {
      return {
        action: 'regenerate',
        reason: `Moderador rechazó: ${moderatorResult.reason || 'Incumple normas de plataforma'}`
      };
    }

    // 3 verdes = publicar
    if (passes === 3) {
      return {
        action: 'approved',
        reason: 'Los 3 revisores aprobaron el roast'
      };
    }

    // 2 verdes (sin fail del Moderador) = publicar en modo Creator+ Pro simplificado
    if (passes === 2) {
      return {
        action: 'approved',
        reason: '2 de 3 revisores aprobaron (moderador OK)'
      };
    }

    // Menos de 2 verdes = regenerar
    const failureReasons = [];
    if (comedianResult.verdict === 'fail') {
      failureReasons.push(`Comediante: ${comedianResult.reason || 'No suficientemente gracioso'}`);
    }
    if (styleResult.verdict === 'fail') {
      failureReasons.push(`Estilo: ${styleResult.reason || 'No sigue el estilo configurado'}`);
    }

    return {
      action: 'regenerate',
      reason: failureReasons.join('; ')
    };
  }

  /**
   * Estimate tokens used (rough approximation)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
}

module.exports = RQCService;