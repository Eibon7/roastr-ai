const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requirePlan } = require('../middleware/requirePlan');
const styleProfileService = require('../services/styleProfileService');
const queueService = require('../services/queueService');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

/**
 * @route POST /api/style-profile-extraction/extract
 * @desc Extract style profile for a user's social media account
 * @access Private (Pro/Plus only)
 */
router.post('/extract', authenticateToken, requirePlan(['pro', 'plus']), async (req, res) => {
  try {
    // Check if feature is enabled
    if (!flags.isEnabled('ENABLE_ORIGINAL_TONE')) {
      return res.status(403).json({
        success: false,
        error: 'Style profile extraction feature is not enabled'
      });
    }

    const { platform, accountRef } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!platform || !accountRef) {
      return res.status(400).json({
        success: false,
        error: 'Platform and accountRef are required'
      });
    }

    // Queue the extraction job
    const job = await queueService.addJob(
      'style_profile',
      {
        userId,
        platform,
        accountRef,
        isRefresh: false
      },
      {
        priority: 2 // Medium priority for user-initiated extractions
      }
    );

    logger.info('Style profile extraction queued', {
      userId,
      platform,
      jobId: job.id
    });

    res.json({
      success: true,
      message: 'Style profile extraction queued',
      jobId: job.id
    });
  } catch (error) {
    logger.error('Failed to queue style profile extraction', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to queue style profile extraction'
    });
  }
});

/**
 * @route GET /api/style-profile-extraction/status
 * @desc Get style profile status for a user's accounts
 * @access Private (Pro/Plus only)
 */
router.get('/status', authenticateToken, requirePlan(['pro', 'plus']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'Platform parameter is required'
      });
    }

    // Check if profile exists and needs refresh
    const needsRefresh = await styleProfileService.needsRefresh(userId, platform);

    // Get profile metadata (without decrypting)
    const profileData = await styleProfileService.getProfileMetadata(userId, platform);

    res.json({
      success: true,
      profile: {
        exists: !!profileData,
        needsRefresh,
        lastRefresh: profileData?.last_refresh || null,
        commentsSinceRefresh: profileData?.comment_count_since_refresh || 0
      }
    });
  } catch (error) {
    logger.error('Failed to get style profile status', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get style profile status'
    });
  }
});

/**
 * @route POST /api/style-profile-extraction/refresh
 * @desc Force refresh of style profile
 * @access Private (Pro/Plus only)
 */
router.post('/refresh', authenticateToken, requirePlan(['pro', 'plus']), async (req, res) => {
  try {
    const { platform, accountRef } = req.body;
    const userId = req.user.id;

    if (!platform || !accountRef) {
      return res.status(400).json({
        success: false,
        error: 'Platform and accountRef are required'
      });
    }

    // Queue the refresh job with high priority
    const job = await queueService.addJob(
      'style_profile',
      {
        userId,
        platform,
        accountRef,
        isRefresh: true
      },
      {
        priority: 1 // High priority for manual refresh
      }
    );

    logger.info('Style profile refresh queued', {
      userId,
      platform,
      jobId: job.id
    });

    res.json({
      success: true,
      message: 'Style profile refresh queued',
      jobId: job.id
    });
  } catch (error) {
    logger.error('Failed to queue style profile refresh', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to queue style profile refresh'
    });
  }
});

module.exports = router;
