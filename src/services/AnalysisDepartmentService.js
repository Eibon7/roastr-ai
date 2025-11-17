/**
 * Analysis Department Service
 *
 * Unified service that orchestrates Gatekeeper (security) and Perspective (toxicity)
 * analysis in PARALLEL to ensure comprehensive comment analysis.
 *
 * Issue #632: Unified Analysis Department (Gatekeeper + Perspective)
 *
 * Key Features:
 * - Parallel execution of Gatekeeper + Perspective (no early returns)
 * - Robust fallback handling (if one service fails, other compensates)
 * - Unified output schema with direction, action_tags, metadata
 * - Fail-safe: defaults to SHIELD on critical errors
 *
 * @class AnalysisDepartmentService
 */

const GatekeeperService = require('./gatekeeperService');
const PerspectiveService = require('./perspective');
const AnalysisDecisionEngine = require('./AnalysisDecisionEngine');
const { logger } = require('../utils/logger');
const { mockMode } = require('../config/mockMode');

class AnalysisDepartmentService {
  constructor(options = {}) {
    this.options = options;

    // Initialize services
    this.gatekeeper = new GatekeeperService();
    this.perspective = new PerspectiveService();
    this.decisionEngine = new AnalysisDecisionEngine();

    // Performance tracking
    this.metrics = {
      totalAnalyses: 0,
      parallelSuccesses: 0,
      fallbacksUsed: 0,
      avgProcessingTime: 0
    };
  }

  /**
   * Analyze comment with parallel Gatekeeper + Perspective execution
   * @param {string} commentText - Comment text to analyze
   * @param {Object} userContext - User configuration (thresholds, persona, etc.)
   * @returns {Promise<Object>} Unified analysis decision
   */
  async analyzeComment(commentText, userContext = {}) {
    const startTime = Date.now();

    // Validate input (reject empty, non-string, and whitespace-only)
    if (typeof commentText !== 'string' || commentText.trim().length === 0) {
      throw new Error('Invalid comment text: must be a non-empty string');
    }

    logger.info('Analysis Department: Starting parallel analysis', {
      textLength: commentText.length,
      userId: userContext.userId,
      organizationId: userContext.organizationId
    });

    try {
      // PARALLEL EXECUTION: Run Gatekeeper + Perspective simultaneously
      // Using Promise.allSettled() to allow fallback if one fails
      // Issue #858: Pass userContext to Gatekeeper for prompt caching
      const [gatekeeperResult, perspectiveResult] = await Promise.allSettled([
        this.runGatekeeperAnalysis(commentText, userContext),
        this.runPerspectiveAnalysis(commentText)
      ]);

      // Log results
      this.logAnalysisResults(gatekeeperResult, perspectiveResult);

      // Check if both failed (critical failure)
      if (gatekeeperResult.status === 'rejected' && perspectiveResult.status === 'rejected') {
        logger.error('Analysis Department: BOTH services failed, applying fail-safe', {
          gatekeeperError: gatekeeperResult.reason?.message,
          perspectiveError: perspectiveResult.reason?.message
        });
        return this.failSafeDecision(commentText, userContext);
      }

      // Delegate to Decision Engine
      const decision = await this.decisionEngine.determineDirection(
        gatekeeperResult,
        perspectiveResult,
        userContext
      );

      // Update metrics
      this.updateMetrics(startTime, decision);

      logger.info('Analysis Department: Analysis complete', {
        direction: decision.direction,
        action_tags: decision.action_tags.length,
        platform_violations: decision.metadata.platform_violations.has_violations,
        processing_time_ms: Date.now() - startTime
      });

      return decision;

    } catch (error) {
      logger.error('Analysis Department: Unexpected error during analysis', {
        error: error.message,
        stack: error.stack,
        textLength: commentText.length
      });

      // Return fail-safe decision
      return this.failSafeDecision(commentText, userContext, error);
    }
  }

  /**
   * Run Gatekeeper analysis with retry logic
   * Issue #858: Updated to pass organization context for prompt caching
   */
  async runGatekeeperAnalysis(commentText, userContext = {}) {
    try {
      // Extract options for prompt caching (Issue #858)
      const options = {
        userId: userContext.userId || null,
        orgId: userContext.organizationId || null,
        plan: userContext.plan || null,
        redLines: userContext.redLines || null,
        shieldSettings: userContext.shieldSettings || null
      };

      const result = await this.gatekeeper.classifyComment(commentText, options);

      logger.debug('Gatekeeper analysis complete', {
        classification: result.classification,
        is_prompt_injection: result.isPromptInjection,
        injection_score: result.injectionScore
      });

      return result;

    } catch (error) {
      logger.warn('Gatekeeper analysis failed', {
        error: error.message,
        textLength: commentText.length
      });

      // Re-throw to be handled by Promise.allSettled
      throw error;
    }
  }

  /**
   * Run Perspective API analysis with retry logic
   */
  async runPerspectiveAnalysis(commentText) {
    try {
      const result = await this.perspective.analyzeToxicity(commentText);

      logger.debug('Perspective analysis complete', {
        toxicity_score: result.toxicityScore,
        severity: result.severity,
        categories: result.categories
      });

      return result;

    } catch (error) {
      logger.warn('Perspective analysis failed', {
        error: error.message,
        textLength: commentText.length
      });

      // Re-throw to be handled by Promise.allSettled
      throw error;
    }
  }

  /**
   * Log analysis results from both services
   */
  logAnalysisResults(gatekeeperResult, perspectiveResult) {
    const gatekeeperStatus = gatekeeperResult.status === 'fulfilled' ? '✅ Success' : '❌ Failed';
    const perspectiveStatus = perspectiveResult.status === 'fulfilled' ? '✅ Success' : '❌ Failed';

    logger.info('Analysis Department: Parallel execution complete', {
      gatekeeper: gatekeeperStatus,
      perspective: perspectiveStatus,
      both_succeeded: gatekeeperResult.status === 'fulfilled' && perspectiveResult.status === 'fulfilled'
    });

    if (gatekeeperResult.status === 'rejected') {
      logger.warn('Gatekeeper failed, using Perspective + pattern matching fallback', {
        error: gatekeeperResult.reason?.message
      });
      this.metrics.fallbacksUsed++;
    }

    if (perspectiveResult.status === 'rejected') {
      logger.warn('Perspective failed, using Gatekeeper + basic sentiment fallback', {
        error: perspectiveResult.reason?.message
      });
      this.metrics.fallbacksUsed++;
    }
  }

  /**
   * Fail-safe decision when both services fail or critical error occurs
   * @param {string} commentText - Original comment text
   * @param {Object} userContext - User configuration
   * @param {Error} error - Optional error object
   * @returns {Object} Fail-safe SHIELD decision
   */
  failSafeDecision(commentText, userContext, error = null) {
    logger.error('Analysis Department: Applying fail-safe SHIELD decision', {
      reason: error ? error.message : 'Both services failed',
      textLength: commentText.length
    });

    return {
      direction: 'SHIELD',
      action_tags: ['hide_comment', 'require_manual_review'],
      metadata: {
        security: {
          classification: 'UNKNOWN',
          is_prompt_injection: false,
          injection_score: 0,
          injection_patterns: [],
          injection_categories: []
        },
        toxicity: {
          toxicity_score: 0.5,
          threat_score: 0,
          identity_attack_score: 0,
          insult_score: 0,
          profanity_score: 0,
          severe_toxicity_score: 0,
          flagged_categories: []
        },
        decision: {
          severity_level: 'critical',
          primary_reason: 'Fail-safe: Analysis services unavailable',
          secondary_reasons: ['Both Gatekeeper and Perspective failed', 'Manual review required'],
          thresholds_used: {},
          persona_adjusted: false,
          reincidence_factor: 0
        },
        platform_violations: {
          has_violations: false,
          violation_types: [],
          reportable: false
        }
      },
      scores: {
        final_toxicity: 0.5,
        original_toxicity: 0.5,
        security_risk: 0,
        combined_risk: 0.5
      },
      analysis: {
        timestamp: new Date().toISOString(),
        services_used: [],
        processing_time_ms: 0,
        fallback_used: true,
        fail_safe: true
      }
    };
  }

  /**
   * Update performance metrics
   */
  updateMetrics(startTime, decision) {
    const processingTime = Date.now() - startTime;

    this.metrics.totalAnalyses++;

    if (!decision.analysis.fallback_used) {
      this.metrics.parallelSuccesses++;
    }

    // Update rolling average processing time
    this.metrics.avgProcessingTime =
      (this.metrics.avgProcessingTime * (this.metrics.totalAnalyses - 1) + processingTime) /
      this.metrics.totalAnalyses;
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status of all services
   */
  async getHealth() {
    const health = {
      department: 'operational',
      services: {
        gatekeeper: 'unknown',
        perspective: 'unknown',
        decisionEngine: 'operational'
      },
      metrics: this.metrics
    };

    // Check Gatekeeper health
    try {
      if (this.gatekeeper.openaiClient) {
        health.services.gatekeeper = 'operational';
      } else {
        health.services.gatekeeper = 'pattern-only';
      }
    } catch (error) {
      health.services.gatekeeper = 'degraded';
    }

    // Check Perspective health
    try {
      const perspectiveHealth = await this.perspective.healthCheck();
      health.services.perspective = perspectiveHealth.healthy ? 'operational' : 'degraded';
    } catch (error) {
      health.services.perspective = 'degraded';
    }

    // Overall department health
    if (health.services.gatekeeper === 'degraded' && health.services.perspective === 'degraded') {
      health.department = 'critical';
    } else if (health.services.gatekeeper === 'degraded' || health.services.perspective === 'degraded') {
      health.department = 'degraded';
    }

    return health;
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      fallbackRate: this.metrics.totalAnalyses > 0
        ? (this.metrics.fallbacksUsed / this.metrics.totalAnalyses * 100).toFixed(2) + '%'
        : '0%',
      successRate: this.metrics.totalAnalyses > 0
        ? (this.metrics.parallelSuccesses / this.metrics.totalAnalyses * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

module.exports = AnalysisDepartmentService;
