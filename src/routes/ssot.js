/**
 * SSOT Public Routes
 * 
 * Public endpoints exposing SSOT-V2.md data for frontend v2
 * 
 * Issue: ROA-267 - Crear endpoints públicos de SSOT para frontend v2
 * 
 * All endpoints are PUBLIC (no authentication required) to allow
 * frontend v2 to access SSOT data without session.
 */

const express = require('express');
const { logger } = require('../utils/logger');
const ssotService = require('../services/ssotService');

const router = express.Router();

/**
 * GET /api/ssot/plans
 * Get valid plan IDs, trial configuration, limits, and capabilities
 * Source: SSOT-V2.md section 1
 */
router.get('/plans', (req, res) => {
  try {
    const plans = {
      valid_ids: ssotService.getValidPlanIds(),
      trial_config: ssotService.getTrialConfiguration(),
      limits: ssotService.getPlanLimits(),
      capabilities: ssotService.getPlanCapabilities()
    };

    res.status(200).json({
      success: true,
      data: plans,
      source: 'SSOT-V2.md section 1',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting SSOT plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plan information'
    });
  }
});

/**
 * GET /api/ssot/limits
 * Get monthly functional limits by plan
 * Source: SSOT-V2.md section 1.3
 */
router.get('/limits', (req, res) => {
  try {
    const limits = ssotService.getPlanLimits();

    res.status(200).json({
      success: true,
      data: limits,
      source: 'SSOT-V2.md section 1.3',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting SSOT limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve plan limits'
    });
  }
});

/**
 * GET /api/ssot/features
 * Get valid feature flags and their semantics
 * Source: SSOT-V2.md section 3
 */
router.get('/features', (req, res) => {
  try {
    const features = {
      valid_flags: ssotService.getValidFeatureFlagKeys(),
      semantics: ssotService.getFeatureFlagSemantics()
    };

    res.status(200).json({
      success: true,
      data: features,
      source: 'SSOT-V2.md section 3',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting SSOT features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve feature flags'
    });
  }
});

/**
 * GET /api/ssot/tones
 * Get valid roast tones
 * Source: SSOT-V2.md section 6.1
 */
router.get('/tones', (req, res) => {
  try {
    const tones = {
      valid_tones: ssotService.getValidRoastTones(),
      descriptions: {
        flanders: 'amable, diminutivos, humor blanco',
        balanceado: 'estándar, sarcasmo suave, elegante',
        canalla: 'humor afilado, ironía, sin degradación',
        personal: 'derivado rule-based del estilo del usuario (solo Pro/Plus, beta)'
      }
    };

    res.status(200).json({
      success: true,
      data: tones,
      source: 'SSOT-V2.md section 6.1',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting SSOT tones:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve roast tones'
    });
  }
});

/**
 * GET /api/ssot/subscription-states
 * Get valid subscription states
 * Source: SSOT-V2.md section 2.2
 */
router.get('/subscription-states', (req, res) => {
  try {
    const states = ssotService.getValidSubscriptionStates();

    res.status(200).json({
      success: true,
      data: {
        valid_states: states,
        descriptions: {
          trialing: 'Usuario en período de prueba',
          expired_trial_pending_payment: 'Trial expirado, pendiente de pago (interno)',
          payment_retry: 'Reintento de pago en curso',
          active: 'Suscripción activa',
          canceled_pending: 'Cancelada pero servicio activo hasta fin de ciclo',
          paused: 'Servicio pausado'
        }
      },
      source: 'SSOT-V2.md section 2.2',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting SSOT subscription states:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve subscription states'
    });
  }
});

/**
 * GET /api/ssot/platforms
 * Get supported and planned platforms
 * Source: SSOT-V2.md section 7
 */
router.get('/platforms', (req, res) => {
  try {
    const platforms = {
      supported: ssotService.getSupportedPlatforms(),
      planned: ssotService.getPlannedPlatforms(),
      notes: {
        supported: 'Plataformas implementadas en v2 MVP',
        planned: 'Plataformas planificadas pero no implementadas en v2'
      }
    };

    res.status(200).json({
      success: true,
      data: platforms,
      source: 'SSOT-V2.md section 7',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting SSOT platforms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve platform information'
    });
  }
});

/**
 * GET /api/ssot/all
 * Get all SSOT data in a single response
 * Convenience endpoint for frontend v2
 */
router.get('/all', (req, res) => {
  try {
    const allData = ssotService.getAllSSOTData();

    res.status(200).json({
      success: true,
      data: allData,
      source: 'SSOT-V2.md',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting all SSOT data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve SSOT data'
    });
  }
});

module.exports = router;

