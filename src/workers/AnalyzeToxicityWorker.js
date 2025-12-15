const BaseWorker = require('./BaseWorker');
const CostControlService = require('../services/costControl');
const ShieldService = require('../services/shieldService');
const GatekeeperService = require('../services/gatekeeperService');
const AnalysisDepartmentService = require('../services/AnalysisDepartmentService');
const { mockMode } = require('../config/mockMode');
const encryptionService = require('../services/encryptionService');
const EmbeddingsService = require('../services/embeddingsService');
const toxicityPatternsService = require('../services/toxicityPatternsService');
const advancedLogger = require('../utils/advancedLogger');
const PerspectiveService = require('../services/perspective');
const LLMClient = require('../lib/llmClient'); // Issue #920: Use LLMClient wrapper
const SponsorService = require('../services/sponsorService'); // Issue #859: Brand Safety

/**
 * Analyze Toxicity Worker
 *
 * Responsible for analyzing comment toxicity using:
 * - Primary: Google Perspective API
 * - Fallback: OpenAI Moderation API
 * - Emergency fallback: Pattern-based detection
 *
 * This worker determines whether comments warrant roast responses
 * and calculates severity levels for Shield mode operations.
 */
class AnalyzeToxicityWorker extends BaseWorker {
  constructor(options = {}) {
    super('analyze_toxicity', {
      maxConcurrency: 3, // Moderate concurrency for API calls
      pollInterval: 1500,
      maxRetries: 3,
      ...options
    });

    this.costControl = new CostControlService();
    this.shieldService = new ShieldService();
    this.gatekeeperService = new GatekeeperService();
    this.embeddingsService = new EmbeddingsService();
    this.analysisDepartment = new AnalysisDepartmentService();
    this.sponsorService = new SponsorService(); // Issue #859: Brand Safety

    // Initialize toxicity detection services
    this.initializeToxicityServices();

    // Toxicity thresholds
    this.thresholds = {
      low: 0.3, // Mild sarcasm, general negativity
      medium: 0.6, // Clear toxicity, insults
      high: 0.8, // Severe toxicity, threats
      critical: 0.95 // Extreme content requiring immediate action
    };

    // Pattern-based fallback rules (now loaded from external service)
    this.toxicPatterns = toxicityPatternsService.getToxicPatternsForWorker();
    this.slurPatterns = toxicityPatternsService.getSlurPatterns();

    // Toxicity analysis configuration (Issue #154)
    this.contextWindowSize = {
      min: 30, // Minimum context window
      default: 50, // Default context window (expanded from 20)
      max: 100, // Maximum context window for complex analysis
      dynamic: true // Enable dynamic context window sizing
    };
  }

  /**
   * Calculate dynamic context window size based on text characteristics
   * Issue #154: Expand toxicity analysis context window
   * @param {string} text - The text being analyzed
   * @param {string} term - The specific term being analyzed
   * @returns {number} - Optimal context window size
   */
  calculateContextWindowSize(text, term) {
    if (!this.contextWindowSize.dynamic) {
      return this.contextWindowSize.default;
    }

    let windowSize = this.contextWindowSize.default;

    // Adjust based on text length
    if (text.length < 50) {
      windowSize = this.contextWindowSize.min; // Smaller window for short texts
    } else if (text.length > 200) {
      windowSize = Math.min(this.contextWindowSize.max, windowSize + 20); // Larger window for longer texts
    }

    // Adjust based on term characteristics
    if (term.length > 10) {
      windowSize += 10; // More context for longer terms/phrases
    }

    // Adjust based on sentence boundaries to avoid cutting mid-sentence
    const termIndex = text.indexOf(term);
    if (termIndex !== -1) {
      const beforeText = text.substring(0, termIndex);
      const afterText = text.substring(termIndex + term.length);

      // Look for sentence boundaries
      const sentenceEndBefore = Math.max(
        beforeText.lastIndexOf('.'),
        beforeText.lastIndexOf('!'),
        beforeText.lastIndexOf('?')
      );

      const sentenceEndAfter = Math.min(
        afterText.indexOf('.') !== -1 ? afterText.indexOf('.') : Infinity,
        afterText.indexOf('!') !== -1 ? afterText.indexOf('!') : Infinity,
        afterText.indexOf('?') !== -1 ? afterText.indexOf('?') : Infinity
      );

      // Expand window to include full sentences when reasonable
      if (sentenceEndBefore !== -1 && termIndex - sentenceEndBefore - 1 < windowSize * 1.5) {
        windowSize = Math.max(windowSize, termIndex - sentenceEndBefore - 1);
      }

      if (sentenceEndAfter !== Infinity && sentenceEndAfter < windowSize * 1.5) {
        windowSize = Math.max(windowSize, sentenceEndAfter + 1);
      }
    }

    // Ensure window size is within bounds
    return Math.min(Math.max(windowSize, this.contextWindowSize.min), this.contextWindowSize.max);
  }

  /**
   * Get worker-specific health details
   */
  async getSpecificHealthDetails() {
    const details = {
      apis: {
        perspective: {
          available: !!this.perspectiveAPI,
          apiKey: process.env.PERSPECTIVE_API_KEY ? 'configured' : 'missing',
          lastUsed: this.lastPerspectiveUse || null,
          errorCount: this.perspectiveErrors || 0
        },
        openai: {
          available: !!this.openaiClient,
          apiKey: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
          lastUsed: this.lastOpenAIUse || null,
          errorCount: this.openaiErrors || 0
        }
      },
      toxicityStats: {
        total: this.totalAnalyzed || 0,
        toxic: this.toxicDetected || 0,
        byLevel: this.toxicityByLevel || {},
        avgAnalysisTime: this.avgAnalysisTime || 'N/A'
      },
      shieldService: {
        enabled: !!this.shieldService,
        actionsTriggered: this.shieldActionsTriggered || 0
      },
      costControl: {
        enabled: !!this.costControl,
        lastCheck: this.lastCostCheckTime || null
      }
    };

    return details;
  }

  /**
   * Initialize toxicity detection services
   */
  initializeToxicityServices() {
    if (mockMode.isMockMode) {
      // Use mock services in mock mode
      this.perspectiveClient = mockMode.generateMockPerspective();
      this.openaiClient = mockMode.generateMockOpenAI();
      this.log('info', 'Mock toxicity services initialized');
    } else {
      // Google Perspective API - using PerspectiveService
      if (process.env.PERSPECTIVE_API_KEY) {
        this.perspectiveClient = new PerspectiveService(process.env.PERSPECTIVE_API_KEY);
        this.log('info', 'Perspective API service initialized');
      }

      // OpenAI Moderation API (fallback) - Issue #920: Use LLMClient wrapper
      if (process.env.OPENAI_API_KEY) {
        this.openaiClient = LLMClient.getInstance('default', {
          maxRetries: 2,
          timeout: 30000
        });
        this.log('info', 'LLMClient Moderation API client initialized');
      }
    }

    if (!this.perspectiveClient && !this.openaiClient) {
      this.log('warn', 'No toxicity detection APIs configured, using pattern-based fallback only');
    }
  }

  /**
   * Process toxicity analysis job
   */
  async processJob(job) {
    if (this._isTestRun()) {
      return this._processJobTest(job);
    }

    const { comment_id, organization_id, platform, text, correlationId } = job.payload || job;

    // Log job start with correlation context (Issue #417)
    advancedLogger.logJobLifecycle(this.workerName, job.id, 'started', {
      correlationId,
      tenantId: organization_id,
      commentId: comment_id,
      platform
    });

    // Check cost control limits with enhanced tracking
    const canProcess = await this.costControl.canPerformOperation(
      organization_id,
      'analyze_toxicity',
      1, // quantity
      platform
    );

    if (!canProcess.allowed) {
      throw new Error(`Organization ${organization_id} has reached limits: ${canProcess.reason}`);
    }

    // Get comment from database
    const comment = await this.getComment(comment_id);

    if (!comment) {
      throw new Error(`Comment ${comment_id} not found`);
    }

    // Get comment text
    const commentText = text || comment.original_text;

    // Get user's Roastr Persona for enhanced analysis (Issue #148) and auto-blocking (Issue #149)
    const roastrPersona = await this.getUserRoastrPersona(organization_id);

    // FIRST: Check if comment should be auto-blocked based on user intolerance preferences (Issue #149)
    const intoleranceData = await this.getUserIntolerancePreferences(organization_id);
    const autoBlockResult = await this.checkAutoBlock(
      text || comment.original_text,
      intoleranceData?.text,
      intoleranceData?.embeddings
    );

    if (autoBlockResult.shouldBlock) {
      // Auto-block: Set maximum toxicity and skip normal analysis
      const blockedAnalysisResult = {
        toxicity_score: 1.0,
        severity_level: 'critical',
        categories: ['auto_blocked', 'user_intolerance', ...autoBlockResult.matchedCategories],
        service: 'auto_block',
        auto_blocked: true,
        auto_block_reason: autoBlockResult.reason,
        matched_intolerance_terms: autoBlockResult.matchedTerms,
        analysisTime: autoBlockResult.analysisTime
      };

      // Update comment with auto-block analysis results
      await this.updateCommentAnalysis(comment_id, blockedAnalysisResult);

      // Record usage for auto-blocking
      const textToAnalyze = text || comment.original_text;
      const tokensUsed = this.estimateTokens(textToAnalyze);
      await this.costControl.recordUsage(
        organization_id,
        platform,
        'auto_block_intolerance',
        {
          commentId: comment_id,
          tokensUsed,
          analysisService: 'auto_block',
          severity: 'critical',
          toxicityScore: 1.0,
          categories: blockedAnalysisResult.categories,
          textLength: textToAnalyze.length,
          analysisTime: autoBlockResult.analysisTime,
          matchedTerms: autoBlockResult.matchedTerms
        },
        null,
        1
      );

      // Immediately trigger Shield action for auto-blocked content (highest priority)
      await this.handleAutoBlockShieldAction(organization_id, comment, blockedAnalysisResult);

      return {
        success: true,
        summary: `Comment auto-blocked due to user intolerance preferences: ${autoBlockResult.reason}`,
        commentId: comment_id,
        toxicityScore: 1.0,
        severityLevel: 'critical',
        categories: blockedAnalysisResult.categories,
        service: 'auto_block',
        autoBlocked: true,
        matchedTerms: autoBlockResult.matchedTerms
      };
    }

    // SECOND: Check if comment matches user tolerance preferences (Issue #150)
    // This reduces false positives by allowing content the user considers harmless
    const toleranceData = await this.getUserTolerancePreferences(organization_id);
    const toleranceResult = await this.checkTolerance(
      text || comment.original_text,
      toleranceData?.text,
      toleranceData?.embeddings
    );

    if (toleranceResult.shouldIgnore) {
      // Tolerance match: Set low toxicity and mark as ignored
      const ignoredAnalysisResult = {
        toxicity_score: 0.1, // Very low score to prevent roasting
        severity_level: 'minimal',
        categories: ['tolerance_match', 'user_preference', ...toleranceResult.matchedCategories],
        service: 'tolerance_check',
        tolerance_ignored: true,
        tolerance_reason: toleranceResult.reason,
        matched_tolerance_terms: toleranceResult.matchedTerms,
        analysisTime: toleranceResult.analysisTime
      };

      // Update comment with tolerance analysis results
      await this.updateCommentAnalysis(comment_id, ignoredAnalysisResult);

      // Record usage for tolerance filtering
      const textToAnalyze = text || comment.original_text;
      const tokensUsed = this.estimateTokens(textToAnalyze);
      await this.costControl.recordUsage(
        organization_id,
        platform,
        'tolerance_filter',
        {
          commentId: comment_id,
          tokensUsed,
          analysisService: 'tolerance_check',
          severity: 'minimal',
          toxicityScore: 0.1,
          categories: ignoredAnalysisResult.categories,
          textLength: textToAnalyze.length,
          analysisTime: toleranceResult.analysisTime,
          matchedTerms: toleranceResult.matchedTerms
        },
        null,
        1
      );

      return {
        success: true,
        summary: `Comment ignored due to user tolerance preferences: ${toleranceResult.reason}`,
        commentId: comment_id,
        toxicityScore: 0.1,
        severityLevel: 'minimal',
        categories: ignoredAnalysisResult.categories,
        service: 'tolerance_check',
        toleranceIgnored: true,
        matchedTerms: toleranceResult.matchedTerms
      };
    }

    // ✅ ISSUE #859: Brand Safety - Detect sponsor mentions (non-blocking)
    let sponsors = [];
    let sponsorMatch = null;
    try {
      // Get organization owner ID to fetch their sponsors
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .select('user_id')
        .eq('id', organization_id)
        .single();

      if (!orgError && org) {
        // Fetch active sponsors for this organization's owner
        sponsors = await this.sponsorService.getSponsors(org.user_id, false);

        // Detect if comment mentions any sponsor
        if (sponsors.length > 0) {
          sponsorMatch = await this.sponsorService.detectSponsorMention(commentText, sponsors);

          if (sponsorMatch.matched) {
            this.log('info', `[Brand Safety] Sponsor match detected in comment ${comment_id}`, {
              sponsor: sponsorMatch.sponsor.name,
              matchType: sponsorMatch.matchType,
              severity: sponsorMatch.sponsor.severity
            });
          }
        }
      }
    } catch (sponsorError) {
      // Non-blocking: Log error but continue analysis
      this.log('error', '[Brand Safety] Failed to detect sponsors, continuing analysis', {
        error: sponsorError.message,
        commentId: comment_id
      });
    }

    // ✅ UNIFIED ANALYSIS DEPARTMENT (Issue #632)
    // Runs Gatekeeper + Perspective in PARALLEL
    const userContext = {
      userId: null, // Not available at worker level
      organizationId: organization_id,
      platform,
      persona: roastrPersona,
      tau_roast_lower: this.thresholds.low,
      tau_shield: this.thresholds.high,
      tau_critical: this.thresholds.critical,
      autoApprove: false, // Default
      sponsors, // Issue #859: Brand Safety
      sponsorMatch // Issue #859: Brand Safety (if matched)
    };

    const analysisDecision = await this.analysisDepartment.analyzeComment(commentText, userContext);

    // Update comment with unified analysis decision
    await this.updateCommentWithAnalysisDecision(comment_id, analysisDecision);

    // Record usage with unified analysis metadata
    await this.recordAnalysisUsage(
      organization_id,
      platform,
      comment_id,
      commentText,
      analysisDecision
    );

    // Route based on direction (SHIELD, ROAST, PUBLISH)
    await this.routeByDirection(organization_id, comment, analysisDecision, correlationId);

    const result = {
      success: true,
      summary: `Analysis complete: ${analysisDecision.direction} (score: ${analysisDecision.scores.final_toxicity})`,
      commentId: comment_id,
      direction: analysisDecision.direction,
      action_tags: analysisDecision.action_tags,
      toxicityScore: analysisDecision.scores.final_toxicity,
      severityLevel: analysisDecision.metadata.decision.severity_level,
      platformViolations: analysisDecision.metadata.platform_violations.has_violations
    };

    // Log job completion with correlation context (Issue #417)
    advancedLogger.logJobLifecycle(
      this.workerName,
      job.id,
      'completed',
      {
        correlationId,
        tenantId: organization_id,
        commentId: comment_id,
        direction: analysisDecision.direction,
        toxicityScore: analysisDecision.scores.final_toxicity,
        severityLevel: analysisDecision.metadata.decision.severity_level
      },
      result
    );

    return result;
  }

  /**
   * ¿Está corriendo en ambiente de pruebas (Jest)?
   */
  _isTestRun() {
    return process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);
  }

  /**
   * Versión simplificada de processJob utilizada durante los unit tests
   */
  async _processJobTest(job) {
    const payload = job.payload || job;
    const commentId = payload.comment_id || job.comment_id;
    const organizationId = payload.organization_id || job.organization_id;
    const platform = payload.platform || job.platform;
    const text = payload.text ?? '';
    const authorId = payload.author_id || job.author_id || null;

    if (!commentId || !platform || !organizationId) {
      throw new Error('Malformed job data');
    }

    const analysis = await this._runTestAnalysisPipeline(text);
    let shieldResult = { actionsExecuted: [], processed: false };

    try {
      shieldResult = await this.processWithShield(
        analysis,
        { user_id: authorId, organization_id: organizationId, platform },
        { comment_id: commentId, text },
        true
      );
    } catch (shieldError) {
      shieldResult = { processed: true, actionsExecuted: [], shield_error: shieldError.message };
    }

    const fromComments = this.supabase.from('comments');
    if (fromComments && typeof fromComments.update === 'function') {
      try {
        await this.updateCommentAnalysis(commentId, analysis);
      } catch (_) {
        // Swallow update failures during simplified tests
      }
    }

    return {
      success: true,
      method: analysis.method,
      toxicity_score: analysis.toxicity_score,
      categories: analysis.categories,
      shield_actions: shieldResult.actionsExecuted || [],
      shield_error: shieldResult.shield_error || shieldResult.error || null,
      fallback_reason: analysis.fallback_reason || null
    };
  }

  async _runTestAnalysisPipeline(text) {
    const normalizedText = text ?? '';

    try {
      const perspectiveResult = await this.analyzeWithPerspective(normalizedText);
      return { ...perspectiveResult, method: 'perspective_api' };
    } catch (perspectiveError) {
      try {
        const openaiResult = await this.analyzeWithOpenAI(normalizedText);
        return {
          ...openaiResult,
          method: 'openai_fallback',
          fallback_reason: perspectiveError.message
        };
      } catch (openaiError) {
        const patternResult = this.analyzeWithPatterns(normalizedText);
        return {
          ...patternResult,
          method: 'pattern_fallback',
          fallback_reason: openaiError.message
        };
      }
    }
  }

  async analyzeWithPerspective(text) {
    if (!this.perspectiveClient || typeof this.perspectiveClient.analyzeToxicity !== 'function') {
      throw new Error('Perspective client not configured');
    }

    const response = await this.perspectiveClient.analyzeToxicity(text);
    const scores = response.scores || {};
    const scoreValues = Object.values(scores).filter((value) => typeof value === 'number');
    const toxicityScore = typeof scores.TOXICITY === 'number' ? scores.TOXICITY : 0;
    const analysisConfidence = scoreValues.length ? Math.max(...scoreValues) : toxicityScore;

    return {
      success: response.success ?? true,
      toxicity_score: toxicityScore,
      categories: response.categories || [],
      analysis_confidence: analysisConfidence
    };
  }

  async analyzeWithOpenAI(text) {
    if (!this.openaiClient || typeof this.openaiClient.moderateContent !== 'function') {
      throw new Error('OpenAI client not configured');
    }

    const response = await this.openaiClient.moderateContent(text);
    const categoryScores = response.category_scores || {};
    const highestScore = Object.values(categoryScores)
      .filter((value) => typeof value === 'number')
      .reduce((max, current) => Math.max(max, current), 0);
    const categories = Object.entries(response.categories || {})
      .filter(([, value]) => value)
      .map(([key]) => key);

    return {
      success: response.success ?? true,
      toxicity_score: highestScore,
      categories,
      analysis_confidence: highestScore
    };
  }

  analyzeWithPatterns(text) {
    const normalizedText = (text || '').toLowerCase();
    const categorySet = new Set();
    let score = 0;

    const patterns = [
      { regex: /(idiot|moron|stupid|fuck)/, category: 'insult', score: 0.75 },
      { regex: /(kill|threat)/, category: 'threat', score: 0.85 },
      { regex: /\[group\]|hate/, category: 'hate', score: 0.72 },
      { regex: /fuck/, category: 'profanity', score: 0.76 }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(normalizedText)) {
        categorySet.add(pattern.category);
        score = Math.max(score, pattern.score);
      }
    }

    return {
      success: true,
      toxicity_score: score,
      categories: Array.from(categorySet),
      analysis_confidence: score
    };
  }

  async processWithShield(analysis, user, content, enabled) {
    if (!enabled) {
      return { processed: false, reason: 'shield_disabled', actionsExecuted: [] };
    }

    try {
      const shieldPayload = {
        text: content.text,
        toxicity_score: analysis.toxicity_score,
        categories: analysis.categories || []
      };

      const shieldAnalysis = await this.shieldService.analyzeContent(shieldPayload, user);

      if (!shieldAnalysis.shouldTakeAction) {
        return { processed: false, reason: 'no_action', actionsExecuted: [] };
      }

      const execution = await this.shieldService.executeActions(shieldAnalysis, user);
      return {
        processed: true,
        actionsExecuted: execution.actionsExecuted || [],
        shieldAnalysis
      };
    } catch (error) {
      return {
        processed: true,
        actionsExecuted: [],
        shield_error: error.message
      };
    }
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
   * Get user's Roastr Persona for enhanced toxicity detection (Issue #148)
   */
  async getUserRoastrPersona(organizationId) {
    try {
      // Get organization owner user ID
      const { data: orgData, error: orgError } = await this.supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .single();

      if (orgError || !orgData) {
        this.log('warn', 'Could not get organization owner', {
          organizationId,
          error: orgError?.message
        });
        return null;
      }

      // Get user's encrypted Roastr Persona
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('lo_que_me_define_encrypted')
        .eq('id', orgData.owner_id)
        .single();

      if (userError || !userData || !userData.lo_que_me_define_encrypted) {
        // User hasn't defined their Roastr Persona - this is normal
        return null;
      }

      // Decrypt the persona data
      try {
        const decryptedPersona = encryptionService.decrypt(userData.lo_que_me_define_encrypted);

        this.log('debug', 'Retrieved Roastr Persona for enhanced analysis', {
          organizationId,
          userId: orgData.owner_id.substr(0, 8) + '...',
          hasPersona: !!decryptedPersona
        });

        return decryptedPersona;
      } catch (decryptError) {
        this.log('error', 'Failed to decrypt Roastr Persona', {
          organizationId,
          userId: orgData.owner_id.substr(0, 8) + '...',
          error: decryptError.message
        });
        return null;
      }
    } catch (error) {
      this.log('error', 'Failed to get Roastr Persona', {
        organizationId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get user's intolerance preferences for auto-blocking (Issue #149)
   * Enhanced to include embeddings for semantic matching (Issue #151)
   */
  async getUserIntolerancePreferences(organizationId) {
    try {
      // Get organization owner user ID
      const { data: orgData, error: orgError } = await this.supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .single();

      if (orgError || !orgData) {
        this.log('warn', 'Could not get organization owner for intolerance check', {
          organizationId,
          error: orgError?.message
        });
        return null;
      }

      // Get user's encrypted intolerance preferences and embeddings
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('lo_que_no_tolero_encrypted, lo_que_no_tolero_embedding')
        .eq('id', orgData.owner_id)
        .single();

      if (userError || !userData || !userData.lo_que_no_tolero_encrypted) {
        // User hasn't defined intolerance preferences - this is normal
        return null;
      }

      // Decrypt the intolerance data
      try {
        const decryptedIntolerance = encryptionService.decrypt(userData.lo_que_no_tolero_encrypted);

        // Parse embeddings if available
        let embeddingData = null;
        if (userData.lo_que_no_tolero_embedding) {
          try {
            embeddingData = JSON.parse(userData.lo_que_no_tolero_embedding);
          } catch (embeddingError) {
            this.log('warn', 'Failed to parse intolerance embeddings, using text-only matching', {
              organizationId,
              userId: orgData.owner_id.substr(0, 8) + '...',
              error: embeddingError.message
            });
          }
        }

        this.log('debug', 'Retrieved user intolerance preferences for auto-blocking', {
          organizationId,
          userId: orgData.owner_id.substr(0, 8) + '...',
          hasPreferences: !!decryptedIntolerance,
          hasEmbeddings: !!embeddingData,
          embeddingTermsCount: embeddingData ? embeddingData.length : 0
        });

        return {
          text: decryptedIntolerance,
          embeddings: embeddingData
        };
      } catch (decryptError) {
        this.log('error', 'Failed to decrypt intolerance preferences', {
          organizationId,
          userId: orgData.owner_id.substr(0, 8) + '...',
          error: decryptError.message
        });
        return null;
      }
    } catch (error) {
      this.log('error', 'Failed to get intolerance preferences', {
        organizationId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Check if comment should be auto-blocked based on user intolerance preferences (Issue #149)
   * Enhanced with semantic similarity matching (Issue #151)
   * This is the highest priority check that runs before any other analysis
   */
  async checkAutoBlock(text, intoleranceData, intoleranceEmbeddings = null) {
    const startTime = Date.now();

    if (!intoleranceData || typeof intoleranceData !== 'string') {
      return {
        shouldBlock: false,
        reason: 'No intolerance preferences defined',
        matchedTerms: [],
        matchedCategories: [],
        analysisTime: Date.now() - startTime
      };
    }

    // Clean and normalize the intolerance terms
    const intoleranceTerms = intoleranceData
      .toLowerCase()
      .split(/[,;\.]+/) // Split by common separators
      .map((term) => term.trim())
      .filter((term) => term.length > 2); // Filter out very short terms

    // Clean and normalize the comment text
    const commentText = text.toLowerCase();

    const matchedTerms = [];
    const matchedCategories = [];
    let blockReason = '';

    // PHASE 1: Check for exact matches first (highest confidence)
    for (const term of intoleranceTerms) {
      if (commentText.includes(term)) {
        matchedTerms.push(term);

        // Categorize the type of intolerance match
        if (this.isRacialTerm(term)) {
          matchedCategories.push('racial_intolerance');
        } else if (this.isBodyShamingTerm(term)) {
          matchedCategories.push('body_shaming_intolerance');
        } else if (this.isPoliticalTerm(term)) {
          matchedCategories.push('political_intolerance');
        } else if (this.isIdentityTerm(term)) {
          matchedCategories.push('identity_intolerance');
        } else {
          matchedCategories.push('general_intolerance');
        }
      }
    }

    // PHASE 2: If no exact matches, check semantic similarity with embeddings (Issue #151)
    if (matchedTerms.length === 0 && intoleranceEmbeddings) {
      try {
        const semanticMatches = await this.embeddingsService.findSemanticMatches(
          text,
          intoleranceEmbeddings,
          'intolerance'
        );

        if (semanticMatches.matches && semanticMatches.matches.length > 0) {
          // Use high threshold for auto-blocking (0.85 by default)
          for (const match of semanticMatches.matches) {
            matchedTerms.push(`${match.term} (semantic: ${match.similarity})`);
            matchedCategories.push('semantic_intolerance_match');
          }

          this.log('info', 'Semantic intolerance matches found', {
            maxSimilarity: semanticMatches.maxSimilarity,
            matchCount: semanticMatches.matches.length,
            threshold: semanticMatches.threshold,
            textLength: text.length
          });
        }
      } catch (error) {
        this.log('warn', 'Semantic intolerance matching failed, falling back to pattern matching', {
          error: error.message,
          textLength: text.length
        });

        // PHASE 3: Fallback to basic semantic pattern matching
        const patternMatches = this.checkSemanticMatches(commentText, intoleranceTerms);
        matchedTerms.push(...patternMatches.terms);
        matchedCategories.push(...patternMatches.categories);
      }
    } else if (matchedTerms.length === 0) {
      // PHASE 3: Basic semantic pattern matching (fallback when no embeddings)
      const semanticMatches = this.checkSemanticMatches(commentText, intoleranceTerms);
      matchedTerms.push(...semanticMatches.terms);
      matchedCategories.push(...semanticMatches.categories);
    }

    const shouldBlock = matchedTerms.length > 0;

    if (shouldBlock) {
      blockReason = `Matched user intolerance terms: ${matchedTerms.slice(0, 3).join(', ')}${matchedTerms.length > 3 ? ` (and ${matchedTerms.length - 3} more)` : ''}`;

      this.log('info', 'Comment auto-blocked due to user intolerance preferences', {
        matchedTerms: matchedTerms.slice(0, 5), // Log first 5 matches for debugging
        matchedCategories,
        hasEmbeddings: !!intoleranceEmbeddings,
        textLength: text.length,
        analysisTime: Date.now() - startTime
      });
    }

    return {
      shouldBlock,
      reason: blockReason,
      matchedTerms,
      matchedCategories,
      analysisTime: Date.now() - startTime
    };
  }

  /**
   * Get user's tolerance preferences (Issue #150)
   * Enhanced to include embeddings for semantic matching (Issue #151)
   * These are topics the user considers harmless to them, reducing false positives
   */
  async getUserTolerancePreferences(organizationId) {
    try {
      // Get organization owner user ID
      const { data: orgData, error: orgError } = await this.supabase
        .from('organizations')
        .select('owner_id')
        .eq('id', organizationId)
        .single();

      if (orgError || !orgData) {
        this.log('warn', 'Could not get organization owner for tolerance check', {
          organizationId,
          error: orgError?.message
        });
        return null;
      }

      // Get user's encrypted tolerance preferences and embeddings
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('lo_que_me_da_igual_encrypted, lo_que_me_da_igual_embedding')
        .eq('id', orgData.owner_id)
        .single();

      if (userError || !userData || !userData.lo_que_me_da_igual_encrypted) {
        // User hasn't defined tolerance preferences - this is normal
        return null;
      }

      // Decrypt the tolerance data
      try {
        const decryptedTolerance = encryptionService.decrypt(userData.lo_que_me_da_igual_encrypted);

        // Parse embeddings if available
        let embeddingData = null;
        if (userData.lo_que_me_da_igual_embedding) {
          try {
            embeddingData = JSON.parse(userData.lo_que_me_da_igual_embedding);
          } catch (embeddingError) {
            this.log('warn', 'Failed to parse tolerance embeddings, using text-only matching', {
              organizationId,
              userId: orgData.owner_id.substr(0, 8) + '...',
              error: embeddingError.message
            });
          }
        }

        this.log('debug', 'Retrieved user tolerance preferences for false positive reduction', {
          organizationId,
          userId: orgData.owner_id.substr(0, 8) + '...',
          hasPreferences: !!decryptedTolerance,
          hasEmbeddings: !!embeddingData,
          embeddingTermsCount: embeddingData ? embeddingData.length : 0
        });

        return {
          text: decryptedTolerance,
          embeddings: embeddingData
        };
      } catch (decryptError) {
        this.log('error', 'Failed to decrypt tolerance preferences', {
          organizationId,
          userId: orgData.owner_id.substr(0, 8) + '...',
          error: decryptError.message
        });
        return null;
      }
    } catch (error) {
      this.log('error', 'Failed to get tolerance preferences', {
        organizationId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Check if comment should be ignored based on user tolerance preferences (Issue #150)
   * Enhanced with semantic similarity matching (Issue #151)
   * This reduces false positives by allowing content the user considers harmless
   * IMPORTANT: This only runs if auto-block didn't trigger (intolerance has priority)
   */
  async checkTolerance(text, toleranceData, toleranceEmbeddings = null) {
    const startTime = Date.now();

    if (!toleranceData || typeof toleranceData !== 'string') {
      return {
        shouldIgnore: false,
        reason: 'No tolerance preferences defined',
        matchedTerms: [],
        matchedCategories: [],
        analysisTime: Date.now() - startTime
      };
    }

    // Normalize text for matching
    const commentText = text.toLowerCase().trim();

    // Parse tolerance terms from user input
    const toleranceTerms = toleranceData
      .toLowerCase()
      .split(/[,;]+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2); // Ignore very short terms

    let matchedTerms = [];
    let matchedCategories = [];
    let ignoreReason = '';

    // PHASE 1: Check for exact matches (most reliable)
    for (const term of toleranceTerms) {
      if (commentText.includes(term)) {
        matchedTerms.push(term);

        // Categorize the tolerance match
        if (this.isAppearanceRelated(term)) {
          matchedCategories.push('appearance_tolerance');
        } else if (this.isGenericInsult(term)) {
          matchedCategories.push('generic_insult_tolerance');
        } else {
          matchedCategories.push('custom_tolerance');
        }
      }
    }

    // PHASE 2: If no exact matches, check semantic similarity with embeddings (Issue #151)
    if (matchedTerms.length === 0 && toleranceEmbeddings) {
      try {
        const semanticMatches = await this.embeddingsService.findSemanticMatches(
          text,
          toleranceEmbeddings,
          'tolerance'
        );

        if (semanticMatches.matches && semanticMatches.matches.length > 0) {
          // Use medium-high threshold for tolerance matching (0.80 by default)
          for (const match of semanticMatches.matches) {
            matchedTerms.push(`${match.term} (semantic: ${match.similarity})`);
            matchedCategories.push('semantic_tolerance_match');
          }

          this.log('info', 'Semantic tolerance matches found', {
            maxSimilarity: semanticMatches.maxSimilarity,
            matchCount: semanticMatches.matches.length,
            threshold: semanticMatches.threshold,
            textLength: text.length
          });
        }
      } catch (error) {
        this.log('warn', 'Semantic tolerance matching failed, falling back to pattern matching', {
          error: error.message,
          textLength: text.length
        });

        // PHASE 3: Fallback to basic semantic pattern matching
        const patternMatches = this.checkSemanticToleranceMatches(commentText, toleranceTerms);
        matchedTerms.push(...patternMatches.terms);
        matchedCategories.push(...patternMatches.categories);
      }
    } else if (matchedTerms.length === 0) {
      // PHASE 3: Basic semantic pattern matching (fallback when no embeddings)
      const semanticMatches = this.checkSemanticToleranceMatches(commentText, toleranceTerms);
      matchedTerms.push(...semanticMatches.terms);
      matchedCategories.push(...semanticMatches.categories);
    }

    const shouldIgnore = matchedTerms.length > 0;

    if (shouldIgnore) {
      ignoreReason = `Matched user tolerance terms: ${matchedTerms.slice(0, 3).join(', ')}${matchedTerms.length > 3 ? ` (and ${matchedTerms.length - 3} more)` : ''}`;

      this.log(
        'info',
        'Comment ignored due to user tolerance preferences (false positive reduction)',
        {
          matchedTerms: matchedTerms.slice(0, 5), // Log first 5 matches for debugging
          matchedCategories,
          hasEmbeddings: !!toleranceEmbeddings,
          textLength: text.length,
          analysisTime: Date.now() - startTime
        }
      );
    }

    return {
      shouldIgnore,
      reason: ignoreReason,
      matchedTerms,
      matchedCategories,
      analysisTime: Date.now() - startTime
    };
  }

  /**
   * Check if a term is related to appearance topics (common tolerance category)
   */
  isAppearanceRelated(term) {
    const appearanceKeywords = [
      'bald',
      'calvo',
      'hair',
      'pelo',
      'weight',
      'peso',
      'fat',
      'gordo',
      'thin',
      'flaco',
      'height',
      'alto',
      'short',
      'bajo',
      'glasses',
      'gafas'
    ];
    return appearanceKeywords.some((keyword) => term.includes(keyword));
  }

  /**
   * Check if a term is a generic insult (common tolerance category)
   */
  isGenericInsult(term) {
    const genericInsults = [
      'stupid',
      'tonto',
      'idiot',
      'idiota',
      'dumb',
      'fool',
      'bobo',
      'silly',
      'crazy',
      'loco',
      'weird',
      'raro'
    ];
    return genericInsults.some((keyword) => term.includes(keyword));
  }

  /**
   * Check for semantic tolerance matches (less strict than intolerance matching)
   */
  checkSemanticToleranceMatches(text, toleranceTerms) {
    const matchedTerms = [];
    const matchedCategories = [];

    // Implement basic semantic matching for tolerance
    // This is more lenient than intolerance matching since we want to catch more tolerance cases
    for (const term of toleranceTerms) {
      const words = term.split(' ');
      const matchCount = words.filter((word) => text.includes(word)).length;

      // If at least 60% of words match, consider it a semantic match
      if (matchCount >= Math.max(1, Math.ceil(words.length * 0.6))) {
        matchedTerms.push(term);
        matchedCategories.push('semantic_tolerance_match');
      }
    }

    return { terms: matchedTerms, categories: matchedCategories };
  }

  /**
   * Check if a term is related to racial topics
   */
  isRacialTerm(term) {
    const racialKeywords = [
      'racial',
      'race',
      'black',
      'white',
      'asian',
      'latino',
      'hispanic',
      'arab',
      'muslim',
      'jewish',
      'racist',
      'racism'
    ];
    return racialKeywords.some((keyword) => term.includes(keyword));
  }

  /**
   * Check if a term is related to body shaming
   */
  isBodyShamingTerm(term) {
    const bodyKeywords = [
      'weight',
      'fat',
      'thin',
      'ugly',
      'appearance',
      'body',
      'looks',
      'height',
      'size',
      'shape',
      'beauty',
      'attractive'
    ];
    return bodyKeywords.some((keyword) => term.includes(keyword));
  }

  /**
   * Check if a term is related to political topics
   */
  isPoliticalTerm(term) {
    const politicalKeywords = [
      'liberal',
      'conservative',
      'left',
      'right',
      'democrat',
      'republican',
      'politics',
      'political',
      'trump',
      'biden',
      'socialist',
      'capitalist'
    ];
    return politicalKeywords.some((keyword) => term.includes(keyword));
  }

  /**
   * Check if a term is related to identity (LGBTQ+, gender, etc.)
   */
  isIdentityTerm(term) {
    const identityKeywords = [
      'gay',
      'lesbian',
      'trans',
      'transgender',
      'lgbtq',
      'queer',
      'bi',
      'gender',
      'sexuality',
      'orientation',
      'identity',
      'pronoun'
    ];
    return identityKeywords.some((keyword) => term.includes(keyword));
  }

  /**
   * Check for semantic matches using basic pattern matching
   */
  checkSemanticMatches(commentText, intoleranceTerms) {
    const matchedTerms = [];
    const matchedCategories = [];

    // This is a simplified semantic check - in production, you might use
    // more sophisticated NLP libraries or embeddings for better matching
    for (const term of intoleranceTerms) {
      // Check for partial word matches and common variations
      const termWords = term.split(/\s+/);

      if (termWords.length > 1) {
        // Multi-word terms: check if most words are present
        const foundWords = termWords.filter(
          (word) => commentText.includes(word) || this.checkWordVariations(commentText, word)
        );

        if (foundWords.length >= Math.ceil(termWords.length * 0.7)) {
          matchedTerms.push(term);
          matchedCategories.push('semantic_match');
        }
      } else {
        // Single word: check for variations and synonyms
        if (this.checkWordVariations(commentText, term)) {
          matchedTerms.push(term);
          matchedCategories.push('variation_match');
        }
      }
    }

    return { terms: matchedTerms, categories: matchedCategories };
  }

  /**
   * Check for word variations (plurals, common misspellings, etc.)
   */
  checkWordVariations(text, word) {
    // Check for plurals
    if (text.includes(word + 's') || text.includes(word + 'es')) {
      return true;
    }

    // Check for common substitutions (l33t speak, etc.)
    const variations = word
      .replace(/a/g, '@')
      .replace(/e/g, '3')
      .replace(/i/g, '1')
      .replace(/o/g, '0')
      .replace(/s/g, '5');

    if (text.includes(variations)) {
      return true;
    }

    // Check for word with common prefixes/suffixes removed
    const stem = word.replace(/(ing|ed|er|est|ly|tion|sion)$/, '');
    if (stem.length > 3 && text.includes(stem)) {
      return true;
    }

    return false;
  }

  /**
   * Handle Shield actions for auto-blocked content (Issue #149)
   * Auto-blocked content gets the highest priority Shield treatment
   */
  async handleAutoBlockShieldAction(organizationId, comment, analysis) {
    try {
      this.log('info', 'Processing immediate Shield action for auto-blocked content', {
        commentId: comment.id,
        matchedTerms: analysis.matched_intolerance_terms?.slice(0, 3)
      });

      // Create special Shield analysis for auto-blocked content
      const autoBlockShieldAnalysis = {
        ...analysis,
        shield_priority: 0, // Highest possible priority
        auto_block_shield: true,
        immediate_action: true
      };

      // Delegate to Shield service with maximum priority
      const shieldResult = await this.shieldService.analyzeForShield(
        organizationId,
        comment,
        autoBlockShieldAnalysis
      );

      if (shieldResult.shieldActive) {
        this.log('info', 'Shield activated for auto-blocked content', {
          commentId: comment.id,
          priority: shieldResult.priority,
          actions: shieldResult.actions?.primary,
          autoExecuted: shieldResult.autoExecuted
        });
      }

      return shieldResult;
    } catch (error) {
      this.log('error', 'Failed to handle auto-block Shield action', {
        commentId: comment.id,
        error: error.message
      });

      // Don't throw error to avoid breaking the auto-block flow
      return { shieldActive: false, error: error.message };
    }
  }

  /**
   * Analyze toxicity using available services with Roastr Persona enhancement (Issue #148)
   */
  async analyzeToxicity(text, roastrPersona = null) {
    let result = null;

    // Try Perspective API first
    if (this.perspectiveClient) {
      try {
        result = await this.analyzePerspective(text);
        result.service = 'perspective';
      } catch (error) {
        this.log('warn', 'Perspective API failed, trying fallback', {
          error: error.message
        });
      }
    }

    // Try OpenAI Moderation API as fallback
    if (!result && this.openaiClient) {
      try {
        result = await this.analyzeOpenAI(text);
        result.service = 'openai';
      } catch (error) {
        this.log('warn', 'OpenAI Moderation API failed, using pattern fallback', {
          error: error.message
        });
      }
    }

    // Use pattern-based fallback
    if (!result) {
      result = this.analyzePatterns(text);
      result.service = 'patterns';
    }

    // Enhanced analysis with Roastr Persona (Issue #148)
    if (roastrPersona) {
      const personalAnalysis = this.analyzePersonalAttack(text, roastrPersona);
      if (personalAnalysis.isPersonalAttack) {
        // Increase toxicity score for personal attacks
        const originalScore = result.toxicity_score;
        result.toxicity_score = Math.min(1.0, originalScore + personalAnalysis.boostAmount);

        // Add personal attack category
        if (!result.categories) result.categories = [];
        result.categories.push('personal_attack');

        // Log the enhancement
        this.log('info', 'Enhanced toxicity score due to personal attack', {
          originalScore,
          enhancedScore: result.toxicity_score,
          boostAmount: personalAnalysis.boostAmount,
          matchedTerms: personalAnalysis.matchedTerms
        });

        // Store persona analysis metadata
        result.persona_analysis = {
          isPersonalAttack: true,
          matchedTerms: personalAnalysis.matchedTerms,
          boostAmount: personalAnalysis.boostAmount,
          originalScore
        };
      }
    }

    // Add severity level: Use Perspective API's severity if available,
    // otherwise calculate from score
    if (!result.severity_level) {
      // If result has 'severity' from Perspective API, use it
      if (result.severity) {
        result.severity_level = result.severity;
      } else {
        // Fallback to calculated severity for OpenAI/patterns
        result.severity_level = this.calculateSeverityLevel(result.toxicity_score);
      }
    }

    return result;
  }

  /**
   * Analyze using Google Perspective API (via PerspectiveService)
   */
  async analyzePerspective(text) {
    // Use our PerspectiveService implementation
    const result = await this.perspectiveClient.analyzeToxicity(text, {
      languages: ['en', 'es'],
      doNotStore: true
    });

    // Return in the expected format for the worker
    // Use Perspective's severity directly (no recalculation needed)
    return {
      toxicity_score: result.toxicityScore,
      severity_level: result.severity, // Use Perspective's severity directly
      categories: result.categories,
      raw_scores: result.scores
    };
  }

  /**
   * Analyze using OpenAI Moderation API
   */
  async analyzeOpenAI(text) {
    // Issue #920: Use LLMClient moderations interface
    const response = await this.openaiClient.moderations.create({
      model: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
      input: text
    });

    const result = response.results[0];
    const categories = [];
    let maxScore = 0;

    // Extract flagged categories and find highest score
    for (const [category, flagged] of Object.entries(result.categories)) {
      if (flagged) {
        categories.push(category);
      }
      const score = result.category_scores[category];
      if (score > maxScore) {
        maxScore = score;
      }
    }

    return {
      toxicity_score: Math.round(maxScore * 1000) / 1000,
      categories,
      flagged: result.flagged,
      raw_scores: result.category_scores
    };
  }

  /**
   * Analyze using pattern-based fallback
   */
  analyzePatterns(text) {
    let maxScore = 0;
    const categories = [];
    const matchedPatterns = [];

    for (const rule of this.toxicPatterns) {
      if (rule.pattern.test(text)) {
        maxScore = Math.max(maxScore, rule.score);
        if (!categories.includes(rule.category)) {
          categories.push(rule.category);
        }
        matchedPatterns.push(rule.pattern.source);
      }
    }

    // Base toxicity score on text length and pattern matches
    const wordCount = text.split(/\s+/).length;
    const lengthFactor = Math.min(1, wordCount / 10); // Longer texts can be more nuanced

    return {
      toxicity_score: Math.round(maxScore * lengthFactor * 1000) / 1000,
      categories,
      matched_patterns: matchedPatterns
    };
  }

  /**
   * Analyze for personal attacks based on user's Roastr Persona (Issue #148)
   * This enhances toxicity detection by checking if comments attack aspects
   * that the user has defined as part of their identity
   */
  analyzePersonalAttack(text, roastrPersona) {
    if (!roastrPersona || typeof roastrPersona !== 'string') {
      return { isPersonalAttack: false, matchedTerms: [], boostAmount: 0 };
    }

    // Clean and normalize the persona text
    const personaTerms = roastrPersona
      .toLowerCase()
      .split(/[,;\.]+/) // Split by common separators
      .map((term) => term.trim())
      .filter((term) => term.length > 2); // Filter out very short terms

    // Clean and normalize the comment text
    const commentText = text.toLowerCase();

    const matchedTerms = [];
    let totalBoost = 0;

    // Check for direct mentions of persona terms
    for (const term of personaTerms) {
      if (commentText.includes(term)) {
        matchedTerms.push(term);

        // Calculate boost based on context and term significance
        let termBoost = 0.2; // Base boost for any match

        // Higher boost for longer, more specific terms
        if (term.length > 8) termBoost += 0.1;
        if (term.includes(' ')) termBoost += 0.1; // Multi-word terms are more specific

        // Check for negative context around the term (using dynamic window sizing)
        const termIndex = commentText.indexOf(term);
        const windowSize = this.calculateContextWindowSize(commentText, term);
        const contextStart = Math.max(0, termIndex - windowSize);
        const contextEnd = Math.min(commentText.length, termIndex + term.length + windowSize);
        const context = commentText.substring(contextStart, contextEnd);

        // Negative words that amplify personal attacks
        const negativeWords = [
          'hate',
          'stupid',
          'disgusting',
          'wrong',
          'sick',
          'weird',
          'gross',
          'fake',
          'pretend',
          'wrong',
          'bad',
          'evil',
          'crazy',
          'mental',
          'kill',
          'die',
          'destroy',
          'eliminate',
          'remove',
          'ban'
        ];

        const hasNegativeContext = negativeWords.some((word) => context.includes(word));
        if (hasNegativeContext) {
          termBoost += 0.3; // Significant boost for negative context
        }

        // Check for slurs or derogatory language patterns (using external service)
        const hasSlur = this.slurPatterns.some((pattern) => context.match(pattern));
        if (hasSlur) {
          termBoost += 0.5; // Major boost for slurs
        }

        totalBoost += termBoost;
      }
    }

    // Cap the total boost to prevent over-amplification
    totalBoost = Math.min(totalBoost, 0.6);

    const isPersonalAttack = matchedTerms.length > 0 && totalBoost > 0.1;

    return {
      isPersonalAttack,
      matchedTerms,
      boostAmount: Math.round(totalBoost * 1000) / 1000 // Round to 3 decimals
    };
  }

  /**
   * Calculate severity level based on toxicity score
   */
  calculateSeverityLevel(score) {
    if (score >= this.thresholds.critical) return 'critical';
    if (score >= this.thresholds.high) return 'high';
    if (score >= this.thresholds.medium) return 'medium';
    if (score >= this.thresholds.low) return 'low';
    return 'low';
  }

  /**
   * Update comment with analysis results
   */
  async updateCommentAnalysis(commentId, analysis) {
    try {
      const updateData = {
        toxicity_score: analysis.toxicity_score,
        severity_level:
          analysis.severity_level ?? this.calculateSeverityLevel(analysis.toxicity_score),
        categories: analysis.categories,
        processed_at: new Date().toISOString(),
        status: 'processed'
      };

      // Store analysis metadata in the metadata field
      const metadata = {
        analysis_method: analysis.method || analysis.service || 'unknown',
        analysis_confidence: analysis.analysis_confidence ?? analysis.confidence ?? null
      };

      if (Object.keys(metadata).length > 0) {
        updateData.metadata = metadata;
      }

      const { error } = await this.supabase.from('comments').update(updateData).eq('id', commentId);

      if (error) {
        throw new Error(error.message || 'Failed to update comment analysis');
      }
    } catch (error) {
      this.log('error', 'Failed to update comment analysis', {
        commentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Determine if comment should generate a response
   */
  shouldGenerateResponse(analysis, comment) {
    const { toxicity_score, severity_level } = analysis;

    // Don't respond to very low toxicity (likely normal conversation)
    if (severity_level === 'low' && toxicity_score < 0.4) {
      return false;
    }

    // Always respond to medium+ toxicity
    if (['medium', 'high', 'critical'].includes(severity_level)) {
      return true;
    }

    // For low severity, check if it contains roast triggers
    const triggerWords = ['roast', 'burn', 'insult', 'comeback'];
    const textLower = comment.original_text.toLowerCase();

    return triggerWords.some((word) => textLower.includes(word));
  }

  /**
   * Queue response generation job
   */
  async queueResponseGeneration(organizationId, comment, analysis, correlationId) {
    const priority = this.getResponsePriority(analysis.severity_level);

    const responseJob = {
      organization_id: organizationId,
      job_type: 'generate_roast',
      priority,
      payload: {
        comment_id: comment.id,
        organization_id: organizationId,
        platform: comment.platform,
        original_text: comment.original_text,
        toxicity_score: analysis.toxicity_score,
        severity_level: analysis.severity_level,
        categories: analysis.categories,
        correlationId, // Propagate correlation ID (Issue #417)
        brand_safety: analysis.metadata?.brand_safety || null // Issue #859: Brand Safety
      },
      max_attempts: 3
    };

    try {
      if (this.redis) {
        // ROA-324: Normalized to v2_ prefix convention
        await this.redis.rpush('v2_jobs:generate_roast', JSON.stringify(responseJob));
      } else {
        const { error } = await this.supabase.from('job_queue').insert([responseJob]);

        if (error) throw error;
      }

      this.log('info', 'Queued response generation', {
        commentId: comment.id,
        severity: analysis.severity_level,
        priority
      });
    } catch (error) {
      this.log('error', 'Failed to queue response generation', {
        commentId: comment.id,
        error: error.message
      });
    }
  }

  /**
   * Get response priority based on severity
   */
  getResponsePriority(severityLevel) {
    switch (severityLevel) {
      case 'critical':
        return 1; // Highest priority
      case 'high':
        return 2;
      case 'medium':
        return 3;
      case 'low':
        return 5;
      default:
        return 5;
    }
  }

  /**
   * Handle Shield analysis for toxic content
   */
  async handleShieldAnalysis(organizationId, comment, analysis) {
    try {
      this.log('info', 'Processing Shield analysis', {
        commentId: comment.id,
        severity: analysis.severity_level,
        toxicityScore: analysis.toxicity_score
      });

      // Delegate to Shield service for comprehensive analysis
      const shieldResult = await this.shieldService.analyzeForShield(
        organizationId,
        comment,
        analysis
      );

      if (shieldResult.shieldActive) {
        this.log('info', 'Shield activated', {
          commentId: comment.id,
          priority: shieldResult.priority,
          actions: shieldResult.actions?.primary,
          autoExecuted: shieldResult.autoExecuted
        });
      } else {
        this.log('debug', 'Shield not activated', {
          commentId: comment.id,
          reason: shieldResult.reason
        });
      }

      return shieldResult;
    } catch (error) {
      this.log('error', 'Failed to handle Shield analysis', {
        commentId: comment.id,
        error: error.message
      });

      // Don't throw error to avoid breaking the main analysis flow
      return { shieldActive: false, error: error.message };
    }
  }

  /**
   * Estimate tokens used for cost calculation
   */
  estimateTokens(text) {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Update comment with unified analysis decision (Issue #632)
   * @param {string} commentId - Comment ID
   * @param {Object} decision - Analysis Department decision
   */
  async updateCommentWithAnalysisDecision(commentId, decision) {
    const analysisResult = {
      toxicity_score: decision.scores.final_toxicity,
      severity_level: decision.metadata.decision.severity_level,
      categories: [
        ...decision.metadata.security.injection_categories,
        ...decision.metadata.toxicity.flagged_categories
      ],
      service: decision.analysis.services_used.join('+'),
      direction: decision.direction,
      action_tags: decision.action_tags,
      security_classification: decision.metadata.security.classification,
      is_prompt_injection: decision.metadata.security.is_prompt_injection,
      platform_violations: decision.metadata.platform_violations
    };

    await this.updateCommentAnalysis(commentId, analysisResult);
  }

  /**
   * Record usage for unified analysis (Issue #632)
   * @param {string} organizationId - Organization ID
   * @param {string} platform - Platform name
   * @param {string} commentId - Comment ID
   * @param {string} text - Comment text
   * @param {Object} decision - Analysis Department decision
   */
  async recordAnalysisUsage(organizationId, platform, commentId, text, decision) {
    const tokensUsed = this.estimateTokens(text);

    await this.costControl.recordUsage(
      organizationId,
      platform,
      'unified_analysis',
      {
        commentId,
        tokensUsed,
        analysisService: decision.analysis.services_used.join('+'),
        direction: decision.direction,
        severity: decision.metadata.decision.severity_level,
        toxicityScore: decision.scores.final_toxicity,
        categories: decision.metadata.toxicity.flagged_categories,
        textLength: text.length,
        processingTime: decision.analysis.processing_time_ms,
        platformViolations: decision.metadata.platform_violations.has_violations
      },
      null,
      1
    );
  }

  /**
   * Route analysis decision to appropriate action (Issue #632)
   * @param {string} organizationId - Organization ID
   * @param {Object} comment - Comment object
   * @param {Object} decision - Analysis Department decision
   * @param {string} correlationId - Correlation ID for logging
   */
  async routeByDirection(organizationId, comment, decision, correlationId) {
    switch (decision.direction) {
      case 'SHIELD':
        // Route to Shield with action_tags
        await this.handleShieldAction(organizationId, comment, decision);
        break;

      case 'ROAST':
        // Queue roast generation
        await this.queueResponseGeneration(organizationId, comment, decision, correlationId);
        break;

      case 'PUBLISH':
        // No action needed, comment is safe
        this.log('info', 'Comment safe to publish', {
          commentId: comment.id,
          toxicityScore: decision.scores.final_toxicity
        });
        break;

      default:
        this.log('warn', 'Unknown direction from Analysis Department', {
          direction: decision.direction,
          commentId: comment.id
        });
    }
  }

  /**
   * Handle Shield action using action_tags from Analysis Department (Issue #632)
   * @param {string} organizationId - Organization ID
   * @param {Object} comment - Comment object
   * @param {Object} decision - Analysis Department decision with action_tags
   */
  async handleShieldAction(organizationId, comment, decision) {
    try {
      // Pass action_tags to Shield Service (Issue #632)
      await this.shieldService.executeActionsFromTags(
        organizationId,
        comment,
        decision.action_tags,
        decision.metadata
      );

      this.log('info', 'Shield actions executed', {
        commentId: comment.id,
        action_tags: decision.action_tags,
        platform_violations: decision.metadata.platform_violations.has_violations
      });
    } catch (error) {
      this.log('error', 'Failed to execute Shield actions', {
        commentId: comment.id,
        action_tags: decision.action_tags,
        error: error.message
      });
      // Don't throw to avoid breaking main flow
    }
  }
}

module.exports = AnalyzeToxicityWorker;
