const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const planLimitsService = require('../services/planLimitsService');

// Enhanced secure in-memory cache for analytics data (Issue #164)
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL
const MAX_CACHE_SIZE = 1000; // Maximum cache entries

// Issue #164: Secure cache key generation using SHA-256 hashing
const getCacheKey = (endpoint, userId, params) => {
  // Create a normalized string that includes all relevant cache parameters
  const keyData = {
    endpoint,
    userId,
    params: params || {}
  };

  // Convert to JSON and create SHA-256 hash to prevent sensitive data exposure
  const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
  const hash = crypto.createHash('sha256').update(keyString).digest('hex');

  // Use first 32 characters for shorter keys while maintaining security
  return `analytics_${hash.substring(0, 32)}`;
};

const getCachedData = (key) => {
  const cached = analyticsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  analyticsCache.delete(key); // Remove expired entry
  return null;
};

// Issue #164: LRU cache eviction policy for better memory management
const setCachedData = (key, data) => {
  // Implement LRU eviction when cache is full
  if (analyticsCache.size >= MAX_CACHE_SIZE) {
    // Find and remove the oldest entry (LRU eviction)
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [cacheKey, cacheValue] of analyticsCache.entries()) {
      if (cacheValue.timestamp < oldestTime) {
        oldestTime = cacheValue.timestamp;
        oldestKey = cacheKey;
      }
    }

    if (oldestKey) {
      analyticsCache.delete(oldestKey);
      logger.debug('LRU cache eviction', {
        evictedKey: oldestKey,
        cacheSize: analyticsCache.size,
        evictedAge: Date.now() - oldestTime
      });
    }
  }

  // Set cache entry with current timestamp
  analyticsCache.set(key, {
    data,
    timestamp: Date.now(),
    accessCount: 1
  });
};

// Clear cache function for testing
const clearCache = () => {
  analyticsCache.clear();
};

const router = express.Router();

// Issue #164: Unified plan validation logic
const PLAN_LIMITS = {
  free: {
    maxLimit: 100,
    rateLimit: 10
  },
  pro: {
    maxLimit: 1000,
    rateLimit: 50
  },
  creator_plus: {
    maxLimit: 5000,
    rateLimit: 200
  }
};

/**
 * Validate and normalize plan ID
 * @param {string} planId - Plan ID to validate
 * @returns {string} Normalized plan ID or 'starter_trial' as default
 */
const validatePlanId = (planId) => {
  if (!planId || typeof planId !== 'string') {
    return 'starter_trial';
  }

  const normalizedPlan = planId.toLowerCase().trim();
  return PLAN_LIMITS.hasOwnProperty(normalizedPlan) ? normalizedPlan : 'starter_trial';
};

/**
 * Get plan-based limits for a given plan
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Plan limits object
 */
const getPlanLimits = async (planId) => {
  try {
    const validatedPlan = validatePlanId(planId);
    const limits = await planLimitsService.getPlanLimits(validatedPlan);

    // Map to analytics format
    return {
      maxLimit: limits.monthlyResponsesLimit,
      maxTimeRange: validatedPlan === 'starter_trial' ? 30 : validatedPlan === 'pro' ? 90 : 365,
      allowedFilters:
        validatedPlan === 'starter_trial' ? ['platform'] : ['platform', 'date_range', 'sentiment'],
      rateLimit: validatedPlan === 'starter_trial' ? 10 : validatedPlan === 'pro' ? 60 : 300
    };
  } catch (error) {
    logger.error('Failed to get plan limits from database:', error);
    // Fallback to hardcoded limits
    const validatedPlan = validatePlanId(planId);
    return PLAN_LIMITS[validatedPlan] || PLAN_LIMITS.free;
  }
};

// Issue #164: Robust input type validation
/**
 * Validate and sanitize integer input
 * @param {any} value - Input value to validate
 * @param {number} defaultValue - Default value if invalid
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Validated integer
 */
const validateInteger = (
  value,
  defaultValue,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER
) => {
  // Handle null, undefined, empty string
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  // Try to parse as integer
  const parsed = parseInt(value, 10);

  // Check if parsing was successful and value is a valid number
  if (isNaN(parsed) || !isFinite(parsed)) {
    logger.warn('Invalid integer input received', {
      value,
      type: typeof value,
      defaultUsed: defaultValue
    });
    return defaultValue;
  }

  // Apply min/max constraints
  return Math.min(Math.max(parsed, min), max);
};

/**
 * Validate string input with length constraints
 * @param {any} value - Input value to validate
 * @param {string} defaultValue - Default value if invalid
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Validated string
 */
const validateString = (value, defaultValue = '', maxLength = 1000) => {
  if (typeof value !== 'string') {
    logger.warn('Invalid string input received', {
      value,
      type: typeof value,
      defaultUsed: defaultValue
    });
    return defaultValue;
  }

  // Trim whitespace and apply length constraint
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) : trimmed;
};

// Rate limiting for analytics endpoints to prevent abuse (Issue #162)
const { ipKeyGenerator } = require('express-rate-limit');
const analyticsRateLimit = require('express-rate-limit')({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    // Issue #164: Use unified plan validation for rate limits
    const userPlan = req.user?.plan || 'starter_trial';
    // Note: Rate limiter doesn't support async, so use static limits
    const rateLimits = {
      starter_trial: 10,
      starter: 10,
      pro: 60,
      plus: 300, // was creator_plus (Issue #842 plan restructuring)
      custom: 300
    };
    return rateLimits[userPlan] ?? rateLimits.starter_trial;
  },
  message: {
    success: false,
    error: 'Too many analytics requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `analytics:${ipKeyGenerator(req)}:${req.user?.id || 'anonymous'}`,
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  }
});

// All routes require authentication
router.use(authenticateToken);

// Apply rate limiting to analytics endpoints
router.use(analyticsRateLimit);

/**
 * GET /api/analytics/config-performance
 * Get performance analytics for platform configurations
 */
router.get('/config-performance', async (req, res) => {
  try {
    const { user } = req;
    const {
      days = 30,
      platform = null,
      group_by = 'day', // day, week, month
      limit = 1000, // Max records to fetch
      offset = 0 // Pagination offset
    } = req.query;

    // Get user's organization
    const { data: orgData } = await supabaseServiceClient
      .from('organizations')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!orgData) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));

    // Validate and constrain pagination parameters
    const maxLimit = 5000; // Maximum allowed limit
    const sanitizedLimit = Math.min(parseInt(limit) || 1000, maxLimit);
    const sanitizedOffset = Math.max(parseInt(offset) || 0, 0);

    // Get response data with engagement metrics (with pagination)
    let query = supabaseServiceClient
      .from('responses')
      .select(
        `
                id,
                tone,
                // Issue #868: Removed humor_type,
                created_at,
                post_status,
                platform_response_id,
                tokens_used,
                cost_cents,
                comments!inner (
                    platform,
                    toxicity_score,
                    severity_level,
                    created_at
                )
            `
      )
      .eq('organization_id', orgData.id)
      .gte('created_at', dateThreshold.toISOString())
      .order('created_at', { ascending: false })
      .range(sanitizedOffset, sanitizedOffset + sanitizedLimit - 1);

    if (platform) {
      query = query.eq('comments.platform', platform);
    }

    const { data: responses, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate performance metrics
    const analytics = {
      summary: {
        total_responses: responses.length,
        successful_posts: responses.filter((r) => r.platform_response_id).length,
        total_cost_cents: responses.reduce((sum, r) => sum + (r.cost_cents || 0), 0),
        total_tokens: responses.reduce((sum, r) => sum + (r.tokens_used || 0), 0),
        avg_toxicity_score:
          responses.length > 0
            ? (
                responses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) /
                responses.length
              ).toFixed(3)
            : 0
      },
      by_tone: {},
      // Issue #868: Removed by_humor_type,
      by_platform: {},
      by_severity: {},
      timeline: []
    };

    // Group by tone
    const toneGroups = responses.reduce((acc, r) => {
      const tone = r.tone || 'unknown';
      if (!acc[tone]) {
        acc[tone] = [];
      }
      acc[tone].push(r);
      return acc;
    }, {});

    Object.entries(toneGroups).forEach(([tone, toneResponses]) => {
      analytics.by_tone[tone] = {
        count: toneResponses.length,
        success_rate:
          toneResponses.length > 0
            ? (
                (toneResponses.filter((r) => r.platform_response_id).length /
                  toneResponses.length) *
                100
              ).toFixed(1)
            : 0,
        avg_cost_cents:
          toneResponses.length > 0
            ? (
                toneResponses.reduce((sum, r) => sum + (r.cost_cents || 0), 0) /
                toneResponses.length
              ).toFixed(2)
            : 0,
        avg_tokens:
          toneResponses.length > 0
            ? Math.round(
                toneResponses.reduce((sum, r) => sum + (r.tokens_used || 0), 0) /
                  toneResponses.length
              )
            : 0
      };
    });

    // Issue #868: Removed humor type grouping (deprecated)

    // Group by platform
    const platformGroups = responses.reduce((acc, r) => {
      const platform = r.comments.platform;
      if (!acc[platform]) {
        acc[platform] = [];
      }
      acc[platform].push(r);
      return acc;
    }, {});

    Object.entries(platformGroups).forEach(([platform, platformResponses]) => {
      analytics.by_platform[platform] = {
        count: platformResponses.length,
        success_rate:
          platformResponses.length > 0
            ? (
                (platformResponses.filter((r) => r.platform_response_id).length /
                  platformResponses.length) *
                100
              ).toFixed(1)
            : 0,
        avg_toxicity:
          platformResponses.length > 0
            ? (
                platformResponses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) /
                platformResponses.length
              ).toFixed(3)
            : 0
      };
    });

    // Group by severity level
    const severityGroups = responses.reduce((acc, r) => {
      const severity = r.comments.severity_level || 'unknown';
      if (!acc[severity]) {
        acc[severity] = [];
      }
      acc[severity].push(r);
      return acc;
    }, {});

    Object.entries(severityGroups).forEach(([severity, severityResponses]) => {
      analytics.by_severity[severity] = {
        count: severityResponses.length,
        percentage:
          responses.length > 0
            ? ((severityResponses.length / responses.length) * 100).toFixed(1)
            : 0
      };
    });

    // Create timeline data
    const timeGroups = responses.reduce((acc, r) => {
      let dateKey;
      const date = new Date(r.created_at);

      if (group_by === 'week') {
        // Get start of week (Sunday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        dateKey = weekStart.toISOString().split('T')[0];
      } else if (group_by === 'month') {
        dateKey = date.toISOString().substr(0, 7); // YYYY-MM
      } else {
        dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      }

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(r);
      return acc;
    }, {});

    Object.entries(timeGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, timeResponses]) => {
        analytics.timeline.push({
          date,
          count: timeResponses.length,
          successful_posts: timeResponses.filter((r) => r.platform_response_id).length,
          total_cost_cents: timeResponses.reduce((sum, r) => sum + (r.cost_cents || 0), 0),
          avg_toxicity:
            timeResponses.length > 0
              ? (
                  timeResponses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) /
                  timeResponses.length
                ).toFixed(3)
              : 0
        });
      });

    res.status(200).json({
      success: true,
      data: {
        period_days: parseInt(days),
        platform_filter: platform,
        group_by,
        analytics
      }
    });
  } catch (error) {
    logger.error('Get config performance analytics error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance analytics'
    });
  }
});

/**
 * GET /api/analytics/shield-effectiveness
 * Get Shield system effectiveness analytics
 */
router.get('/shield-effectiveness', async (req, res) => {
  try {
    const { user } = req;
    const { days = 30 } = req.query;

    // Get user's organization
    const { data: orgData } = await supabaseServiceClient
      .from('organizations')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!orgData) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));

    // Get Shield actions and user behaviors (with limits to prevent performance issues)
    const [shieldActionsResult, userBehaviorsResult] = await Promise.all([
      // Get Shield responses (responses with shield actions)
      supabaseServiceClient
        .from('responses')
        .select('*')
        .eq('organization_id', orgData.id)
        .eq('is_shield_mode', true)
        .gte('created_at', dateThreshold.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000), // Limit to prevent large result sets

      // Get user behavior data
      supabaseServiceClient
        .from('user_behaviors')
        .select('*')
        .eq('organization_id', orgData.id)
        .gte('last_seen_at', dateThreshold.toISOString())
        .order('last_seen_at', { ascending: false })
        .limit(1000) // Limit to prevent large result sets
    ]);

    if (shieldActionsResult.error) throw shieldActionsResult.error;
    if (userBehaviorsResult.error) throw userBehaviorsResult.error;

    const shieldResponses = shieldActionsResult.data;
    const userBehaviors = userBehaviorsResult.data;

    // Calculate Shield effectiveness metrics
    const shieldAnalytics = {
      total_shield_actions: shieldResponses.length,
      actions_by_type: {},
      platform_effectiveness: {},
      user_reincidence: {
        total_tracked_users: userBehaviors.length,
        blocked_users: userBehaviors.filter((u) => u.is_blocked).length,
        repeat_offenders: userBehaviors.filter((u) => u.total_violations > 3).length,
        avg_violations_per_user:
          userBehaviors.length > 0
            ? (
                userBehaviors.reduce((sum, u) => sum + u.total_violations, 0) / userBehaviors.length
              ).toFixed(1)
            : 0
      },
      severity_distribution: {},
      action_success_rate: 0
    };

    // Group Shield actions by type
    const actionGroups = shieldResponses.reduce((acc, r) => {
      const action = r.shield_action || 'unknown';
      if (!acc[action]) {
        acc[action] = 0;
      }
      acc[action]++;
      return acc;
    }, {});

    shieldAnalytics.actions_by_type = actionGroups;

    // Calculate severity distribution from user behaviors
    userBehaviors.forEach((user) => {
      const severityCounts = user.severity_counts || { low: 0, medium: 0, high: 0, critical: 0 };
      Object.entries(severityCounts).forEach(([severity, count]) => {
        if (!shieldAnalytics.severity_distribution[severity]) {
          shieldAnalytics.severity_distribution[severity] = 0;
        }
        shieldAnalytics.severity_distribution[severity] += count;
      });
    });

    // Calculate platform effectiveness
    const platformGroups = userBehaviors.reduce((acc, user) => {
      if (!acc[user.platform]) {
        acc[user.platform] = {
          total_users: 0,
          blocked_users: 0,
          total_violations: 0
        };
      }
      acc[user.platform].total_users++;
      if (user.is_blocked) {
        acc[user.platform].blocked_users++;
      }
      acc[user.platform].total_violations += user.total_violations;
      return acc;
    }, {});

    Object.entries(platformGroups).forEach(([platform, data]) => {
      shieldAnalytics.platform_effectiveness[platform] = {
        ...data,
        block_rate:
          data.total_users > 0 ? ((data.blocked_users / data.total_users) * 100).toFixed(1) : 0,
        avg_violations:
          data.total_users > 0 ? (data.total_violations / data.total_users).toFixed(1) : 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        period_days: parseInt(days),
        shield_analytics: shieldAnalytics
      }
    });
  } catch (error) {
    logger.error('Get Shield effectiveness analytics error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Shield effectiveness analytics'
    });
  }
});

/**
 * GET /api/analytics/usage-trends
 * Get usage trends and forecasting data
 */
router.get('/usage-trends', async (req, res) => {
  try {
    const { user } = req;
    const { months = 6 } = req.query;

    // Validate and constrain months parameter
    const maxMonths = 24; // Maximum 2 years of data
    const sanitizedMonths = Math.min(Math.max(parseInt(months) || 6, 1), maxMonths);

    // Get user's organization
    const { data: orgData } = await supabaseServiceClient
      .from('organizations')
      .select('id, monthly_responses_limit')
      .eq('owner_id', user.id)
      .single();

    if (!orgData) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    // Get monthly usage data (with validated limit)
    const { data: monthlyUsage, error } = await supabaseServiceClient
      .from('monthly_usage')
      .select('*')
      .eq('organization_id', orgData.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(sanitizedMonths);

    if (error) {
      throw error;
    }

    // Calculate trends
    const trends = {
      monthly_data: monthlyUsage.map((usage) => ({
        period: `${usage.year}-${String(usage.month).padStart(2, '0')}`,
        total_responses: usage.total_responses,
        limit: usage.responses_limit,
        utilization_rate:
          usage.responses_limit > 0
            ? ((usage.total_responses / usage.responses_limit) * 100).toFixed(1)
            : 0,
        total_cost_cents: usage.total_cost_cents,
        limit_exceeded: usage.limit_exceeded,
        responses_by_platform: usage.responses_by_platform || {}
      })),
      current_limit: orgData.monthly_responses_limit,
      growth_rate: 0,
      projected_usage: 0
    };

    // Calculate growth rate (if we have at least 2 months of data)
    if (monthlyUsage.length >= 2) {
      const currentMonth = monthlyUsage[0];
      const previousMonth = monthlyUsage[1];

      if (previousMonth.total_responses > 0) {
        trends.growth_rate = (
          ((currentMonth.total_responses - previousMonth.total_responses) /
            previousMonth.total_responses) *
          100
        ).toFixed(1);
      }

      // Simple projection for next month based on growth rate
      trends.projected_usage = Math.round(
        currentMonth.total_responses * (1 + parseFloat(trends.growth_rate) / 100)
      );
    }

    res.status(200).json({
      success: true,
      data: {
        period_months: parseInt(months),
        trends
      }
    });
  } catch (error) {
    logger.error('Get usage trends analytics error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage trends'
    });
  }
});

/**
 * GET /api/analytics/roastr-persona-insights
 * Get analytics on how Roastr Persona configurations impact roast generation
 * Issue #81: Roastr Persona Analytics and Insights
 */
router.get('/roastr-persona-insights', async (req, res) => {
  try {
    const { user } = req;
    const { days = 30, limit = 1000, offset = 0 } = req.query;

    // Issue #164: Use robust input type validation
    const sanitizedDays = validateInteger(days, 30, 1, 365);
    const sanitizedLimit = validateInteger(limit, 1000, 10, 5000);
    const sanitizedOffset = validateInteger(offset, 0, 0, Number.MAX_SAFE_INTEGER);

    // Issue #162: Check cache for frequently accessed data
    const cacheKey = getCacheKey('roastr-persona-insights', user.id, {
      days: sanitizedDays,
      limit: sanitizedLimit,
      offset: sanitizedOffset
    });

    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      logger.info('Returning cached Roastr Persona analytics', {
        userId: user.id,
        cacheHit: true
      });
      return res.status(200).json(cachedResult);
    }

    // Log analytics request for monitoring (Issue #162: abuse detection)
    logger.info('Roastr Persona analytics request', {
      userId: user.id,
      days: sanitizedDays,
      limit: sanitizedLimit,
      offset: sanitizedOffset,
      timestamp: new Date().toISOString()
    });

    // Get user's organization with plan information for dynamic limits
    const { data: orgData } = await supabaseServiceClient
      .from('organizations')
      .select('id, plan_id')
      .eq('owner_id', user.id)
      .single();

    if (!orgData) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    // Issue #164: Apply plan-based limits using unified validation
    const planLimits = await getPlanLimits(orgData.plan_id);
    const effectiveLimit = Math.min(sanitizedLimit, planLimits.maxLimit);

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - sanitizedDays);

    // Get user's current Roastr Persona data
    const { data: personaData } = await supabaseServiceClient
      .from('users')
      .select(
        `
                lo_que_me_define_encrypted,
                lo_que_me_define_visible,
                lo_que_me_define_created_at,
                lo_que_me_define_updated_at,
                lo_que_no_tolero_encrypted,
                lo_que_no_tolero_visible,
                lo_que_no_tolero_created_at,
                lo_que_no_tolero_updated_at,
                lo_que_me_da_igual_encrypted,
                lo_que_me_da_igual_visible,
                lo_que_me_da_igual_created_at,
                lo_que_me_da_igual_updated_at,
                embeddings_generated_at,
                embeddings_model,
                embeddings_version
            `
      )
      .eq('id', user.id)
      .single();

    // Get responses generated using Roastr Persona data (Issue #162: improved pagination)
    const { data: personaResponses, error } = await supabaseServiceClient
      .from('responses')
      .select(
        `
                id,
                tone,
                // Issue #868: Removed humor_type,
                created_at,
                post_status,
                platform_response_id,
                tokens_used,
                cost_cents,
                persona_fields_used,
                comments!inner (
                    platform,
                    toxicity_score,
                    severity_level,
                    created_at
                )
            `
      )
      .eq('organization_id', orgData.id)
      .gte('created_at', dateThreshold.toISOString())
      .not('persona_fields_used', 'is', null)
      .order('created_at', { ascending: false })
      .range(sanitizedOffset, sanitizedOffset + effectiveLimit - 1);

    if (error) {
      throw error;
    }

    // Calculate persona configuration status
    const personaStatus = {
      lo_que_me_define: {
        configured: !!personaData?.lo_que_me_define_encrypted,
        visible: personaData?.lo_que_me_define_visible || false,
        created_at: personaData?.lo_que_me_define_created_at,
        last_updated: personaData?.lo_que_me_define_updated_at
      },
      lo_que_no_tolero: {
        configured: !!personaData?.lo_que_no_tolero_encrypted,
        visible: personaData?.lo_que_no_tolero_visible || false,
        created_at: personaData?.lo_que_no_tolero_created_at,
        last_updated: personaData?.lo_que_no_tolero_updated_at
      },
      lo_que_me_da_igual: {
        configured: !!personaData?.lo_que_me_da_igual_encrypted,
        visible: personaData?.lo_que_me_da_igual_visible || false,
        created_at: personaData?.lo_que_me_da_igual_created_at,
        last_updated: personaData?.lo_que_me_da_igual_updated_at
      },
      embeddings: {
        generated: !!personaData?.embeddings_generated_at,
        generated_at: personaData?.embeddings_generated_at,
        model: personaData?.embeddings_model,
        version: personaData?.embeddings_version
      }
    };

    // Calculate persona usage analytics
    const personaAnalytics = {
      summary: {
        total_persona_responses: personaResponses.length,
        successful_posts: personaResponses.filter((r) => r.platform_response_id).length,
        total_cost_cents: personaResponses.reduce((sum, r) => sum + (r.cost_cents || 0), 0),
        total_tokens: personaResponses.reduce((sum, r) => sum + (r.tokens_used || 0), 0),
        avg_toxicity_score:
          personaResponses.length > 0
            ? (
                personaResponses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) /
                personaResponses.length
              ).toFixed(3)
            : 0
      },
      fields_usage: {
        lo_que_me_define: 0,
        lo_que_no_tolero: 0,
        lo_que_me_da_igual: 0,
        combined_fields: 0
      },
      persona_impact: {
        by_tone: {},
        by_platform: {},
        success_rate_comparison: {
          with_persona: 0,
          without_persona: 0
        }
      },
      timeline: []
    };

    // Analyze which persona fields are being used
    personaResponses.forEach((response) => {
      const fieldsUsed = response.persona_fields_used || [];
      if (fieldsUsed.includes('lo_que_me_define')) {
        personaAnalytics.fields_usage.lo_que_me_define++;
      }
      if (fieldsUsed.includes('lo_que_no_tolero')) {
        personaAnalytics.fields_usage.lo_que_no_tolero++;
      }
      if (fieldsUsed.includes('lo_que_me_da_igual')) {
        personaAnalytics.fields_usage.lo_que_me_da_igual++;
      }
      if (fieldsUsed.length > 1) {
        personaAnalytics.fields_usage.combined_fields++;
      }
    });

    // Analyze persona impact by tone
    const toneGroups = personaResponses.reduce((acc, r) => {
      const tone = r.tone || 'unknown';
      if (!acc[tone]) {
        acc[tone] = [];
      }
      acc[tone].push(r);
      return acc;
    }, {});

    Object.entries(toneGroups).forEach(([tone, toneResponses]) => {
      personaAnalytics.persona_impact.by_tone[tone] = {
        count: toneResponses.length,
        success_rate:
          toneResponses.length > 0
            ? (
                (toneResponses.filter((r) => r.platform_response_id).length /
                  toneResponses.length) *
                100
              ).toFixed(1)
            : 0,
        avg_cost_cents:
          toneResponses.length > 0
            ? (
                toneResponses.reduce((sum, r) => sum + (r.cost_cents || 0), 0) /
                toneResponses.length
              ).toFixed(2)
            : 0,
        most_used_persona_fields: getMostUsedPersonaFields(toneResponses)
      };
    });

    // Analyze persona impact by platform
    const platformGroups = personaResponses.reduce((acc, r) => {
      const platform = r.comments.platform;
      if (!acc[platform]) {
        acc[platform] = [];
      }
      acc[platform].push(r);
      return acc;
    }, {});

    Object.entries(platformGroups).forEach(([platform, platformResponses]) => {
      personaAnalytics.persona_impact.by_platform[platform] = {
        count: platformResponses.length,
        success_rate:
          platformResponses.length > 0
            ? (
                (platformResponses.filter((r) => r.platform_response_id).length /
                  platformResponses.length) *
                100
              ).toFixed(1)
            : 0,
        avg_toxicity:
          platformResponses.length > 0
            ? (
                platformResponses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) /
                platformResponses.length
              ).toFixed(3)
            : 0,
        most_active_persona_field: getMostActivePersonaField(platformResponses)
      };
    });

    // Compare success rates (would need additional query for non-persona responses)
    // This is a simplified version for now
    const successRate =
      personaResponses.length > 0
        ? (
            (personaResponses.filter((r) => r.platform_response_id).length /
              personaResponses.length) *
            100
          ).toFixed(1)
        : 0;

    personaAnalytics.persona_impact.success_rate_comparison.with_persona = successRate;

    // Create timeline for persona usage
    const timeGroups = personaResponses.reduce((acc, r) => {
      const dateKey = new Date(r.created_at).toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(r);
      return acc;
    }, {});

    Object.entries(timeGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, dayResponses]) => {
        personaAnalytics.timeline.push({
          date,
          count: dayResponses.length,
          successful_posts: dayResponses.filter((r) => r.platform_response_id).length,
          fields_usage: getFieldsUsageForDay(dayResponses),
          avg_toxicity:
            dayResponses.length > 0
              ? (
                  dayResponses.reduce((sum, r) => sum + (r.comments.toxicity_score || 0), 0) /
                  dayResponses.length
                ).toFixed(3)
              : 0
        });
      });

    const responseData = {
      success: true,
      data: {
        period_days: sanitizedDays,
        persona_status: personaStatus,
        persona_analytics: personaAnalytics,
        recommendations: generatePersonaRecommendations(personaStatus, personaAnalytics)
      }
    };

    // Issue #162: Cache the response for future requests
    setCachedData(cacheKey, responseData);

    res.status(200).json(responseData);
  } catch (error) {
    logger.error('Get Roastr Persona insights error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Roastr Persona insights'
    });
  }
});

// Helper functions for persona analytics
function getMostUsedPersonaFields(responses) {
  const fieldCount = { lo_que_me_define: 0, lo_que_no_tolero: 0, lo_que_me_da_igual: 0 };

  responses.forEach((r) => {
    const fields = r.persona_fields_used || [];
    fields.forEach((field) => {
      if (fieldCount.hasOwnProperty(field)) {
        fieldCount[field]++;
      }
    });
  });

  return Object.entries(fieldCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([field]) => field);
}

function getMostActivePersonaField(responses) {
  const fieldCount = { lo_que_me_define: 0, lo_que_no_tolero: 0, lo_que_me_da_igual: 0 };

  responses.forEach((r) => {
    const fields = r.persona_fields_used || [];
    fields.forEach((field) => {
      if (fieldCount.hasOwnProperty(field)) {
        fieldCount[field]++;
      }
    });
  });

  return Object.entries(fieldCount).sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';
}

function getFieldsUsageForDay(responses) {
  const usage = { lo_que_me_define: 0, lo_que_no_tolero: 0, lo_que_me_da_igual: 0 };

  responses.forEach((r) => {
    const fields = r.persona_fields_used || [];
    fields.forEach((field) => {
      if (usage.hasOwnProperty(field)) {
        usage[field]++;
      }
    });
  });

  return usage;
}

function generatePersonaRecommendations(personaStatus, analytics) {
  const recommendations = [];

  // Check if user should configure more persona fields
  const configuredFields = Object.values(personaStatus).filter(
    (field) => field.configured && field !== personaStatus.embeddings
  ).length;

  if (configuredFields < 2) {
    recommendations.push({
      type: 'configuration',
      priority: 'high',
      title: 'Complete your Roastr Persona',
      description: `You have ${configuredFields} of 3 persona fields configured. Complete your profile for more personalized roasts.`,
      action: 'Configure missing persona fields'
    });
  }

  // Check if embeddings need to be generated
  if (configuredFields > 0 && !personaStatus.embeddings.generated) {
    recommendations.push({
      type: 'optimization',
      priority: 'medium',
      title: 'Generate semantic embeddings',
      description: 'Enable advanced semantic matching for more contextually aware roasts.',
      action: 'Generate embeddings for your persona fields'
    });
  }

  // Check usage patterns
  if (analytics.summary.total_persona_responses > 0) {
    const successRate = parseFloat(
      (analytics.summary.successful_posts / analytics.summary.total_persona_responses) * 100
    );

    if (successRate < 70) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Improve persona effectiveness',
        description: `Your persona-enhanced roasts have a ${successRate.toFixed(1)}% success rate. Consider refining your persona fields.`,
        action: 'Review and update your persona configuration'
      });
    }
  }

  // Visibility recommendations
  const visibleFields = Object.values(personaStatus).filter(
    (field) => field.visible && field !== personaStatus.embeddings
  ).length;

  if (configuredFields > 0 && visibleFields === 0) {
    recommendations.push({
      type: 'privacy',
      priority: 'low',
      title: 'Consider making persona visible',
      description: 'Making your persona visible can help others understand your roasting style.',
      action: 'Enable visibility for some persona fields'
    });
  }

  return recommendations;
}

// Issue #715: Analytics Dashboard endpoints
const analyticsDashboardService = require('../services/analyticsDashboardService');

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard analytics data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { user } = req;
    const { range = 30, group_by = 'day', platform = 'all' } = req.query;

    const rangeDays = validateInteger(range, 30, 7, 365);
    const groupBy = validateString(group_by, 'day', 20);
    const platformFilter = validateString(platform, 'all', 50);

    const cacheKey = getCacheKey('dashboard', user.id, { rangeDays, groupBy, platformFilter });
    const cached = getCachedData(cacheKey);

    if (cached) {
      logger.debug('Returning cached dashboard data', { userId: user.id });
      return res.status(200).json(cached);
    }

    const dashboardData = await analyticsDashboardService.getDashboardData({
      user,
      rangeDays,
      groupBy,
      platformFilter
    });

    const response = {
      success: true,
      data: dashboardData
    };

    setCachedData(cacheKey, response);
    res.status(200).json(response);
  } catch (error) {
    logger.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve dashboard analytics'
    });
  }
});

/**
 * GET /api/analytics/billing
 * Get billing analytics with Polar integration
 */
router.get('/billing', async (req, res) => {
  try {
    const { user } = req;
    const { range = 90 } = req.query;

    const rangeDays = validateInteger(range, 90, 30, 365);

    const billingData = await analyticsDashboardService.getBillingAnalytics({
      user,
      rangeDays
    });

    res.status(200).json({
      success: true,
      data: billingData
    });
  } catch (error) {
    logger.error('Billing analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve billing analytics'
    });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data as CSV or JSON
 */
router.get('/export', async (req, res) => {
  try {
    const { user } = req;
    const {
      format = 'csv',
      dataset = 'snapshots',
      range = 90,
      locale = 'es-ES',
      timezone = 'UTC'
    } = req.query;

    const rangeDays = validateInteger(range, 90, 7, 365);
    const normalizedFormat = validateString(format, 'csv', 10).toLowerCase();
    const normalizedDataset = validateString(dataset, 'snapshots', 20).toLowerCase();
    const normalizedLocale = validateString(locale, 'es-ES', 10);
    const normalizedTimezone = validateString(timezone, 'UTC', 50);

    const exportResult = await analyticsDashboardService.exportAnalytics({
      user,
      format: normalizedFormat,
      dataset: normalizedDataset,
      rangeDays,
      locale: normalizedLocale,
      timezone: normalizedTimezone
    });

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.status(200).send(exportResult.body);
  } catch (error) {
    logger.error('Analytics export error:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message || 'Export failed'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export analytics data'
    });
  }
});

// Expose cache clearing function for tests
if (process.env.NODE_ENV === 'test') {
  router.__clearAnalyticsCache = clearCache;
}

module.exports = router;
