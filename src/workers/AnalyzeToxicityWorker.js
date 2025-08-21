const BaseWorker = require('./BaseWorker');
const CostControlService = require('../services/costControl');
const ShieldService = require('../services/shieldService');
const { mockMode } = require('../config/mockMode');
const encryptionService = require('../services/encryptionService');

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
    
    // Initialize toxicity detection services
    this.initializeToxicityServices();
    
    // Toxicity thresholds
    this.thresholds = {
      low: 0.3,      // Mild sarcasm, general negativity
      medium: 0.6,   // Clear toxicity, insults
      high: 0.8,     // Severe toxicity, threats
      critical: 0.95 // Extreme content requiring immediate action
    };
    
    // Pattern-based fallback rules
    this.toxicPatterns = [
      { pattern: /\b(idiot|stupid|dumb|moron)\b/i, score: 0.4, category: 'insult' },
      { pattern: /\b(hate|kill|die|death)\b/i, score: 0.8, category: 'threat' },
      { pattern: /\b(fuck|shit|damn|ass)\b/i, score: 0.3, category: 'profanity' },
      { pattern: /\b(racist|nazi|hitler)\b/i, score: 0.9, category: 'hate' }
    ];
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
      // Google Perspective API
      if (process.env.PERSPECTIVE_API_KEY) {
        const { google } = require('googleapis');
        this.perspectiveClient = google.commentanalyzer({
          version: 'v1alpha1',
          auth: process.env.PERSPECTIVE_API_KEY
        });
        this.log('info', 'Perspective API client initialized');
      }
      
      // OpenAI Moderation API (fallback)
      if (process.env.OPENAI_API_KEY) {
        const { OpenAI } = require('openai');
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        this.log('info', 'OpenAI Moderation API client initialized');
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
    const { comment_id, organization_id, platform, text } = job.payload || job;
    
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
    
    // Get user's Roastr Persona for enhanced analysis (Issue #148)
    const roastrPersona = await this.getUserRoastrPersona(organization_id);
    
    // Analyze toxicity using available services with personalization
    const analysisResult = await this.analyzeToxicity(
      text || comment.original_text, 
      roastrPersona
    );
    
    // Update comment with analysis results
    await this.updateCommentAnalysis(comment_id, analysisResult);
    
    // Record usage and cost with enhanced tracking
    const textToAnalyze = text || comment.original_text;
    const tokensUsed = this.estimateTokens(textToAnalyze);
    await this.costControl.recordUsage(
      organization_id,
      platform,
      'analyze_toxicity',
      {
        commentId: comment_id,
        tokensUsed,
        analysisService: analysisResult.service,
        severity: analysisResult.severity_level,
        toxicityScore: analysisResult.toxicity_score,
        categories: analysisResult.categories,
        textLength: textToAnalyze.length,
        analysisTime: analysisResult.analysisTime || 0
      },
      null, // userId - not applicable for toxicity analysis
      1 // quantity
    );
    
    // Queue response generation if comment meets criteria
    if (this.shouldGenerateResponse(analysisResult, comment)) {
      await this.queueResponseGeneration(organization_id, comment, analysisResult);
    }
    
    // Handle Shield mode actions for medium+ severity
    if (['medium', 'high', 'critical'].includes(analysisResult.severity_level)) {
      await this.handleShieldAnalysis(organization_id, comment, analysisResult);
    }
    
    return {
      success: true,
      summary: `Analyzed comment toxicity: ${analysisResult.severity_level} (${analysisResult.toxicity_score})`,
      commentId: comment_id,
      toxicityScore: analysisResult.toxicity_score,
      severityLevel: analysisResult.severity_level,
      categories: analysisResult.categories,
      service: analysisResult.service
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
    
    // Add severity level based on final score
    result.severity_level = this.calculateSeverityLevel(result.toxicity_score);
    
    return result;
  }
  
  /**
   * Analyze using Google Perspective API
   */
  async analyzePerspective(text) {
    const request = {
      comment: { text },
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        IDENTITY_ATTACK: {},
        INSULT: {},
        PROFANITY: {},
        THREAT: {}
      },
      languages: ['en', 'es'], // Support English and Spanish
      doNotStore: true
    };
    
    const response = await this.perspectiveClient.comments.analyze({
      resource: request
    });
    
    const scores = response.data.attributeScores;
    const toxicityScore = scores.TOXICITY?.summaryScore?.value || 0;
    
    const categories = [];
    for (const [attribute, data] of Object.entries(scores)) {
      if (data.summaryScore?.value > 0.5) {
        categories.push(attribute.toLowerCase());
      }
    }
    
    return {
      toxicity_score: Math.round(toxicityScore * 1000) / 1000, // Round to 3 decimals
      categories,
      raw_scores: scores
    };
  }
  
  /**
   * Analyze using OpenAI Moderation API
   */
  async analyzeOpenAI(text) {
    const response = await this.openaiClient.moderations.create({
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
      toxicity_score: Math.round((maxScore * lengthFactor) * 1000) / 1000,
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
      .map(term => term.trim())
      .filter(term => term.length > 2); // Filter out very short terms
    
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
        
        // Check for negative context around the term
        const termIndex = commentText.indexOf(term);
        const contextStart = Math.max(0, termIndex - 20);
        const contextEnd = Math.min(commentText.length, termIndex + term.length + 20);
        const context = commentText.substring(contextStart, contextEnd);
        
        // Negative words that amplify personal attacks
        const negativeWords = [
          'hate', 'stupid', 'disgusting', 'wrong', 'sick', 'weird', 'gross',
          'fake', 'pretend', 'wrong', 'bad', 'evil', 'crazy', 'mental',
          'kill', 'die', 'destroy', 'eliminate', 'remove', 'ban'
        ];
        
        const hasNegativeContext = negativeWords.some(word => context.includes(word));
        if (hasNegativeContext) {
          termBoost += 0.3; // Significant boost for negative context
        }
        
        // Check for slurs or derogatory language patterns
        const slurPatterns = [
          /f[a@]g/i, /tr[a@]nny/i, /ret[a@]rd/i, /n[i1]gg[e3]r/i,
          /sp[i1]c/i, /ch[i1]nk/i, /k[i1]k[e3]/i
        ];
        
        const hasSlur = slurPatterns.some(pattern => context.match(pattern));
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
      const { error } = await this.supabase
        .from('comments')
        .update({
          toxicity_score: analysis.toxicity_score,
          severity_level: analysis.severity_level,
          categories: analysis.categories,
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', commentId);
      
      if (error) throw error;
      
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
    
    return triggerWords.some(word => textLower.includes(word));
  }
  
  /**
   * Queue response generation job
   */
  async queueResponseGeneration(organizationId, comment, analysis) {
    const priority = this.getResponsePriority(analysis.severity_level);
    
    const responseJob = {
      organization_id: organizationId,
      job_type: 'generate_reply',
      priority,
      payload: {
        comment_id: comment.id,
        organization_id: organizationId,
        platform: comment.platform,
        original_text: comment.original_text,
        toxicity_score: analysis.toxicity_score,
        severity_level: analysis.severity_level,
        categories: analysis.categories
      },
      max_attempts: 3
    };
    
    try {
      if (this.redis) {
        await this.redis.rpush('roastr:jobs:generate_reply', JSON.stringify(responseJob));
      } else {
        const { error } = await this.supabase
          .from('job_queue')
          .insert([responseJob]);
        
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
      case 'critical': return 1; // Highest priority
      case 'high': return 2;
      case 'medium': return 3;
      case 'low': return 5;
      default: return 5;
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
}

module.exports = AnalyzeToxicityWorker;