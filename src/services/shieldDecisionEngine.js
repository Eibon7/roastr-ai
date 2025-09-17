const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');
const ShieldPersistenceService = require('./shieldPersistenceService');
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
    
    // Decision cache for idempotency
    this.decisionCache = new Map();
    
    this.logger.info('Shield Decision Engine initialized', {
      thresholds: this.thresholds,
      aggressiveness: this.thresholds.aggressiveness
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
      const cacheKey = this.generateCacheKey(organizationId, externalCommentId, platform);
      if (this.decisionCache.has(cacheKey)) {
        this.logger.debug('Returning cached decision', { organizationId, externalCommentId });
        return this.decisionCache.get(cacheKey);
      }
      
      const startTime = Date.now();
      
      // Step 1: Input processing and validation
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
      
      // Step 2: Get offender history for recidivism analysis
      const offenderHistory = await this.persistenceService.getOffenderHistory(
        organizationId,
        platform,
        externalAuthorId
      );
      
      // Step 3: Apply decision logic
      const decision = await this.applyDecisionLogic(
        processedInput,
        offenderHistory
      );
      
      // Step 4: Record decision and update persistence layer
      if (decision.action !== 'publish_normal') {
        await this.recordDecision(processedInput, decision, offenderHistory);
      }
      
      // Step 5: Cache decision for idempotency
      decision.processingTimeMs = Date.now() - startTime;
      this.decisionCache.set(cacheKey, decision);
      
      this.logger.info('Decision made', {
        organizationId,
        externalCommentId,
        action: decision.action,
        reason: decision.reason,
        processingTimeMs: decision.processingTimeMs
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
   * Apply core decision logic
   */
  async applyDecisionLogic(input, offenderHistory) {
    const {
      toxicityScore,
      toxicityLabels,
      primaryCategory,
      userRedLines,
      userAggressiveness,
      autoApprove,
      externalAuthorId
    } = input;
    
    // Adjust thresholds based on user aggressiveness
    const adjustedThresholds = this.adjustThresholds(userAggressiveness);
    
    // Check user-defined red lines first
    const redLineViolation = this.checkRedLineViolations(toxicityLabels, primaryCategory, userRedLines, input.originalText, toxicityScore);
    if (redLineViolation) {
      return this.createDecision({
        action: 'shield_action_critical',
        reason: `User red line violated: ${redLineViolation}`,
        severity: 'critical',
        toxicityScore,
        primaryCategory,
        escalationLevel: this.calculateEscalationLevel(offenderHistory),
        requiresHumanReview: true,
        autoExecute: !autoApprove,
        metadata: { redLineViolation, userDefined: true }
      });
    }
    
    // Apply escalation based on recidivism
    const escalationAdjustment = this.calculateRecidivismAdjustment(offenderHistory);
    const adjustedScore = Math.min(1.0, toxicityScore + escalationAdjustment);
    
    // Critical threshold - immediate severe action
    if (adjustedScore >= adjustedThresholds.critical) {
      return this.createDecision({
        action: 'shield_action_critical',
        reason: 'Critical toxicity detected',
        severity: 'critical',
        toxicityScore: adjustedScore,
        primaryCategory,
        escalationLevel: this.calculateEscalationLevel(offenderHistory),
        requiresHumanReview: true,
        autoExecute: !autoApprove,
        suggestedActions: ['block_user', 'report_content', 'escalate_to_human'],
        metadata: { 
          originalScore: toxicityScore, 
          escalationAdjustment,
          isRepeatOffender: offenderHistory.isRecidivist
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
        escalationLevel: this.calculateEscalationLevel(offenderHistory),
        requiresHumanReview: false,
        autoExecute: !autoApprove,
        suggestedActions: this.getSuggestedActions('high', primaryCategory, offenderHistory),
        metadata: { 
          originalScore: toxicityScore, 
          escalationAdjustment,
          isRepeatOffender: offenderHistory.isRecidivist
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
      const correctiveMessage = this.selectCorrectiveMessage(primaryCategory, offenderHistory);
      
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
          firstStrike: !offenderHistory.isRecidivist
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
    // Check category-specific red lines
    if (userRedLines.categories) {
      const configured = userRedLines.categories.map(c => c.toLowerCase());
      for (const label of toxicityLabels) {
        if (configured.includes(String(label).toLowerCase())) {
          return `category:${label}`;
        }
      }
    }
    
    // Check keyword-based red lines
    if (userRedLines.keywords && userRedLines.keywords.length > 0) {
      const text = originalText || '';
      for (const keyword of userRedLines.keywords) {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'i');
        if (re.test(text)) {
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
    if (!offenderHistory.isRecidivist) {
      return 0; // No adjustment for first-time offenders
    }
    
    const totalOffenses = offenderHistory.totalOffenses || 0;
    const escalationLevel = offenderHistory.escalationLevel || 0;
    const avgToxicity = offenderHistory.averageToxicity || 0;
    
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
    if (!offenderHistory.isRecidivist) {
      return 0;
    }
    
    const totalOffenses = offenderHistory.totalOffenses || 0;
    const existingLevel = offenderHistory.escalationLevel || 0;
    
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
  getSuggestedActions(severity, primaryCategory, offenderHistory) {
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
    
    // Add recidivism-based escalations
    if (offenderHistory.isRecidivist && offenderHistory.totalOffenses >= 3) {
      if (!actions.includes('escalate_to_human')) {
        actions.push('escalate_to_human');
      }
    }
    
    return [...new Set(actions)]; // Remove duplicates
  }
  
  /**
   * Select appropriate corrective message
   */
  selectCorrectiveMessage(primaryCategory, offenderHistory) {
    // Choose message pool based on primary category
    let messagePool = this.correctiveMessages.general;
    
    if (this.correctiveMessages[primaryCategory]) {
      messagePool = this.correctiveMessages[primaryCategory];
    }
    
    // For repeat offenders, use more direct messaging
    if (offenderHistory.isRecidivist && offenderHistory.totalOffenses >= 2) {
      messagePool = this.correctiveMessages.harassment; // More firm tone
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
    
    // Aggressiveness 0.90 = more lenient (higher thresholds needed to trigger)
    // Aggressiveness 1.00 = stricter (lower thresholds to trigger more easily)
    const adjustment = (1.0 - aggressiveness) * 0.1; // 0 to 0.01 range
    
    return {
      critical: Math.max(0.92, baseThresholds.critical + adjustment),
      high: Math.max(0.87, baseThresholds.high + adjustment),
      moderate: Math.max(0.82, baseThresholds.moderate + adjustment),
      corrective: Math.max(0.77, baseThresholds.corrective + adjustment)
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
      'threat', 'harassment', 'identity_attack', 'hate', 'severe_toxicity',
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
            isRecidivist: offenderHistory.isRecidivist,
            totalOffenses: offenderHistory.totalOffenses,
            riskLevel: offenderHistory.riskLevel,
            escalationLevel: offenderHistory.escalationLevel
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
  generateCacheKey(organizationId, externalCommentId, platform = '') {
    const secret = process.env.IDEMPOTENCY_SECRET || '';
    return crypto
      .createHash('sha256')
      .update(`${secret}:${organizationId}:${platform}:${externalCommentId}`)
      .digest('hex');
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
   * Update configuration
   */
  updateConfiguration(newConfig) {
    if (newConfig.thresholds) {
      this.thresholds = { ...this.thresholds, ...newConfig.thresholds };
    }
    
    if (newConfig.correctiveMessages) {
      this.correctiveMessages = { ...this.correctiveMessages, ...newConfig.correctiveMessages };
    }
    
    this.logger.info('Decision engine configuration updated', {
      newThresholds: this.thresholds,
      messagePoolSizes: Object.keys(this.correctiveMessages).reduce((acc, key) => {
        acc[key] = this.correctiveMessages[key].length;
        return acc;
      }, {})
    });
  }
}

module.exports = ShieldDecisionEngine;