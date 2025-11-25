const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');
const levelConfigService = require('../services/levelConfigService');
const toneCompatibilityService = require('../services/toneCompatibilityService'); // Issue #872: Tone compatibility
const { roastLevelSchema, shieldLevelSchema } = require('../validators/zod/config.schema'); // Issue #943: Zod validation
const { formatZodError } = require('../validators/zod/helpers'); // Issue #943: Error formatting
const { VALID_TONES_WITH_ALIASES } = require('../config/tones'); // Issue #973: Centralized tones

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Valid platform values
const VALID_PLATFORMS = [
  'twitter',
  'youtube',
  'bluesky',
  'instagram',
  'facebook',
  'discord',
  'twitch',
  'reddit',
  'tiktok'
];
// Issue #872: humor_types deprecated, kept for backward compat only
const VALID_HUMOR_TYPES = []; // Empty - deprecated

/**
 * GET /api/config/:platform
 * Get configuration for a specific platform
 */
router.get('/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { user } = req;

    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform specified'
      });
    }

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

    // Get platform configuration
    const { data: config, error } = await supabaseServiceClient
      .from('integration_configs')
      .select('*')
      .eq('organization_id', orgData.id)
      .eq('platform', platform)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      throw error;
    }

    // Return default config if none exists
    const defaultConfig = {
      platform,
      enabled: false,
      tone: 'balanceado', // Issue #872: Default to new system
      // Issue #872 AC8: humor_type completely removed
      response_frequency: 1.0,
      trigger_words: ['roast', 'burn', 'insult'],
      shield_enabled: false,
      shield_config: {
        auto_actions: false,
        mute_enabled: true,
        block_enabled: true,
        report_enabled: false
      },
      config: {}
    };

    const responseConfig = config || defaultConfig;

    res.status(200).json({
      success: true,
      data: {
        platform: responseConfig.platform,
        enabled: responseConfig.enabled,
        tone: responseConfig.tone,
        // Issue #872 AC8: humor_type completely removed
        response_frequency: responseConfig.response_frequency,
        trigger_words: responseConfig.trigger_words,
        shield_enabled: responseConfig.shield_enabled,
        shield_config: responseConfig.shield_config,
        roast_level: responseConfig.roast_level || 3,
        shield_level: responseConfig.shield_level || 3,
        updated_at: responseConfig.updated_at
      }
    });
  } catch (error) {
    logger.error('Get platform config error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve platform configuration'
    });
  }
});

/**
 * PUT /api/config/:platform
 * Update configuration for a specific platform
 */
router.put('/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { user } = req;
    const {
      enabled,
      tone,
      // Issue #872 AC8: humor_type no longer accepted
      response_frequency,
      trigger_words,
      shield_enabled,
      shield_config,
      config,
      roast_level,
      shield_level
    } = req.body;

    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform specified'
      });
    }

    // Issue #972 + #973: Always normalize tone to canonical form (flanders, balanceado, canalla)
    // This handles both validation and normalization of aliases (light→flanders, etc.)
    // Issue #973: Uses centralized VALID_TONES_WITH_ALIASES for error message
    let normalizedTone = null;
    if (tone) {
      normalizedTone = toneCompatibilityService.normalizeTone(tone);
      if (!normalizedTone) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tone. Must be one of: ' + VALID_TONES_WITH_ALIASES.join(', ')
        });
      }
      // Log if the tone was converted from an alias
      if (normalizedTone !== tone.toLowerCase().trim()) {
        logger.info(`Tone normalized: ${tone} → ${normalizedTone} (Issue #872 compatibility)`);
      }
    }

    // Issue #872 AC8: humor_type completely removed - no validation needed

    // Issue #872 AC8: humor_type completely removed - no validation needed

    if (
      response_frequency !== undefined &&
      (response_frequency < 0.0 || response_frequency > 1.0)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Response frequency must be between 0.0 and 1.0'
      });
    }

    // Issue #943: Zod validation for roast_level
    if (roast_level !== undefined) {
      const roastValidation = roastLevelSchema.safeParse(roast_level);
      if (!roastValidation.success) {
        return res.status(400).json({
          success: false,
          error: formatZodError(roastValidation.error)
        });
      }
    }

    // Issue #943: Zod validation for shield_level
    if (shield_level !== undefined) {
      const shieldValidation = shieldLevelSchema.safeParse(shield_level);
      if (!shieldValidation.success) {
        return res.status(400).json({
          success: false,
          error: formatZodError(shieldValidation.error)
        });
      }
    }

    // Issue #597: Validate plan-based level access
    if (roast_level !== undefined || shield_level !== undefined) {
      const levelValidation = await levelConfigService.validateLevelAccess(
        user.id,
        roast_level,
        shield_level
      );

      if (!levelValidation.allowed) {
        return res.status(403).json({
          success: false,
          error: levelValidation.message,
          reason: levelValidation.reason,
          currentPlan: levelValidation.currentPlan,
          maxAllowedRoastLevel: levelValidation.maxAllowedRoastLevel,
          maxAllowedShieldLevel: levelValidation.maxAllowedShieldLevel
        });
      }
    }

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

    // Prepare update data
    const updateData = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    // Issue #972: Use already-normalized tone from validation step above
    if (normalizedTone) updateData.tone = normalizedTone;
    // Issue #872 AC8: humor_type completely removed - no processing
    if (response_frequency !== undefined) updateData.response_frequency = response_frequency;
    if (trigger_words) updateData.trigger_words = trigger_words;
    if (shield_enabled !== undefined) updateData.shield_enabled = shield_enabled;
    if (shield_config) updateData.shield_config = shield_config;
    if (config) updateData.config = config;
    if (roast_level !== undefined) updateData.roast_level = roast_level;
    if (shield_level !== undefined) updateData.shield_level = shield_level;

    // Upsert configuration
    const { data: updatedConfig, error } = await supabaseServiceClient
      .from('integration_configs')
      .upsert({
        organization_id: orgData.id,
        platform,
        ...updateData
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info(`Platform config updated: ${platform} for user ${user.id}`);

    res.status(200).json({
      success: true,
      data: {
        platform: updatedConfig.platform,
        enabled: updatedConfig.enabled,
        tone: updatedConfig.tone,
        // Issue #872 AC8: humor_type completely removed
        response_frequency: updatedConfig.response_frequency,
        trigger_words: updatedConfig.trigger_words,
        shield_enabled: updatedConfig.shield_enabled,
        shield_config: updatedConfig.shield_config,
        roast_level: updatedConfig.roast_level,
        shield_level: updatedConfig.shield_level,
        updated_at: updatedConfig.updated_at
      }
    });
  } catch (error) {
    logger.error('Update platform config error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update platform configuration'
    });
  }
});

/**
 * GET /api/config
 * Get all platform configurations for the user
 */
router.get('/', async (req, res) => {
  try {
    const { user } = req;

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

    // Get all platform configurations
    const { data: configs, error } = await supabaseServiceClient
      .from('integration_configs')
      .select('*')
      .eq('organization_id', orgData.id);

    if (error) {
      throw error;
    }

    // Format response
    const platformConfigs = {};

    // Add existing configs
    configs.forEach((config) => {
      platformConfigs[config.platform] = {
        platform: config.platform,
        enabled: config.enabled,
        tone: config.tone,
        // Issue #872 AC8: humor_type completely removed
        response_frequency: config.response_frequency,
        trigger_words: config.trigger_words,
        shield_enabled: config.shield_enabled,
        shield_config: config.shield_config,
        updated_at: config.updated_at
      };
    });

    // Add default configs for platforms not yet configured
    VALID_PLATFORMS.forEach((platform) => {
      if (!platformConfigs[platform]) {
        platformConfigs[platform] = {
          platform,
          enabled: false,
          tone: 'balanceado', // Issue #872: Default to new system
          // Issue #872 AC8: humor_type completely removed
          response_frequency: 1.0,
          trigger_words: ['roast', 'burn', 'insult'],
          shield_enabled: false,
          shield_config: {
            auto_actions: false,
            mute_enabled: true,
            block_enabled: true,
            report_enabled: false
          }
        };
      }
    });

    res.status(200).json({
      success: true,
      data: {
        platforms: platformConfigs,
        available_tones: VALID_TONES_WITH_ALIASES,
        available_humor_types: [] // Issue #872: Deprecated, return empty array
      }
    });
  } catch (error) {
    logger.error('Get all platform configs error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve platform configurations'
    });
  }
});

/**
 * POST /api/config/reload
 * Hot-reload configuration without restart
 */
router.post('/reload', requireAdmin, async (req, res) => {
  try {
    const { user } = req;

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

    // Get current configurations
    const { data: configs, error } = await supabaseServiceClient
      .from('integration_configs')
      .select('*')
      .eq('organization_id', orgData.id);

    if (error) {
      throw error;
    }

    // Simulate configuration reload
    // In a real implementation, this would notify workers to reload their configuration
    logger.info(`Configuration reloaded for organization ${orgData.id}`);

    res.status(200).json({
      success: true,
      message: 'Configuration reloaded successfully',
      data: {
        reloaded_at: new Date().toISOString(),
        platforms_reloaded: configs.length,
        organization_id: orgData.id
      }
    });
  } catch (error) {
    logger.error('Config reload error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to reload configuration'
    });
  }
});

/**
 * GET /api/config/flags
 * Get feature flags for frontend consumption
 * Public endpoint (no authentication required for basic flags)
 */
router.get('/flags', (req, res) => {
  try {
    // Get frontend-relevant flags only
    const frontendFlags = {
      ENABLE_SHOP: flags.isEnabled('ENABLE_SHOP'),
      ENABLE_STYLE_PROFILE: flags.isEnabled('ENABLE_STYLE_PROFILE'),
      ENABLE_RQC: flags.isEnabled('ENABLE_RQC'),
      ENABLE_SHIELD: flags.isEnabled('ENABLE_SHIELD'),
      ENABLE_BILLING: flags.isEnabled('ENABLE_BILLING'),
      ENABLE_MAGIC_LINK: flags.isEnabled('ENABLE_MAGIC_LINK')
    };

    res.status(200).json({
      success: true,
      flags: frontendFlags,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Feature flags endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve feature flags',
      flags: {
        ENABLE_SHOP: false,
        ENABLE_STYLE_PROFILE: false,
        ENABLE_RQC: false,
        ENABLE_SHIELD: false,
        ENABLE_BILLING: false,
        ENABLE_MAGIC_LINK: false
      }
    });
  }
});

/**
 * GET /api/config/levels/available
 * Get available roast and shield levels for authenticated user based on their plan
 * Issue #597
 */
router.get('/levels/available', async (req, res) => {
  try {
    const { user } = req;

    const availableLevels = await levelConfigService.getAvailableLevelsForUser(user.id);

    res.status(200).json({
      success: true,
      data: availableLevels
    });
  } catch (error) {
    logger.error('Get available levels error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve available levels'
    });
  }
});

/**
 * GET /api/config/levels/definitions
 * Get all level definitions (roast and shield)
 * Issue #597
 */
router.get('/levels/definitions', async (req, res) => {
  try {
    const roastLevels = levelConfigService.getAllRoastLevels();
    const shieldLevels = levelConfigService.getAllShieldLevels();

    res.status(200).json({
      success: true,
      data: {
        roast: roastLevels,
        shield: shieldLevels
      }
    });
  } catch (error) {
    logger.error('Get level definitions error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve level definitions'
    });
  }
});

module.exports = router;
