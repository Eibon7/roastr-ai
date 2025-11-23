/**
 * Enhanced Roast Generator with integrated RQC (Roast Quality Control)
 * 
 * Features:
 * - Basic moderation integrated in prompt for Free/Pro plans
 * - Advanced RQC system for Creator+ plans with 3 parallel reviewers
 * - Fallback system with regeneration limits
 * - Cost optimization per plan
 */

const OpenAI = require('openai');
const { logger } = require('../utils/logger');
const RQCService = require('./rqcService');
const RoastGeneratorMock = require('./roastGeneratorMock');
const RoastPromptTemplate = require('./roastPromptTemplate');
const RoastPromptBuilder = require('../lib/prompts/roastPrompt'); // Issue #858: New prompt builder with caching
const PersonaService = require('./PersonaService'); // Issue #615: Import PersonaService
const transparencyService = require('./transparencyService');
const levelConfigService = require('./levelConfigService'); // Issue #597: Import levelConfigService
const toneCompatibilityService = require('./toneCompatibilityService'); // Issue #872: Tone compatibility
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const { callOpenAIWithCaching } = require('../lib/openai/responsesHelper'); // Issue #858: Responses API helper
require('dotenv').config();

// Timeout configuration (Issue #419)
const VARIANT_GENERATION_TIMEOUT = 30000; // 30 seconds

class RoastGeneratorEnhanced {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      logger.warn('⚠️  OPENAI_API_KEY not found - using mock mode for enhanced generator');
      this.mockGenerator = new RoastGeneratorMock();
      this.isMockMode = true;
      return;
    }

    // Issue #419: Add timeout to OpenAI client
    this.openai = new OpenAI({
      apiKey,
      timeout: VARIANT_GENERATION_TIMEOUT,
      maxRetries: 1 // Reduced retries for faster failure detection
    });
    this.rqcService = new RQCService(this.openai);
    this.promptTemplate = new RoastPromptTemplate();
    this.promptBuilder = new RoastPromptBuilder(); // Issue #858: New prompt builder with cacheable blocks
    this.personaService = PersonaService; // Issue #615: Use PersonaService singleton
    this.isMockMode = false;
  }

  /**
   * Get generation parameters based on roast level (Issue #597)
   * @param {number} roastLevel - Roast level (1-5), defaults to 3
   * @returns {Object} Generation parameters (temperature, max_tokens, etc.)
   */
  getRoastLevelParameters(roastLevel = 3) {
    try {
      const levelConfig = levelConfigService.getRoastLevelConfig(roastLevel);
      return {
        temperature: levelConfig.temperature,
        max_tokens: Math.min(levelConfig.maxLength, 150), // Cap at 150 for cost control
        allowProfanity: levelConfig.allowProfanity,
        intensityMultiplier: levelConfig.intensityMultiplier
      };
    } catch (error) {
      logger.warn('Invalid roast level, using default (3)', { roastLevel, error: error.message });
      return {
        temperature: 0.8,
        max_tokens: 120,
        allowProfanity: true,
        intensityMultiplier: 0.9
      };
    }
  }

  /**
   * Main entry point for roast generation with RQC
   * @param {string} text - Original comment to roast
   * @param {number} toxicityScore - Toxicity score (0-1)
   * @param {string} tone - Roast tone (sarcastic, subtle, direct)
   * @param {Object} userConfig - User configuration with plan info
   * @returns {Promise<Object>} - Generated roast with metadata
   */
  async generateRoast(text, toxicityScore, tone = 'sarcastic', userConfig = {}) {
    const startTime = Date.now();
    
    // If in mock mode, use mock generator
    if (this.isMockMode) {
      const mockResult = await this.mockGenerator.generateRoast(text, toxicityScore, tone);
      // Extract roast string from mock result (Issue #483)
      const rawRoast = mockResult.roast || mockResult;

      // Apply unified transparency disclaimer (Issue #196)
      const transparencyResult = await transparencyService.applyTransparencyDisclaimer(
        rawRoast, 
        userConfig.userId, 
        userConfig.language || 'es',
        userConfig.platformLimit || null
      );
      
      // Update disclaimer usage statistics with robust retry logic (Issue #199)
      const statsResult = await transparencyService.updateDisclaimerStats(
        transparencyResult.disclaimer,
        transparencyResult.disclaimerType,
        userConfig.language || 'es',
        {
          maxRetries: 2, // Fewer retries in roast generation to avoid delays
          retryDelay: 500,
          fallbackToLocal: true,
          context: {
            userId: userConfig.userId,
            mode: 'mock_fallback'
          }
        }
      );
      
      if (!statsResult.success) {
        logger.warn('Mock mode disclaimer stats tracking failed', {
          reason: statsResult.reason,
          error: statsResult.error
        });
      }
      
      return {
        roast: transparencyResult.finalText,
        plan: userConfig.plan || 'starter_trial',
        rqcEnabled: false,
        rqcGloballyEnabled: false,
        processingTime: Date.now() - startTime,
        tokensUsed: this.estimateTokens(text + transparencyResult.finalText),
        method: 'mock_fallback',
        isMockMode: true,
        transparencyMode: transparencyResult.transparencyMode,
        disclaimerType: transparencyResult.disclaimerType,
        bioText: transparencyResult.bioText
      };
    }
    
    try {
      logger.info('🎯 Starting roast generation with RQC', {
        userId: userConfig.userId,
        plan: userConfig.plan,
        rqcEnabled: userConfig.rqcEnabled,
        tone
      });

      // Get user RQC configuration from database
      const rqcConfig = await this.getUserRQCConfig(userConfig.userId);
      
      // Check if RQC is globally enabled
      const rqcGloballyEnabled = flags.isEnabled('ENABLE_RQC');
      
      // For Free and Pro plans OR if RQC is disabled globally: use integrated basic moderation
      if (!rqcConfig.advanced_review_enabled || !rqcGloballyEnabled) {
        logger.info('📝 Using basic moderation for plan:', rqcConfig.plan);
        
        const rawRoast = await this.generateWithBasicModeration(
          text, 
          toxicityScore, 
          tone, 
          rqcConfig
        );
        
        // Apply unified transparency disclaimer (Issue #196)
        const transparencyResult = await transparencyService.applyTransparencyDisclaimer(
          rawRoast, 
          userConfig.userId, 
          userConfig.language || 'es',
          userConfig.platformLimit || null
        );
        
        // Update disclaimer usage statistics with robust retry logic (Issue #199)
        const statsResult = await transparencyService.updateDisclaimerStats(
          transparencyResult.disclaimer,
          transparencyResult.disclaimerType,
          userConfig.language || 'es',
          {
            maxRetries: 2,
            retryDelay: 500,
            fallbackToLocal: true,
            context: {
              userId: userConfig.userId,
              mode: 'basic_moderation'
            }
          }
        );
        
        if (!statsResult.success) {
          logger.warn('Basic moderation disclaimer stats tracking failed', {
            reason: statsResult.reason,
            error: statsResult.error
          });
        }
        
        return {
          roast: transparencyResult.finalText,
          plan: rqcConfig.plan,
          rqcEnabled: rqcGloballyEnabled && rqcConfig.rqc_enabled,
          rqcGloballyEnabled,
          processingTime: Date.now() - startTime,
          tokensUsed: this.estimateTokens(text + transparencyResult.finalText),
          method: rqcGloballyEnabled ? 'rqc_bypass' : 'basic_moderation',
          transparencyMode: transparencyResult.transparencyMode,
          disclaimerType: transparencyResult.disclaimerType,
          bioText: transparencyResult.bioText
        };
      }

      // For Creator+ plans: use advanced RQC system
      logger.info('🔬 Using advanced RQC for plan:', rqcConfig.plan);
      
      const result = await this.generateWithAdvancedRQC(
        text, 
        toxicityScore, 
        tone, 
        rqcConfig
      );

      // Apply unified transparency disclaimer to the final roast (Issue #196)
      const transparencyResult = await transparencyService.applyTransparencyDisclaimer(
        result.roast, 
        userConfig.userId, 
        userConfig.language || 'es',
        userConfig.platformLimit || null
      );

      // Update disclaimer usage statistics with robust retry logic (Issue #199)
      const statsResult = await transparencyService.updateDisclaimerStats(
        transparencyResult.disclaimer,
        transparencyResult.disclaimerType,
        userConfig.language || 'es',
        {
          maxRetries: 2,
          retryDelay: 500,
          fallbackToLocal: true,
          context: {
            userId: userConfig.userId,
            mode: 'advanced_rqc'
          }
        }
      );
      
      if (!statsResult.success) {
        logger.warn('Advanced RQC disclaimer stats tracking failed', {
          reason: statsResult.reason,
          error: statsResult.error
        });
      }
      return {
        ...result,
        roast: transparencyResult.finalText,
        plan: rqcConfig.plan,
        rqcEnabled: true,
        processingTime: Date.now() - startTime,
        transparencyMode: transparencyResult.transparencyMode,
        disclaimerType: transparencyResult.disclaimerType,
        bioText: transparencyResult.bioText
      };

    } catch (error) {
      logger.error('❌ Error in enhanced roast generation:', error);
      
      // Fallback to safe roast (never fail)
      let rawFallbackRoast;
      try {
        rawFallbackRoast = await this.generateFallbackRoast(text, tone, userConfig.plan || 'starter_trial');
      } catch (fallbackErr) {
        logger.error('Fallback generation failed, using mock/static roast', { error: fallbackErr.message });
        try {
          const mock = this.mockGenerator || new RoastGeneratorMock();
          const mockResult = await mock.generateRoast(text, 0.2, tone);
          // Extract roast string from mock result (Issue #483)
          rawFallbackRoast = mockResult.roast || mockResult;
        } catch {
          rawFallbackRoast = '😉 Tomo nota, pero hoy prefiero mantener la clase.';
        }
      }
      
      // Apply unified transparency disclaimer even to fallback roasts (Issue #196)
      const transparencyResult = await transparencyService.applyTransparencyDisclaimer(
        rawFallbackRoast, 
        userConfig.userId, 
        userConfig.language || 'es',
        userConfig.platformLimit || null
      );
      
      // Update disclaimer usage statistics for fallback with robust retry logic (Issue #199)
      const statsResult = await transparencyService.updateDisclaimerStats(
        transparencyResult.disclaimer,
        transparencyResult.disclaimerType,
        userConfig.language || 'es',
        {
          maxRetries: 1, // Minimal retries for fallback scenario to avoid delays
          retryDelay: 500,
          fallbackToLocal: true,
          context: {
            userId: userConfig.userId,
            mode: 'fallback_roast',
            originalError: error.message
          }
        }
      );
      
      if (!statsResult.success) {
        logger.warn('Fallback roast disclaimer stats tracking failed', {
          reason: statsResult.reason,
          error: statsResult.error
        });
      }
      
      return {
        roast: transparencyResult.finalText,
        plan: userConfig.plan || 'starter_trial',
        rqcEnabled: false,
        processingTime: Date.now() - startTime,
        tokensUsed: this.estimateTokens(text + transparencyResult.finalText),
        method: 'fallback',
        error: error.message,
        transparencyMode: transparencyResult.transparencyMode,
        disclaimerType: transparencyResult.disclaimerType,
        bioText: transparencyResult.bioText
      };
    }
  }

  /**
   * Generate roast with basic moderation integrated in prompt (Free/Pro)
   */
  async generateWithBasicModeration(text, toxicityScore, tone, rqcConfig) {
    // Get model based on plan (Issue #326)
    const model = await this.getModelForPlan(rqcConfig.plan);

    // Issue #615: Load user persona for personalized roast generation
    const persona = await this.personaService.getPersona(rqcConfig.user_id);

    // Issue #597: Get generation parameters based on roast_level
    const roastLevel = rqcConfig.roast_level || 3;
    const levelParams = this.getRoastLevelParameters(roastLevel);

    // Issue #858: Build prompt using new prompt builder with cacheable blocks (A/B/C)
    const completePrompt = await this.promptBuilder.buildCompletePrompt({
      comment: text,
      platform: rqcConfig.platform || 'twitter',
      toxicityData: {
        score: toxicityScore,
        categories: [] // Could be enhanced with actual toxicity categories
      },
      persona: persona,
      styleProfile: rqcConfig.styleProfile || null,
      tone: tone,
      // Issue #872: humorType deprecated, kept for compatibility but not used in new prompt builder
      includeReferences: rqcConfig.plan !== 'starter_trial',
      getReferenceRoasts: async (comment) => {
        // Use existing prompt template's reference roast method for compatibility
        return await this.promptTemplate.getReferenceRoasts(comment);
      }
    });

    // Issue #858: Use Responses API with prompt caching
    const result = await callOpenAIWithCaching(this.openai, {
      model: model,
      input: completePrompt,
      max_tokens: levelParams.max_tokens,
      temperature: levelParams.temperature,
      prompt_cache_retention: '24h',
      loggingContext: {
        userId: rqcConfig.user_id,
        orgId: rqcConfig.orgId || null,
        plan: rqcConfig.plan,
        endpoint: 'roast'
      }
    });

    const roast = result.content;
    
    logger.info('✅ Basic moderated roast generated', {
      plan: rqcConfig.plan,
      model: model,
      intensityLevel: toneCompatibilityService.getToneIntensity(rqcConfig.tone || tone || 'balanceado'),
      roastLength: roast.length,
      promptVersion: this.promptTemplate.getVersion()
    });

    return roast;
  }

  /**
   * Generate roast with advanced RQC system (Creator+)
   */
  async generateWithAdvancedRQC(text, toxicityScore, tone, rqcConfig) {
    let attempt = 1;
    const maxAttempts = rqcConfig.max_regenerations || 3;
    let totalTokensUsed = 0;
    let totalCost = 0;

    while (attempt <= maxAttempts) {
      logger.info(`🔄 RQC attempt ${attempt}/${maxAttempts}`);

      // Generate initial roast
      const roast = await this.generateInitialRoast(text, tone, rqcConfig);
      const roastTokens = this.estimateTokens(text + roast);
      totalTokensUsed += roastTokens;

      // Run RQC review process
      const reviewResult = await this.rqcService.reviewRoast({
        originalComment: text,
        roastText: roast,
        userConfig: rqcConfig,
        attempt: attempt
      });

      totalTokensUsed += reviewResult.tokensUsed;
      totalCost += reviewResult.costCents;

      // Log review to database
      await this.logRQCReview(rqcConfig.user_id, text, roast, attempt, reviewResult);

      // Check RQC decision
      if (reviewResult.decision === 'approved') {
        logger.info('✅ RQC approved roast', {
          attempt,
          moderatorPass: reviewResult.moderatorPass,
          comedianPass: reviewResult.comedianPass,
          stylePass: reviewResult.stylePass
        });

        return {
          roast,
          attempt,
          tokensUsed: totalTokensUsed,
          costCents: totalCost,
          method: 'advanced_rqc',
          rqcResults: reviewResult,
          approved: true
        };
      }

      if (reviewResult.decision === 'rejected' || attempt >= maxAttempts) {
        logger.warn('⚠️ RQC rejected roast or max attempts reached', {
          attempt,
          maxAttempts,
          decision: reviewResult.decision
        });
        break;
      }

      // Prepare for regeneration with feedback
      attempt++;
    }

    // Generate fallback roast
    logger.info('🔄 Generating fallback roast after RQC failure');
    let fallbackRoast;
    try {
      fallbackRoast = await this.generateFallbackRoast(text, tone);
    } catch (fallbackErr) {
      logger.error('RQC fallback generation failed, using mock/static roast', { error: fallbackErr.message });
      try {
        const mock = this.mockGenerator || new RoastGeneratorMock();
        const mockResult = await mock.generateRoast(text, 0.2, tone);
        // Extract roast string from mock result (Issue #483)
        fallbackRoast = mockResult.roast || mockResult;
      } catch {
        fallbackRoast = '😉 Tomo nota, pero hoy prefiero mantener la clase.';
      }
    }
    
    return {
      roast: fallbackRoast,
      attempt,
      tokensUsed: totalTokensUsed + this.estimateTokens(fallbackRoast),
      costCents: totalCost,
      method: 'fallback_after_rqc',
      approved: false
    };
  }

  /**
   * Generate initial roast without moderation constraints
   */
  async generateInitialRoast(text, tone, rqcConfig) {
    // Get model based on plan (Issue #326)
    const model = await this.getModelForPlan(rqcConfig.plan);

    // Issue #615: Load user persona for personalized roast generation
    const persona = await this.personaService.getPersona(rqcConfig.user_id);

    // Issue #858: Build prompt using new prompt builder with cacheable blocks (A/B/C)
    const completePrompt = await this.promptBuilder.buildCompletePrompt({
      comment: text,
      platform: rqcConfig.platform || 'twitter',
      toxicityData: {
        categories: [] // Could be enhanced with actual toxicity categories
      },
      persona: persona,
      styleProfile: rqcConfig.styleProfile || null,
      tone: tone,
      // Issue #872: humorType deprecated, kept for compatibility but not used in new prompt builder
      includeReferences: true, // Always include references for Creator+ plans
      getReferenceRoasts: async (comment) => {
        return await this.promptTemplate.getReferenceRoasts(comment);
      }
    });

    // Issue #858: Use Responses API with prompt caching
    const result = await callOpenAIWithCaching(this.openai, {
      model: model,
      input: completePrompt,
      max_tokens: 150,
      temperature: 0.9, // Higher creativity for advanced users
      prompt_cache_retention: '24h',
      loggingContext: {
        userId: rqcConfig.user_id,
        orgId: rqcConfig.orgId || null,
        plan: rqcConfig.plan,
        endpoint: 'roast_initial'
      }
    });

    return result.content;
  }

  /**
   * Generate safe fallback roast
   */
  async generateFallbackRoast(text, tone, plan = 'starter_trial') {
    try {
      const model = await this.getModelForPlan(plan);

      // Issue #858: Use Responses API for fallback (simpler prompt, still cacheable)
      const fallbackPrompt = `Eres Roastr, un bot que responde con comentarios ingeniosos y seguros.

Reglas estrictas:
- Sé ingenioso pero completamente inofensivo
- Usa humor muy ligero y amigable
- Evita cualquier contenido que pueda ser problemático
- Máximo 1-2 frases cortas
- Enfócate en ser divertido sin ser agresivo

Comentario: "${text}"

Responde únicamente con el roast seguro, sin explicaciones.`;

      const result = await callOpenAIWithCaching(this.openai, {
        model: model,
        input: fallbackPrompt,
        max_tokens: 80,
        temperature: 0.5, // Lower temperature for safety
        prompt_cache_retention: '24h', // Still use caching for fallback
        loggingContext: {
          userId: null, // Fallback doesn't have user context
          orgId: null,
          plan: plan,
          endpoint: 'roast_fallback'
        }
      });

      return result.content;
    } catch (err) {
      logger.error('OpenAI fallback failed, returning mock/static roast', { error: err.message });
      try {
        const mock = this.mockGenerator || new RoastGeneratorMock();
        const mockResult = await mock.generateRoast(text, 0.2, tone);
        // Extract roast string from mock result (Issue #483)
        return mockResult.roast || mockResult;
      } catch {
        return '😉 Tomo nota, pero hoy prefiero mantener la clase.';
      }
    }
  }

  /**
   * Get basic moderation prompt for Free/Pro plans
   */
  getBasicModerationPrompt(tone, rqcConfig) {
    const basePrompt = `Eres Roastr, un bot que responde a comentarios en redes sociales con roasts divertidos, inteligentes y con un toque de sarcasmo.

Reglas obligatorias:

1. Cumple siempre las políticas de contenido de las plataformas (sin incitación al odio, violencia gráfica, discriminación o acoso directo).
2. Mantén la intensidad del roast en un nivel básico, ingenioso pero no excesivamente ofensivo.
3. Sé gracioso y original, pero evita contenido sexual explícito.
4. Evita términos que puedan activar filtros automáticos o penalizaciones algorítmicas.
5. Tu objetivo es que el lector sonría o se ría, sin que el comentario sea reportado.
6. Detecta automáticamente el idioma del comentario y responde en el mismo idioma.
7. Responde únicamente con el texto del roast, sin explicaciones adicionales.

Configuración de usuario:
- Tono: ${rqcConfig.tone || 'balanceado'} (intensidad ${toneCompatibilityService.getToneIntensity(rqcConfig.tone || 'balanceado')}/5)
- Plan: ${rqcConfig.plan} (moderación básica integrada)`;

    // Add tone-specific instructions
    const toneInstructions = {
      sarcastic: "- Estilo: Sarcasmo agudo pero sin insultos explícitos fuertes\n- Humor inteligente y creativo",
      subtle: "- Estilo: Ironía sofisticada y elegante\n- Usa juegos de palabras y dobles sentidos",
      direct: "- Estilo: Humor directo pero inteligente\n- Ve al punto sin rodeos pero mantén el ingenio"
    };

    return basePrompt + "\n\n" + (toneInstructions[tone] || toneInstructions.sarcastic);
  }

  /**
   * Get advanced roast prompt for Creator+ plans (pre-RQC)
   */
  getAdvancedRoastPrompt(tone, rqcConfig) {
    let prompt = `Eres Roastr, un generador de roasts avanzado para usuarios premium.

Eres más creativo y sofisticado porque el contenido será revisado por un sistema de control de calidad.

Configuración de usuario:
- Tono: ${rqcConfig.tone || 'balanceado'} (intensidad ${toneCompatibilityService.getToneIntensity(rqcConfig.tone || 'balanceado')}/5)
- Plan: ${rqcConfig.plan} (con revisión RQC)`;

    // Add custom style prompt if available (admin-configured) and feature flag is enabled
    if (flags.isEnabled('ENABLE_CUSTOM_PROMPT') && rqcConfig.custom_style_prompt) {
      prompt += `\n- Estilo personalizado: ${rqcConfig.custom_style_prompt}`;
    }

    prompt += `\n\nInstrucciones:
- Crea un roast ingenioso y memorable
- Puedes ser más creativo porque será revisado
- Detecta el idioma del comentario y responde en el mismo idioma
- Responde únicamente con el roast, sin explicaciones`;

    return prompt;
  }

  /**
   * Get user RQC configuration from database
   */
  async getUserRQCConfig(userId) {
    try {
      const { data, error } = await supabaseServiceClient
        .rpc('get_user_rqc_config', { user_uuid: userId });

      if (error) {
        logger.error('Error fetching user RQC config:', error);
        // Return default config
        return {
          plan: 'starter_trial',
          rqc_enabled: false,
          tone: 'balanceado', // Issue #872: Use new tone system
          intensity_level: 3, // Legacy - kept for backward compatibility
          custom_style_prompt: null,
          max_regenerations: 0,
          basic_moderation_enabled: true,
          advanced_review_enabled: false,
          user_id: userId
        };
      }

      if (!data || data.length === 0) {
        logger.warn('No RQC config found for user:', userId);
        return {
          plan: 'starter_trial',
          rqc_enabled: false,
          tone: 'balanceado', // Issue #872: Use new tone system
          intensity_level: 3, // Legacy - kept for backward compatibility
          custom_style_prompt: null,
          max_regenerations: 0,
          basic_moderation_enabled: true,
          advanced_review_enabled: false,
          user_id: userId
        };
      }

      return {
        ...data[0],
        user_id: userId
      };
    } catch (error) {
      logger.error('Exception fetching user RQC config:', error);
      return {
        plan: 'starter_trial',
        rqc_enabled: false,
        tone: 'balanceado', // Issue #872: Use new tone system
        custom_style_prompt: null,
        max_regenerations: 0,
        basic_moderation_enabled: true,
        advanced_review_enabled: false,
        user_id: userId
      };
    }
  }

  /**
   * Log RQC review to database
   */
  async logRQCReview(userId, originalComment, roastText, attempt, reviewResult) {
    try {
      await supabaseServiceClient
        .rpc('log_rqc_review', {
          user_uuid: userId,
          original_comment: originalComment,
          roast_text: roastText,
          attempt_num: attempt,
          moderator_pass: reviewResult.moderatorPass ? 'pass' : 'fail',
          moderator_reason: reviewResult.moderatorReason || null,
          comedian_pass: reviewResult.comedianPass ? 'pass' : 'fail',
          comedian_reason: reviewResult.comedianReason || null,
          style_pass: reviewResult.stylePass ? 'pass' : 'fail',
          style_reason: reviewResult.styleReason || null,
          final_decision: reviewResult.decision,
          review_duration: reviewResult.reviewDuration || null,
          tokens_used: reviewResult.tokensUsed || 0,
          cost_cents: reviewResult.costCents || 0,
          config_json: JSON.stringify({
            tone: reviewResult.userConfig?.tone,
            intensityLevel: toneCompatibilityService.getToneIntensity(reviewResult.userConfig?.tone || 'balanceado'),
            customPrompt: reviewResult.userConfig?.custom_style_prompt
          })
        });
      
      logger.info('✅ RQC review logged to database', { userId, attempt });
    } catch (error) {
      logger.error('❌ Error logging RQC review:', error);
    }
  }

  /**
   * Estimate tokens used (rough approximation)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4); // Rough estimate: 4 chars per token
  }

  // Legacy compatibility methods
  async generateRoastWithTone(text, toxicityScore, tone = 'sarcastic') {
    return this.generateRoast(text, toxicityScore, tone);
  }

  async generateRoastWithPrompt(text, customPrompt, plan = 'pro', userId = null) {
    try {
      const model = await this.getModelForPlan(plan);
      
      // Issue #858: Combine custom prompt with user input for Responses API
      const completePrompt = `${customPrompt}\n\nComentario: "${text}"\n\nRoast:`;
      
      const result = await callOpenAIWithCaching(this.openai, {
        model: model,
        input: completePrompt,
        temperature: 0.8,
        max_tokens: 150,
        prompt_cache_retention: '24h',
        loggingContext: {
          userId: userId,
          plan: plan,
          endpoint: 'roast_custom_prompt'
        }
      });

      return result.content;
    } catch (error) {
      logger.error("❌ Error generating roast with custom prompt:", error);
      try {
        return await this.generateFallbackRoast(text, 'sarcastic', plan);
      } catch {
        const mock = this.mockGenerator || new RoastGeneratorMock();
        try {
          const mockResult = await mock.generateRoast(text, 0.2, 'sarcastic');
          // Extract roast string from mock result (Issue #483)
          return mockResult.roast || mockResult;
        } catch {
          return '😉 Tomo nota, pero hoy prefiero mantener la clase.';
        }
      }
    }
  }

  /**
   * Get AI model for plan with GPT-5 auto-detection (Issue #326)
   */
  async getModelForPlan(plan) {
    try {
      const { getModelAvailabilityService } = require('./modelAvailabilityService');
      const modelService = getModelAvailabilityService();
      
      // Use the smart model selection with GPT-5 detection
      return await modelService.getModelForPlan(plan);
    } catch (error) {
      logger.error('Error getting model for plan in RoastGenerator, using fallback', {
        plan,
        error: error.message
      });
      
      // Safe fallback to previous logic
      const fallbackModels = {
        'starter_trial': 'gpt-3.5-turbo',
        'starter': 'gpt-4o',
        'pro': 'gpt-4o', 
        'plus': 'gpt-4o',
        'custom': 'gpt-4o'
      };
      return fallbackModels[plan] || 'gpt-4o';
    }
  }
}

module.exports = RoastGeneratorEnhanced;