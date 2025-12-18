/**
 * V2 Settings Public Routes
 * 
 * Public endpoints exposing SSOT v2 data via SettingsLoader v2
 * 
 * Issue: ROA-267 - Refactor SSOT endpoints to use SettingsLoader v2
 * 
 * All endpoints are PUBLIC (no authentication required) to allow
 * frontend v2 to access SSOT data without session.
 * 
 * Rules:
 * - NO hardcoded values
 * - NO derivation (only projection)
 * - All values come from SettingsLoader v2 (admin_settings + admin-controlled.yaml)
 */

const express = require('express');
const { logger } = require('../../utils/logger');
const settingsLoader = require('../../services/settingsLoaderV2');

const router = express.Router();

/**
 * GET /api/v2/settings/public
 * Get public settings (plans, limits, capabilities, subscription states, platforms)
 * Source: SettingsLoader v2 (admin_settings + admin-controlled.yaml)
 * 
 * NO hardcoding, NO derivation - only projection from SettingsLoader
 */
router.get('/public', async (req, res) => {
  try {
    const config = await settingsLoader.getMergedConfig();

    // Project data from config (NO derivation, NO hardcoding)
    // All values come from SettingsLoader v2
    const publicSettings = {
      plans: config.plans || {},
      subscription: config.subscription || {},
      features: config.features || {},
      platforms: config.platforms || {}
    };

    res.status(200).json({
      success: true,
      data: publicSettings,
      source: 'SettingsLoader v2 (admin_settings + admin-controlled.yaml)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting public settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve public settings'
    });
  }
});

/**
 * GET /api/v2/settings/tones
 * Get valid roast tones
 * Source: SettingsLoader v2 (admin-controlled.yaml roasting.supported_tones)
 * 
 * NO hardcoding, NO derivation - only projection from SettingsLoader
 */
router.get('/tones', async (req, res) => {
  try {
    const config = await settingsLoader.getMergedConfig();

    // Project tones from config (NO derivation, NO hardcoding)
    // All values come from SettingsLoader v2
    const tones = {
      valid_tones: config.roasting?.supported_tones || [],
      descriptions: config.roasting?.tone_descriptions || {}
    };

    res.status(200).json({
      success: true,
      data: tones,
      source: 'SettingsLoader v2 (admin-controlled.yaml roasting)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting tones:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tones'
    });
  }
});

/**
 * GET /api/v2/settings/roastr-persona/schema
 * Get Roastr Persona schema structure
 * Source: SettingsLoader v2 (admin-controlled.yaml persona.schema)
 * 
 * NO hardcoding, NO derivation - only projection from SettingsLoader
 */
router.get('/roastr-persona/schema', async (req, res) => {
  try {
    const config = await settingsLoader.getMergedConfig();

    // Project persona schema from config (NO derivation, NO hardcoding)
    // All values come from SettingsLoader v2
    const personaSchema = {
      structure: config.persona?.schema || {},
      encryption: config.persona?.encryption || {}
    };

    res.status(200).json({
      success: true,
      data: personaSchema,
      source: 'SettingsLoader v2 (admin-controlled.yaml persona)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting persona schema:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve persona schema'
    });
  }
});

/**
 * GET /api/v2/settings/shield
 * Get Shield configuration
 * Source: SettingsLoader v2 (admin-controlled.yaml shield + admin_settings)
 * 
 * NO hardcoding, NO derivation - only projection from SettingsLoader
 */
router.get('/shield', async (req, res) => {
  try {
    const config = await settingsLoader.getMergedConfig();

    // Project shield config from config (NO derivation, NO hardcoding)
    // All values come from SettingsLoader v2
    const shieldConfig = config.shield || {};

    res.status(200).json({
      success: true,
      data: shieldConfig,
      source: 'SettingsLoader v2 (admin-controlled.yaml shield + admin_settings)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting shield config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve shield configuration'
    });
  }
});

module.exports = router;

