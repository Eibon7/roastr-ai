/**
 * Backoffice Settings API Routes
 * Issue #371: SPEC 15 — Backoffice (MVP): thresholds globales, flags y soporte básico
 * 
 * Provides secure endpoints for managing global thresholds, feature flags and healthchecks
 * - GET /api/admin/backoffice/thresholds - Get global Shield thresholds
 * - PUT /api/admin/backoffice/thresholds - Update global Shield thresholds  
 * - POST /api/admin/backoffice/healthcheck - Run platform API healthchecks
 * - GET /api/admin/backoffice/healthcheck/status - Get current healthcheck status
 * - GET /api/admin/backoffice/audit/export - Export audit logs as CSV/JSON
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
 * GET /api/admin/backoffice/thresholds
 * Get current global Shield thresholds configuration
 */
router.get('/thresholds', async (req, res) => {
    try {
        // Get global Shield thresholds from shield_settings or global_config table
        const { data: globalSettings, error } = await supabaseServiceClient
            .from('global_shield_settings')
            .select('*')
            .eq('scope', 'global')
            .single();

        let thresholds;
        if (error && error.code === 'PGRST116') {
            // No global settings exist yet, return defaults
            thresholds = {
                tau_roast_lower: 0.25,
                tau_shield: 0.70,
                tau_critical: 0.90,
                aggressiveness: 95,
                scope: 'global',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
        } else if (error) {
            throw error;
        } else {
            thresholds = globalSettings;
        }

        logger.info('Global thresholds retrieved', {
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            aggressiveness: thresholds.aggressiveness
        });

        res.json({
            success: true,
            data: {
                thresholds,
                aggressiveness_levels: {
                    90: { name: 'Lenient', description: 'More tolerant approach, fewer interventions' },
                    95: { name: 'Balanced', description: 'Default balanced approach' },
                    98: { name: 'Strict', description: 'Stricter moderation, more interventions' },
                    100: { name: 'Maximum', description: 'Maximum protection, lowest tolerance' }
                }
            }
        });

    } catch (error) {
        logger.error('Failed to retrieve global thresholds', {
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve global thresholds'
        });
    }
});

/**
 * PUT /api/admin/backoffice/thresholds
 * Update global Shield thresholds
 */
router.put('/thresholds', async (req, res) => {
    try {
        const { tau_roast_lower, tau_shield, tau_critical, aggressiveness } = req.body;

        // Validation
        if (typeof tau_roast_lower !== 'number' || tau_roast_lower < 0 || tau_roast_lower > 1) {
            return res.status(400).json({
                success: false,
                error: 'tau_roast_lower must be a number between 0 and 1'
            });
        }

        if (typeof tau_shield !== 'number' || tau_shield < 0 || tau_shield > 1) {
            return res.status(400).json({
                success: false,
                error: 'tau_shield must be a number between 0 and 1'
            });
        }

        if (typeof tau_critical !== 'number' || tau_critical < 0 || tau_critical > 1) {
            return res.status(400).json({
                success: false,
                error: 'tau_critical must be a number between 0 and 1'
            });
        }

        if (![90, 95, 98, 100].includes(aggressiveness)) {
            return res.status(400).json({
                success: false,
                error: 'aggressiveness must be one of: 90, 95, 98, 100'
            });
        }

        // Validate threshold hierarchy: tau_roast_lower < tau_shield < tau_critical
        if (tau_roast_lower >= tau_shield) {
            return res.status(400).json({
                success: false,
                error: 'tau_roast_lower must be less than tau_shield'
            });
        }

        if (tau_shield >= tau_critical) {
            return res.status(400).json({
                success: false,
                error: 'tau_shield must be less than tau_critical'
            });
        }

        // Get current settings for audit logging
        const { data: currentSettings } = await supabaseServiceClient
            .from('global_shield_settings')
            .select('*')
            .eq('scope', 'global')
            .single();

        const updateData = {
            tau_roast_lower,
            tau_shield,
            tau_critical,
            aggressiveness,
            scope: 'global',
            updated_at: new Date().toISOString(),
            updated_by: req.user.id
        };

        // Upsert global settings
        const { data: updatedSettings, error: upsertError } = await supabaseServiceClient
            .from('global_shield_settings')
            .upsert(updateData)
            .eq('scope', 'global')
            .select()
            .single();

        if (upsertError) {
            throw upsertError;
        }

        // Log the change in audit logs
        await logAdminAction(
            req.user.id,
            'global_thresholds_update',
            'global_shield_settings',
            'global',
            currentSettings ? {
                tau_roast_lower: currentSettings.tau_roast_lower,
                tau_shield: currentSettings.tau_shield,
                tau_critical: currentSettings.tau_critical,
                aggressiveness: currentSettings.aggressiveness
            } : null,
            {
                tau_roast_lower,
                tau_shield,
                tau_critical,
                aggressiveness
            },
            `Global Shield thresholds updated to aggressiveness level ${aggressiveness}%`,
            req.ip,
            req.get('User-Agent')
        );

        logger.info('Global thresholds updated', {
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            newAggressiveness: aggressiveness,
            thresholds: { tau_roast_lower, tau_shield, tau_critical }
        });

        res.json({
            success: true,
            data: {
                thresholds: updatedSettings,
                message: `Global Shield thresholds updated to ${aggressiveness}% aggressiveness level`
            }
        });

    } catch (error) {
        logger.error('Failed to update global thresholds', {
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });

        res.status(500).json({
            success: false,
            error: 'Failed to update global thresholds'
        });
    }
});

/**
 * POST /api/admin/backoffice/healthcheck
 * Run healthcheck for platform APIs
 */
router.post('/healthcheck', async (req, res) => {
    try {
        const { platforms = [] } = req.body;
        const allPlatforms = ['twitter', 'youtube', 'discord', 'twitch', 'instagram', 'facebook'];
        const platformsToCheck = platforms.length > 0 ? platforms : allPlatforms;

        const healthResults = {};
        
        // Check each platform API
        for (const platform of platformsToCheck) {
            try {
                let isHealthy = false;
                let error = null;
                let responseTime = 0;
                
                const startTime = Date.now();
                
                switch (platform) {
                    case 'twitter':
                        if (process.env.TWITTER_BEARER_TOKEN) {
                            // Simple API call to verify Twitter connectivity
                            const response = await fetch('https://api.twitter.com/2/users/me', {
                                headers: { 'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}` }
                            });
                            isHealthy = response.ok;
                            if (!response.ok) {
                                error = `HTTP ${response.status}: ${response.statusText}`;
                            }
                        } else {
                            error = 'Twitter API credentials not configured';
                        }
                        break;
                        
                    case 'youtube':
                        if (process.env.YOUTUBE_API_KEY) {
                            // Simple API call to verify YouTube connectivity
                            const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&key=${process.env.YOUTUBE_API_KEY}`);
                            isHealthy = response.ok;
                            if (!response.ok) {
                                error = `HTTP ${response.status}: ${response.statusText}`;
                            }
                        } else {
                            error = 'YouTube API key not configured';
                        }
                        break;
                        
                    case 'discord':
                        if (process.env.DISCORD_BOT_TOKEN) {
                            // Simple API call to verify Discord connectivity
                            const response = await fetch('https://discord.com/api/users/@me', {
                                headers: { 'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}` }
                            });
                            isHealthy = response.ok;
                            if (!response.ok) {
                                error = `HTTP ${response.status}: ${response.statusText}`;
                            }
                        } else {
                            error = 'Discord bot token not configured';
                        }
                        break;
                        
                    case 'twitch':
                        if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
                            // Simple API call to verify Twitch connectivity
                            const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: `client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`
                            });
                            isHealthy = tokenResponse.ok;
                            if (!tokenResponse.ok) {
                                error = `HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`;
                            }
                        } else {
                            error = 'Twitch API credentials not configured';
                        }
                        break;
                        
                    case 'instagram':
                        // Instagram Basic Display API doesn't have a simple healthcheck endpoint
                        // We'll just mark as healthy if token is present
                        if (process.env.INSTAGRAM_ACCESS_TOKEN) {
                            isHealthy = true;
                        } else {
                            error = 'Instagram access token not configured';
                        }
                        break;
                        
                    case 'facebook':
                        // Facebook Graph API doesn't have a simple healthcheck endpoint
                        // We'll just mark as healthy if token is present
                        if (process.env.FACEBOOK_ACCESS_TOKEN) {
                            isHealthy = true;
                        } else {
                            error = 'Facebook access token not configured';
                        }
                        break;
                        
                    default:
                        error = 'Unknown platform';
                }
                
                responseTime = Date.now() - startTime;
                
                healthResults[platform] = {
                    status: isHealthy ? 'OK' : 'FAIL',
                    error,
                    response_time_ms: responseTime,
                    checked_at: new Date().toISOString()
                };
                
            } catch (platformError) {
                healthResults[platform] = {
                    status: 'FAIL',
                    error: platformError.message,
                    response_time_ms: 0,
                    checked_at: new Date().toISOString()
                };
            }
        }

        // Store healthcheck results
        const { error: storeError } = await supabaseServiceClient
            .from('healthcheck_results')
            .insert({
                checked_by: req.user.id,
                results: healthResults,
                platforms_checked: platformsToCheck,
                overall_status: Object.values(healthResults).every(r => r.status === 'OK') ? 'OK' : 'FAIL'
            });

        if (storeError) {
            logger.warn('Failed to store healthcheck results:', storeError.message);
        }

        // Log the healthcheck
        await logAdminAction(
            req.user.id,
            'healthcheck_run',
            'platform_apis',
            'all',
            null,
            healthResults,
            `Platform healthcheck performed for: ${platformsToCheck.join(', ')}`,
            req.ip,
            req.get('User-Agent')
        );

        logger.info('Platform healthcheck performed', {
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            platforms: platformsToCheck,
            overallStatus: Object.values(healthResults).every(r => r.status === 'OK') ? 'OK' : 'FAIL'
        });

        res.json({
            success: true,
            data: {
                results: healthResults,
                overall_status: Object.values(healthResults).every(r => r.status === 'OK') ? 'OK' : 'FAIL',
                checked_at: new Date().toISOString(),
                platforms_checked: platformsToCheck
            }
        });

    } catch (error) {
        logger.error('Failed to perform healthcheck', {
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });

        res.status(500).json({
            success: false,
            error: 'Failed to perform healthcheck'
        });
    }
});

/**
 * GET /api/admin/backoffice/healthcheck/status
 * Get latest healthcheck status
 */
router.get('/healthcheck/status', async (req, res) => {
    try {
        // Get the most recent healthcheck result
        const { data: latestHealthcheck, error } = await supabaseServiceClient
            .from('healthcheck_results')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        logger.info('Latest healthcheck status retrieved', {
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            hasResults: !!latestHealthcheck
        });

        res.json({
            success: true,
            data: latestHealthcheck || {
                message: 'No healthcheck has been performed yet',
                overall_status: 'UNKNOWN',
                results: {},
                created_at: null
            }
        });

    } catch (error) {
        logger.error('Failed to retrieve healthcheck status', {
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve healthcheck status'
        });
    }
});

/**
 * GET /api/admin/backoffice/audit/export
 * Export audit logs as CSV or JSON
 */
router.get('/audit/export', async (req, res) => {
    try {
        const { 
            format = 'csv',
            days = 30,
            action_type,
            resource_type,
            admin_user_id
        } = req.query;

        if (!['csv', 'json'].includes(format)) {
            return res.status(400).json({
                success: false,
                error: 'format must be either csv or json'
            });
        }

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(days));

        // Build query
        let query = supabaseServiceClient
            .from('admin_audit_logs')
            .select(`
                *,
                admin_user:admin_user_id (
                    id, email, name
                )
            `)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false });

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

        const { data: auditLogs, error } = await query;

        if (error) {
            throw error;
        }

        // Log the export action
        await logAdminAction(
            req.user.id,
            'audit_logs_export',
            'audit_logs',
            'bulk',
            null,
            { format, days, filters: { action_type, resource_type, admin_user_id } },
            `Audit logs exported in ${format} format for last ${days} days`,
            req.ip,
            req.get('User-Agent')
        );

        if (format === 'csv') {
            // Generate CSV
            let csv = 'Timestamp,Admin Email,Action Type,Resource Type,Resource ID,Description,IP Address,User Agent,Old Value,New Value\n';
            
            auditLogs.forEach(log => {
                const adminEmail = log.admin_user?.email || 'Unknown';
                const oldValue = log.old_value ? JSON.stringify(log.old_value).replace(/"/g, '""') : '';
                const newValue = log.new_value ? JSON.stringify(log.new_value).replace(/"/g, '""') : '';
                
                csv += `"${log.created_at}",`;
                csv += `"${adminEmail}",`;
                csv += `"${log.action_type}",`;
                csv += `"${log.resource_type}",`;
                csv += `"${log.resource_id || ''}",`;
                csv += `"${(log.description || '').replace(/"/g, '""')}",`;
                csv += `"${log.ip_address || ''}",`;
                csv += `"${(log.user_agent || '').replace(/"/g, '""')}",`;
                csv += `"${oldValue}",`;
                csv += `"${newValue}"\n`;
            });

            const filename = `roastr-audit-logs-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);
        } else {
            // Return JSON
            const filename = `roastr-audit-logs-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.json`;
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.json({
                success: true,
                export_info: {
                    format,
                    date_range: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                        days: parseInt(days)
                    },
                    filters: { action_type, resource_type, admin_user_id },
                    total_records: auditLogs.length,
                    exported_at: new Date().toISOString(),
                    exported_by: req.user.email
                },
                data: auditLogs
            });
        }

        logger.info('Audit logs exported', {
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id),
            format,
            recordCount: auditLogs.length,
            days: parseInt(days)
        });

    } catch (error) {
        logger.error('Failed to export audit logs', {
            error: error.message,
            adminUserId: SafeUtils.safeUserIdPrefix(req.user.id)
        });

        res.status(500).json({
            success: false,
            error: 'Failed to export audit logs'
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