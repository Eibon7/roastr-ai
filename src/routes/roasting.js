/**
 * Roasting Control Routes (Issue #596)
 * Global enable/disable toggle for roasting feature
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const workerNotificationService = require('../services/workerNotificationService');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/roasting/status
 * Get current roasting status for authenticated user
 */
router.get('/status', async (req, res) => {
    try {
        const { user } = req;

        const { data: userData, error } = await supabaseServiceClient
            .from('users')
            .select('roasting_enabled, roasting_disabled_at, roasting_disabled_reason')
            .eq('id', user.id)
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json({
            success: true,
            data: {
                roasting_enabled: userData.roasting_enabled ?? true,
                roasting_disabled_at: userData.roasting_disabled_at,
                roasting_disabled_reason: userData.roasting_disabled_reason
            }
        });

    } catch (error) {
        logger.error('Get roasting status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve roasting status'
        });
    }
});

/**
 * POST /api/roasting/toggle
 * Toggle roasting on/off for authenticated user
 *
 * Body:
 * {
 *   enabled: boolean,
 *   reason?: string (optional reason for disabling)
 * }
 */
router.post('/toggle', async (req, res) => {
    try {
        const { user } = req;
        const { enabled, reason } = req.body;

        // Validate input
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'enabled field must be a boolean'
            });
        }

        // Prepare update data
        const updateData = {
            roasting_enabled: enabled,
            updated_at: new Date().toISOString()
        };

        // If disabling, add audit trail
        if (!enabled) {
            updateData.roasting_disabled_at = new Date().toISOString();
            updateData.roasting_disabled_reason = reason || 'user_request';
        } else {
            // If enabling, clear audit trail
            updateData.roasting_disabled_at = null;
            updateData.roasting_disabled_reason = null;
        }

        // Update database
        const { data, error } = await supabaseServiceClient
            .from('users')
            .update(updateData)
            .eq('id', user.id)
            .select('roasting_enabled, roasting_disabled_at, roasting_disabled_reason')
            .single();

        if (error) {
            throw error;
        }

        // Notify workers of state change
        await workerNotificationService.notifyRoastingStateChange(
            user.id,
            enabled,
            { reason }
        );

        logger.info('Roasting state changed:', {
            userId: user.id,
            enabled,
            reason
        });

        res.status(200).json({
            success: true,
            message: `Roasting ${enabled ? 'enabled' : 'disabled'} successfully`,
            data: {
                roasting_enabled: data.roasting_enabled,
                roasting_disabled_at: data.roasting_disabled_at,
                roasting_disabled_reason: data.roasting_disabled_reason
            }
        });

    } catch (error) {
        logger.error('Toggle roasting error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle roasting status'
        });
    }
});

/**
 * GET /api/roasting/stats
 * Get roasting statistics (pending jobs, cancelled jobs, etc.)
 */
router.get('/stats', async (req, res) => {
    try {
        const { user } = req;

        // Get organization
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

        // Get pending roast jobs count
        const { data: pendingJobs, error: jobsError } = await supabaseServiceClient
            .from('job_queue')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgData.id)
            .eq('job_type', 'generate_reply')
            .eq('status', 'pending');

        if (jobsError) {
            throw jobsError;
        }

        // Get total roasts generated today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: todayRoasts, error: roastsError } = await supabaseServiceClient
            .from('responses')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgData.id)
            .gte('created_at', today.toISOString());

        if (roastsError) {
            throw roastsError;
        }

        res.status(200).json({
            success: true,
            data: {
                pending_jobs: pendingJobs || 0,
                roasts_today: todayRoasts || 0
            }
        });

    } catch (error) {
        logger.error('Get roasting stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve roasting statistics'
        });
    }
});

module.exports = router;
