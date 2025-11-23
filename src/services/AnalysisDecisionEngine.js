/**
 * Analysis Decision Engine
 *
 * Core decision-making component for the Analysis Department.
 * Combines Gatekeeper (security) and Perspective (toxicity) results
 * to determine routing direction and action tags.
 *
 * Issue #632: Unified Analysis Department (Gatekeeper + Perspective)
 *
 * Decision Matrix:
 * 1. MALICIOUS (injection only) → SHIELD without report
 * 2. Threat ≥0.8 (only) → SHIELD with report
 * 3. MALICIOUS + Threat → SHIELD with report
 * 4. Toxicity ≥ τ_critical → SHIELD with reincidence
 * 5. τ_shield ≤ score < τ_critical → SHIELD
 * 6. Zona correctiva → ROAST correctivo
 * 7. τ_roast_lower ≤ score < τ_shield → ROAST
 * 8. POSITIVE classification → PUBLISH
 * 9. score < τ_roast_lower → PUBLISH
 *
 * @class AnalysisDecisionEngine
 */

const { logger } = require('../utils/logger');

class AnalysisDecisionEngine {
  constructor(options = {}) {
    // Default thresholds (can be overridden by user config)
    this.defaultThresholds = {
      roast_lower: 0.3, // Minimum roastable threshold
      roast_upper: 0.84, // Maximum roastable threshold
      shield: 0.85, // Shield activation threshold
      critical: 0.95 // Critical action threshold
    };

    this.options = options;
  }

  /**
   * Determine routing direction and action tags
   * @param {Object} gatekeeperResult - Result from Gatekeeper service
   * @param {Object} perspectiveResult - Result from Perspective API
   * @param {Object} userContext - User configuration and thresholds
   * @returns {Object} Unified decision with direction, action_tags, metadata
   */
  async determineDirection(gatekeeperResult, perspectiveResult, userContext = {}) {
    const startTime = Date.now();

    // Get effective thresholds (user overrides or defaults)
    const thresholds = this.getEffectiveThresholds(userContext);

    // Extract scores from perspective result
    const perspectiveData = this.extractPerspectiveData(perspectiveResult);
    const gatekeeperData = this.extractGatekeeperData(gatekeeperResult);

    // Detect platform violations (threat, identity attack, harassment)
    const platformViolations = this.detectPlatformViolations(perspectiveData);

    // Calculate combined risk score
    const combinedScores = this.calculateCombinedScores(
      gatekeeperData,
      perspectiveData,
      userContext
    );

    // Apply decision matrix
    const decision = this.applyDecisionMatrix(
      gatekeeperData,
      perspectiveData,
      platformViolations,
      combinedScores,
      thresholds,
      userContext
    );

    // Add processing metadata
    decision.analysis = {
      timestamp: new Date().toISOString(),
      services_used: this.getServicesUsed(gatekeeperResult, perspectiveResult),
      processing_time_ms: Date.now() - startTime,
      fallback_used: gatekeeperData.fallback || perspectiveData.fallback
    };

    logger.debug('Decision Engine: Decision complete', {
      direction: decision.direction,
      action_tags: decision.action_tags,
      platform_violations: platformViolations.has_violations,
      processing_time: decision.analysis.processing_time_ms
    });

    return decision;
  }

  /**
   * Extract Gatekeeper data from result or fulfilled promise
   */
  extractGatekeeperData(result) {
    // Handle Promise.allSettled format
    if (result?.status === 'fulfilled') {
      result = result.value;
    }

    // Handle failed promise
    if (result?.status === 'rejected') {
      logger.warn('Gatekeeper failed, using conservative fallback classification', {
        error: result.reason?.message
      });
      // SECURITY FIX (CodeRabbit Review #634): Conservative fallback
      // When Gatekeeper unavailable, default to MALICIOUS to prevent
      // prompt injections from passing through during service outages.
      // This prevents the security gap that Issue #632 aims to close.
      return {
        classification: 'MALICIOUS', // Conservative default
        is_prompt_injection: true, // Treat as potential threat
        injection_score: 0.5, // Moderate risk indicator
        injection_patterns: [],
        injection_categories: ['fallback_mode'],
        fallback: true,
        fallback_reason: 'Gatekeeper unavailable - conservative classification applied'
      };
    }

    // Valid result
    return {
      classification: result?.classification || 'NEUTRAL',
      is_prompt_injection: result?.isPromptInjection || false,
      injection_score: result?.injectionScore || 0,
      injection_patterns: result?.injectionPatterns || [],
      injection_categories: result?.injectionCategories || [],
      fallback: false
    };
  }

  /**
   * Extract Perspective data from result or fulfilled promise
   */
  extractPerspectiveData(result) {
    // Handle Promise.allSettled format
    if (result?.status === 'fulfilled') {
      result = result.value;
    }

    // Handle failed promise
    if (result?.status === 'rejected') {
      logger.warn('Perspective failed, using fallback scores', {
        error: result.reason?.message
      });
      return {
        toxicity_score: 0.1, // Conservative default to prevent false escalations on API failures
        threat_score: 0,
        identity_attack_score: 0,
        insult_score: 0,
        profanity_score: 0,
        severe_toxicity_score: 0,
        flagged_categories: [],
        fallback: true
      };
    }

    // Valid result
    const scores = result?.scores || {};
    return {
      toxicity_score: scores.toxicity || 0,
      threat_score: scores.threat || 0,
      identity_attack_score: scores.identityAttack || 0,
      insult_score: scores.insult || 0,
      profanity_score: scores.profanity || 0,
      severe_toxicity_score: scores.severeToxicity || 0,
      flagged_categories: result?.categories || [],
      fallback: false
    };
  }

  /**
   * Detect platform violations (ToS violations that must be reported)
   * @param {Object} perspectiveData - Perspective toxicity scores
   * @returns {Object} Platform violations metadata
   */
  detectPlatformViolations(perspectiveData) {
    const violations = [];

    // Physical threats (≥0.8)
    if (perspectiveData.threat_score >= 0.8) {
      violations.push('physical_threat');
    }

    // Identity attacks (≥0.8)
    if (perspectiveData.identity_attack_score >= 0.8) {
      violations.push('identity_attack');
    }

    // Severe toxicity/harassment (≥0.95)
    if (perspectiveData.severe_toxicity_score >= 0.95) {
      violations.push('harassment');
    }

    return {
      has_violations: violations.length > 0,
      violation_types: violations,
      reportable: violations.length > 0
    };
  }

  /**
   * Calculate combined risk scores
   */
  calculateCombinedScores(gatekeeperData, perspectiveData, userContext) {
    // Security risk (injection)
    const security_risk = gatekeeperData.injection_score;

    // Toxicity risk (base Perspective score)
    const original_toxicity = perspectiveData.toxicity_score;

    // Combined risk: max of security and toxicity
    const combined_risk = Math.max(security_risk, original_toxicity);

    // Final toxicity (can be adjusted by persona, reincidence, etc.)
    const final_toxicity = this.adjustToxicityScore(original_toxicity, userContext);

    return {
      final_toxicity,
      original_toxicity,
      security_risk,
      combined_risk
    };
  }

  /**
   * Adjust toxicity score based on user context
   * (Placeholder for persona adjustment, reincidence, etc.)
   */
  adjustToxicityScore(toxicityScore, userContext) {
    let adjusted = toxicityScore;

    // TODO: Add persona adjustment (Issue #595)
    // if (userContext.persona) {
    //   adjusted = applyPersonaAdjustment(adjusted, userContext.persona);
    // }

    // TODO: Add reincidence adjustment
    // if (userContext.reincidenceFactor) {
    //   adjusted += userContext.reincidenceFactor;
    // }

    return Math.min(adjusted, 1.0); // Cap at 1.0
  }

  /**
   * Apply decision matrix logic
   */
  applyDecisionMatrix(
    gatekeeperData,
    perspectiveData,
    platformViolations,
    combinedScores,
    thresholds,
    userContext
  ) {
    const { classification, is_prompt_injection, fallback } = gatekeeperData;
    const { final_toxicity } = combinedScores;

    // RULE 0: Gatekeeper fallback mode - Conservative SHIELD
    // (CodeRabbit Review #634 - Explicit fallback handling)
    if (fallback && gatekeeperData.fallback_reason) {
      logger.info('Gatekeeper fallback detected - forcing conservative SHIELD', {
        fallback_reason: gatekeeperData.fallback_reason,
        final_toxicity
      });

      return this.createShieldDecision(
        gatekeeperData.fallback_reason,
        ['hide_comment', 'require_manual_review', 'gatekeeper_unavailable'],
        'critical',
        gatekeeperData,
        perspectiveData,
        platformViolations,
        combinedScores,
        thresholds,
        userContext
      );
    }

    // RULE 0.5: Brand Safety - Sponsor Protection (Issue #859)
    if (userContext.sponsorMatch?.matched) {
      const sponsor = userContext.sponsorMatch.sponsor;

      logger.info('Brand Safety: Sponsor mention detected in toxic comment', {
        sponsor: sponsor.name,
        severity: sponsor.severity,
        matchType: userContext.sponsorMatch.matchType,
        final_toxicity
      });

      // Zero tolerance sponsors: immediate SHIELD
      if (sponsor.severity === 'zero_tolerance') {
        return this.createShieldDecision(
          'Brand Safety: Zero Tolerance Sponsor Violation',
          ['hide_comment', 'block_user', 'sponsor_protection', ...sponsor.actions],
          'critical',
          gatekeeperData,
          perspectiveData,
          platformViolations,
          combinedScores,
          thresholds,
          userContext,
          {
            brand_safety: {
              sponsor: sponsor.name,
              severity: sponsor.severity,
              tone: sponsor.tone,
              matchType: userContext.sponsorMatch.matchType
            }
          }
        );
      }

      // Other severities: Adjust toxicity threshold to make SHIELD more sensitive
      const severityAdjustment = {
        high: -0.2, // Lower threshold by 0.2 (more sensitive)
        medium: -0.1, // Lower threshold by 0.1
        low: -0.05 // Minimal adjustment
      };

      const adjustment = severityAdjustment[sponsor.severity] || 0;
      const adjustedThreshold = thresholds.tau_shield + adjustment;

      // If adjusted threshold triggers SHIELD
      if (final_toxicity >= adjustedThreshold) {
        return this.createShieldDecision(
          `Brand Safety: ${sponsor.severity} sponsor protection triggered`,
          ['hide_comment', 'sponsor_protection', ...sponsor.actions],
          'high',
          gatekeeperData,
          perspectiveData,
          platformViolations,
          combinedScores,
          thresholds,
          userContext,
          {
            brand_safety: {
              sponsor: sponsor.name,
              severity: sponsor.severity,
              tone: sponsor.tone,
              matchType: userContext.sponsorMatch.matchType,
              threshold_adjustment: adjustment
            }
          }
        );
      }

      // If not SHIELD-worthy but sponsor has def_roast or agg_roast actions
      if (sponsor.actions.includes('def_roast') || sponsor.actions.includes('agg_roast')) {
        // Mark for defensive roast generation
        combinedScores.brand_safety_roast = true;
        combinedScores.sponsor_tone = sponsor.tone;
        combinedScores.sponsor_name = sponsor.name;
      }
    }

    // RULE 1: MALICIOUS classification (prompt injection)
    if (classification === 'MALICIOUS' || is_prompt_injection) {
      // Check if there are ALSO platform violations
      if (platformViolations.has_violations) {
        // BOTH injection + threat/hate → SHIELD with report
        return this.createShieldDecision(
          'MALICIOUS + Platform Violation',
          ['hide_comment', 'block_user', 'report_to_platform', 'check_reincidence'],
          'critical',
          gatekeeperData,
          perspectiveData,
          platformViolations,
          combinedScores,
          thresholds,
          userContext
        );
      } else {
        // ONLY injection → SHIELD without report
        return this.createShieldDecision(
          'Prompt injection detected',
          ['hide_comment', 'block_user', 'check_reincidence'],
          'critical',
          gatekeeperData,
          perspectiveData,
          platformViolations,
          combinedScores,
          thresholds,
          userContext
        );
      }
    }

    // RULE 2: Platform violations (threat/hate) WITHOUT injection
    if (platformViolations.has_violations) {
      return this.createShieldDecision(
        `Platform violation: ${platformViolations.violation_types.join(', ')}`,
        ['hide_comment', 'block_user', 'report_to_platform'],
        'critical',
        gatekeeperData,
        perspectiveData,
        platformViolations,
        combinedScores,
        thresholds,
        userContext
      );
    }

    // RULE 3: Critical toxicity (≥τ_critical)
    if (final_toxicity >= thresholds.critical) {
      return this.createShieldDecision(
        'Critical toxicity level',
        ['hide_comment', 'block_user', 'check_reincidence'],
        'critical',
        gatekeeperData,
        perspectiveData,
        platformViolations,
        combinedScores,
        thresholds,
        userContext
      );
    }

    // RULE 4: Shield zone (τ_shield ≤ score < τ_critical)
    if (final_toxicity >= thresholds.shield && final_toxicity < thresholds.critical) {
      const actionTags = ['hide_comment'];

      // Add report if user is recidivist
      if (userContext.reincidenceFactor && userContext.reincidenceFactor > 0.05) {
        actionTags.push('report_to_platform');
      }

      return this.createShieldDecision(
        'High toxicity requiring moderation',
        actionTags,
        'high',
        gatekeeperData,
        perspectiveData,
        platformViolations,
        combinedScores,
        thresholds,
        userContext
      );
    }

    // RULE 5: Corrective zone (detected insulting content but with valid argument)
    if (this.isCorrectiveZone(perspectiveData, final_toxicity, thresholds)) {
      return this.createRoastDecision(
        'Corrective roast appropriate',
        ['roast_correctivo', 'add_strike_1', 'check_reincidence'],
        'medium',
        'correctivo',
        gatekeeperData,
        perspectiveData,
        platformViolations,
        combinedScores,
        thresholds,
        userContext
      );
    }

    // RULE 6: Roastable zone (τ_roast_lower ≤ score < τ_shield)
    if (final_toxicity >= thresholds.roast_lower && final_toxicity < thresholds.shield) {
      const roastStyle = this.determineRoastStyle(final_toxicity, thresholds);
      const autoApprove = userContext.autoApprove !== false; // Default true

      return this.createRoastDecision(
        'Roastable content detected',
        [roastStyle, autoApprove ? 'auto_approve' : 'require_approval'],
        'medium',
        roastStyle.replace('roast_', ''), // soft, balanced, hard
        gatekeeperData,
        perspectiveData,
        platformViolations,
        combinedScores,
        thresholds,
        userContext
      );
    }

    // RULE 7: Positive content
    if (classification === 'POSITIVE') {
      return this.createPublishDecision(
        'Positive content',
        ['publish_normal'],
        'none',
        gatekeeperData,
        perspectiveData,
        platformViolations,
        combinedScores,
        thresholds,
        userContext
      );
    }

    // RULE 8: Low toxicity (< τ_roast_lower)
    return this.createPublishDecision(
      'Low toxicity, safe to publish',
      ['publish_normal'],
      'none',
      gatekeeperData,
      perspectiveData,
      platformViolations,
      combinedScores,
      thresholds,
      userContext
    );
  }

  /**
   * Create SHIELD decision
   */
  createShieldDecision(
    reason,
    actionTags,
    severity,
    gatekeeperData,
    perspectiveData,
    platformViolations,
    combinedScores,
    thresholds,
    userContext,
    extraMetadata = {} // Issue #859: Brand Safety metadata
  ) {
    return {
      direction: 'SHIELD',
      action_tags: actionTags,
      metadata: {
        security: {
          classification: gatekeeperData.classification,
          is_prompt_injection: gatekeeperData.is_prompt_injection,
          injection_score: gatekeeperData.injection_score,
          injection_patterns: gatekeeperData.injection_patterns,
          injection_categories: gatekeeperData.injection_categories
        },
        toxicity: {
          toxicity_score: perspectiveData.toxicity_score,
          threat_score: perspectiveData.threat_score,
          identity_attack_score: perspectiveData.identity_attack_score,
          insult_score: perspectiveData.insult_score,
          profanity_score: perspectiveData.profanity_score,
          severe_toxicity_score: perspectiveData.severe_toxicity_score,
          flagged_categories: perspectiveData.flagged_categories
        },
        ...extraMetadata, // Issue #859: Brand Safety - Merge extra metadata
        decision: {
          severity_level: severity,
          primary_reason: reason,
          secondary_reasons: [],
          thresholds_used: thresholds,
          persona_adjusted: false, // TODO: Set to true when persona adjustment logic is implemented
          reincidence_factor: userContext.reincidenceFactor || 0
        },
        platform_violations: platformViolations
      },
      scores: combinedScores
    };
  }

  /**
   * Create ROAST decision
   */
  createRoastDecision(
    reason,
    actionTags,
    severity,
    roastStyle,
    gatekeeperData,
    perspectiveData,
    platformViolations,
    combinedScores,
    thresholds,
    userContext
  ) {
    // Issue #859: Brand Safety - Include sponsor metadata if roasting with defensive tone
    const metadata = {
      security: {
        classification: gatekeeperData.classification,
        is_prompt_injection: gatekeeperData.is_prompt_injection,
        injection_score: gatekeeperData.injection_score,
        injection_patterns: [],
        injection_categories: []
      },
      toxicity: {
        toxicity_score: perspectiveData.toxicity_score,
        threat_score: perspectiveData.threat_score,
        identity_attack_score: perspectiveData.identity_attack_score,
        insult_score: perspectiveData.insult_score,
        profanity_score: perspectiveData.profanity_score,
        severe_toxicity_score: perspectiveData.severe_toxicity_score,
        flagged_categories: perspectiveData.flagged_categories
      },
      decision: {
        severity_level: severity,
        primary_reason: reason,
        secondary_reasons: [],
        thresholds_used: thresholds,
        persona_adjusted: false, // TODO: Set to true when persona adjustment logic is implemented
        reincidence_factor: userContext.reincidenceFactor || 0,
        roast_style: roastStyle
      },
      platform_violations: platformViolations
    };

    // Issue #859: Add brand_safety metadata if sponsor protection roast is requested
    if (combinedScores.brand_safety_roast) {
      metadata.brand_safety = {
        sponsor: combinedScores.sponsor_name,
        tone: combinedScores.sponsor_tone,
        defensive_roast: true
      };
    }

    return {
      direction: 'ROAST',
      action_tags: actionTags,
      metadata,
      scores: combinedScores
    };
  }

  /**
   * Create PUBLISH decision
   */
  createPublishDecision(
    reason,
    actionTags,
    severity,
    gatekeeperData,
    perspectiveData,
    platformViolations,
    combinedScores,
    thresholds,
    userContext
  ) {
    return {
      direction: 'PUBLISH',
      action_tags: actionTags,
      metadata: {
        security: {
          classification: gatekeeperData.classification,
          is_prompt_injection: gatekeeperData.is_prompt_injection,
          injection_score: gatekeeperData.injection_score,
          injection_patterns: [],
          injection_categories: []
        },
        toxicity: {
          toxicity_score: perspectiveData.toxicity_score,
          threat_score: perspectiveData.threat_score,
          identity_attack_score: perspectiveData.identity_attack_score,
          insult_score: perspectiveData.insult_score,
          profanity_score: perspectiveData.profanity_score,
          severe_toxicity_score: perspectiveData.severe_toxicity_score,
          flagged_categories: perspectiveData.flagged_categories
        },
        decision: {
          severity_level: severity,
          primary_reason: reason,
          secondary_reasons: [],
          thresholds_used: thresholds,
          persona_adjusted: false, // TODO: Set to true when persona adjustment logic is implemented
          reincidence_factor: userContext.reincidenceFactor || 0
        },
        platform_violations: platformViolations
      },
      scores: combinedScores
    };
  }

  /**
   * Check if comment is in corrective zone
   * (Insulting but may have valid argument)
   */
  isCorrectiveZone(perspectiveData, toxicityScore, thresholds) {
    // Corrective zone criteria:
    // 1. Insult score ≥ 0.7
    // 2. Toxicity score in range [0.70, 0.84]
    // 3. Not in critical/severe category
    return (
      perspectiveData.insult_score >= 0.7 &&
      toxicityScore >= 0.7 &&
      toxicityScore < thresholds.shield &&
      perspectiveData.severe_toxicity_score < 0.8
    );
  }

  /**
   * Determine roast style based on toxicity score
   */
  determineRoastStyle(toxicityScore, thresholds) {
    const roastRange = thresholds.shield - thresholds.roast_lower;

    // Guard against division by zero or negative range
    if (roastRange <= 0) {
      logger.warn('Invalid roast range (shield ≤ roast_lower), defaulting to roast_balanced', {
        shield: thresholds.shield,
        roast_lower: thresholds.roast_lower,
        roastRange
      });
      return 'roast_balanced';
    }

    const normalizedScore = (toxicityScore - thresholds.roast_lower) / roastRange;

    if (normalizedScore < 0.33) return 'roast_soft';
    if (normalizedScore < 0.67) return 'roast_balanced';
    return 'roast_hard';
  }

  /**
   * Get effective thresholds (user overrides or defaults)
   */
  getEffectiveThresholds(userContext) {
    return {
      roast_lower: userContext.tau_roast_lower || this.defaultThresholds.roast_lower,
      roast_upper: userContext.tau_roast_upper || this.defaultThresholds.roast_upper,
      shield: userContext.tau_shield || this.defaultThresholds.shield,
      critical: userContext.tau_critical || this.defaultThresholds.critical
    };
  }

  /**
   * Get list of services used
   */
  getServicesUsed(gatekeeperResult, perspectiveResult) {
    const services = [];

    if (gatekeeperResult?.status === 'fulfilled' || gatekeeperResult?.classification) {
      services.push('gatekeeper');
    }

    if (perspectiveResult?.status === 'fulfilled' || perspectiveResult?.scores !== undefined) {
      services.push('perspective');
    }

    return services;
  }
}

module.exports = AnalysisDecisionEngine;
