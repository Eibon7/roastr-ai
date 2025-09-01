/**
 * Admin Feature Flags API Routes
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 * 
 * Provides secure endpoints for managing feature flags and kill switch
 * - GET /api/admin/feature-flags - List all feature flags
 * - PUT /api/admin/feature-flags/:flagKey - Update a specific feature flag
 * - POST /api/admin/kill-switch - Toggle the global kill switch
 * - GET /api/admin/audit-logs - Get audit logs for admin actions
 */

const express = require('express');
const router = express.Router();
const { supabaseServiceClient } = require('../../config/supabase');
const { requireAdmin } = require('../../middleware/auth');
const { logger } = require('../../utils/logger');
const SafeUtils = require('../../utils/safeUtils');

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/feature-flags
 * Get all feature flags with their current status
 */
router.get('/feature-flags', async (req, res) => {
    try {
        const { category } = req.query;
        
        let query = supabaseServiceClient
            .from('feature_flags')
            .select('*')
            .order('category', { ascending: true })
            .order('flag_name', { ascending: true });
        
        if (category) {
            query = query.eq('category', category);
        }
        
        const { data: flags, error } = await query;
        
        if (error) {
            throw error;
        }
        
        // Group flags by category for better UI organization
        const flagsByCategory = flags.reduce((acc, flag) => {
            const cat = flag.category || 'general';
            if (!acc[cat]) {
                acc[cat] = [];
            }
            acc[cat].push(flag);
            return acc;
        }, {});
        
        logger.info('Feature flags retrieved', {
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            totalFlags: flags.length,
            categories: Object.keys(flagsByCategory)
        });
        
        res.json({
            success: true,
            data: {
                flags,
                flagsByCategory,
                totalCount: flags.length
            }
        });
        
    } catch (error) {
        logger.error('Failed to retrieve feature flags', {
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve feature flags'
        });
    }
});

/**
 * PUT /api/admin/feature-flags/:flagKey
 * Update a specific feature flag
 */
router.put('/feature-flags/:flagKey', async (req, res) => {
    try {
        const { flagKey } = req.params;
        const { is_enabled, flag_value, description } = req.body;
        
        // Validate input
        if (typeof is_enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'is_enabled must be a boolean value'
            });
        }
        
        // Get current flag state for audit logging
        const { data: currentFlag, error: fetchError } = await supabaseServiceClient
            .from('feature_flags')
            .select('*')
            .eq('flag_key', flagKey)
            .single();
        
        if (fetchError || !currentFlag) {
            return res.status(404).json({
                success: false,
                error: 'Feature flag not found'
            });
        }
        
        // Prepare update data
        const updateData = {
            is_enabled,
            updated_by: req.user.id,
            updated_at: new Date().toISOString()
        };
        
        if (flag_value !== undefined) {
            updateData.flag_value = flag_value;
        }
        
        if (description !== undefined) {
            updateData.description = description;
        }
        
        // Update the flag
        const { data: updatedFlag, error: updateError } = await supabaseServiceClient
            .from('feature_flags')
            .update(updateData)
            .eq('flag_key', flagKey)
            .select()
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        // Log the change in audit logs
        await logAdminAction(
            req.user.id,
            'feature_flag_update',
            'feature_flag',
            flagKey,
            {
                is_enabled: currentFlag.is_enabled,
                flag_value: currentFlag.flag_value,
                description: currentFlag.description
            },
            {
                is_enabled: updatedFlag.is_enabled,
                flag_value: updatedFlag.flag_value,
                description: updatedFlag.description
            },
            `Feature flag '${currentFlag.flag_name}' ${is_enabled ? 'enabled' : 'disabled'}`,
            req.ip,
            req.get('User-Agent')
        );
        
        logger.info('Feature flag updated', {
            flagKey,
            flagName: currentFlag.flag_name,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            oldEnabled: currentFlag.is_enabled,
            newEnabled: updatedFlag.is_enabled
        });
        
        res.json({
            success: true,
            data: {
                flag: updatedFlag,
                message: `Feature flag '${currentFlag.flag_name}' updated successfully`
            }
        });
        
    } catch (error) {
        logger.error('Failed to update feature flag', {
            flagKey: req.params.flagKey,
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to update feature flag'
        });
    }
});

/**
 * POST /api/admin/kill-switch
 * Toggle the global kill switch for autopost
 */
router.post('/kill-switch', async (req, res) => {
    try {
        const { enabled, reason } = req.body;
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'enabled must be a boolean value'
            });
        }
        
        const killSwitchKey = 'KILL_SWITCH_AUTOPOST';
        
        // Get current kill switch state
        const { data: currentFlag, error: fetchError } = await supabaseServiceClient
            .from('feature_flags')
            .select('*')
            .eq('flag_key', killSwitchKey)
            .single();
        
        if (fetchError || !currentFlag) {
            return res.status(404).json({
                success: false,
                error: 'Kill switch flag not found'
            });
        }
        
        // Update kill switch
        const { data: updatedFlag, error: updateError } = await supabaseServiceClient
            .from('feature_flags')
            .update({
                is_enabled: enabled,
                flag_value: enabled,
                updated_by: req.user.id,
                updated_at: new Date().toISOString()
            })
            .eq('flag_key', killSwitchKey)
            .select()
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        // Log the critical action
        await logAdminAction(
            req.user.id,
            'kill_switch_toggle',
            'kill_switch',
            killSwitchKey,
            { enabled: currentFlag.is_enabled },
            { enabled: updatedFlag.is_enabled },
            `Kill switch ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}${reason ? ` - Reason: ${reason}` : ''}`,
            req.ip,
            req.get('User-Agent')
        );
        
        // Log with high priority
        logger.warn('KILL SWITCH TOGGLED', {
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            adminEmail: SafeUtils.maskEmail(req.user.email) || 'unknown-email',
            previousState: currentFlag.is_enabled,
            newState: updatedFlag.is_enabled,
            reason: reason || 'No reason provided',
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            data: {
                killSwitchEnabled: updatedFlag.is_enabled,
                message: `Kill switch ${enabled ? 'activated' : 'deactivated'} successfully`,
                timestamp: updatedFlag.updated_at
            }
        });
        
    } catch (error) {
        logger.error('Failed to toggle kill switch', {
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to toggle kill switch'
        });
    }
});

/**
 * GET /api/admin/audit-logs
 * Get audit logs for admin actions
 */
router.get('/audit-logs', async (req, res) => {
    try {
        const { 
            limit = 50, 
            offset = 0, 
            action_type, 
            resource_type,
            admin_user_id,
            start_date,
            end_date
        } = req.query;
        
        let query = supabaseServiceClient
            .from('admin_audit_logs')
            .select(`
                *,
                admin_user:admin_user_id (
                    id, email, name
                )
            `)
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        
        // Apply filters
        if (action_type) {
            query = query.eq('action_type', action_type);
        }
        
        if (resource_type) {
            query = query.eq('resource_type', resource_type);
        }
        
        if (admin_user_id) {
            query = query.eq('admin_user_id', admin_user_id);
        }
        
        if (start_date) {
            query = query.gte('created_at', start_date);
        }
        
        if (end_date) {
            query = query.lte('created_at', end_date);
        }
        
        const { data: logs, error, count } = await query;
        
        if (error) {
            throw error;
        }
        
        logger.info('Audit logs retrieved', {
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            logsCount: logs.length,
            filters: { action_type, resource_type, admin_user_id }
        });
        
        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    offset: parseInt(offset),
                    limit: parseInt(limit),
                    total: count
                }
            }
        });
        
    } catch (error) {
        logger.error('Failed to retrieve audit logs', {
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit logs'
        });
    }
});

/**
 * Helper function to log admin actions
 */
async function logAdminAction(adminUserId, actionType, resourceType, resourceId, oldValue, newValue, description, ipAddress, userAgent) {
    try {
        const { error } = await supabaseServiceClient
            .from('admin_audit_logs')
            .insert({
                admin_user_id: adminUserId,
                action_type: actionType,
                resource_type: resourceType,
                resource_id: resourceId,
                old_value: oldValue,
                new_value: newValue,
                description,
                ip_address: ipAddress,
                user_agent: userAgent
            });
        
        if (error) {
            logger.error('Failed to log admin action', {
                error: error.message,
                actionType,
                resourceType,
                resourceId
            });
        }
    } catch (error) {
        logger.error('Failed to log admin action', {
            error: error.message,
            actionType,
            resourceType,
            resourceId
        });
    }
}

module.exports = router;
