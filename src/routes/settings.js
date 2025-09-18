const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePlan } = require('../middleware/requirePlan');
const ShieldSettingsService = require('../services/shieldSettingsService');
const { logger } = require('../utils/logger');

const router = express.Router();

// Initialize Shield Settings Service
const shieldSettingsService = new ShieldSettingsService();

/**
 * Shield Settings Routes for Issue #362
 * 
 * Provides REST API endpoints for managing Shield configuration at
 * organization and platform levels with proper validation and authentication.
 */

// ============================================================================
// ORGANIZATION SHIELD SETTINGS
// ============================================================================

/**
 * GET /api/settings/shield
 * Get organization Shield settings
 */
router.get('/shield', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.user;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization not found in user context'
      });
    }
    
    const settings = await shieldSettingsService.getOrganizationSettings(organizationId);
    const aggressivenessLevels = shieldSettingsService.getAggressivenessLevels();
    const supportedPlatforms = shieldSettingsService.getSupportedPlatforms();
    
    res.json({
      success: true,
      data: {
        settings,
        aggressiveness_levels: aggressivenessLevels,
        supported_platforms: supportedPlatforms
      }
    });
    
  } catch (error) {
    logger.error('Failed to get organization Shield settings', {
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Shield settings'
    });
  }
});

/**
 * POST /api/settings/shield
 * Update organization Shield settings
 */
router.post('/shield', 
  authenticateToken, 
  requirePlan(['pro', 'creator_plus', 'custom']), // Shield settings require Pro+ plan
  async (req, res) => {
    try {
      const { organizationId, id: userId } = req.user;
      
      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization not found in user context'
        });
      }
      
      const {
        aggressiveness,
        tau_roast_lower,
        tau_shield,
        tau_critical,
        shield_enabled,
        auto_approve_shield_actions,
        corrective_messages_enabled
      } = req.body;
      
      // Validate required fields
      if (aggressiveness === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Aggressiveness level is required'
        });
      }
      
      // Build settings object
      const settings = {
        aggressiveness,
        tau_roast_lower,
        tau_shield,
        tau_critical,
        shield_enabled,
        auto_approve_shield_actions,
        corrective_messages_enabled
      };
      
      // Apply aggressiveness presets if thresholds not provided
      if (tau_roast_lower === undefined || tau_shield === undefined || tau_critical === undefined) {
        const thresholds = shieldSettingsService.aggressivenessToThresholds(aggressiveness);
        settings.tau_roast_lower = tau_roast_lower ?? thresholds.tau_roast_lower;
        settings.tau_shield = tau_shield ?? thresholds.tau_shield;
        settings.tau_critical = tau_critical ?? thresholds.tau_critical;
      }
      
      const updatedSettings = await shieldSettingsService.updateOrganizationSettings(
        organizationId,
        settings,
        userId
      );
      
      logger.info('Organization Shield settings updated', {
        userId,
        organizationId,
        aggressiveness: settings.aggressiveness,
        shield_enabled: settings.shield_enabled
      });
      
      res.json({
        success: true,
        data: updatedSettings,
        message: 'Shield settings updated successfully'
      });
      
    } catch (error) {
      logger.error('Failed to update organization Shield settings', {
        userId: req.user?.id,
        organizationId: req.user?.organizationId,
        error: error.message
      });
      
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update Shield settings'
      });
    }
  }
);

/**
 * GET /api/settings/shield/summary
 * Get Shield settings summary for organization
 */
router.get('/shield/summary', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.user;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization not found in user context'
      });
    }
    
    const summary = await shieldSettingsService.getSettingsSummary(organizationId);
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    logger.error('Failed to get Shield settings summary', {
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve Shield settings summary'
    });
  }
});

// ============================================================================
// PLATFORM-SPECIFIC SHIELD SETTINGS
// ============================================================================

/**
 * GET /api/settings/shield/platform/:platform
 * Get platform-specific Shield settings
 */
router.get('/shield/platform/:platform', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { platform } = req.params;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization not found in user context'
      });
    }
    
    // Validate platform
    const supportedPlatforms = shieldSettingsService.getSupportedPlatforms();
    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported platform: ${platform}`
      });
    }
    
    const [platformSettings, effectiveSettings] = await Promise.all([
      shieldSettingsService.getPlatformSettings(organizationId, platform),
      shieldSettingsService.getEffectiveSettings(organizationId, platform)
    ]);
    
    res.json({
      success: true,
      data: {
        platform,
        platform_settings: platformSettings,
        effective_settings: effectiveSettings,
        has_overrides: !!platformSettings
      }
    });
    
  } catch (error) {
    logger.error('Failed to get platform Shield settings', {
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
      platform: req.params.platform,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve platform Shield settings'
    });
  }
});

/**
 * POST /api/settings/shield/platform/:platform
 * Update platform-specific Shield settings
 */
router.post('/shield/platform/:platform', 
  authenticateToken, 
  requirePlan(['pro', 'creator_plus', 'custom']),
  async (req, res) => {
    try {
      const { organizationId, id: userId } = req.user;
      const { platform } = req.params;
      
      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization not found in user context'
        });
      }
      
      // Validate platform
      const supportedPlatforms = shieldSettingsService.getSupportedPlatforms();
      if (!supportedPlatforms.includes(platform)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported platform: ${platform}`
        });
      }
      
      const {
        aggressiveness,
        tau_roast_lower,
        tau_shield,
        tau_critical,
        shield_enabled,
        auto_approve_shield_actions,
        corrective_messages_enabled,
        response_frequency,
        trigger_words,
        max_responses_per_hour
      } = req.body;
      
      const settings = {
        aggressiveness,
        tau_roast_lower,
        tau_shield,
        tau_critical,
        shield_enabled,
        auto_approve_shield_actions,
        corrective_messages_enabled,
        response_frequency,
        trigger_words,
        max_responses_per_hour
      };
      
      // Apply aggressiveness presets if provided and thresholds not set
      if (aggressiveness !== null && aggressiveness !== undefined && 
          (tau_roast_lower === undefined || tau_shield === undefined || tau_critical === undefined)) {
        const thresholds = shieldSettingsService.aggressivenessToThresholds(aggressiveness);
        settings.tau_roast_lower = tau_roast_lower ?? thresholds.tau_roast_lower;
        settings.tau_shield = tau_shield ?? thresholds.tau_shield;
        settings.tau_critical = tau_critical ?? thresholds.tau_critical;
      }
      
      const updatedSettings = await shieldSettingsService.updatePlatformSettings(
        organizationId,
        platform,
        settings,
        userId
      );
      
      logger.info('Platform Shield settings updated', {
        userId,
        organizationId,
        platform,
        aggressiveness: settings.aggressiveness,
        shield_enabled: settings.shield_enabled
      });
      
      res.json({
        success: true,
        data: updatedSettings,
        message: `Shield settings updated successfully for ${platform}`
      });
      
    } catch (error) {
      logger.error('Failed to update platform Shield settings', {
        userId: req.user?.id,
        organizationId: req.user?.organizationId,
        platform: req.params.platform,
        error: error.message
      });
      
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update platform Shield settings'
      });
    }
  }
);

/**
 * DELETE /api/settings/shield/platform/:platform
 * Delete platform-specific settings (revert to organization defaults)
 */
router.delete('/shield/platform/:platform', 
  authenticateToken, 
  requirePlan(['pro', 'creator_plus', 'custom']),
  async (req, res) => {
    try {
      const { organizationId, id: userId } = req.user;
      const { platform } = req.params;
      
      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization not found in user context'
        });
      }
      
      // Validate platform
      const supportedPlatforms = shieldSettingsService.getSupportedPlatforms();
      if (!supportedPlatforms.includes(platform)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported platform: ${platform}`
        });
      }
      
      const result = await shieldSettingsService.deletePlatformSettings(
        organizationId,
        platform,
        userId
      );
      
      logger.info('Platform Shield settings deleted', {
        userId,
        organizationId,
        platform,
        deleted: result.deleted
      });
      
      res.json({
        success: true,
        data: result,
        message: result.deleted 
          ? `Platform settings removed for ${platform}. Now using organization defaults.`
          : `No platform settings found for ${platform}.`
      });
      
    } catch (error) {
      logger.error('Failed to delete platform Shield settings', {
        userId: req.user?.id,
        organizationId: req.user?.organizationId,
        platform: req.params.platform,
        error: error.message
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete platform Shield settings'
      });
    }
  }
);

/**
 * GET /api/settings/shield/platform/:platform/effective
 * Get effective settings for a platform (with inheritance)
 */
router.get('/shield/platform/:platform/effective', authenticateToken, async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { platform } = req.params;
    
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization not found in user context'
      });
    }
    
    // Validate platform
    const supportedPlatforms = shieldSettingsService.getSupportedPlatforms();
    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported platform: ${platform}`
      });
    }
    
    const effectiveSettings = await shieldSettingsService.getEffectiveSettings(organizationId, platform);
    
    res.json({
      success: true,
      data: {
        platform,
        settings: effectiveSettings,
        aggressiveness_details: effectiveSettings.aggressiveness_details
      }
    });
    
  } catch (error) {
    logger.error('Failed to get effective Shield settings', {
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
      platform: req.params.platform,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve effective Shield settings'
    });
  }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

/**
 * GET /api/settings/shield/aggressiveness-levels
 * Get available aggressiveness levels and their descriptions
 */
router.get('/shield/aggressiveness-levels', (req, res) => {
  try {
    const levels = shieldSettingsService.getAggressivenessLevels();
    
    res.json({
      success: true,
      data: levels
    });
    
  } catch (error) {
    logger.error('Failed to get aggressiveness levels', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve aggressiveness levels'
    });
  }
});

/**
 * GET /api/settings/shield/platforms
 * Get supported platforms list
 */
router.get('/shield/platforms', (req, res) => {
  try {
    const platforms = shieldSettingsService.getSupportedPlatforms();
    
    res.json({
      success: true,
      data: platforms
    });
    
  } catch (error) {
    logger.error('Failed to get supported platforms', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported platforms'
    });
  }
});

/**
 * POST /api/settings/shield/validate
 * Validate Shield settings without saving
 */
router.post('/shield/validate', authenticateToken, async (req, res) => {
  try {
    const { type = 'organization', ...settings } = req.body;
    
    if (type === 'organization') {
      shieldSettingsService.validateOrganizationSettings(settings);
    } else if (type === 'platform') {
      shieldSettingsService.validatePlatformSettings(settings);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid validation type. Must be "organization" or "platform"'
      });
    }
    
    res.json({
      success: true,
      data: {
        valid: true,
        message: 'Settings validation passed'
      }
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || 'Settings validation failed'
    });
  }
});

module.exports = router;