const BaseWorker = require('./BaseWorker');
const CostControlService = require('../services/costControl');
const RoastPromptTemplate = require('../services/roastPromptTemplate');
const transparencyService = require('../services/transparencyService');
const { mockMode } = require('../config/mockMode');
const { PLATFORM_LIMITS } = require('../config/constants');

/**
 * Generate Reply Worker
 * 
 * Responsible for generating contextual roast responses using:
 * - Primary: OpenAI GPT-4o mini for personalized roasts
 * - Fallback: Template-based responses
 * 
 * This worker handles the creative core of Roastr.ai, generating
 * witty, sarcastic, and platform-appropriate responses while
 * respecting tone, humor type, and frequency settings.
 */
class GenerateReplyWorker extends BaseWorker {
  constructor(options = {}) {
    super('generate_reply', {
      maxConcurrency: 2, // Lower concurrency due to LLM rate limits
      pollInterval: 2000,
      maxRetries: 3,
      ...options
    });
    
    this.costControl = new CostControlService();
    this.promptTemplate = new RoastPromptTemplate();
    
    // Initialize OpenAI client
    this.initializeOpenAI();
    
    // Roast templates for fallback
    this.initializeTemplates();
    
    // Tone configurations
    this.tonePrompts = {
      sarcastic: "Respond with sharp, cutting sarcasm that's clever but not cruel.",
      ironic: "Use irony and subtle humor to highlight the absurdity of the comment.",
      absurd: "Create an absurdly exaggerated response that's so over-the-top it's funny."
    };
    
    this.humorStyles = {
      witty: "Be clever and quick-witted, like a stand-up comedian.",
      clever: "Show intellectual humor with wordplay and smart observations.",
      playful: "Keep it light and fun, like friendly teasing between friends."
    };
  }
  
  /**
   * Get worker-specific health details
   */
  async getSpecificHealthDetails() {
    const details = {
      openai: {
        available: !!this.openaiClient,
        apiKey: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
        lastUsed: this.lastOpenAIUse || null,
        errorCount: this.openaiErrors || 0,
        fallbackCount: this.fallbackUseCount || 0
      },
      generationStats: {
        total: this.totalGenerated || 0,
        byTone: this.generationsByTone || {},
        byHumor: this.generationsByHumor || {},
        avgGenerationTime: this.avgGenerationTime || 'N/A',
        avgTokensUsed: this.avgTokensUsed || 'N/A'
      },
      costControl: {
        enabled: !!this.costControl,
        lastCheck: this.lastCostCheckTime || null,
        costThisHour: this.costThisHour || 0,
        remainingBudget: this.remainingBudget || 'N/A'
      },
      templateUsage: {
        templatesAvailable: this.roastTemplates ? Object.keys(this.roastTemplates).length : 0,
        fallbacksUsed: this.fallbackUseCount || 0
      }
    };
    
    return details;
  }
  
  /**
   * Initialize OpenAI client
   */
  initializeOpenAI() {
    if (mockMode.isMockMode) {
      this.openai = mockMode.generateMockOpenAI();
      this.openaiClient = this.openai;
    } else if (process.env.OPENAI_API_KEY) {
      const { OpenAI } = require('openai');
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 15000 // 15 second timeout
      });
      this.log('info', 'OpenAI client initialized');
    } else {
      this.log('warn', 'No OpenAI API key configured, using template fallback only');
    }
  }
  
  /**
   * Initialize response templates
   */
  initializeTemplates() {
    this.templates = {
      sarcastic: [
        "Oh wow, what an absolutely groundbreaking observation. I'm sure no one has ever thought of that before.",
        "Truly fascinating. I'm sure the world was desperately waiting for this insight.",
        "Your creativity knows no bounds. How do you come up with such original thoughts?",
        "Amazing! You've managed to say something that adds absolutely nothing to the conversation."
      ],
      ironic: [
        "It's funny how someone who clearly has it all figured out needs to share their wisdom with the rest of us.",
        "I love how confident people become when they're completely missing the point.",
        "Nothing says 'I'm reasonable' like that tone you're using.",
        "Your comment really demonstrates that you've given this a lot of careful thought."
      ],
      absurd: [
        "BREAKING: Local genius discovers the secret to solving all world problems in a single comment! Scientists hate them!",
        "This comment has single-handedly convinced me to reconsider my entire existence. Truly life-changing.",
        "I'm literally shaking. This comment has opened my third eye and I can now see through dimensions.",
        "Hold on, let me alert the Nobel Prize committee. This level of insight deserves international recognition."
      ]
    };
  }
  
  
  /**
   * Process reply generation job
   */
  async processJob(job) {
    // FIX: Critical fixes from CodeRabbit review (outside diff)
    // Validate job payload exists before destructuring
    if (!job?.payload) {
      throw new Error('Invalid job: missing payload');
    }

    const {
      comment_id,
      organization_id,
      platform,
      original_text,
      toxicity_score,
      severity_level,
      categories
    } = job.payload;
    
    // Check cost control limits with enhanced tracking
    const canProcess = await this.costControl.canPerformOperation(
      organization_id, 
      'generate_reply',
      1, // quantity
      platform
    );
    
    if (!canProcess.allowed) {
      throw new Error(`Organization ${organization_id} has reached limits: ${canProcess.reason}`);
    }
    
    // Get comment and integration config
    const comment = await this.getComment(comment_id);
    if (!comment) {
      throw new Error(`Comment ${comment_id} not found`);
    }
    
    const integrationConfig = await this.getIntegrationConfig(
      organization_id, 
      comment.integration_config_id
    );
    
    if (!integrationConfig) {
      throw new Error(`Integration config not found for comment ${comment_id}`);
    }
    
    // Check response frequency (probabilistic filtering)
    if (!this.shouldRespondBasedOnFrequency(integrationConfig.response_frequency)) {
      return {
        success: true,
        summary: 'Response skipped based on frequency setting',
        skipped: true,
        reason: 'frequency_filter'
      };
    }
    
    // Fetch user's Roastr Persona data for enhanced response generation (Issue #81)
    const personaData = await this.fetchPersonaData(organization_id);
    
    // Generate response
    const startTime = Date.now();
    const response = await this.generateResponse(
      original_text,
      integrationConfig,
      {
        toxicity_score,
        severity_level,
        categories,
        platform,
        personaData // Include persona data in context
      }
    );
    const generationTime = Date.now() - startTime;
    
    // Store response in database
    const storedResponse = await this.storeResponse(
      comment_id,
      organization_id,
      response,
      integrationConfig,
      generationTime
    );
    
    // Record usage and cost with enhanced tracking
    const tokensUsed = response.tokensUsed || this.estimateTokens(original_text + response.text);
    await this.costControl.recordUsage(
      organization_id,
      platform,
      'generate_reply',
      {
        commentId: comment_id,
        responseId: storedResponse.id,
        tokensUsed,
        generationTime,
        service: response.service,
        tone: integrationConfig.tone,
        humorType: integrationConfig.humor_type,
        originalTextLength: original_text.length,
        responseLength: response.text.length
      },
      null, // userId - could be extracted from comment if needed
      1 // quantity
    );
    
    // Queue posting job (if auto-posting is enabled)
    if (integrationConfig.config.auto_post !== false) {
      await this.queuePostingJob(organization_id, storedResponse, platform);
    }
    
    return {
      success: true,
      summary: `Generated ${response.service} response: "${response.text.substring(0, 50)}..."`,
      responseId: storedResponse.id,
      responseText: response.text,
      service: response.service,
      generationTime,
      tokensUsed: response.tokensUsed || this.estimateTokens(response.text)
    };
  }
  
  /**
   * Get comment from database
   */
  async getComment(commentId) {
    try {
      const { data: comment, error } = await this.supabase
        .from('comments')
        .select('*')
        .eq('id', commentId)
        .single();
      
      if (error) throw error;
      return comment;
      
    } catch (error) {
      this.log('error', 'Failed to get comment', {
        commentId,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Get integration configuration
   */
  async getIntegrationConfig(organizationId, configId) {
    try {
      const { data: config, error } = await this.supabase
        .from('integration_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('id', configId)
        .single();
      
      if (error) throw error;
      return config;
      
    } catch (error) {
      this.log('error', 'Failed to get integration config', {
        organizationId,
        configId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Fetch user's Roastr Persona data for personalized response generation
   * Issue #81: Enable persona-aware roast generation and analytics tracking
   */
  async fetchPersonaData(organizationId) {
    try {
      // Get the organization owner's persona data
      const { data: orgData, error: orgError } = await this.supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .single();

      if (orgError || !orgData) {
        this.log('warn', 'Could not find organization for persona lookup', {
          organizationId,
          error: orgError?.message
        });
        return null;
      }

      // Fetch persona data for the owner
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select(`
          lo_que_me_define_encrypted,
          lo_que_me_define_visible,
          lo_que_no_tolero_encrypted,
          lo_que_no_tolero_visible,
          lo_que_me_da_igual_encrypted,
          lo_que_me_da_igual_visible,
          embeddings_generated_at,
          embeddings_model
        `)
        .eq('id', orgData.owner_id)
        .single();

      if (userError || !userData) {
        this.log('debug', 'No persona data found for organization owner', {
          organizationId,
          ownerId: orgData.owner_id
        });
        return null;
      }

      // Check if any persona fields are configured
      const hasPersonaData = !!(
        userData.lo_que_me_define_encrypted || 
        userData.lo_que_no_tolero_encrypted || 
        userData.lo_que_me_da_igual_encrypted
      );

      if (!hasPersonaData) {
        return null; // No persona configured
      }

      // Decrypt persona fields (simplified version - in production you'd use the encryption service)
      let personaData = {
        hasPersona: true,
        fieldsAvailable: [],
        embeddings: {
          available: !!userData.embeddings_generated_at,
          model: userData.embeddings_model,
          generated_at: userData.embeddings_generated_at
        }
      };

      // Note: In a real implementation, you would decrypt these fields
      // For now, we'll just track which fields are available
      if (userData.lo_que_me_define_encrypted) {
        personaData.fieldsAvailable.push('lo_que_me_define');
      }
      if (userData.lo_que_no_tolero_encrypted) {
        personaData.fieldsAvailable.push('lo_que_no_tolero');
      }
      if (userData.lo_que_me_da_igual_encrypted) {
        personaData.fieldsAvailable.push('lo_que_me_da_igual');
      }

      this.log('debug', 'Persona data fetched for response generation', {
        organizationId,
        fieldsAvailable: personaData.fieldsAvailable,
        hasEmbeddings: personaData.embeddings.available
      });

      return personaData;

    } catch (error) {
      this.log('error', 'Failed to fetch persona data', {
        organizationId,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Check if response should be generated based on frequency setting
   */
  shouldRespondBasedOnFrequency(frequency) {
    if (frequency >= 1.0) return true; // Always respond
    if (frequency <= 0.0) return false; // Never respond
    
    return Math.random() < frequency;
  }
  
  /**
   * Generate response using OpenAI or templates
   */
  async generateResponse(originalText, config, context) {
    let response = null;
    
    // Try OpenAI first
    if (this.openaiClient) {
      try {
        response = await this.generateOpenAIResponse(originalText, config, context);
        response.service = 'openai';
      } catch (error) {
        // FIX: Critical fixes from CodeRabbit review (outside diff)
        // Enhanced error logging with stack trace and safe property access
        this.log('warn', 'OpenAI generation failed, using template fallback', {
          error: error?.message || 'Unknown error',
          stack: error?.stack || 'No stack trace available',
          originalTextLength: originalText?.length || 0
        });
      }
    }
    
    // Use template fallback
    if (!response) {
      response = this.generateTemplateResponse(originalText, config, context);
      response.service = 'template';
    }
    
    return response;
  }
  
  /**
   * Build persona context from available persona fields
   * @private
   */
  buildPersonaContext(personaData, personaFieldsUsed) {
    if (!personaData || !personaData.hasPersona || !personaData.fieldsAvailable) {
      return null;
    }

    // FIX: Critical fixes from CodeRabbit review (outside diff)
    // Use const instead of let for immutable arrays
    const personaEnhancements = [];

    if (personaData.fieldsAvailable.includes('lo_que_me_define')) {
      personaEnhancements.push('Considera la personalidad definida del usuario');
      personaFieldsUsed.loQueMeDefineUsed = true;
    }

    if (personaData.fieldsAvailable.includes('lo_que_no_tolero')) {
      personaEnhancements.push('Ten en cuenta lo que el usuario no tolera');
      personaFieldsUsed.loQueNoToleroUsed = true;
    }

    if (personaData.fieldsAvailable.includes('lo_que_me_da_igual')) {
      personaEnhancements.push('Considera las cosas que le dan igual al usuario');
      personaFieldsUsed.loQueMeDaIgualUsed = true;
    }

    // Filter out empty or falsy elements and join with proper formatting
    const validEnhancements = personaEnhancements.filter(enhancement =>
      enhancement && typeof enhancement === 'string' && enhancement.trim().length > 0
    );

    if (validEnhancements.length === 0) {
      return null;
    }

    // Join and trim the final context
    const personaContext = validEnhancements.join('. ').trim();

    // Ensure it ends with a period if it doesn't already
    return personaContext.endsWith('.') ? personaContext : personaContext + '.';
  }

  /**
   * Generate response using OpenAI
   */
  async generateOpenAIResponse(originalText, config, context) {
    const { tone, humor_type } = config;
    const { platform, severity_level, toxicity_score, categories, personaData } = context;

    // Track which persona fields will be used (Issue #81)
    const personaFieldsUsed = {
      loQueMeDefineUsed: false,
      loQueNoToleroUsed: false,
      loQueMeDaIgualUsed: false
    };

    // FIX: Critical fixes from CodeRabbit review (outside diff)
    // Build enhanced user config with persona data if available
    const userConfig = {
      tone: tone,
      humor_type: humor_type,
      intensity_level: config.intensity_level || 3,
      custom_style_prompt: config.custom_style_prompt
    };

    // Enhance prompt with persona context if available using robust helper
    const personaContext = this.buildPersonaContext(personaData, personaFieldsUsed);
    if (personaContext) {
      userConfig.persona_context = personaContext;
      this.log('debug', 'Enhanced response with persona context', {
        fieldsUsed: Object.keys(personaFieldsUsed).filter(key => personaFieldsUsed[key]),
        contextLength: personaContext.length
      });
    }

    // Build enhanced system prompt using master template with error handling
    let systemPrompt;
    try {
      systemPrompt = await this.promptTemplate.buildPrompt({
        originalComment: originalText,
        toxicityData: {
          score: toxicity_score,
          severity: severity_level,
          categories: categories || []
        },
        userConfig,
        includeReferences: true // Include references by default in worker
      });
    } catch (err) {
      // FIX: Critical fixes from CodeRabbit review (outside diff)
      // Enhanced error logging with stack trace
      this.log('error', 'Failed to build system prompt', {
        error: err.message,
        stack: err.stack,
        originalTextLength: originalText?.length || 0,
        userConfig: userConfig ? Object.keys(userConfig) : []
      });
      throw new Error(`Prompt generation failed: ${err.message}`);
    }
    
    // Add platform constraints to the end of the prompt
    const platformConstraint = this.getPlatformConstraint(platform);
    const finalPrompt = systemPrompt + '\n\n' + platformConstraint;
    
    const completion = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: finalPrompt }
      ],
      max_tokens: 200, // Keep responses concise
      temperature: 0.8, // Creative but not too random
      presence_penalty: 0.3, // Encourage varied vocabulary
      frequency_penalty: 0.2 // Reduce repetition
    });
    
    const responseText = completion.choices[0].message.content.trim();
    
    // Validate response length for platform
    const finalResponse = this.validateResponseLength(responseText, platform);
    
    return {
      text: finalResponse,
      tokensUsed: completion.usage.total_tokens,
      model: 'gpt-4o-mini',
      promptVersion: this.promptTemplate.getVersion(),
      personaData: personaFieldsUsed // Track which persona fields were used
    };
  }
  
  /**
   * Generate response using templates
   */
  generateTemplateResponse(originalText, config, context) {
    const { tone } = config;
    const templates = this.templates[tone] || this.templates.sarcastic;
    
    // Select random template
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return {
      text: template,
      templated: true
    };
  }
  
  /**
   * Build system prompt for OpenAI
   */
  buildSystemPrompt(tone, humorType, platform) {
    const toneGuide = this.tonePrompts[tone] || this.tonePrompts.sarcastic;
    const humorGuide = this.humorStyles[humorType] || this.humorStyles.witty;
    
    let platformConstraints = '';
    switch (platform) {
      case 'twitter':
        platformConstraints = `Keep responses under ${PLATFORM_LIMITS.twitter.maxLength} characters for Twitter.`;
        break;
      case 'youtube':
        platformConstraints = 'YouTube comment style, can be slightly longer but still concise.';
        break;
      case 'instagram':
        platformConstraints = 'Instagram style, friendly but sassy.';
        break;
      default:
        platformConstraints = 'Keep responses concise and platform-appropriate.';
    }
    
    return `You are Roastr.ai, a witty AI that generates clever comeback responses to comments.
    
    TONE: ${toneGuide}
    HUMOR STYLE: ${humorGuide}
    PLATFORM: ${platformConstraints}
    
    IMPORTANT RULES:
    - Never be genuinely mean or cruel
    - Avoid personal attacks on appearance, race, gender, or serious issues
    - Keep it playful and fun, not genuinely hurtful
    - Don't use excessive profanity
    - Be clever, not just insulting
    - Make it feel like friendly banter, not cyberbullying
    
    Generate a single response that roasts the comment in a clever, ${tone} way with ${humorType} humor.`;
  }
  
  /**
   * Get platform-specific constraints
   */
  getPlatformConstraint(platform) {
    const constraints = {
      'twitter': `RESTRICCIÓN DE PLATAFORMA: Respuesta máxima de ${PLATFORM_LIMITS.twitter.maxLength} caracteres para Twitter.`,
      'youtube': 'RESTRICCIÓN DE PLATAFORMA: Estilo de comentario de YouTube, puede ser ligeramente más largo pero mantén la concisión.',
      'instagram': 'RESTRICCIÓN DE PLATAFORMA: Estilo de Instagram, amigable pero con sarcasmo.',
      'facebook': 'RESTRICCIÓN DE PLATAFORMA: Estilo de Facebook, considera audiencia más amplia.',
      'tiktok': 'RESTRICCIÓN DE PLATAFORMA: Estilo TikTok, dinámico y juvenil.',
      'reddit': 'RESTRICCIÓN DE PLATAFORMA: Estilo Reddit, más intelectual y con referencias.',
      'discord': 'RESTRICCIÓN DE PLATAFORMA: Estilo Discord casual pero ingenioso.'
    };

    return constraints[platform] || 'RESTRICCIÓN DE PLATAFORMA: Mantén la respuesta concisa y apropiada para la plataforma.';
  }

  /**
   * Build user prompt for OpenAI (legacy method, may be deprecated)
   */
  buildUserPrompt(originalText, context) {
    const { severity_level, toxicity_score, categories } = context;
    
    let contextInfo = '';
    if (severity_level && toxicity_score) {
      contextInfo = `\n\nContext: This comment has ${severity_level} toxicity (score: ${toxicity_score})`;
      if (categories && categories.length > 0) {
        contextInfo += ` with categories: ${categories.join(', ')}`;
      }
    }
    
    return `Roast this comment: "${originalText}"${contextInfo}`;
  }
  
  /**
   * Validate response length for platform constraints
   */
  validateResponseLength(response, platform) {
    let maxLength;
    
    switch (platform) {
      case 'twitter':
        maxLength = PLATFORM_LIMITS.twitter.maxLength - 10; // Leave room for mentions/context
        break;
      case 'instagram':
        maxLength = 500;
        break;
      case 'youtube':
        maxLength = 1000;
        break;
      default:
        maxLength = PLATFORM_LIMITS.twitter.maxLength;
    }
    
    if (response.length <= maxLength) {
      return response;
    }
    
    // Truncate at sentence boundary if possible
    const sentences = response.split(/[.!?]+/);
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length > maxLength - 10) {
        break;
      }
      truncated += sentence + '.';
    }
    
    return truncated || response.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Store response in database with Roastr Persona tracking
   * Issue #81: Track which persona fields were used in response generation
   */
  async storeResponse(commentId, organizationId, response, config, generationTime) {
    try {
      // Determine which persona fields were used (if any)
      let personaFieldsUsed = null;
      
      if (response.personaData) {
        personaFieldsUsed = [];
        if (response.personaData.loQueMeDefineUsed) {
          personaFieldsUsed.push('lo_que_me_define');
        }
        if (response.personaData.loQueNoToleroUsed) {
          personaFieldsUsed.push('lo_que_no_tolero');
        }
        if (response.personaData.loQueMeDaIgualUsed) {
          personaFieldsUsed.push('lo_que_me_da_igual');
        }
        
        // Only set if fields were actually used
        if (personaFieldsUsed.length === 0) {
          personaFieldsUsed = null;
        }
      }

      // Get organization owner ID for transparency settings (Issue #196)
      const { data: orgData } = await this.supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .single();
      
      const ownerId = orgData?.owner_id;
      let finalResponseText = response.text;
      
      // Apply unified transparency disclaimer if we have owner ID (Issue #196)
      if (ownerId) {
        try {
          const transparencyResult = await transparencyService.applyTransparencyDisclaimer(
            response.text,
            ownerId,
            config.language || 'es',
            config.platformLimit || null
          );
          finalResponseText = transparencyResult.finalText;
          
          // FIX: Critical fixes from CodeRabbit review (outside diff)
          // Update disclaimer usage statistics with enhanced fallback retry logic
          let statsResult;
          try {
            statsResult = await transparencyService.updateDisclaimerStats(
              transparencyResult.disclaimer,
              transparencyResult.disclaimerType,
              config.language || 'es',
              {
                maxRetries: 3,
                retryDelay: 1000,
                fallbackToLocal: true,
                context: {
                  organizationId,
                  workerId: this.workerId || 'unknown',
                  responseId: response.id
                }
              }
            );
          } catch (statsError) {
            // Fallback with enhanced retry logic
            this.log('warn', 'Primary disclaimer stats update failed, attempting fallback', {
              error: statsError.message,
              stack: statsError.stack
            });

            try {
              // Wait 3 seconds and retry with simpler options
              await new Promise(resolve => setTimeout(resolve, 3000));
              statsResult = await transparencyService.updateDisclaimerStats(
                transparencyResult.disclaimer,
                transparencyResult.disclaimerType,
                config.language || 'es',
                {
                  maxRetries: 2,
                  retryDelay: 3000,
                  fallbackToLocal: true
                }
              );
            } catch (fallbackError) {
              this.log('error', 'Disclaimer stats fallback also failed', {
                error: fallbackError.message,
                stack: fallbackError.stack
              });
              // Continue without stats tracking rather than failing the entire operation
              statsResult = { success: false, reason: 'fallback_failed' };
            }
          }

          // Log the result for monitoring
          if (statsResult?.success) {
            this.log('info', 'Disclaimer stats tracking successful', {
              disclaimerType: transparencyResult.disclaimerType,
              attempt: statsResult.attempt,
              processingTime: statsResult.processingTimeMs
            });
          } else {
            this.log('warn', 'Disclaimer stats tracking failed', {
              reason: statsResult?.reason || 'unknown',
              error: statsResult?.error || 'no error details',
              processingTime: statsResult?.processingTimeMs || 0
            });
          }
          
          this.log('info', 'Applied unified transparency disclaimer', {
            organizationId,
            transparencyMode: transparencyResult.transparencyMode,
            disclaimerType: transparencyResult.disclaimerType,
            hasDisclaimer: finalResponseText !== response.text
          });
        } catch (transparencyError) {
          this.log('warn', 'Failed to apply transparency disclaimer, using original text', {
            organizationId,
            error: transparencyError.message
          });
        }
      }

      // FIX: Critical fixes from CodeRabbit review (outside diff)
      // Enhanced Supabase insertion with automatic retry
      let stored, error;
      const insertData = {
        organization_id: organizationId,
        comment_id: commentId,
        response_text: finalResponseText,
        tone: config.tone,
        humor_type: config.humor_type,
        generation_time_ms: generationTime,
        tokens_used: response.tokensUsed || this.estimateTokens(finalResponseText),
        cost_cents: 5, // Base cost per generation
        post_status: 'pending',
        persona_fields_used: personaFieldsUsed
      };

      try {
        const result = await this.supabase
          .from('responses')
          .insert(insertData)
          .select()
          .single();

        stored = result.data;
        error = result.error;
      } catch (insertError) {
        this.log('warn', 'First Supabase insertion attempt failed, retrying', {
          error: insertError.message,
          commentId
        });

        // Second attempt after brief delay
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResult = await this.supabase
            .from('responses')
            .insert(insertData)
            .select()
            .single();

          stored = retryResult.data;
          error = retryResult.error;
        } catch (retryError) {
          this.log('error', 'Supabase insertion retry also failed', {
            error: retryError.message,
            stack: retryError.stack,
            commentId
          });
          throw retryError;
        }
      }

      if (error) throw error;
      
      // Log persona usage for analytics
      if (personaFieldsUsed && personaFieldsUsed.length > 0) {
        this.log('info', 'Persona fields used in response generation', {
          commentId,
          responseId: stored.id,
          personaFields: personaFieldsUsed,
          fieldsCount: personaFieldsUsed.length
        });
      }
      
      return stored;
      
    } catch (error) {
      this.log('error', 'Failed to store response', {
        commentId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Queue posting job
   */
  async queuePostingJob(organizationId, response, platform) {
    const postJob = {
      organization_id: organizationId,
      job_type: 'post_response',
      priority: 4, // Normal priority for posting
      payload: {
        response_id: response.id,
        organization_id: organizationId,
        platform,
        response_text: response.response_text,
        comment_id: response.comment_id
      },
      max_attempts: 3
    };
    
    try {
      if (this.redis) {
        await this.redis.rpush('roastr:jobs:post_response', JSON.stringify(postJob));
      } else {
        const { error } = await this.supabase
          .from('job_queue')
          .insert([postJob]);
        
        if (error) throw error;
      }
      
      this.log('info', 'Queued posting job', {
        responseId: response.id,
        platform
      });
      
    } catch (error) {
      this.log('error', 'Failed to queue posting job', {
        responseId: response.id,
        error: error.message
      });
    }
  }
  
  /**
   * Estimate tokens used for cost calculation
   */
  estimateTokens(text) {
    // More accurate estimation for OpenAI models
    // ~4 characters per token for English, ~6 for other languages
    return Math.ceil(text.length / 4);
  }
}

module.exports = GenerateReplyWorker;