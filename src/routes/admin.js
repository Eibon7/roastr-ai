const express = require('express');
const { supabaseServiceClient } = require('../config/supabase');
const { isAdminMiddleware } = require('../middleware/isAdmin');
const { logger } = require('../utils/logger');
const metricsService = require('../services/metricsService');
const authService = require('../services/authService');
const CostControlService = require('../services/costControl');
const revenueRoutes = require('./revenue');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const planLimitsService = require('../services/planLimitsService');

const router = express.Router();

// Aplicar middleware de admin a todas las rutas
router.use(isAdminMiddleware);

// Revenue dashboard routes (admin only)
router.use('/revenue', revenueRoutes);

/**
 * GET /api/admin/dashboard
 * Obtener estadísticas generales del dashboard con métricas avanzadas
 */
router.get('/dashboard', async (req, res) => {
    try {
        // Usar el nuevo servicio de métricas
        const dashboardData = await metricsService.getDashboardMetrics();
        
        // Agregar timestamp
        dashboardData.system = {
            last_updated: new Date().toISOString()
        };

        res.json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        logger.error('Dashboard endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/users
 * Obtener lista de usuarios con filtros
 */
router.get('/users', async (req, res) => {
    try {
        const { 
            limit = 50, 
            offset = 0, 
            search = '', 
            admin_only = false,
            active_only = false 
        } = req.query;

        let query = supabaseServiceClient
            .from('users')
            .select(`
                id, email, name, is_admin, active, created_at, last_activity_at,
                total_messages_sent, monthly_messages_sent, plan,
                organizations!owner_id (id, name, monthly_responses_used)
            `);

        // Filtros
        if (search) {
            query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
        }

        if (admin_only === 'true') {
            query = query.eq('is_admin', true);
        }

        if (active_only === 'true') {
            query = query.eq('active', true);
        }

        // Ordenar y paginar
        query = query
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data: users, error, count } = await query;

        if (error) {
            throw new Error(`Error fetching users: ${error.message}`);
        }

        res.json({
            success: true,
            data: {
                users: users || [],
                pagination: {
                    total: count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: count > (parseInt(offset) + parseInt(limit))
                }
            }
        });

    } catch (error) {
        logger.error('Users list endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/users/:userId/toggle-admin
 * Promover/demover usuario admin
 */
router.post('/users/:userId/toggle-admin', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Obtener usuario actual
        const { data: currentUser, error: fetchError } = await supabaseServiceClient
            .from('users')
            .select('email, name, is_admin')
            .eq('id', userId)
            .single();

        if (fetchError || !currentUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const newAdminStatus = !currentUser.is_admin;

        // Actualizar estado de admin
        const { data: updatedUser, error: updateError } = await supabaseServiceClient
            .from('users')
            .update({ is_admin: newAdminStatus })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
            throw new Error(`Error updating admin status: ${updateError.message}`);
        }

        // Log de la acción
        logger.info('Admin status toggled:', {
            targetUserId: userId,
            targetUserEmail: currentUser.email,
            newAdminStatus,
            performedBy: req.user.email
        });

        res.json({
            success: true,
            data: {
                user: updatedUser,
                message: `Usuario ${newAdminStatus ? 'promovido a' : 'removido de'} administrador`
            }
        });

    } catch (error) {
        logger.error('Toggle admin endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle admin status',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/users/:userId/toggle-active
 * Activar/desactivar usuario
 */
router.post('/users/:userId/toggle-active', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Obtener usuario actual
        const { data: currentUser, error: fetchError } = await supabaseServiceClient
            .from('users')
            .select('email, name, active')
            .eq('id', userId)
            .single();

        if (fetchError || !currentUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const newActiveStatus = !currentUser.active;

        // Actualizar estado activo
        const { data: updatedUser, error: updateError } = await supabaseServiceClient
            .from('users')
            .update({ active: newActiveStatus })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
            throw new Error(`Error updating active status: ${updateError.message}`);
        }

        // Log de la acción
        logger.info('User active status toggled:', {
            targetUserId: userId,
            targetUserEmail: currentUser.email,
            newActiveStatus,
            performedBy: req.user.email
        });

        res.json({
            success: true,
            data: {
                user: updatedUser,
                message: `Usuario ${newActiveStatus ? 'activado' : 'desactivado'} exitosamente`
            }
        });

    } catch (error) {
        logger.error('Toggle active endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle active status',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/users/:userId/suspend
 * Suspender usuario (no puede generar roasts pero sí acceder al dashboard)
 */
router.post('/users/:userId/suspend', async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;
        
        const result = await authService.suspendUser(userId, req.user.id, reason);
        
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error('Suspend user endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to suspend user',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/users/:userId/reactivate
 * Reactivar usuario suspendido
 */
router.post('/users/:userId/reactivate', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await authService.unsuspendUser(userId, req.user.id);
        
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error('Reactivate user endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to reactivate user',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/integrations/test
 * Ejecutar test de integraciones
 */
router.post('/integrations/test', async (req, res) => {
    try {
        const { platforms = '' } = req.body;
        
        // Construir comando
        let command = 'npm run integrations:test';
        if (platforms) {
            command = `INTEGRATIONS_ENABLED=${platforms} ${command}`;
        }

        // Ejecutar comando con timeout
        exec(command, { 
            cwd: process.cwd(),
            timeout: 60000 // 60 segundos
        }, (error, stdout, stderr) => {
            if (error) {
                logger.error('Integration test error:', error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Test execution failed',
                    output: stderr || error.message
                });
            }

            // Log de la ejecución
            logger.info('Integration test executed:', {
                platforms: platforms || 'all',
                performedBy: req.user.email,
                stdout: stdout.substring(0, 500) // Primeros 500 caracteres
            });

            res.json({
                success: true,
                data: {
                    output: stdout,
                    command: command,
                    executed_at: new Date().toISOString()
                }
            });
        });

    } catch (error) {
        logger.error('Integration test endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to execute integration test',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/config
 * Obtener configuración actual del sistema
 */
router.get('/config', async (req, res) => {
    try {
        // Obtener variables de entorno relevantes
        const config = {
            integrations: {
                enabled: process.env.INTEGRATIONS_ENABLED || 'twitter,youtube,bluesky',
                twitter_enabled: process.env.TWITTER_ENABLED || 'true',
                youtube_enabled: process.env.YOUTUBE_ENABLED || 'true',
                bluesky_enabled: process.env.BLUESKY_ENABLED || 'true'
            },
            features: {
                shield_enabled: process.env.SHIELD_ENABLED || 'true',
                debug: process.env.DEBUG || 'false',
                node_env: process.env.NODE_ENV || 'development'
            },
            limits: {
                response_frequency: process.env.RESPONSE_FREQUENCY || '1.0',
                tone: process.env.TONE || 'sarcastic'
            }
        };

        // Obtener configuraciones desde la base de datos si existen
        const { data: integrationConfigs } = await supabaseServiceClient
            .from('integration_configs')
            .select('platform, enabled, tone, response_frequency, shield_enabled')
            .limit(10);

        res.json({
            success: true,
            data: {
                env_config: config,
                database_config: integrationConfigs || []
            }
        });

    } catch (error) {
        logger.error('Config endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch configuration',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/logs
 * Obtener logs recientes del sistema
 */
router.get('/logs', async (req, res) => {
    try {
        const { type = 'all', limit = 100 } = req.query;

        // Obtener logs de la base de datos si existe tabla app_logs
        const { data: dbLogs, error } = await supabaseServiceClient
            .from('app_logs')
            .select('id, level, category, message, platform, created_at, metadata')
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        let logs = [];
        
        if (error) {
            // Si no hay tabla de logs, crear logs de muestra
            logs = [
                {
                    id: '1',
                    level: 'info',
                    category: 'integration',
                    message: 'Integration test executed successfully',
                    platform: 'twitter',
                    created_at: new Date().toISOString(),
                    metadata: { performed_by: req.user.email }
                },
                {
                    id: '2',
                    level: 'warn',
                    category: 'shield',
                    message: 'High toxicity comment detected',
                    platform: 'youtube',
                    created_at: new Date(Date.now() - 3600000).toISOString(),
                    metadata: { toxicity_score: 0.95 }
                }
            ];
        } else {
            logs = dbLogs || [];
        }

        // Filtrar por tipo si se especifica
        if (type !== 'all') {
            logs = logs.filter(log => log.category === type || log.level === type);
        }

        res.json({
            success: true,
            data: {
                logs,
                total: logs.length,
                filtered_by: type
            }
        });

    } catch (error) {
        logger.error('Logs endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch logs',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/usage
 * Get usage statistics across all organizations
 */
router.get('/usage', async (req, res) => {
    try {
        const { 
            period = 'current_month',
            limit = 50, 
            offset = 0,
            organization_id = null,
            resource_type = null 
        } = req.query;

        const costControl = new CostControlService();
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        // Base query for usage tracking
        let query = supabaseServiceClient
            .from('usage_tracking')
            .select(`
                id, organization_id, user_id, resource_type, platform,
                quantity, year, month, day, cost_cents, tokens_used,
                created_at, metadata,
                organizations!inner(id, name, plan_id)
            `);

        // Apply filters
        if (period === 'current_month') {
            query = query.eq('year', currentYear).eq('month', currentMonth);
        } else if (period === 'last_month') {
            const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
            query = query.eq('year', lastMonthYear).eq('month', lastMonth);
        }

        if (organization_id) {
            query = query.eq('organization_id', organization_id);
        }

        if (resource_type) {
            query = query.eq('resource_type', resource_type);
        }

        // Order and paginate
        query = query
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data: usageRecords, error, count } = await query;

        if (error) {
            throw new Error(`Error fetching usage data: ${error.message}`);
        }

        // Get summary statistics
        const { data: summaryData, error: summaryError } = await supabaseServiceClient
            .rpc('get_usage_summary', {
                target_year: period === 'last_month' && currentMonth === 1 ? currentYear - 1 : currentYear,
                target_month: period === 'last_month' ? (currentMonth === 1 ? 12 : currentMonth - 1) : currentMonth
            });

        res.json({
            success: true,
            data: {
                usage_records: usageRecords || [],
                summary: summaryData || [],
                pagination: {
                    total: count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: count > (parseInt(offset) + parseInt(limit))
                },
                filters: {
                    period,
                    organization_id,
                    resource_type
                }
            }
        });

    } catch (error) {
        logger.error('Usage statistics endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch usage statistics',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/usage/organizations/:orgId
 * Get detailed usage statistics for a specific organization
 */
router.get('/usage/organizations/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const { months = 3 } = req.query;

        const costControl = new CostControlService();
        const usageStats = await costControl.getEnhancedUsageStats(orgId, parseInt(months));

        res.json({
            success: true,
            data: usageStats
        });

    } catch (error) {
        logger.error('Organization usage endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch organization usage statistics',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/usage/limits
 * Set or update usage limits for an organization
 */
router.post('/usage/limits', async (req, res) => {
    try {
        const { 
            organization_id, 
            resource_type, 
            monthly_limit,
            daily_limit = null,
            allow_overage = false,
            overage_rate_cents = 0,
            hard_limit = true
        } = req.body;

        if (!organization_id || !resource_type || monthly_limit === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: organization_id, resource_type, monthly_limit'
            });
        }

        const costControl = new CostControlService();
        const result = await costControl.setUsageLimit(organization_id, resource_type, monthly_limit, {
            dailyLimit: daily_limit,
            allowOverage: allow_overage,
            overageRateCents: overage_rate_cents,
            hardLimit: hard_limit
        });

        logger.info('Usage limit updated by admin', {
            organization_id,
            resource_type,
            monthly_limit,
            performedBy: req.user.email
        });

        res.json({
            success: true,
            data: result,
            message: `Usage limit for ${resource_type} updated successfully`
        });

    } catch (error) {
        logger.error('Set usage limit endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to set usage limit',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/usage/reset
 * Manually reset monthly usage for all organizations (emergency use)
 */
router.post('/usage/reset', async (req, res) => {
    try {
        const { confirm = false } = req.body;

        if (!confirm) {
            return res.status(400).json({
                success: false,
                error: 'This action requires confirmation. Send { "confirm": true } to proceed.',
                warning: 'This will reset monthly usage counters for ALL organizations'
            });
        }

        const costControl = new CostControlService();
        const result = await costControl.resetAllMonthlyUsage();

        logger.warn('Manual usage reset performed by admin', {
            organizationsReset: result.organizationsReset,
            performedBy: req.user.email,
            resetAt: result.resetAt
        });

        res.json({
            success: true,
            data: result,
            message: `Monthly usage reset completed for ${result.organizationsReset} organizations`
        });

    } catch (error) {
        logger.error('Manual usage reset endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to reset monthly usage',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/usage/export
 * Export usage data as CSV
 */
router.get('/usage/export', async (req, res) => {
    try {
        const { 
            period = 'current_month',
            format = 'csv',
            organization_id = null
        } = req.query;

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        // Query usage data
        let query = supabaseServiceClient
            .from('usage_tracking')
            .select(`
                organization_id, resource_type, platform,
                quantity, year, month, day, cost_cents, tokens_used,
                created_at,
                organizations!inner(name, plan_id)
            `);

        // Apply period filter
        if (period === 'current_month') {
            query = query.eq('year', currentYear).eq('month', currentMonth);
        } else if (period === 'last_month') {
            const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
            const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
            query = query.eq('year', lastMonthYear).eq('month', lastMonth);
        }

        if (organization_id) {
            query = query.eq('organization_id', organization_id);
        }

        query = query.order('created_at', { ascending: false }).limit(10000);

        const { data: usageData, error } = await query;

        if (error) {
            throw new Error(`Error fetching usage data for export: ${error.message}`);
        }

        if (format === 'csv') {
            // Generate CSV
            let csv = 'Organization,Plan,Resource Type,Platform,Quantity,Cost (cents),Tokens Used,Date,Created At\n';
            
            usageData.forEach(record => {
                csv += `"${record.organizations.name}",`;
                csv += `"${record.organizations.plan_id}",`;
                csv += `"${record.resource_type}",`;
                csv += `"${record.platform || ''}",`;
                csv += `${record.quantity},`;
                csv += `${record.cost_cents},`;
                csv += `${record.tokens_used},`;
                csv += `"${record.year}-${String(record.month).padStart(2, '0')}-${String(record.day).padStart(2, '0')}",`;
                csv += `"${record.created_at}"\n`;
            });

            const filename = `roastr-usage-${period}-${new Date().toISOString().split('T')[0]}.csv`;
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);
        } else {
            // Return JSON
            res.json({
                success: true,
                data: {
                    usage_records: usageData,
                    exported_at: new Date().toISOString(),
                    period,
                    total_records: usageData.length
                }
            });
        }

    } catch (error) {
        logger.error('Usage export endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to export usage data',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/logs/download
 * Descargar logs como archivo de texto
 */
router.get('/logs/download', async (req, res) => {
    try {
        // Obtener logs
        const { data: logs } = await supabaseServiceClient
            .from('app_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000);

        // Formatear logs como texto
        let logText = `# Roastr.ai Admin Panel - Logs Export\n`;
        logText += `# Generated: ${new Date().toISOString()}\n`;
        logText += `# By: ${req.user.email}\n\n`;

        if (logs && logs.length > 0) {
            logs.forEach(log => {
                logText += `[${log.created_at}] [${log.level.toUpperCase()}] [${log.category}] `;
                if (log.platform) logText += `[${log.platform}] `;
                logText += `${log.message}\n`;
                if (log.metadata && Object.keys(log.metadata).length > 0) {
                    logText += `  Metadata: ${JSON.stringify(log.metadata)}\n`;
                }
                logText += `\n`;
            });
        } else {
            logText += 'No logs found in database.\n';
        }

        // Configurar headers para descarga
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="roastr-logs-${new Date().toISOString().split('T')[0]}.txt"`);
        
        res.send(logText);

    } catch (error) {
        logger.error('Logs download endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to download logs',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/alerts/history/:orgId
 * Get usage alert history for a specific organization (Issue 72)
 */
router.get('/alerts/history/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const {
            limit = 50,
            offset = 0,
            resource_type: resourceType,
            date_from: dateFrom,
            date_to: dateTo,
            alert_type: alertType
        } = req.query;

        const costControl = new CostControlService();
        const alertHistory = await costControl.getAlertHistory(orgId, {
            limit: parseInt(limit),
            offset: parseInt(offset),
            resourceType,
            dateFrom,
            dateTo,
            alertType
        });

        res.json({
            success: true,
            data: alertHistory
        });

    } catch (error) {
        logger.error('Get alert history endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alert history',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/alerts/stats/:orgId
 * Get usage alert statistics for a specific organization
 */
router.get('/alerts/stats/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const { days = 30 } = req.query;

        const costControl = new CostControlService();
        const alertStats = await costControl.getAlertStats(orgId, parseInt(days));

        res.json({
            success: true,
            data: alertStats
        });

    } catch (error) {
        logger.error('Get alert stats endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alert statistics',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/alerts/history
 * Get usage alert history across all organizations
 */
router.get('/alerts/history', async (req, res) => {
    try {
        const {
            limit = 100,
            offset = 0,
            organization_id: organizationId,
            resource_type: resourceType,
            date_from: dateFrom,
            date_to: dateTo,
            alert_type: alertType
        } = req.query;

        // Build query for all organizations
        let query = supabaseServiceClient
            .from('app_logs')
            .select(`
                id, organization_id, level, category, message, metadata, created_at,
                organizations (
                    name, plan_id
                )
            `)
            .eq('category', 'usage_alert')
            .order('created_at', { ascending: false });

        // Apply filters
        if (organizationId) {
            query = query.eq('organization_id', organizationId);
        }

        if (resourceType) {
            query = query.eq('metadata->>resourceType', resourceType);
        }

        if (alertType) {
            query = query.eq('metadata->>alertType', alertType);
        }

        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
        }

        if (dateTo) {
            query = query.lte('created_at', dateTo);
        }

        // Apply pagination
        query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data: alerts, error, count } = await query;

        if (error) {
            throw new Error(`Error fetching alert history: ${error.message}`);
        }

        // Get total count
        let countQuery = supabaseServiceClient
            .from('app_logs')
            .select('*', { count: 'exact', head: true })
            .eq('category', 'usage_alert');

        if (organizationId) {
            countQuery = countQuery.eq('organization_id', organizationId);
        }

        const { count: totalCount, error: countError } = await countQuery;

        if (countError) {
            throw new Error(`Error getting alert count: ${countError.message}`);
        }

        res.json({
            success: true,
            data: {
                alerts: alerts || [],
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: totalCount || 0,
                    hasMore: (parseInt(offset) + parseInt(limit)) < (totalCount || 0)
                },
                filters: {
                    organizationId,
                    resourceType,
                    alertType,
                    dateFrom,
                    dateTo
                }
            }
        });

    } catch (error) {
        logger.error('Get all alerts endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alert history',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/plan-limits
 * Get all plan limits configurations
 * Issue #99: Database-based plan limit configuration
 */
router.get('/plan-limits', async (req, res) => {
    try {
        const allLimits = await planLimitsService.getAllPlanLimits();
        
        res.json({
            success: true,
            data: {
                plans: allLimits,
                last_updated: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Get plan limits error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch plan limits',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/plan-limits/:planId
 * Get specific plan limits
 * Issue #99: Database-based plan limit configuration
 */
router.get('/plan-limits/:planId', async (req, res) => {
    try {
        const { planId } = req.params;
        const limits = await planLimitsService.getPlanLimits(planId);
        
        res.json({
            success: true,
            data: {
                planId,
                limits,
                last_updated: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Get plan limits error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch plan limits',
            message: error.message
        });
    }
});

/**
 * PUT /api/admin/plan-limits/:planId
 * Update plan limits for a specific plan
 * Issue #99: Database-based plan limit configuration
 */
router.put('/plan-limits/:planId', async (req, res) => {
    try {
        const { planId } = req.params;
        const updates = req.body;
        const adminId = req.user.id;
        
        // Validate plan ID
        const validPlans = ['free', 'pro', 'creator_plus', 'custom'];
        if (!validPlans.includes(planId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid plan ID'
            });
        }
        
        // Validate updates
        const allowedFields = [
            'maxRoasts', 'monthlyResponsesLimit', 'maxPlatforms', 
            'integrationsLimit', 'shieldEnabled', 'customPrompts',
            'prioritySupport', 'apiAccess', 'analyticsEnabled',
            'customTones', 'dedicatedSupport', 'monthlyTokensLimit',
            'dailyApiCallsLimit'
        ];
        
        const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));
        if (invalidFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid fields in update request',
                invalidFields
            });
        }
        
        // Update plan limits
        const updatedLimits = await planLimitsService.updatePlanLimits(planId, updates, adminId);
        
        logger.info('Plan limits updated', {
            planId,
            updatedBy: adminId,
            changes: Object.keys(updates)
        });
        
        res.json({
            success: true,
            data: {
                planId,
                limits: updatedLimits,
                updated_at: new Date().toISOString(),
                updated_by: adminId
            }
        });
    } catch (error) {
        logger.error('Update plan limits error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update plan limits',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/plan-limits/refresh-cache
 * Force refresh the plan limits cache
 * Issue #99: Database-based plan limit configuration
 */
router.post('/plan-limits/refresh-cache', async (req, res) => {
    try {
        planLimitsService.clearCache();
        
        logger.info('Plan limits cache cleared by admin', {
            adminId: req.user.id
        });
        
        res.json({
            success: true,
            message: 'Plan limits cache cleared successfully',
            cleared_at: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Clear plan limits cache error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to clear plan limits cache',
            message: error.message
        });
    }
});

module.exports = router;