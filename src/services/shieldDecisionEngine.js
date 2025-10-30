const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');
const ShieldPersistenceService = require('./shieldPersistenceService');
const ShieldSettingsService = require('./shieldSettingsService');
const crypto = require('crypto');

/**
 * Shield Decision Engine
 * 
 * Core decision-making component for the Shield system that determines
 * the appropriate action based on toxicity analysis, user configuration,
 * and recidivism tracking. Implements the consistent decision pipeline
 * with configurable thresholds and corrective zones.
 */
class ShieldDecisionEngine {
  constructor(config = {}) {
    this.supabase = config.supabase || createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    this.logger = config.logger || logger;
    this.persistenceService = config.persistenceService || new ShieldPersistenceService({ supabase: this.supabase, logger: this.logger });
    this.settingsService = config.settingsService || new ShieldSettingsService({ supabase: this.supabase, logger: this.logger });

    // Initialize idempotency secret with environment validation
    this.idempotencySecret = this.initializeIdempotencySecret();
    
    // Configurable decision thresholds
    this.thresholds = {
      toxicity: {
        critical: config.criticalThreshold || 0.98,    // 98% - Immediate severe action
        high: config.highThreshold || 0.95,           // 95% - Shield action
        moderate: config.moderateThreshold || 0.90,    // 90% - Roastable
        corrective: config.correctiveThreshold || 0.85 // 85% - Corrective zone
      },
      aggressiveness: config.aggressiveness || 0.95 // Default aggressiveness level
    };
    
    // Corrective message pools
    this.correctiveMessages = {
      general: [
        "Parece que necesitas un momento para reflexionar. ¿Qué tal si reformulas tu comentario de manera más constructiva?",
        "Tu comentario podría beneficiarse de un enfoque más respetuoso. ¿Te gustaría intentar de nuevo?",
        "Detectamos que tu mensaje puede resultar ofensivo. Te invitamos a expresarte de forma más positiva."
      ],
      insult: [
        "Los insultos no fortalecen tu argumento. ¿Podrías expresar tu punto de vista sin atacar a otros?",
        "Entendemos que puedes estar frustrado, pero los insultos no son la mejor forma de comunicarse.",
        "Tu opinión es válida, pero sería más efectiva sin los comentarios despectivos."
      ],
      harassment: [
        "Este tipo de comentarios puede hacer sentir incómodos a otros usuarios. ¿Podrías ser más respetuoso?",
        "Valoramos la diversidad de opiniones, pero el respeto hacia otros es fundamental en nuestra comunidad.",
        "Tu participación es importante, pero necesitamos mantener un ambiente seguro para todos."
      ],
      threat: [
        "Los comentarios amenazantes no están permitidos. Te pedimos que mantengas un tono respetuoso.",
        "Detectamos lenguaje que puede interpretarse como amenazante. Por favor, reformula tu mensaje.",
        "Nuestra comunidad se basa en el respeto mutuo. Evita cualquier tipo de amenaza o intimidación."
      ]
    };
    
    // Decision cache for idempotency with LRU eviction
    this.decisionCache = new Map();
    this.cacheMaxSize = config.cacheMaxSize || 1000; // Prevent memory bloat
    this.cacheEvictionBatchSize = config.cacheEvictionBatchSize || 100;
    
    this.logger.info('Shield Decision Engine initialized', {
      thresholds: this.thresholds,
      aggressiveness: this.thresholds.aggressiveness,
      cacheMaxSize: this.cacheMaxSize
    });
  }
  
  /**
   * Main decision pipeline - determines action for a comment
   */
  async makeDecision({
    organizationId,
    userId = null,
    platform,
    accountRef,
    externalCommentId,
    externalAuthorId,
    externalAuthorUsername,
    originalText,
    toxicityAnalysis,
    userConfiguration = {},
    metadata = {}
  }) {
    try {
      // Ensure idempotency - check if decision already made
      const cacheKey = this.generateCacheKey(organizationId, externalCommentId, platform, accountRef);
      if (this.decisionCache.has(cacheKey)) {
        // LRU: Move to end by re-inserting (deleting and setting again)
        const cachedDecision = this.decisionCache.get(cacheKey);
        this.decisionCache.delete(cacheKey);
        this.decisionCache.set(cacheKey, cachedDecision);
        
        this.logger.debug('Returning cached decision', { organizationId, externalCommentId, platform, accountRef });
        return cachedDecision;
      }
      
      const startTime = Date.now();
      
      // Step 1: Load Shield settings from database
      const shieldSettings = await this.loadShieldSettings(organizationId, platform);
      
      // Step 2: Input processing and validation
      const processedInput = await this.processInput({
        organizationId,
        userId,
        platform,
        accountRef,
        externalCommentId,
        externalAuthorId,
        externalAuthorUsername,
        originalText,
        toxicityAnalysis,
        userConfiguration,
        metadata
      });
      
      // Step 3: Get offender history for recidivism analysis
      const offenderHistory = await this.persistenceService.getOffenderHistory(
        organizationId,
        platform,
        externalAuthorId
      );
      
      // Step 4: Apply decision logic with database settings
      const decision = await this.applyDecisionLogic(
        processedInput,
        offenderHistory,
        shieldSettings
      );
      
      // Step 5: Record decision and update persistence layer
      if (decision.action !== 'publish_normal') {
        await this.recordDecision(processedInput, decision, offenderHistory);
      }
      
      // Step 6: Cache decision for idempotency with size management
      decision.processingTimeMs = Date.now() - startTime;
      
      // Check cache size and evict if necessary
      if (this.decisionCache.size >= this.cacheMaxSize) {
        this.evictOldestCacheEntries();
      }
      
      this.decisionCache.set(cacheKey, decision);
      
      this.logger.info('Decision made', {
        organizationId,
        externalCommentId,
        action: decision.action,
        reason: decision.reason,
        processingTimeMs: decision.processingTimeMs,
        cacheSize: this.decisionCache.size
      });
      
      return decision;
      
    } catch (error) {
      this.logger.error('Decision engine failed', {
        organizationId,
        externalCommentId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Process and validate input data
   */
  async processInput(input) {
    const {
      organizationId,
      userId,
      platform,
      accountRef,
      externalCommentId,
      externalAuthorId,
      externalAuthorUsername,
      originalText,
      toxicityAnalysis,
      userConfiguration,
      metadata
    } = input;
    
    // Validate required fields
    if (!organizationId || !platform || !externalCommentId || !externalAuthorId) {
      throw new Error('Missing required decision input fields');
    }
    
    if (!toxicityAnalysis || typeof toxicityAnalysis.toxicity_score !== 'number') {
      throw new Error('Invalid toxicity analysis data');
    }
    
    // Extract toxicity data
    const toxicityScore = Math.max(0, Math.min(1, toxicityAnalysis.toxicity_score));
    const toxicityLabels = toxicityAnalysis.toxicity_labels || [];
    const primaryCategory = this.determinePrimaryCategory(toxicityLabels);
    
    // Extract user configuration
    const userRedLines = userConfiguration.redLines || {};
    const userAggressiveness = userConfiguration.aggressiveness || this.thresholds.aggressiveness;
    const autoApprove = userConfiguration.autoApprove || false;
    
    return {
      organizationId,
      userId,
      platform,
      accountRef,
      externalCommentId,
      externalAuthorId,
      externalAuthorUsername,
      originalText,
      toxicityScore,
      toxicityLabels,
      primaryCategory,
      userRedLines,
      userAggressiveness,
      autoApprove,
      metadata: {
        ...metadata,
        confidence: toxicityAnalysis.confidence || 0.8,
        model: toxicityAnalysis.model || 'perspective'
      }
    };
  }
  
  /**
   * Apply core decision logic with database settings
   */
  async applyDecisionLogic(input, offenderHistory, shieldSettings = null) {
    const {
      toxicityScore,
      toxicityLabels,
      primaryCategory,
      userRedLines,
      userAggressiveness,
      autoApprove,
      externalAuthorId
    } = input;
    
    // Normalize offender history to prevent TypeErrors
    const history = {
      isRecidivist: false,
      totalOffenses: 0,
      escalationLevel: 0,
      averageToxicity: 0,
      ...(offenderHistory || {})
    };
    
    // Use database settings if available, otherwise fall back to legacy user aggressiveness
    const adjustedThresholds = shieldSettings
      ? this.getThresholdsFromSettings(shieldSettings)
      : this.adjustThresholds(userAggressiveness);

    // Check user-defined red lines first
    const redLineViolation = this.checkRedLineViolations(toxicityLabels, primaryCategory, userRedLines, input.originalText, toxicityScore);
    if (redLineViolation) {
      return this.createDecision({
        action: 'shield_action_critical',
        reason: `User red line violated: ${redLineViolation}`,
        severity: 'critical',
        toxicityScore,
        primaryCategory,
        escalationLevel: this.calculateEscalationLevel(history),
        requiresHumanReview: true,
        autoExecute: !autoApprove,
        metadata: { redLineViolation, userDefined: true }
      });
    }

    // Apply escalation based on recidivism
    const escalationAdjustment = this.calculateRecidivismAdjustment(history);
    const adjustedScore = Math.min(1.0, toxicityScore + escalationAdjustment);

    // Critical threshold - immediate severe action
    if (adjustedScore >= adjustedThresholds.critical) {
      return this.createDecision({
        action: 'shield_action_critical',
        reason: 'Critical toxicity detected',
        severity: 'critical',
        toxicityScore: adjustedScore,
        primaryCategory,
        escalationLevel: this.calculateEscalationLevel(history),
        requiresHumanReview: true,
        autoExecute: !autoApprove,
        suggestedActions: ['block_user', 'report_content', 'escalate_to_human'],
        metadata: { 
          originalScore: toxicityScore, 
          escalationAdjustment,
          isRepeatOffender: !!history.isRecidivist
        }
      });
    }
    
    // High threshold - moderate Shield action
    if (adjustedScore >= adjustedThresholds.high) {
      return this.createDecision({
        action: 'shield_action_moderate',
        reason: 'High toxicity requiring moderation',
        severity: 'high',
        toxicityScore: adjustedScore,
        primaryCategory,
        escalationLevel: this.calculateEscalationLevel(history),
        requiresHumanReview: false,
        autoExecute: !autoApprove,
        suggestedActions: this.getSuggestedActions('high', primaryCategory, history),
        metadata: { 
          originalScore: toxicityScore, 
          escalationAdjustment,
          isRepeatOffender: !!history.isRecidivist
        }
      });
    }
    
    // Moderate threshold - roastable content
    if (adjustedScore >= adjustedThresholds.moderate) {
      return this.createDecision({
        action: 'roastable_comment',
        reason: 'Content suitable for roasting',
        severity: 'moderate',
        toxicityScore: adjustedScore,
        primaryCategory,
        escalationLevel: 0,
        requiresHumanReview: false,
        autoExecute: true,
        suggestedActions: ['generate_roast', 'monitor_user'],
        metadata: { 
          originalScore: toxicityScore,
          escalationAdjustment,
          roastingEnabled: true
        }
      });
    }
    
    // Corrective threshold - first strike with guidance
    if (adjustedScore >= adjustedThresholds.corrective) {
      const correctiveMessage = this.selectCorrectiveMessage(primaryCategory, history);
      
      return this.createDecision({
        action: 'corrective_zone',
        reason: 'Content needs corrective guidance',
        severity: 'low',
        toxicityScore: adjustedScore,
        primaryCategory,
        escalationLevel: 0,
        requiresHumanReview: false,
        autoExecute: true,
        suggestedActions: ['send_corrective_message', 'track_behavior'],
        correctiveMessage,
        metadata: { 
          originalScore: toxicityScore,
          escalationAdjustment,
          firstStrike: !history.isRecidivist
        }
      });
    }
    
    // Below all thresholds - publish normally
    return this.createDecision({
      action: 'publish_normal',
      reason: 'Content within acceptable limits',
      severity: 'none',
      toxicityScore: adjustedScore,
      primaryCategory: 'none',
      escalationLevel: 0,
      requiresHumanReview: false,
      autoExecute: true,
      suggestedActions: [],
      metadata: { 
        originalScore: toxicityScore,
        escalationAdjustment
      }
    });
  }
  
  /**
   * Check user-defined red line violations
   */
  checkRedLineViolations(toxicityLabels, primaryCategory, userRedLines, originalText = '', toxicityScore = 0) {
    // Check category-specific red lines (case-insensitive)
    if (userRedLines.categories) {
      // Normalize categories to lowercase for comparison
      const normalizedRedLineCategories = userRedLines.categories.map(cat => cat.toLowerCase());
      
      // Check all toxicity labels (with null safety)
      if (toxicityLabels && Array.isArray(toxicityLabels)) {
        for (const category of toxicityLabels) {
          if (normalizedRedLineCategories.includes(category.toLowerCase())) {
            return `category:${category}`;
          }
        }
      }
      
      // Also check primary category if provided
      if (primaryCategory && normalizedRedLineCategories.includes(primaryCategory.toLowerCase())) {
        return `category:${primaryCategory}`;
      }
    }
    
    // Check keyword-based red lines
    if (userRedLines.keywords && userRedLines.keywords.length > 0) {
      const originalTextLower = (originalText || '').toLowerCase();
      for (const keyword of userRedLines.keywords) {
        // Escape special regex characters
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // For keywords with special characters, use lookaround instead of \b
        // as \b doesn't work well with non-word characters
        const hasSpecialChars = /[^\w\s]/.test(keyword);
        
        const pattern = hasSpecialChars 
          ? `(?<![\\w])${escapedKeyword}(?![\\w])`  // Negative lookahead/lookbehind
          : `\\b${escapedKeyword}\\b`;              // Standard word boundary
          
        const regex = new RegExp(pattern, 'i');
        
        if (regex.test(originalText || '')) {
          return `keyword:${keyword}`;
        }
      }
    }
    
    // Check threshold-based red lines
    if (userRedLines.toxicityThreshold && 
        typeof userRedLines.toxicityThreshold === 'number' &&
        toxicityScore >= userRedLines.toxicityThreshold) {
      return `threshold:${userRedLines.toxicityThreshold}`;
    }
    
    return null;
  }
  
  /**
   * Calculate recidivism adjustment to toxicity score
   */
  calculateRecidivismAdjustment(offenderHistory) {
    // Defensive defaults for incomplete history objects
    const history = {
      isRecidivist: false,
      totalOffenses: 0,
      escalationLevel: 0,
      averageToxicity: 0,
      maxToxicity: 0,
      riskLevel: 'low',
      lastOffenseAt: null,
      recentActionsSummary: {},
      ...offenderHistory
    };
    
    if (!history.isRecidivist) {
      return 0; // No adjustment for first-time offenders
    }
    
    const totalOffenses = history.totalOffenses || 0;
    const escalationLevel = history.escalationLevel || 0;
    const avgToxicity = history.averageToxicity || 0;
    
    // Base adjustment: 0.02 per offense (max 0.08)
    let adjustment = Math.min(0.08, totalOffenses * 0.02);
    
    // Additional adjustment for escalation level (small)
    adjustment += escalationLevel * 0.01;
    
    // Bonus adjustment for high average toxicity
    if (avgToxicity >= 0.8) {
      adjustment += 0.03;
    }
    
    return Math.min(0.12, adjustment); // Cap at 0.12 total adjustment
  }
  
  /**
   * Calculate escalation level for decision
   */
  calculateEscalationLevel(offenderHistory) {
    // Defensive defaults for incomplete history objects
    const history = {
      isRecidivist: false,
      totalOffenses: 0,
      escalationLevel: 0,
      averageToxicity: 0,
      maxToxicity: 0,
      riskLevel: 'low',
      lastOffenseAt: null,
      recentActionsSummary: {},
      ...offenderHistory
    };
    
    if (!history.isRecidivist) {
      return 0;
    }
    
    const totalOffenses = history.totalOffenses || 0;
    const existingLevel = history.escalationLevel || 0;
    
    // Escalation levels: 0-5
    // 0: First offense
    // 1-2: Early repeat offenses
    // 3-4: Persistent offender
    // 5: Critical repeat offender
    
    if (totalOffenses >= 10) return 5;
    if (totalOffenses >= 7) return 4;
    if (totalOffenses >= 5) return 3;
    if (totalOffenses >= 3) return 2;
    if (totalOffenses >= 2) return 1;
    
    return Math.max(existingLevel, Math.min(5, Math.floor(totalOffenses / 2)));
  }
  
  /**
   * Get suggested actions based on severity and context
   */
  getSuggestedActions(severity, primaryCategory, history) {
    const baseActions = {
      critical: ['block_user', 'report_content', 'escalate_to_human'],
      high: ['timeout_user', 'hide_comment', 'warn_user'],
      moderate: ['warn_user', 'monitor_user'],
      low: ['track_behavior']
    };
    
    let actions = [...(baseActions[severity] || [])];
    
    // Add category-specific actions
    if (primaryCategory === 'threat' || primaryCategory === 'harassment') {
      actions.unshift('report_content');
    }
    
    // Add recidivism-based escalations (with defensive defaults)
    const historyDefaults = { isRecidivist: false, totalOffenses: 0, ...history };
    if (historyDefaults.isRecidivist && historyDefaults.totalOffenses >= 3) {
      if (!actions.includes('escalate_to_human')) {
        actions.push('escalate_to_human');
      }
    }
    
    return [...new Set(actions)]; // Remove duplicates
  }
  
  /**
   * Select appropriate corrective message
   */
  selectCorrectiveMessage(primaryCategory, history) {
    // Defensive defaults for incomplete history objects
    const historyDefaults = { 
      isRecidivist: false, 
      totalOffenses: 0, 
      ...history 
    };
    
    // Choose message pool based on primary category
    let messagePool = this.correctiveMessages.general;
    
    if (this.correctiveMessages[primaryCategory]) {
      messagePool = this.correctiveMessages[primaryCategory];
    }
    
    // For repeat offenders, use more direct messaging
    if (historyDefaults.isRecidivist && historyDefaults.totalOffenses >= 2) {
      messagePool = this.correctiveMessages.harassment; // More firm tone
    }
    
    // Guard against empty message pools
    if (!messagePool || messagePool.length === 0) {
      this.logger.warn('Empty corrective message pool', { primaryCategory });
      return 'Su comportamiento no es apropiado. Por favor, mantenga un tono respetuoso.';
    }
    
    // Select random message from pool
    const randomIndex = Math.floor(Math.random() * messagePool.length);
    return messagePool[randomIndex];
  }
  
  /**
   * Adjust thresholds based on user aggressiveness setting
   */
  adjustThresholds(aggressiveness) {
    const baseThresholds = this.thresholds.toxicity;
    
    // Clamp aggressiveness to valid range [0.90, 1.00]
    const clampedAggressiveness = Math.max(0.90, Math.min(1.00, aggressiveness));
    
    // Symmetric adjustment around 0.95
    // 0.90 = more lenient (higher thresholds needed to trigger)
    // 0.95 = baseline (no adjustment)
    // 1.00 = stricter (lower thresholds to trigger more easily)
    const adjustment = (0.95 - clampedAggressiveness) * 0.2; // -0.1 to +0.01 range
    
    return {
      critical: Math.max(0.85, Math.min(1.0, baseThresholds.critical + adjustment)),
      high: Math.max(0.80, Math.min(1.0, baseThresholds.high + adjustment)),
      moderate: Math.max(0.75, Math.min(1.0, baseThresholds.moderate + adjustment)),
      corrective: Math.max(0.70, Math.min(1.0, baseThresholds.corrective + adjustment))
    };
  }
  
  /**
   * Determine primary toxicity category
   */
  determinePrimaryCategory(toxicityLabels) {
    if (!toxicityLabels || toxicityLabels.length === 0) {
      return 'general';
    }
    
    // Priority order for categories
    const categoryPriority = [
      'threat', 'harassment', 'hate', 'severe_toxicity',
      'insult', 'profanity', 'toxicity', 'spam'
    ];
    
    for (const category of categoryPriority) {
      if (toxicityLabels.some(label => 
        label.toLowerCase().includes(category.toLowerCase()))) {
        return category;
      }
    }
    
    return toxicityLabels[0]?.toLowerCase() || 'general';
  }
  
  /**
   * Create standardized decision object
   */
  createDecision({
    action,
    reason,
    severity,
    toxicityScore,
    primaryCategory,
    escalationLevel,
    requiresHumanReview,
    autoExecute,
    suggestedActions = [],
    correctiveMessage = null,
    metadata = {}
  }) {
    return {
      action,
      reason,
      severity,
      toxicityScore,
      primaryCategory,
      escalationLevel,
      requiresHumanReview,
      autoExecute,
      suggestedActions,
      correctiveMessage,
      timestamp: new Date().toISOString(),
      version: '1.0',
      metadata
    };
  }
  
  /**
   * Record decision in persistence layer
   */
  async recordDecision(input, decision, offenderHistory) {
    try {
      // Only record Shield events for actionable decisions
      if (decision.action === 'publish_normal') {
        return;
      }
      
      const eventData = {
        organizationId: input.organizationId,
        userId: input.userId,
        platform: input.platform,
        accountRef: input.accountRef,
        externalCommentId: input.externalCommentId,
        externalAuthorId: input.externalAuthorId,
        externalAuthorUsername: input.externalAuthorUsername,
        originalText: decision.action.startsWith('shield_action') ? input.originalText : null, // Only store text for Shield actions
        toxicityScore: decision.toxicityScore,
        toxicityLabels: input.toxicityLabels,
        actionTaken: decision.action,
        actionReason: decision.reason,
        actionStatus: 'pending',
        actionDetails: {
          severity: decision.severity,
          escalationLevel: decision.escalationLevel,
          suggestedActions: decision.suggestedActions,
          correctiveMessage: decision.correctiveMessage,
          requiresHumanReview: decision.requiresHumanReview,
          autoExecute: decision.autoExecute
        },
        processedBy: 'shield_decision_engine',
        processingTimeMs: decision.processingTimeMs || 0,
        metadata: {
          ...decision.metadata,
          decisionVersion: decision.version,
          offenderHistory: {
            isRecidivist: !!offenderHistory?.isRecidivist,
            totalOffenses: offenderHistory?.totalOffenses || 0,
            riskLevel: offenderHistory?.riskLevel || 'low',
            escalationLevel: offenderHistory?.escalationLevel || 0
          }
        }
      };
      
      const recordedEvent = await this.persistenceService.recordShieldEvent(eventData);
      
      this.logger.debug('Decision recorded in persistence layer', {
        eventId: recordedEvent.id,
        organizationId: input.organizationId,
        action: decision.action
      });
      
      return recordedEvent;
      
    } catch (error) {
      this.logger.error('Failed to record decision', {
        organizationId: input.organizationId,
        externalCommentId: input.externalCommentId,
        error: error.message
      });
      // Don't throw - decision recording failure shouldn't fail the main decision
    }
  }
  
  /**
   * Generate cache key for idempotency
   */
  generateCacheKey(organizationId, externalCommentId, platform = '', accountRef = '') {
    const keyData = `${organizationId}:${platform}:${accountRef}:${externalCommentId}`;

    if (!this.idempotencySecret) {
      // Use fallback behavior for non-production or when secret is not set
      return crypto.createHash('sha256').update(keyData).digest('hex');
    }

    // Use HMAC with secret to prevent cross-platform ID collisions
    return crypto
      .createHmac('sha256', this.idempotencySecret)
      .update(keyData)
      .digest('hex');
  }
  
  /**
   * Evict LRU (Least Recently Used) cache entries when cache is full
   */
  evictOldestCacheEntries() {
    const entriesToRemove = this.cacheEvictionBatchSize;
    const keys = Array.from(this.decisionCache.keys());
    
    // In Map, insertion order = last used order (due to LRU re-insertion)
    // So first entries are least recently used
    for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
      this.decisionCache.delete(keys[i]);
    }
    
    this.logger.debug('Evicted LRU cache entries', {
      evicted: Math.min(entriesToRemove, keys.length),
      newSize: this.decisionCache.size,
      cacheMaxSize: this.cacheMaxSize
    });
  }
  
  /**
   * Clear decision cache (for testing or manual cleanup)
   */
  clearCache() {
    this.decisionCache.clear();
    this.logger.debug('Decision cache cleared');
  }
  
  /**
   * Get decision statistics
   */
  getDecisionStats() {
    return {
      cacheSize: this.decisionCache.size,
      thresholds: this.thresholds,
      correctiveMessagePools: Object.keys(this.correctiveMessages).reduce((acc, key) => {
        acc[key] = this.correctiveMessages[key].length;
        return acc;
      }, {})
    };
  }
  
  /**
   * Deep merge objects to prevent data loss
   */
  deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    if (!target || typeof target !== 'object') return source;
    
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Update configuration with deep merge to prevent data loss
   */
  updateConfiguration(newConfig) {
    if (newConfig.thresholds) {
      // Deep merge thresholds to prevent dropping existing keys
      this.thresholds = this.deepMerge(this.thresholds, newConfig.thresholds);
    }
    
    if (newConfig.correctiveMessages) {
      // Merge corrective messages, preserving existing pools
      Object.keys(newConfig.correctiveMessages).forEach(key => {
        if (Array.isArray(newConfig.correctiveMessages[key])) {
          this.correctiveMessages[key] = newConfig.correctiveMessages[key];
        }
      });
    }
    
    // Update cache settings if provided
    if (newConfig.cacheMaxSize !== undefined) {
      this.cacheMaxSize = newConfig.cacheMaxSize;
    }
    
    if (newConfig.cacheEvictionBatchSize !== undefined) {
      this.cacheEvictionBatchSize = newConfig.cacheEvictionBatchSize;
    }
    
    this.logger.info('Decision engine configuration updated', {
      newThresholds: this.thresholds,
      cacheMaxSize: this.cacheMaxSize,
      messagePoolSizes: Object.keys(this.correctiveMessages).reduce((acc, key) => {
        acc[key] = this.correctiveMessages[key].length;
        return acc;
      }, {})
    });
  }

  /**
   * Load Shield settings from database for organization and platform
   */
  async loadShieldSettings(organizationId, platform) {
    try {
      // Check if settingsService is properly initialized
      if (!this.settingsService || typeof this.settingsService.getEffectiveSettings !== 'function') {
        this.logger.warn('ShieldSettingsService not available, will use legacy thresholds');
        return null;
      }

      // Load effective settings (with inheritance) for the platform
      const effectiveSettings = await this.settingsService.getEffectiveSettings(organizationId, platform);

      this.logger.debug('Loaded Shield settings from database', {
        organizationId,
        platform,
        aggressiveness: effectiveSettings.aggressiveness,
        shield_enabled: effectiveSettings.shield_enabled,
        source: effectiveSettings.source
      });

      return effectiveSettings;

    } catch (error) {
      this.logger.warn('Failed to load Shield settings from database, will use legacy thresholds', {
        organizationId,
        platform,
        error: error.message
      });

      // Return null to fall back to legacy threshold adjustment
      return null;
    }
  }
  
  /**
   * Get decision thresholds from Shield settings
   */
  getThresholdsFromSettings(shieldSettings) {
    const tauRoastLower = shieldSettings.tau_roast_lower || 0.85;
    const tauShield = shieldSettings.tau_shield || 0.95;

    // Calculate moderate threshold as midpoint between high and critical
    const moderateThreshold = shieldSettings.tau_moderate || 0.90;

    return {
      critical: shieldSettings.tau_critical || 0.98,
      high: tauShield,
      moderate: moderateThreshold,
      corrective: tauRoastLower
    };
  }

  /**
   * Initialize idempotency secret with environment validation
   */
  initializeIdempotencySecret() {
    const secret = process.env.IDEMPOTENCY_SECRET;

    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('IDEMPOTENCY_SECRET environment variable is required in production');
    }

    if (!secret) {
      // In non-production, log warning and return null for fallback behavior
      if (this.logger) {
        this.logger.warn('IDEMPOTENCY_SECRET not set - using fallback cache key generation');
      }
      return null;
    }

    return secret;
  }
}

module.exports = ShieldDecisionEngine;