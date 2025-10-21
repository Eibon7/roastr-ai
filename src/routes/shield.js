/**
 * Shield API Routes
 * 
 * API endpoints for Shield automated moderation system:
 * - GET /api/shield/events - Paginated events with filtering
 * - POST /api/shield/revert/:id - Revert shield actions
 * - GET /api/shield/stats - Shield statistics
 * - GET /api/shield/config - Shield configuration
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit'); // Issue #618 - IPv6 support
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const { logger } = require('../utils/logger');

const router = express.Router();

// Rate limiting configuration
const generalShieldLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many Shield API requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator, // Issue #618 - Proper IPv6 support
  skip: (req) => process.env.NODE_ENV === 'test'
});

const revertActionLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 revert actions per window
  message: {
    error: 'Too many revert attempts. Please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator, // Issue #618 - Proper IPv6 support
  skip: (req) => process.env.NODE_ENV === 'test'
});

// Apply authentication to all Shield routes
router.use(authenticateToken);

// Apply general rate limiting
router.use(generalShieldLimit);

// ============================================================================
// GDPR COMPLIANCE HELPERS (CodeRabbit Round 5)
// ============================================================================

/**
 * Generate GDPR-compliant content hash
 * @param {string} content - Content to hash
 * @returns {string} SHA-256 hash for GDPR compliance
 */
function generateContentHash(content) {
  if (!content || typeof content !== 'string') {
    return crypto.createHash('sha256').update('').digest('hex');
  }
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Create minimal content snippet for UI display (GDPR data minimization)
 * @param {string} content - Original content
 * @param {number} maxLength - Maximum length for snippet (default 100)
 * @returns {string} Truncated content snippet
 */
function createContentSnippet(content, maxLength = 100) {
  if (!content || typeof content !== 'string') {
    return '[No content available]';
  }
  
  const trimmed = content.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  
  return trimmed.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// INPUT VALIDATION HELPERS (CodeRabbit feedback)
// ============================================================================

// Whitelisted filter parameters to prevent unexpected queries
const VALID_CATEGORIES = ['all', 'toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'];
const VALID_TIME_RANGES = ['7d', '30d', '90d', 'all'];
const VALID_PLATFORMS = ['all', 'twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'];
const VALID_ACTION_TYPES = ['all', 'block', 'mute', 'flag', 'report'];

/**
 * Validate and sanitize query parameters with enhanced security (CodeRabbit Round 6)
 * @param {Object} query - Request query parameters
 * @returns {Object} Validated parameters with comprehensive error handling
 */
function validateQueryParameters(query = {}) {
  // Enhanced null safety for query object
  const safeQuery = (query && typeof query === 'object') ? query : {};
  
  const {
    page = 1,
    limit = 20,
    category = 'all',
    timeRange = '30d',
    platform = 'all',
    actionType = 'all'
  } = safeQuery;

  // Enhanced numeric validation for pagination (CodeRabbit Round 5)
  let pageNum = 1;
  let limitNum = 20;
  
  // Strict numeric validation for page
  if (typeof page === 'number' && Number.isInteger(page) && page > 0) {
    pageNum = Math.min(1000, page); // Cap at 1000 pages
  } else if (typeof page === 'string' && /^\d+$/.test(page.trim())) {
    const parsedPage = parseInt(page.trim(), 10);
    if (parsedPage > 0) {
      pageNum = Math.min(1000, parsedPage);
    }
  }
  
  // Strict numeric validation for limit
  if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0) {
    limitNum = Math.min(100, Math.max(1, limit));
  } else if (typeof limit === 'string' && /^\d+$/.test(limit.trim())) {
    const parsedLimit = parseInt(limit.trim(), 10);
    if (parsedLimit > 0) {
      limitNum = Math.min(100, Math.max(1, parsedLimit));
    }
  }

  // Enhanced filter validation with type checking (Round 4)
  const validatedCategory = (typeof category === 'string' && VALID_CATEGORIES.includes(category.toLowerCase())) 
    ? category.toLowerCase() : 'all';
  const validatedTimeRange = (typeof timeRange === 'string' && VALID_TIME_RANGES.includes(timeRange.toLowerCase())) 
    ? timeRange.toLowerCase() : '30d';
  const validatedPlatform = (typeof platform === 'string' && VALID_PLATFORMS.includes(platform.toLowerCase())) 
    ? platform.toLowerCase() : 'all';
  const validatedActionType = (typeof actionType === 'string' && VALID_ACTION_TYPES.includes(actionType.toLowerCase())) 
    ? actionType.toLowerCase() : 'all';

  return {
    pageNum,
    limitNum,
    category: validatedCategory,
    timeRange: validatedTimeRange,
    platform: validatedPlatform,
    actionType: validatedActionType,
    isValid: true // Always valid after sanitization
  };
}

/**
 * Calculate date range based on time range parameter
 * @param {string} timeRange - Time range parameter
 * @returns {Date|null} Start date or null for 'all'
 */
function calculateDateRange(timeRange) {
  const now = new Date();
  
  switch (timeRange) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

/**
 * Sanitize response data to remove sensitive information (CodeRabbit Round 6 enhanced)
 * @param {Object|Array} data - Response data to sanitize
 * @returns {Object|Array} Sanitized data without sensitive fields
 */
function sanitizeResponseData(data) {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponseData(item));
  }

  if (typeof data === 'object' && data !== null) {
    // Enhanced: Remove multiple sensitive fields
    const { 
      organization_id, 
      content_hash, // Remove hash for additional privacy
      metadata, // Remove metadata to prevent information leakage
      ...sanitizedItem 
    } = data;
    
    // Keep only content_snippet for UI display
    return {
      ...sanitizedItem,
      // Only include safe metadata fields if needed
      metadata: metadata && typeof metadata === 'object' ? 
        { reverted: metadata.reverted || false } : {}
    };
  }

  return data;
}
/**
 * GET /api/shield/events
 * Get paginated shield events with filtering
 */
router.get('/events', async (req, res) => {
  try {
    // Enhanced input validation and sanitization (CodeRabbit Round 4)
    let validated;
    try {
      validated = validateQueryParameters(req.query);
    } catch (error) {
      logger.warn('Query parameter validation error', { 
        query: req.query, 
        error: error.message,
        userId: req.user?.id 
      });
      
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Invalid query parameters', 
          code: 'INVALID_QUERY_PARAMS',
          details: 'Query parameters could not be processed'
        }
      });
    }
    
    // Additional validation for edge cases (Round 4)
    if (!validated || typeof validated !== 'object') {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Parameter validation failed', 
          code: 'VALIDATION_FAILED',
          details: 'Could not validate request parameters'
        }
      });
    }

    // Extract validated parameters (Round 4 enhancement)
    const { pageNum, limitNum, category, timeRange, platform, actionType } = validated;
    
    // Calculate date range using helper function
    const startDate = calculateDateRange(timeRange);

    // Build query with organization isolation (RLS)
    let query = supabaseServiceClient
      .from('shield_actions')
      .select(`
        id,
        action_type,
        content_hash,
        content_snippet,
        platform,
        reason,
        created_at,
        reverted_at,
        metadata
      `, { count: 'exact' })
      .eq('organization_id', req.user.organizationId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (category !== 'all') {
      query = query.eq('reason', category);
    }

    if (platform !== 'all') {
      query = query.eq('platform', platform);
    }

    // Apply pagination
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch shield events', { 
        error: error.message, 
        userId: req.user.id,
        orgId: req.user.organizationId 
      });
      throw error;
    }

    const totalPages = Math.ceil((count || 0) / limitNum);

    // Enhanced response sanitization (CodeRabbit Round 6)
    const sanitizedEvents = sanitizeResponseData(data || []);
    
    res.json({
      success: true,
      data: {
        events: sanitizedEvents,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        },
        filters: {
          category,
          timeRange,
          platform,
          startDate: startDate?.toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('Shield events endpoint error', { 
      error: error.message, 
      userId: req.user?.id,
      orgId: req.user?.organizationId 
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch shield events',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/shield/revert/:id
 * Revert a shield action
 */
router.post('/revert/:id', revertActionLimit, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Enhanced UUID format validation (CodeRabbit Round 5)
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid action ID provided',
          code: 'INVALID_ACTION_ID',
          details: 'Action ID must be a non-empty string'
        }
      });
    }
    
    // Validate UUID format (RFC 4122 compliant)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id.trim())) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid UUID format for action ID',
          code: 'INVALID_UUID_FORMAT',
          details: 'Action ID must be a valid UUID (RFC 4122 compliant)'
        }
      });
    }

    // Validate reason if provided
    if (reason && (typeof reason !== 'string' || reason.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid revert reason provided',
          code: 'INVALID_REASON',
          details: 'Reason must be a non-empty string if provided'
        }
      });
    }

    // First, verify the action exists and belongs to the user's organization
    const { data: existingAction, error: fetchError } = await supabaseServiceClient
      .from('shield_actions')
      .select('id, action_type, content_hash, content_snippet, platform, reverted_at, metadata')
      .eq('id', id)
      .eq('organization_id', req.user.organizationId)
      .single();

    if (fetchError) {
      logger.error('Failed to fetch shield action for revert', { 
        error: fetchError.message, 
        actionId: id,
        userId: req.user.id,
        orgId: req.user.organizationId 
      });

      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Shield action not found',
            code: 'ACTION_NOT_FOUND'
          }
        });
      }

      throw fetchError;
    }

    // Check if already reverted
    if (existingAction.reverted_at) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Action has already been reverted',
          code: 'ALREADY_REVERTED',
          revertedAt: existingAction.reverted_at
        }
      });
    }

    // Update the action with revert information with enhanced metadata safety (CodeRabbit Round 5)
    let baseMetadata = {};
    try {
      // Safe metadata extraction with type checking
      if (existingAction?.metadata && typeof existingAction.metadata === 'object' && existingAction.metadata !== null) {
        baseMetadata = Array.isArray(existingAction.metadata) ? {} : { ...existingAction.metadata };
      }
    } catch (error) {
      logger.warn('Failed to parse existing metadata, using empty object', { 
        actionId: id, 
        error: error.message 
      });
      baseMetadata = {};
    }
    
    const revertMetadata = {
      ...baseMetadata,
      reverted: true,
      revertedBy: req.user?.id,
      revertReason: reason?.trim() || 'Manual revert via UI',
      revertedAt: new Date().toISOString(),
      revertContext: 'shield_ui'
    };

    // Update the action with enhanced revert information
    const { data: updatedAction, error: updateError } = await supabaseServiceClient
      .from('shield_actions')
      .update({ 
        reverted_at: new Date().toISOString(),
        metadata: revertMetadata
      })
      .eq('id', id)
      .eq('organization_id', req.user.organizationId)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to revert shield action', { 
        error: updateError.message, 
        actionId: id,
        userId: req.user.id,
        orgId: req.user.organizationId 
      });
      throw updateError;
    }

    logger.info('Shield action reverted successfully', {
      actionId: id,
      actionType: existingAction.action_type,
      platform: existingAction.platform,
      userId: req.user.id,
      orgId: req.user.organizationId,
      reason: reason || 'Manual revert via UI'
    });

    res.json({
      success: true,
      data: {
        action: updatedAction,
        message: 'Shield action reverted successfully'
      }
    });

  } catch (error) {
    logger.error('Shield revert endpoint error', { 
      error: error.message, 
      actionId: req.params.id,
      userId: req.user?.id,
      orgId: req.user?.organizationId 
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to revert shield action',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/shield/stats
 * Get shield statistics for the organization
 */
router.get('/stats', async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;

    // Calculate date range
    let startDate = null;
    const now = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = null;
        break;
    }

    // Build base query with organization isolation
    let query = supabaseServiceClient
      .from('shield_actions')
      .select('action_type, platform, reason, created_at, reverted_at')
      .eq('organization_id', req.user.organizationId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch shield stats', { 
        error: error.message, 
        userId: req.user.id,
        orgId: req.user.organizationId 
      });
      throw error;
    }

    // Calculate statistics (harden for null data)
    const safeData = data || [];
    const stats = {
      total: safeData.length,
      reverted: safeData.filter(action => action && action.reverted_at).length,
      active: safeData.filter(action => action && !action.reverted_at).length,
      byActionType: {},
      byPlatform: {},
      byReason: {},
      timeRange,
      startDate: startDate?.toISOString(),
      generatedAt: new Date().toISOString()
    };

    // Group by action type (safe iteration)
    safeData.forEach(action => {
      if (action && action.action_type) {
        stats.byActionType[action.action_type] = (stats.byActionType[action.action_type] || 0) + 1;
      }
    });

    // Group by platform (safe iteration)
    safeData.forEach(action => {
      if (action && action.platform) {
        stats.byPlatform[action.platform] = (stats.byPlatform[action.platform] || 0) + 1;
      }
    });

    // Group by reason (safe iteration)
    safeData.forEach(action => {
      if (action && action.reason) {
        stats.byReason[action.reason] = (stats.byReason[action.reason] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Shield stats endpoint error', { 
      error: error.message, 
      userId: req.user?.id,
      orgId: req.user?.organizationId 
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch shield statistics',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/shield/config
 * Get shield configuration for the organization
 */
router.get('/config', async (req, res) => {
  try {
    // Check if Shield UI is enabled via feature flag
    const shieldUIEnabled = flags.isEnabled('ENABLE_SHIELD_UI');

    // Basic shield configuration
    const config = {
      enabled: shieldUIEnabled,
      features: {
        eventFiltering: true,
        revertActions: true,
        statistics: true,
        realTimeUpdates: false // Could be enabled with websockets
      },
      limits: {
        maxEventsPerPage: 100,
        revertActionsPerWindow: 10,
        revertWindowMinutes: 5
      },
      categories: [
        'toxic',
        'spam', 
        'harassment',
        'hate_speech',
        'inappropriate'
      ],
      platforms: [
        'twitter',
        'youtube',
        'instagram',
        'facebook',
        'discord',
        'twitch',
        'reddit',
        'tiktok',
        'bluesky'
      ],
      actionTypes: [
        'block',
        'mute',
        'flag',
        'report'
      ]
    };

    logger.info('Shield config requested', {
      userId: req.user.id,
      orgId: req.user.organizationId,
      shieldUIEnabled
    });

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Shield config endpoint error', { 
      error: error.message, 
      userId: req.user?.id,
      orgId: req.user?.organizationId 
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch shield configuration',
        details: error.message
      }
    });
  }
});

module.exports = router;