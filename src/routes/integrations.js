const express = require('express');
const userIntegrationsService = require('../services/userIntegrationsService');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/integrations
 * Get user's integration configurations
 */
router.get('/', async (req, res) => {
    try {
        const integrations = await userIntegrationsService.getUserIntegrations(req.accessToken);
        
        res.status(200).json({
            success: true,
            data: integrations
        });
        
    } catch (error) {
        logger.error('Get integrations endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/integrations/platforms
 * Get available platforms for user's plan
 */
router.get('/platforms', async (req, res) => {
    try {
        const platforms = await userIntegrationsService.getAvailablePlatforms(req.accessToken);
        
        res.status(200).json({
            success: true,
            data: platforms
        });
        
    } catch (error) {
        logger.error('Get platforms endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/integrations/:platform
 * Create or update integration configuration
 */
router.post('/:platform', async (req, res) => {
    try {
        const { platform } = req.params;
        const config = req.body;
        
        const integration = await userIntegrationsService.updateIntegration(
            req.accessToken,
            platform,
            config
        );
        
        res.status(200).json({
            success: true,
            data: integration
        });
        
    } catch (error) {
        logger.error('Update integration endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/integrations/:platform
 * Update integration configuration (alias for POST)
 */
router.put('/:platform', async (req, res) => {
    try {
        const { platform } = req.params;
        const config = req.body;
        
        const integration = await userIntegrationsService.updateIntegration(
            req.accessToken,
            platform,
            config
        );
        
        res.status(200).json({
            success: true,
            data: integration
        });
        
    } catch (error) {
        logger.error('Update integration endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/integrations/:platform
 * Delete integration configuration
 */
router.delete('/:platform', async (req, res) => {
    try {
        const { platform } = req.params;
        
        const result = await userIntegrationsService.deleteIntegration(
            req.accessToken,
            platform
        );
        
        res.status(200).json({
            success: true,
            data: result
        });
        
    } catch (error) {
        logger.error('Delete integration endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/integrations/metrics
 * Get integration usage metrics for user
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await userIntegrationsService.getIntegrationsMetrics(req.accessToken);
        
        res.status(200).json({
            success: true,
            data: metrics
        });
        
    } catch (error) {
        logger.error('Get integration metrics endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/integrations/:platform/enable
 * Enable a specific integration
 */
router.post('/:platform/enable', async (req, res) => {
    try {
        const { platform } = req.params;
        
        const integration = await userIntegrationsService.updateIntegration(
            req.accessToken,
            platform,
            { enabled: true }
        );
        
        res.status(200).json({
            success: true,
            data: integration
        });
        
    } catch (error) {
        logger.error('Enable integration endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/integrations/:platform/disable
 * Disable a specific integration
 */
router.post('/:platform/disable', async (req, res) => {
    try {
        const { platform } = req.params;
        
        const integration = await userIntegrationsService.updateIntegration(
            req.accessToken,
            platform,
            { enabled: false }
        );
        
        res.status(200).json({
            success: true,
            data: integration
        });
        
    } catch (error) {
        logger.error('Disable integration endpoint error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;