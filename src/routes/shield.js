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
  skip: (req) => process.env.NODE_ENV === 'test'
});

// Apply authentication to all Shield routes
router.use(authenticateToken);

// Apply general rate limiting
router.use(generalShieldLimit);

/**
 * GET /api/shield/events
 * Get paginated shield events with filtering
 */
router.get('/events', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category = 'all', 
      timeRange = '30d',
      platform = 'all'
    } = req.query;

    // Whitelist filters to prevent unexpected queries
    const validCategories = ['all', 'toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'];
    const validTimeRanges = ['7d', '30d', '90d', 'all'];
    const validPlatforms = ['all', 'twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid category filter', code: 'INVALID_CATEGORY' }
      });
    }
    
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid time range filter', code: 'INVALID_TIME_RANGE' }
      });
    }
    
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid platform filter', code: 'INVALID_PLATFORM' }
      });
    }

    // Validate pagination parameters (ensure numeric inputs)
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20)); // Max 100 items per page
    
    if (isNaN(pageNum) || isNaN(limitNum)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid pagination parameters', code: 'INVALID_PAGINATION' }
      });
    }
    
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

    res.json({
      success: true,
      data: {
        events: data || [],
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

    // Validate action ID
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid action ID provided',
          code: 'INVALID_ACTION_ID'
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

    // Update the action with revert information
    const { data: updatedAction, error: updateError } = await supabaseServiceClient
      .from('shield_actions')
      .update({ 
        reverted_at: new Date().toISOString(),
        metadata: {
          ...existingAction.metadata,
          reverted: true,
          revertedBy: req.user.id,
          revertReason: reason || 'Manual revert via UI'
        }
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