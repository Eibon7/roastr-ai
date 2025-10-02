const express = require('express');
const router = express.Router();
const triageService = require('../services/triageService');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const rateLimit = require('express-rate-limit');

/**
 * Rate limiting for Triage API endpoints
 * More restrictive than general API since triage analysis is computationally expensive
 */
const triageRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each organization to 100 triage requests per windowMs
  message: {
    error: 'Too many triage requests, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by organization ID for multi-tenant isolation
    return `triage_${req.organization?.id || req.ip}`;
  }
});

/**
 * More restrictive rate limit for stats endpoint
 */
const statsRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per 5 minutes
  message: {
    error: 'Too many stats requests, please try again later',
    retryAfter: '5 minutes'
  },
  keyGenerator: (req) => {
    return `triage_stats_${req.organization?.id || req.ip}`;
  }
});

/**
 * POST /api/triage/analyze
 * 
 * Analyze a comment and get triage routing decision
 * 
 * Body parameters:
 * - content (required): Comment content to analyze
 * - platform (optional): Source platform (twitter, youtube, etc.)
 * - metadata (optional): Additional context for analysis
 * - user_preferences (optional): User-specific preferences for analysis
 * 
 * Returns:
 * - action: 'publish', 'roast', 'block', 'defer', 'skip', 'error'
 * - reasoning: Human-readable explanation of decision
 * - toxicity_score: Numerical toxicity score (0.0-1.0)
 * - plan_threshold: Threshold used for this organization's plan
 * - shield_decision: Shield system decision (if applicable)
 * - correlation_id: Unique ID for tracking and debugging
 * - metadata: Performance and analysis metadata
 */
router.post('/analyze', authenticateToken, triageRateLimit, async (req, res) => {
  const correlationId = `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { content, platform, metadata, user_preferences } = req.body;
    const { organization, user } = req;

    // Input validation
    if (!content || typeof content !== 'string') {
      logger.warn('Triage API: Invalid content provided', {
        correlation_id: correlationId,
        organization_id: organization?.id,
        user_id: user?.id,
        content_type: typeof content,
        content_length: content?.length
      });
      
      return res.status(400).json({
        success: false,
        error: 'Content is required and must be a string',
        error_code: 'INVALID_CONTENT',
        correlation_id: correlationId
      });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Content cannot be empty',
        error_code: 'EMPTY_CONTENT',
        correlation_id: correlationId
      });
    }

    if (content.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Content exceeds maximum length limit (10,000 characters)',
        error_code: 'CONTENT_TOO_LONG',
        correlation_id: correlationId
      });
    }

    // Create comment object for analysis
    const comment = {
      id: `api-${correlationId}`,
      content: content.trim(),
      platform: platform || 'api',
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      source: 'api_request'
    };

    // Enrich user context with preferences
    const enrichedUser = user ? {
      ...user,
      preferences: {
        ...user.preferences,
        ...user_preferences
      }
    } : null;

    logger.info('Triage API: Starting analysis', {
      correlation_id: correlationId,
      organization_id: organization.id,
      user_id: user?.id,
      content_length: content.length,
      platform: platform || 'api',
      plan: organization.plan
    });

    // Perform triage analysis
    const startTime = Date.now();
    const decision = await triageService.analyzeAndRoute(
      comment, 
      organization, 
      enrichedUser,
      {
        api_request: true,
        correlation_id: correlationId
      }
    );
    const totalTime = Date.now() - startTime;

    logger.info('Triage API: Analysis completed', {
      correlation_id: correlationId,
      organization_id: organization.id,
      user_id: user?.id,
      decision: decision.action,
      toxicity_score: decision.toxicity_score,
      total_time_ms: totalTime,
      cache_hit: decision.cache_stats?.hits > 0
    });

    // Return successful response
    res.json({
      success: true,
      decision: {
        action: decision.action,
        reasoning: decision.reasoning,
        toxicity_score: decision.toxicity_score,
        confidence: decision.confidence,
        plan: decision.plan,
        plan_threshold: decision.plan_threshold,
        shield_decision: decision.shield_decision,
        timestamp: decision.timestamp,
        correlation_id: decision.correlation_id,
        user_preferences: decision.user_preferences,
        fallback_used: decision.fallback_used || false
      },
      metadata: {
        comment_id: comment.id,
        platform: comment.platform,
        analysis_time_ms: decision.decision_time_ms,
        total_time_ms: totalTime,
        cache_performance: decision.cache_stats
      }
    });

  } catch (error) {
    logger.error('Triage API: Analysis failed', {
      correlation_id: correlationId,
      organization_id: req.organization?.id,
      user_id: req.user?.id,
      error: error.message,
      stack: error.stack,
      request_body: {
        content_length: req.body.content?.length,
        platform: req.body.platform
      }
    });

    // Return error response with appropriate status code
    const statusCode = error.message.includes('limit') ? 429 :
                      error.message.includes('validation') ? 400 :
                      error.message.includes('permission') ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      error: 'Failed to analyze comment',
      error_code: 'ANALYSIS_FAILED',
      message: error.message,
      correlation_id: correlationId,
      retry_after: statusCode === 429 ? 900 : undefined // 15 minutes for rate limit
    });
  }
});

/**
 * GET /api/triage/stats
 * 
 * Get triage decision statistics and performance metrics
 * 
 * Query parameters:
 * - time_range (optional): '1h', '24h', '7d', '30d' (default: '1h')
 * - include_cache (optional): Include cache performance stats (default: false)
 * 
 * Returns:
 * - decision_counts: Breakdown of decisions by type
 * - performance_metrics: Analysis timing and throughput
 * - cache_performance: Hit/miss ratios and efficiency
 * - plan_distribution: Decisions by organization plan
 * - error_rates: Error frequency and types
 */
router.get('/stats', authenticateToken, statsRateLimit, async (req, res) => {
  const correlationId = `stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { time_range = '1h', include_cache = 'false' } = req.query;
    const { organization, user } = req;

    // Validate time_range parameter
    const validTimeRanges = ['1h', '24h', '7d', '30d'];
    if (!validTimeRanges.includes(time_range)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid time_range parameter',
        error_code: 'INVALID_TIME_RANGE',
        valid_options: validTimeRanges,
        correlation_id: correlationId
      });
    }

    logger.info('Triage API: Stats request', {
      correlation_id: correlationId,
      organization_id: organization.id,
      user_id: user?.id,
      time_range,
      include_cache: include_cache === 'true'
    });

    // Get stats from triage service
    const stats = await triageService.getTriageStats(organization.id, time_range);

    // Enrich with additional metadata
    const enrichedStats = {
      ...stats,
      organization: {
        id: organization.id,
        plan: organization.plan
      },
      request_info: {
        time_range,
        requested_at: new Date().toISOString(),
        correlation_id: correlationId
      }
    };

    // Conditionally include cache stats
    if (include_cache === 'true') {
      enrichedStats.cache_performance = stats.cache_performance;
    } else {
      delete enrichedStats.cache_performance;
    }

    logger.debug('Triage API: Stats retrieved', {
      correlation_id: correlationId,
      organization_id: organization.id,
      time_range,
      stats_keys: Object.keys(enrichedStats)
    });

    res.json({
      success: true,
      stats: enrichedStats,
      correlation_id: correlationId
    });

  } catch (error) {
    logger.error('Triage API: Stats request failed', {
      correlation_id: correlationId,
      organization_id: req.organization?.id,
      user_id: req.user?.id,
      error: error.message,
      stack: error.stack,
      query_params: req.query
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve triage statistics',
      error_code: 'STATS_FAILED',
      message: error.message,
      correlation_id: correlationId
    });
  }
});

/**
 * POST /api/triage/batch
 * 
 * Analyze multiple comments in a single request
 * Useful for bulk processing and efficiency
 * 
 * Body parameters:
 * - comments (required): Array of comment objects to analyze
 *   - Each comment must have: content, platform (optional), metadata (optional)
 * - options (optional): Global options for all comments
 * 
 * Returns:
 * - results: Array of triage decisions for each comment
 * - summary: Aggregate statistics for the batch
 * - performance: Batch processing metrics
 */
router.post('/batch', authenticateToken, triageRateLimit, async (req, res) => {
  const correlationId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { comments, options = {} } = req.body;
    const { organization, user } = req;

    // Input validation
    if (!Array.isArray(comments)) {
      return res.status(400).json({
        success: false,
        error: 'Comments must be an array',
        error_code: 'INVALID_COMMENTS_FORMAT',
        correlation_id: correlationId
      });
    }

    if (comments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one comment is required',
        error_code: 'EMPTY_COMMENTS_ARRAY',
        correlation_id: correlationId
      });
    }

    if (comments.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 comments per batch request',
        error_code: 'BATCH_SIZE_EXCEEDED',
        correlation_id: correlationId
      });
    }

    logger.info('Triage API: Batch analysis started', {
      correlation_id: correlationId,
      organization_id: organization.id,
      user_id: user?.id,
      comment_count: comments.length,
      plan: organization.plan
    });

    const startTime = Date.now();
    const results = [];
    const errors = [];

    // Process each comment
    for (let i = 0; i < comments.length; i++) {
      const commentData = comments[i];
      
      try {
        // Validate individual comment
        if (!commentData.content || typeof commentData.content !== 'string') {
          errors.push({
            index: i,
            error: 'Invalid content',
            comment_id: commentData.id || `comment_${i}`
          });
          continue;
        }

        // Create comment object
        const comment = {
          id: commentData.id || `batch-${correlationId}-${i}`,
          content: commentData.content.trim(),
          platform: commentData.platform || 'api',
          metadata: { ...(commentData.metadata || {}), batch_index: i },
          created_at: new Date().toISOString(),
          source: 'batch_api_request'
        };

        // Perform analysis
        const decision = await triageService.analyzeAndRoute(
          comment, 
          organization, 
          user,
          {
            ...options,
            batch_request: true,
            correlation_id: correlationId,
            batch_index: i
          }
        );

        results.push({
          index: i,
          comment_id: comment.id,
          ...decision
        });

      } catch (commentError) {
        logger.error('Triage API: Batch comment analysis failed', {
          correlation_id: correlationId,
          comment_index: i,
          error: commentError.message
        });

        errors.push({
          index: i,
          error: commentError.message,
          comment_id: commentData.id || `comment_${i}`
        });
      }
    }

    const totalTime = Date.now() - startTime;

    // Generate summary statistics
    const summary = {
      total_comments: comments.length,
      successful_analyses: results.length,
      failed_analyses: errors.length,
      decisions: {
        publish: results.filter(r => r.action === 'publish').length,
        roast: results.filter(r => r.action === 'roast').length,
        block: results.filter(r => r.action === 'block').length,
        defer: results.filter(r => r.action === 'defer').length,
        skip: results.filter(r => r.action === 'skip').length
      },
      average_toxicity: results.length > 0 
        ? results.reduce((sum, r) => sum + (r.toxicity_score || 0), 0) / results.length 
        : 0,
      shield_actions: results.filter(r => r.shield_decision).length
    };

    logger.info('Triage API: Batch analysis completed', {
      correlation_id: correlationId,
      organization_id: organization.id,
      ...summary,
      total_time_ms: totalTime,
      avg_time_per_comment: totalTime / comments.length
    });

    res.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary,
      performance: {
        total_time_ms: totalTime,
        average_time_per_comment: totalTime / comments.length,
        comments_per_second: totalTime > 0 ? (comments.length / totalTime) * 1000 : 0
      },
      correlation_id: correlationId
    });

  } catch (error) {
    logger.error('Triage API: Batch analysis failed', {
      correlation_id: correlationId,
      organization_id: req.organization?.id,
      user_id: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process batch analysis',
      error_code: 'BATCH_ANALYSIS_FAILED',
      message: error.message,
      correlation_id: correlationId
    });
  }
});

/**
 * POST /api/triage/cache/clear
 * 
 * Clear the triage decision cache
 * Useful for testing and when configuration changes
 * Restricted to admin users only
 */
router.post('/cache/clear', authenticateToken, async (req, res) => {
  const correlationId = `cache-clear-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { organization, user } = req;

    // Check if user has admin permissions
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin permissions required to clear cache',
        error_code: 'INSUFFICIENT_PERMISSIONS',
        correlation_id: correlationId
      });
    }

    logger.info('Triage API: Cache clear requested', {
      correlation_id: correlationId,
      organization_id: organization.id,
      user_id: user.id,
      user_role: user.role
    });

    // Clear the cache
    triageService.clearCache();

    logger.info('Triage API: Cache cleared successfully', {
      correlation_id: correlationId,
      organization_id: organization.id,
      user_id: user.id
    });

    res.json({
      success: true,
      message: 'Triage cache cleared successfully',
      timestamp: new Date().toISOString(),
      correlation_id: correlationId
    });

  } catch (error) {
    logger.error('Triage API: Cache clear failed', {
      correlation_id: correlationId,
      organization_id: req.organization?.id,
      user_id: req.user?.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      error_code: 'CACHE_CLEAR_FAILED',
      message: error.message,
      correlation_id: correlationId
    });
  }
});

module.exports = router;