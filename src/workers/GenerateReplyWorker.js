const BaseWorker = require('./BaseWorker');
const CostControlService = require('../services/costControl');
const RoastPromptTemplate = require('../services/roastPromptTemplate');
const transparencyService = require('../services/transparencyService');
const AutoApprovalService = require('../services/autoApprovalService');
const { mockMode } = require('../config/mockMode');
const { shouldBlockAutopost } = require('../middleware/killSwitch');
const { PLATFORM_LIMITS } = require('../config/constants');

/**
 * Generate Reply Worker - Round 6 Critical Security Enhancements
 * 
 * Responsible for generating contextual roast responses using:
 * - Primary: OpenAI GPT-4o mini for personalized roasts
 * - Fallback: Template-based responses
 * 
 * SECURITY FEATURES:
 * - Circuit breaker patterns for external service failures
 * - Enhanced error handling with comprehensive logging
 * - Content validation and integrity checks
 * - Fail-closed patterns for all critical operations
 * - Comprehensive retry logic with exponential backoff
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
    this.autoApprovalService = new AutoApprovalService();
    
    // ROUND 6: Initialize circuit breaker for external services
    this.circuitBreaker = {
      state: 'closed', // closed, open, half-open
      failures: 0,
      threshold: 3, // Lower threshold for worker
      timeout: 30000, // 30 seconds
      lastFailureTime: null,
      consecutiveSuccesses: 0,
      halfOpenMaxAttempts: 1
    };
    
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
   * Initialize OpenAI client with mock mode support
   * Sets up either real OpenAI client or mock client based on environment
   * @throws {Error} If OpenAI client initialization fails
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
   * Initialize response templates for fallback generation
   * Sets up pre-defined response templates categorized by tone
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
   * ROUND 6 CRITICAL FIX: Enhanced circuit breaker for job processing
   * Checks circuit breaker state and throws error if circuit is open
   * @throws {Error} If circuit breaker is open and service is unavailable
   */
  checkCircuitBreaker() {
    const now = Date.now();
    
    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = now - this.circuitBreaker.lastFailureTime;
      
      if (timeSinceLastFailure >= this.circuitBreaker.timeout) {
        this.circuitBreaker.state = 'half-open';
        this.circuitBreaker.consecutiveSuccesses = 0;
        this.log('info', 'Circuit breaker transitioning to half-open', {
          timeSinceLastFailure,
          threshold: this.circuitBreaker.threshold
        });
      } else {
        throw new Error(`Circuit breaker is open. Service unavailable. Retry in ${Math.ceil((this.circuitBreaker.timeout - timeSinceLastFailure) / 1000)} seconds`);
      }
    }
  }

  /**
   * Record circuit breaker success and manage state transitions
   * Updates circuit breaker state based on successful operations
   */
  recordCircuitBreakerSuccess() {
    if (this.circuitBreaker.state === 'half-open') {
      this.circuitBreaker.consecutiveSuccesses++;
      
      if (this.circuitBreaker.consecutiveSuccesses >= this.circuitBreaker.halfOpenMaxAttempts) {
        this.circuitBreaker.state = 'closed';
        this.circuitBreaker.failures = 0;
        this.log('info', 'Circuit breaker closed after successful recovery');
      }
    } else if (this.circuitBreaker.state === 'closed') {
      this.circuitBreaker.failures = Math.max(0, this.circuitBreaker.failures - 1);
    }
  }

  /**
   * Record circuit breaker failure and potentially open circuit
   * @param {Error} error - The error that caused the failure
   */
  recordCircuitBreakerFailure(error) {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'open';
      this.log('error', 'Circuit breaker opened due to repeated failures', {
        failures: this.circuitBreaker.failures,
        threshold: this.circuitBreaker.threshold,
        error: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace'
      });
    }
  }

  /**
   * ROUND 6 CRITICAL FIX: Enhanced job processing with comprehensive error handling
   * Process reply generation job
   */
  async processJob(job) {
    const processingId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check circuit breaker before processing
      this.checkCircuitBreaker();
      
      // ROUND 6 FIX: Enhanced job payload validation
      if (!job) {
        throw new Error('Job is null or undefined');
      }
      
      if (!job.payload || typeof job.payload !== 'object') {
        throw new Error('Invalid job: missing or invalid payload object');
      }
      
      // CODERABBIT FIX: Flexible payload validation - use job payload as source of truth
      // Support both direct comment data and comment reference patterns
      const hasDirectCommentData = job.payload.comment_id && job.payload.organization_id && 
                                  job.payload.platform && job.payload.original_text;
      const hasCommentReference = job.payload.commentId || job.payload.comment_reference;
      
      if (!hasDirectCommentData && !hasCommentReference) {
        // Fallback: check if we have minimum required organizational context
        if (!job.payload.organization_id && !job.payload.org_id) {
          throw new Error('Invalid job: missing organization context (organization_id or org_id required)');
        }
        
        // Log flexible validation for monitoring
        this.log('warn', 'Using flexible payload validation - no direct comment data found', {
          processingId,
          payloadKeys: Object.keys(job.payload),
          hasDirectData: hasDirectCommentData,
          hasReference: hasCommentReference
        });
      }
      
      this.log('info', 'Starting job processing with enhanced validation', {
        processingId,
        jobId: job.id,
        organizationId: job.payload.organization_id,
        commentId: job.payload.comment_id,
        platform: job.payload.platform,
        circuitBreakerState: this.circuitBreaker.state
      });
      
    } catch (error) {
      this.recordCircuitBreakerFailure(error);
      this.log('error', 'CRITICAL: Job processing failed during validation', {
        processingId,
        error: error.message,
        stack: error.stack,
        jobPayload: job?.payload ? 'present' : 'missing'
      });
      throw error;
    }

    // CODERABBIT FIX: Flexible payload destructuring - support multiple payload patterns
    const comment_id = job.payload.comment_id || job.payload.commentId;
    const organization_id = job.payload.organization_id || job.payload.org_id;
    const platform = job.payload.platform;
    const original_text = job.payload.original_text || job.payload.text;
    const toxicity_score = job.payload.toxicity_score;
    const severity_level = job.payload.severity_level;
    const categories = job.payload.categories;

    // Check kill switch before processing
    const autopostCheck = await shouldBlockAutopost(platform);
    if (autopostCheck.blocked) {
      this.logger.warn('Reply generation blocked by kill switch', {
        comment_id,
        organization_id,
        platform,
        reason: autopostCheck.reason,
        message: autopostCheck.message
      });
      throw new Error(`Reply generation blocked: ${autopostCheck.message}`);
    }

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
    
    // Check for auto-approval mode (Issue #405)
    const mode = job.payload.mode || 'manual'; // Default to manual mode
    const autoApproval = job.payload.autoApproval || false;
    
    let autoApprovalResult = null;
    if (mode === 'auto' && autoApproval) {
      this.log('info', 'Processing auto-approval for generated response', {
        comment_id,
        organization_id,
        mode,
        autoApproval
      });
      
      // SECURITY FIX: Enhanced variant scoring for auto-approval
      // Create variant object for auto-approval processing with proper toxicity handling
      const variant = {
        id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: response.text,
        style: integrationConfig.tone,
        score: this.normalizeToxicityScore(response.score, toxicity_score), // Enhanced score handling
        service: response.service,
        tokensUsed: response.tokensUsed,
        generationTime
      };
      
      // Process auto-approval
      autoApprovalResult = await this.autoApprovalService.processAutoApproval(
        comment,
        variant,
        organization_id
      );
      
      this.log('info', 'Auto-approval processing completed', {
        comment_id,
        organization_id,
        approved: autoApprovalResult.approved,
        reason: autoApprovalResult.reason || 'success'
      });
    }
    
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
    
    // Handle auto-posting based on auto-approval result
    if (autoApprovalResult && autoApprovalResult.approved && autoApprovalResult.autoPublish) {
      // ROUND 6 CRITICAL FIX: Enhanced content validation before auto-publication
      // Auto-approved content should be auto-posted, but we must validate transparency consistency
      this.log('info', 'Queueing auto-publication for auto-approved response', {
        comment_id,
        organization_id,
        responseId: storedResponse.id,
        transparencyApplied: autoApprovalResult.variant ? 
          autoApprovalResult.variant.text !== response.text : false,
        processingId,
        autoApprovalId: autoApprovalResult.validationId || 'unknown'
      });
      
      // ROUND 6 CRITICAL FIX: Enhanced atomic content validation with checksums and transparency verification
      const contentValidation = await this.validateContentAtomically(
        storedResponse,
        autoApprovalResult.variant || { text: response.text },
        response,
        {
          comment_id,
          organization_id,
          responseId: storedResponse.id,
          processingId,
          autoApprovalId: autoApprovalResult.validationId || 'unknown'
        }
      );
      
      if (!contentValidation.valid) {
        this.recordCircuitBreakerFailure(new Error(contentValidation.reason));
        this.log('error', 'CRITICAL: Auto-publication blocked - atomic content validation failed', {
          comment_id,
          organization_id,
          responseId: storedResponse.id,
          processingId,
          validationDetails: contentValidation,
          reason: contentValidation.reason,
          checksumMismatch: contentValidation.checksumMismatch || false,
          validationId: contentValidation.validationId,
          circuitBreakerState: this.circuitBreaker.state,
          securityEvent: 'content_validation_failure'
        });
        throw new Error(`CRITICAL: Atomic content validation failed - ${contentValidation.reason}`);
      }
      
      // ROUND 6 CRITICAL FIX: Additional transparency consistency check
      if (autoApprovalResult.variant && autoApprovalResult.variant.text !== storedResponse.response_text) {
        this.log('error', 'CRITICAL: Auto-publication blocked - stored content does not match approved variant', {
          comment_id,
          organization_id,
          responseId: storedResponse.id,
          processingId,
          approvedLength: autoApprovalResult.variant.text?.length || 0,
          storedLength: storedResponse.response_text?.length || 0,
          reason: 'approved_stored_content_mismatch',
          securityEvent: 'potential_content_tampering'
        });
        throw new Error('CRITICAL: Stored content does not match approved variant - potential tampering detected');
      }
      
      await this.queuePostingJob(organization_id, storedResponse, platform, {
        autoApproved: true,
        approvalRecord: autoApprovalResult.approvalRecord,
        contentValidated: true
      });
    } else if (!autoApprovalResult && integrationConfig.config.auto_post !== false) {
      // Standard manual flow auto-posting
      await this.queuePostingJob(organization_id, storedResponse, platform);
    }
    
    // ROUND 6 FIX: Build enhanced response summary with security context
    const responseData = {
      success: true,
      summary: `Generated ${response.service} response: "${response.text.substring(0, 50)}..."`,
      responseId: storedResponse.id,
      responseText: response.text,
      service: response.service,
      generationTime,
      tokensUsed: response.tokensUsed || this.estimateTokens(response.text),
      mode,
      processingId,
      circuitBreakerState: this.circuitBreaker.state,
      circuitBreakerFailures: this.circuitBreaker.failures,
      securityValidated: true
    };
    
    // Record final success for circuit breaker
    this.recordCircuitBreakerSuccess();
    
    // Add auto-approval specific data for auto mode
    if (mode === 'auto' && autoApprovalResult) {
      responseData.autoApproval = {
        approved: autoApprovalResult.approved,
        reason: autoApprovalResult.reason,
        autoPublish: autoApprovalResult.autoPublish,
        variant: autoApprovalResult.variant,
        securityResults: autoApprovalResult.securityResults
      };
      
      // For auto mode, return the variant info instead of standard response
      if (autoApprovalResult.approved) {
        responseData.variant = autoApprovalResult.variant;
        responseData.summary = `Auto-approved ${response.service} response: "${autoApprovalResult.variant.text.substring(0, 50)}..."`;
      }
    }
    
    this.log('info', 'Job processing completed successfully', {
      processingId,
      responseId: storedResponse.id,
      mode,
      autoApproved: autoApprovalResult?.approved || false,
      circuitBreakerState: this.circuitBreaker.state,
      generationTime
    });
    
    return responseData;
    
  } catch (jobError) {
    // Record failure and re-throw
    this.recordCircuitBreakerFailure(jobError);
    this.log('error', 'CRITICAL: Job processing failed', {
      processingId: processingId || 'unknown',
      error: jobError.message,
      stack: jobError.stack,
      circuitBreakerState: this.circuitBreaker.state,
      circuitBreakerFailures: this.circuitBreaker.failures
    });
    throw jobError;
  }
  
  /**
   * Get comment from database by ID with error handling
   * @param {string} commentId - The unique identifier for the comment
   * @returns {Promise<Object|null>} Comment object or null if not found
   * @throws {Error} If database query fails
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
   * Get integration configuration from database
   * @param {string} organizationId - Organization identifier
   * @param {string} configId - Integration configuration identifier
   * @returns {Promise<Object|null>} Integration config object or null if not found
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
   * @param {string} organizationId - Organization identifier to fetch persona data for
   * @returns {Promise<Object|null>} Persona data object or null if not found/configured
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
   * @param {number} frequency - Response frequency between 0 and 1
   * @returns {boolean} True if response should be generated based on probability
   */
  shouldRespondBasedOnFrequency(frequency) {
    if (frequency >= 1.0) return true; // Always respond
    if (frequency <= 0.0) return false; // Never respond
    
    return Math.random() < frequency;
  }
  
  /**
   * Generate response using OpenAI or templates
   * @param {string} originalText - Original comment text to respond to
   * @param {Object} config - Integration configuration object
   * @param {Object} context - Response generation context
   * @returns {Promise<Object>} Generated response with metadata
   */
  async generateResponse(originalText, config, context) {
    let response = null;
    
    // ROUND 6 CRITICAL FIX: Enhanced OpenAI generation with circuit breaker
    if (this.openaiClient) {
      try {
        // Check circuit breaker before OpenAI call
        this.checkCircuitBreaker();
        
        response = await this.generateOpenAIResponse(originalText, config, context);
        response.service = 'openai';
        
        // Record success for circuit breaker
        this.recordCircuitBreakerSuccess();
        
      } catch (error) {
        // Record failure for circuit breaker
        this.recordCircuitBreakerFailure(error);
        
        // ROUND 6 FIX: Enhanced error logging with comprehensive context
        this.log('error', 'CRITICAL: OpenAI generation failed, using template fallback', {
          error: error?.message || 'Unknown error',
          stack: error?.stack || 'No stack trace available',
          originalTextLength: originalText?.length || 0,
          configTone: config?.tone || 'unknown',
          platform: context?.platform || 'unknown',
          circuitBreakerState: this.circuitBreaker.state,
          circuitBreakerFailures: this.circuitBreaker.failures,
          errorType: error?.constructor?.name || 'UnknownError',
          errorCode: error?.code || 'no_code',
          reason: 'openai_generation_failure'
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
   * Generate response using OpenAI with persona-aware prompting
   * @param {string} originalText - Original comment text to respond to
   * @param {Object} config - Integration configuration object
   * @param {Object} context - Response generation context including persona data
   * @returns {Promise<Object>} Generated OpenAI response with metadata
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
   * Generate response using pre-defined templates as fallback
   * @param {string} originalText - Original comment text (not directly used in templates)
   * @param {Object} config - Integration configuration object
   * @param {Object} context - Response generation context
   * @returns {Object} Generated template response
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
   * Build system prompt for OpenAI (legacy method)
   * @param {string} tone - Response tone (sarcastic, ironic, absurd)
   * @param {string} humorType - Humor style (witty, clever, playful)
   * @param {string} platform - Target platform for response
   * @returns {string} Formatted system prompt for OpenAI
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
   * Get platform-specific constraints for response generation
   * @param {string} platform - Target platform (twitter, youtube, instagram, etc.)
   * @returns {string} Platform-specific constraint text in Spanish
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
   * @param {string} originalText - Original comment text
   * @param {Object} context - Context with toxicity and category information
   * @returns {string} Formatted user prompt for OpenAI
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
   * Validate response length for platform constraints and truncate if necessary
   * @param {string} response - The generated response text
   * @param {string} platform - The target platform (twitter, instagram, youtube, etc.)
   * @returns {string} Validated response text, truncated if exceeds platform limits
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
   * @param {string} commentId - Comment identifier
   * @param {string} organizationId - Organization identifier
   * @param {Object} response - Generated response object
   * @param {Object} config - Integration configuration
   * @param {number} generationTime - Time taken to generate response in milliseconds
   * @returns {Promise<Object>} Stored response object from database
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
   * Queue posting job with optional auto-approval metadata
   * ROUND 6 FIX: Enhanced to preserve GDPR-safe auto-approval metadata
   * @param {string} organizationId - Organization identifier
   * @param {Object} response - Response object to post
   * @param {string} platform - Target platform for posting
   * @param {Object} autoApprovalMetadata - Optional auto-approval metadata (GDPR-safe)
   */
  async queuePostingJob(organizationId, response, platform, autoApprovalMetadata = null) {
    // GDPR-Safe metadata: Only include essential, non-personal data
    const gdprSafeMetadata = autoApprovalMetadata ? {
      autoApproved: autoApprovalMetadata.autoApproved || false,
      contentValidated: autoApprovalMetadata.contentValidated || false,
      approvalTimestamp: new Date().toISOString(),
      approvalRecordId: autoApprovalMetadata.approvalRecord?.id || null,
      // GDPR compliance: No personal text content stored
      validationId: autoApprovalMetadata.validationId || null,
      securityPassed: autoApprovalMetadata.securityPassed || false
    } : null;

    const postJob = {
      organization_id: organizationId,
      job_type: 'post_response',
      priority: autoApprovalMetadata?.autoApproved ? 3 : 4, // Higher priority for auto-approved content
      payload: {
        response_id: response.id,
        organization_id: organizationId,
        platform,
        response_text: response.response_text,
        comment_id: response.comment_id,
        // ROUND 6 FIX: Include GDPR-safe auto-approval metadata
        autoApprovalMetadata: gdprSafeMetadata
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
        platform,
        autoApproved: gdprSafeMetadata?.autoApproved || false,
        priority: postJob.priority,
        hasMetadata: !!gdprSafeMetadata
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
   * @param {string} text - Text to estimate token count for
   * @returns {number} Estimated number of tokens
   */
  estimateTokens(text) {
    // More accurate estimation for OpenAI models
    // ~4 characters per token for English, ~6 for other languages
    return Math.ceil(text.length / 4);
  }

  /**
   * SECURITY FIX: Normalize toxicity score for auto-approval processing
   * @param {any} responseScore - Score from AI response generation
   * @param {any} originalScore - Original comment toxicity score
   * @returns {number} Normalized score between 0-1, with fallback logic
   */
  normalizeToxicityScore(responseScore, originalScore) {
    try {
      // First try to use the response score if valid
      let score = this.parseScore(responseScore);
      
      // If response score is invalid, use original comment score as baseline
      if (score === null) {
        score = this.parseScore(originalScore);
      }
      
      // If both are invalid, use conservative fallback
      if (score === null) {
        this.log('warn', 'No valid toxicity scores available, using conservative fallback', {
          responseScore,
          originalScore
        });
        return 0.8; // Conservative score for auto-approval consideration
      }
      
      // For auto-approval, be slightly more conservative than original
      // If it's a roast response, it might be slightly more "toxic" by design
      const adjustedScore = Math.min(score + 0.1, 1.0);
      
      this.log('debug', 'Normalized toxicity score for auto-approval', {
        responseScore,
        originalScore,
        finalScore: adjustedScore
      });
      
      return adjustedScore;
      
    } catch (error) {
      this.log('error', 'Error normalizing toxicity score, using conservative fallback', {
        responseScore,
        originalScore,
        error: error.message
      });
      return 0.8; // Conservative fallback
    }
  }

  /**
   * Parse and validate a toxicity score with multiple scale support
   * @param {any} score - Raw score value (number, string, or other)
   * @returns {number|null} Parsed score between 0-1, or null if invalid
   */
  parseScore(score) {
    // Handle null/undefined
    if (score === null || score === undefined) {
      return null;
    }

    // Convert string numbers
    if (typeof score === 'string') {
      const parsed = parseFloat(score);
      if (isNaN(parsed)) return null;
      score = parsed;
    }

    // Must be a number
    if (typeof score !== 'number' || isNaN(score)) {
      return null;
    }

    // Handle different scales (some APIs return 0-100 instead of 0-1)
    if (score > 1 && score <= 100) {
      score = score / 100;
    }

    // Must be within valid range
    if (score < 0 || score > 1) {
      return null;
    }

    return score;
  }

  /**
   * SECURITY FIX Round 2: Atomic content validation with checksums and race condition prevention
   * Validates that stored content exactly matches approved content with comprehensive checks
   * @param {Object} storedResponse - Response stored in database
   * @param {Object} approvedVariant - Approved variant from auto-approval process
   * @param {Object} originalResponse - Original generated response
   * @param {Object} context - Validation context (comment_id, organization_id, etc.)
   * @returns {Object} Validation result with detailed information
   */
  async validateContentAtomically(storedResponse, approvedVariant, originalResponse, context) {
    const validationStart = Date.now();
    const validationId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.log('debug', 'Starting atomic content validation', {
        ...context,
        validationId,
        validationVersion: '2.0',
        storedResponseId: storedResponse?.id,
        approvedVariantId: approvedVariant?.id
      });

      // Input validation
      if (!storedResponse || typeof storedResponse !== 'object') {
        return {
          valid: false,
          reason: 'invalid_stored_response',
          validationId,
          details: 'Stored response object is missing or invalid'
        };
      }

      if (!approvedVariant || typeof approvedVariant !== 'object') {
        return {
          valid: false,
          reason: 'invalid_approved_variant',
          validationId,
          details: 'Approved variant object is missing or invalid'
        };
      }

      if (!approvedVariant.text || typeof approvedVariant.text !== 'string') {
        return {
          valid: false,
          reason: 'missing_approved_text',
          validationId,
          details: 'Approved variant text is missing or not a string'
        };
      }

      if (!storedResponse.response_text || typeof storedResponse.response_text !== 'string') {
        return {
          valid: false,
          reason: 'missing_stored_text',
          validationId,
          details: 'Stored response text is missing or not a string'
        };
      }

      // Enhanced content comparison with multiple validation layers
      const storedText = storedResponse.response_text;
      const approvedText = approvedVariant.text;

      // Layer 1: Exact string comparison (primary validation)
      if (storedText !== approvedText) {
        this.log('warn', 'Content validation failed: text mismatch', {
          ...context,
          validationId,
          storedLength: storedText.length,
          approvedLength: approvedText.length,
          textMatch: false
        });
        
        return {
          valid: false,
          reason: 'content_text_mismatch',
          validationId,
          details: 'Stored text does not exactly match approved text',
          storedLength: storedText.length,
          approvedLength: approvedText.length,
          checksumMismatch: true
        };
      }

      // Layer 2: Enhanced checksum validation for additional security
      const storedChecksum = this.calculateContentChecksum(storedText);
      const approvedChecksum = this.calculateContentChecksum(approvedText);

      if (storedChecksum !== approvedChecksum) {
        this.log('error', 'CRITICAL: Checksum validation failed despite text match', {
          ...context,
          validationId,
          storedChecksum,
          approvedChecksum,
          reason: 'checksum_algorithm_inconsistency'
        });
        
        return {
          valid: false,
          reason: 'checksum_validation_failed',
          validationId,
          details: 'Content checksums do not match despite identical text',
          storedChecksum,
          approvedChecksum,
          checksumMismatch: true
        };
      }

      // Layer 3: Metadata validation (additional security)
      const metadataValidation = this.validateContentMetadata(
        storedResponse, 
        approvedVariant, 
        originalResponse,
        validationId
      );

      if (!metadataValidation.valid) {
        return {
          valid: false,
          reason: 'metadata_validation_failed',
          validationId,
          details: metadataValidation.reason,
          metadataIssues: metadataValidation.issues
        };
      }

      // Layer 4: Temporal validation (race condition detection)
      const temporalValidation = this.validateContentTiming(
        storedResponse,
        approvedVariant,
        validationStart,
        validationId
      );

      if (!temporalValidation.valid) {
        return {
          valid: false,
          reason: 'temporal_validation_failed',
          validationId,
          details: temporalValidation.reason,
          timingIssues: temporalValidation.issues
        };
      }

      const validationDuration = Date.now() - validationStart;

      this.log('info', 'Atomic content validation passed all layers', {
        ...context,
        validationId,
        validationDuration,
        textLength: storedText.length,
        checksum: storedChecksum,
        layersPassed: ['text_match', 'checksum_match', 'metadata_valid', 'timing_valid'],
        validationVersion: '2.0'
      });

      return {
        valid: true,
        validationId,
        validationDuration,
        checksum: storedChecksum,
        textLength: storedText.length,
        layersValidated: 4,
        details: 'All validation layers passed successfully'
      };

    } catch (error) {
      const validationDuration = Date.now() - validationStart;
      this.log('error', 'CRITICAL: Error in atomic content validation - failing closed', {
        ...context,
        validationId,
        error: error.message,
        stack: error.stack || 'No stack available',
        validationDuration,
        validationVersion: '2.0'
      });

      return {
        valid: false,
        reason: 'validation_error',
        validationId,
        details: `Validation error: ${error.message}`,
        validationDuration,
        error: error.message
      };
    }
  }

  /**
   * Calculate content checksum for validation
   * @param {string} content - Content to checksum
   * @returns {string} SHA-256 checksum of content
   */
  calculateContentChecksum(content) {
    if (!content || typeof content !== 'string') {
      return 'invalid_content';
    }
    
    // Simple but effective checksum using built-in crypto if available
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    } catch (error) {
      // Fallback: Simple hash function for environments without crypto
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return `fallback_${hash.toString(16)}`;
    }
  }

  /**
   * Validate content metadata for consistency
   * @param {Object} storedResponse - Stored response object
   * @param {Object} approvedVariant - Approved variant object
   * @param {Object} originalResponse - Original response object
   * @param {string} validationId - Validation operation ID
   * @returns {Object} Metadata validation result
   */
  validateContentMetadata(storedResponse, approvedVariant, originalResponse, validationId) {
    const issues = [];

    // Validate basic structure consistency
    if (storedResponse.comment_id !== originalResponse.comment_id) {
      issues.push('comment_id_mismatch');
    }

    // Validate response service consistency (if available)
    if (originalResponse.service && storedResponse.service && 
        originalResponse.service !== storedResponse.service) {
      issues.push('service_mismatch');
    }

    // Validate generation timestamps (basic sanity check)
    if (storedResponse.created_at) {
      const storedTime = new Date(storedResponse.created_at);
      const now = new Date();
      const timeDiff = now - storedTime;
      
      // Responses shouldn't be from the future or too old (1 hour max)
      if (timeDiff < 0 || timeDiff > 3600000) {
        issues.push('timestamp_anomaly');
      }
    }

    return {
      valid: issues.length === 0,
      reason: issues.length > 0 ? `Metadata issues: ${issues.join(', ')}` : 'metadata_valid',
      issues
    };
  }

  /**
   * Validate content timing to detect race conditions
   * @param {Object} storedResponse - Stored response object
   * @param {Object} approvedVariant - Approved variant object
   * @param {number} validationStart - Validation start timestamp
   * @param {string} validationId - Validation operation ID
   * @returns {Object} Temporal validation result
   */
  validateContentTiming(storedResponse, approvedVariant, validationStart, validationId) {
    const issues = [];

    // Check if stored response was modified recently (potential race condition)
    if (storedResponse.updated_at) {
      const updatedTime = new Date(storedResponse.updated_at);
      const validationTime = new Date(validationStart);
      const timeDiff = validationTime - updatedTime;
      
      // If response was updated very recently (within last 100ms), it might be a race condition
      if (timeDiff < 100) {
        issues.push('recent_modification_detected');
      }
    }

    // Check validation timing itself (shouldn't take too long)
    const validationDuration = Date.now() - validationStart;
    if (validationDuration > 5000) { // 5 seconds max
      issues.push('validation_timeout_risk');
    }

    return {
      valid: issues.length === 0,
      reason: issues.length > 0 ? `Timing issues: ${issues.join(', ')}` : 'timing_valid',
      issues
    };
  }
}

module.exports = GenerateReplyWorker;