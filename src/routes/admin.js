const express = require('express');
const { supabaseServiceClient } = require('../config/supabase');
const { isAdminMiddleware } = require('../middleware/isAdmin');
const { logger } = require('../utils/logger');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Aplicar middleware de admin a todas las rutas
router.use(isAdminMiddleware);

/**
 * GET /api/admin/dashboard
 * Obtener estadísticas generales del dashboard
 */
router.get('/dashboard', async (req, res) => {
    try {
        // Obtener estadísticas de usuarios
        const { data: usersStats, error: usersError } = await supabaseServiceClient
            .from('users')
            .select('id, created_at, is_admin, active')
            .order('created_at', { ascending: false });

        if (usersError) {
            throw new Error(`Error fetching users: ${usersError.message}`);
        }

        // Obtener estadísticas de actividades recientes
        const { data: activities, error: activitiesError } = await supabaseServiceClient
            .from('user_activities')
            .select('id, activity_type, platform, created_at')
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 30 días
            .order('created_at', { ascending: false })
            .limit(1000);

        if (activitiesError) {
            logger.warn('Error fetching activities:', activitiesError.message);
        }

        // Calcular estadísticas
        const totalUsers = usersStats.length;
        const adminUsers = usersStats.filter(u => u.is_admin).length;
        const activeUsers = usersStats.filter(u => u.active).length;
        const newUsersThisMonth = usersStats.filter(u => {
            const userDate = new Date(u.created_at);
            const now = new Date();
            return userDate.getMonth() === now.getMonth() && userDate.getFullYear() === now.getFullYear();
        }).length;

        // Actividad por plataforma
        const platformActivity = {};
        const activityByDay = {};

        if (activities) {
            activities.forEach(activity => {
                // Contar por plataforma
                if (activity.platform) {
                    platformActivity[activity.platform] = (platformActivity[activity.platform] || 0) + 1;
                }

                // Contar por día
                const day = new Date(activity.created_at).toISOString().split('T')[0];
                activityByDay[day] = (activityByDay[day] || 0) + 1;
            });
        }

        // Obtener integraciones activas desde variables de entorno
        const enabledIntegrations = process.env.INTEGRATIONS_ENABLED 
            ? process.env.INTEGRATIONS_ENABLED.split(',')
            : ['twitter', 'youtube', 'bluesky'];

        const dashboardData = {
            users: {
                total: totalUsers,
                active: activeUsers,
                admins: adminUsers,
                new_this_month: newUsersThisMonth
            },
            activity: {
                total_activities: activities?.length || 0,
                by_platform: platformActivity,
                by_day: activityByDay,
                last_activity: activities?.[0]?.created_at || null
            },
            integrations: {
                enabled: enabledIntegrations,
                total_enabled: enabledIntegrations.length
            },
            system: {
                last_updated: new Date().toISOString()
            }
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

module.exports = router;