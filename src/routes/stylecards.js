/**
 * Stylecards API Routes - Issue #293
 * Handles stylecard generation and management
 */

const express = require('express');
const router = express.Router();
const stylecardService = require('../services/stylecardService');
const { authenticateToken } = require('../middleware/auth');
const { requirePlan } = require('../middleware/requirePlan');
const { body, param, query, validationResult } = require('express-validator');

// Simple validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};
const logger = require('../utils/logger');

/**
 * POST /api/stylecards/generate
 * Trigger stylecard generation for a user
 */
router.post('/generate',
  authenticateToken,
  requirePlan(['pro', 'creator_plus']), // Only Pro/Plus users can generate stylecards
  [
    body('platforms')
      .isArray()
      .withMessage('Platforms must be an array')
      .custom((platforms) => {
        const validPlatforms = ['twitter', 'instagram', 'tiktok', 'youtube', 'twitch'];
        const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
        if (invalidPlatforms.length > 0) {
          throw new Error(`Invalid platforms: ${invalidPlatforms.join(', ')}`);
        }
        return true;
      }),
    body('language')
      .optional()
      .isIn(['es', 'en'])
      .withMessage('Language must be es or en'),
    body('forceRegenerate')
      .optional()
      .isBoolean()
      .withMessage('forceRegenerate must be a boolean'),
    body('maxContentPerPlatform')
      .optional()
      .isInt({ min: 10, max: 100 })
      .withMessage('maxContentPerPlatform must be between 10 and 100')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { platforms, language = 'es', forceRegenerate = false, maxContentPerPlatform } = req.body;
      const userId = req.user.id;
      const organizationId = req.user.organization_id;

      logger.info('Stylecard generation requested', {
        userId,
        organizationId,
        platforms,
        language,
        forceRegenerate
      });

      // Check if user has connected integrations for the requested platforms
      const { data: integrations } = await req.supabase
        .from('integration_configs')
        .select('platform')
        .eq('organization_id', organizationId)
        .eq('enabled', true)
        .in('platform', platforms);

      const connectedPlatforms = integrations?.map(i => i.platform) || [];
      
      if (connectedPlatforms.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No connected integrations found for the specified platforms',
          availablePlatforms: platforms,
          connectedPlatforms: []
        });
      }

      // Start stylecard generation
      const result = await stylecardService.triggerStylecardGeneration(
        userId,
        organizationId,
        connectedPlatforms,
        {
          language,
          forceRegenerate,
          maxContent: maxContentPerPlatform
        }
      );

      res.json({
        success: true,
        data: result,
        message: 'Stylecard generation started successfully'
      });

    } catch (error) {
      logger.error('Failed to trigger stylecard generation', {
        userId: req.user?.id,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to start stylecard generation',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /api/stylecards/status/:jobId
 * Get stylecard generation job status
 */
router.get('/status/:jobId',
  authenticateToken,
  [
    param('jobId').isUUID().withMessage('Invalid job ID')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.user.id;

      // Get job status
      const { data: job, error } = await req.supabase
        .from('stylecard_generation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single();

      if (error || !job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: job.id,
          status: job.status,
          progress: job.progress_percentage,
          contentAnalyzed: job.content_analyzed,
          platformsProcessed: job.platforms_processed,
          errorMessage: job.error_message,
          createdAt: job.created_at,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          stylecardId: job.stylecard_id
        }
      });

    } catch (error) {
      logger.error('Failed to get job status', {
        jobId: req.params.jobId,
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get job status'
      });
    }
  }
);

/**
 * GET /api/stylecards/current
 * Get user's current active stylecard
 */
router.get('/current',
  authenticateToken,
  [
    query('language')
      .optional()
      .isIn(['es', 'en'])
      .withMessage('Language must be es or en')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const language = req.query.language || 'es';

      const stylecard = await stylecardService.getActiveStylecard(userId, language);

      if (!stylecard) {
        return res.json({
          success: true,
          data: null,
          message: 'No active stylecard found'
        });
      }

      // Don't expose sensitive data
      const publicStylecard = {
        id: stylecard.id,
        name: stylecard.name,
        description: stylecard.description,
        language: stylecard.language,
        tone: stylecard.tone,
        formalityLevel: stylecard.formality_level,
        sarcasmLevel: stylecard.sarcasm_level,
        examples: stylecard.examples,
        sourcePlatforms: stylecard.source_platforms,
        totalContentAnalyzed: stylecard.total_content_analyzed,
        status: stylecard.status,
        generationMethod: stylecard.generation_method,
        createdAt: stylecard.created_at,
        lastUsedAt: stylecard.last_used_at
      };

      res.json({
        success: true,
        data: publicStylecard
      });

    } catch (error) {
      logger.error('Failed to get current stylecard', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get current stylecard'
      });
    }
  }
);

/**
 * DELETE /api/stylecards/current
 * Delete user's current stylecard (opt-out)
 */
router.delete('/current',
  authenticateToken,
  [
    query('language')
      .optional()
      .isIn(['es', 'en'])
      .withMessage('Language must be es or en')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const language = req.query.language || 'es';

      // Get current stylecard
      const stylecard = await stylecardService.getActiveStylecard(userId, language);
      
      if (!stylecard) {
        return res.json({
          success: true,
          message: 'No active stylecard to delete'
        });
      }

      // Delete stylecard and associated content samples
      const { error: stylecardError } = await req.supabase
        .from('stylecards')
        .delete()
        .eq('id', stylecard.id);

      if (stylecardError) throw stylecardError;

      // Content samples will be deleted automatically due to CASCADE

      logger.info('Stylecard deleted by user', {
        userId,
        stylecardId: stylecard.id,
        language
      });

      res.json({
        success: true,
        message: 'Stylecard deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete stylecard', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete stylecard'
      });
    }
  }
);

/**
 * GET /api/stylecards/jobs
 * Get user's stylecard generation job history
 */
router.get('/jobs',
  authenticateToken,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;

      const { data: jobs, error } = await req.supabase
        .from('stylecard_generation_jobs')
        .select('id, status, progress_percentage, content_analyzed, created_at, started_at, completed_at, error_message')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      res.json({
        success: true,
        data: jobs || [],
        pagination: {
          limit,
          offset,
          total: jobs?.length || 0
        }
      });

    } catch (error) {
      logger.error('Failed to get job history', {
        userId: req.user?.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get job history'
      });
    }
  }
);

module.exports = router;
