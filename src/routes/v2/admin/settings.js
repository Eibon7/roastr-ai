/**
 * V2 Admin Settings Routes
 * 
 * Admin-only endpoints for managing SSOT v2 settings via SettingsLoader v2
 * 
 * Issue: ROA-267 - Align settings endpoints with gatekeeper SSOT exposure
 * Related: ROA-266 - Gatekeeper configurable from SSOT
 * 
 * Rules:
 * - Admin-only (requireAdmin middleware)
 * - NO hardcoded values
 * - Read from SettingsLoader v2 (admin_settings + admin-controlled.yaml)
 * - Write to admin_settings table (dynamic config)
 * - NO derivation, only projection/update
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middleware/auth');
const { logger } = require('../../../utils/logger');
const { supabaseServiceClient } = require('../../../config/supabase');
const settingsLoader = require('../../../services/settingsLoaderV2');
const SafeUtils = require('../../../utils/safeUtils');

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/v2/admin/settings/gatekeeper
 * Get Gatekeeper configuration
 * Source: SettingsLoader v2 (admin_settings.gatekeeper.*)
 * 
 * Returns configuration from admin_settings, falling back to empty if not set.
 * NO hardcoded defaults - defaults come from SSOT-V2.md via loader if needed.
 */
router.get('/gatekeeper', async (req, res) => {
  try {
    const config = await settingsLoader.getMergedConfig();
    
    // Project gatekeeper config from merged config
    // If not in admin_settings, returns empty object (admin can set it)
    const gatekeeperConfig = config.gatekeeper || {};

    logger.info('Gatekeeper config retrieved', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      hasConfig: Object.keys(gatekeeperConfig).length > 0
    });

    res.status(200).json({
      success: true,
      data: gatekeeperConfig,
      source: 'SettingsLoader v2 (admin_settings.gatekeeper.*)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting gatekeeper config:', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve gatekeeper configuration'
    });
  }
});

/**
 * PATCH /api/v2/admin/settings/gatekeeper
 * Update Gatekeeper configuration
 * Writes to admin_settings table (dynamic config)
 * 
 * Payload structure matches SSOT-V2.md section 4.6:
 * {
 *   mode: 'multiplicative' | 'additive',
 *   thresholds: { suspicious, highConfidence, maxScore },
 *   heuristics: { multipleNewlines, codeBlocks, unusualLength, repeatedPhrases },
 *   heuristicsConfig: { newlineThreshold, unusualLengthThreshold, repeatedPhraseCount },
 *   patternWeights: { instruction_override, prompt_extraction, ... }
 * }
 * 
 * NO validation of values (that's ROA-266's responsibility)
 * NO hardcoded defaults (read from SSOT if needed)
 * Only stores what admin sends
 */
router.patch('/gatekeeper', async (req, res) => {
  try {
    const updates = req.body;
    const adminUserId = req.user.id;

    // Validate that updates is an object
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Request body must be an object'
      });
    }

    // Get current config for audit
    const currentConfig = await settingsLoader.getValue('gatekeeper') || {};

    // Convert nested object to flat key-value pairs for admin_settings
    // e.g., { gatekeeper: { mode: 'multiplicative' } } => 'gatekeeper.mode' = 'multiplicative'
    const flatUpdates = {};
    
    function flatten(obj, prefix = 'gatekeeper') {
      for (const key in obj) {
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          flatten(obj[key], `${prefix}.${key}`);
        } else {
          flatUpdates[`${prefix}.${key}`] = obj[key];
        }
      }
    }

    flatten(updates);

    // Upsert each key-value pair in admin_settings
    const upsertPromises = Object.entries(flatUpdates).map(async ([key, value]) => {
      const { error } = await supabaseServiceClient
        .from('admin_settings')
        .upsert(
          {
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : value,
            updated_at: new Date().toISOString(),
            updated_by: adminUserId
          },
          {
            onConflict: 'key'
          }
        );

      if (error) {
        throw error;
      }
    });

    await Promise.all(upsertPromises);

    // Invalidate cache to force reload
    settingsLoader.invalidateCache();

    // Get updated config
    const updatedConfig = await settingsLoader.getValue('gatekeeper') || {};

    logger.info('Gatekeeper config updated', {
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
      keysUpdated: Object.keys(flatUpdates).length
    });

    res.status(200).json({
      success: true,
      data: updatedConfig,
      message: 'Gatekeeper configuration updated successfully',
      source: 'SettingsLoader v2 (admin_settings.gatekeeper.*)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating gatekeeper config:', {
      error: error.message,
      adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update gatekeeper configuration'
    });
  }
});

module.exports = router;

