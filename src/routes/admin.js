const express = require('express');
const { supabaseServiceClient } = require('../config/supabase');
const { isAdminMiddleware } = require('../middleware/isAdmin');
const { logger } = require('../utils/logger');
const metricsService = require('../services/metricsService');
const authService = require('../services/authService');
const CostControlService = require('../services/costControl');
const revenueRoutes = require('./revenue');
const featureFlagsRoutes = require('./admin/featureFlags');
const backofficeSettingsRoutes = require('./admin/backofficeSettings');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const planLimitsService = require('../services/planLimitsService');
const { VALID_PLANS, PLAN_IDS, isValidPlan, normalizePlanId } = require('../config/planMappings');

const router = express.Router();

// Apply admin authentication to all routes
// Issue #261 - Security hardening for admin endpoints
router.use(isAdminMiddleware);

// Revenue dashboard routes (admin only)
router.use('/revenue', revenueRoutes);

// Feature flags and kill switch routes (admin only)
router.use('/', featureFlagsRoutes);

// Backoffice settings routes (admin only) - Issue #371: SPEC 15
router.use('/backoffice', backofficeSettingsRoutes);

// CSRF token endpoint removed - middleware not available

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
 * Obtener lista de usuarios con filtros avanzados para backoffice
 * Issue #235: Implements comprehensive user search and filtering
 * Issue #261: Enhanced with detailed JSDoc documentation
 * 
 * @description Retrieves paginated list of users with their social integrations, usage statistics, and account status.
 * Supports advanced filtering by email, plan, activity status, and search terms.
 * 
 * @param {number} [req.query.limit=25] - Number of users to return per page
 * @param {number} [req.query.offset=0] - Number of users to skip (for pagination)  
 * @param {string} [req.query.search=''] - Search term to filter by email, user ID, or social handles
 * @param {string} [req.query.plan=''] - Filter by user plan (free, pro, plus, etc.)
 * @param {boolean} [req.query.active_only=false] - Only return active (non-suspended) users
 * @param {number} [req.query.page=1] - Page number (alternative to offset)
 * 
 * @returns {Object} Response object containing:
 *   - success: boolean
 *   - data: Object with users array, pagination info, and total count
 *   - users: Array of user objects with integrated social handles and usage stats
 * 
 * @throws {500} Internal server error if database query fails
 * 
 * @example
 * GET /api/admin/users?limit=10&search=john&plan=pro&active_only=true
 * 
 * @performance Contains N+1 query issue - fetches social integrations per user in loop
 * @todo Fix N+1 query by using JOIN or batch query for integrations
 */
router.get('/users', async (req, res) => {
    try {
        const { 
            limit = 25, 
            offset = 0, 
            search = '', 
            plan = '',
            active_only = false,
            page = 1
        } = req.query;

        // Calculate offset from page if provided
        const actualOffset = page > 1 ? (parseInt(page) - 1) * parseInt(limit) : parseInt(offset);

        let query = supabaseServiceClient
            .from('users')
            .select(`
                id, email, name, plan, is_admin, active, suspended, created_at, last_activity_at,
                total_messages_sent, monthly_messages_sent,
                organizations!owner_id (
                    id, name, plan_id, monthly_responses_used, monthly_responses_limit
                )
            `, { count: 'exact' });

        // Search filters - by ID, email, or handle
        if (search) {
            // Search by user ID, email, or name
            query = query.or(`id.eq.${search},email.ilike.%${search}%,name.ilike.%${search}%`);
        }

        // Plan filter
        if (plan) {
            query = query.eq('plan', plan);
        }

        // Active only filter
        if (active_only === 'true') {
            query = query.eq('active', true);
        }

        // Order by creation date (newest first) and paginate
        query = query
            .order('created_at', { ascending: false })
            .range(actualOffset, actualOffset + parseInt(limit) - 1);

        const { data: users, error, count } = await query;

        if (error) {
            throw new Error(`Error fetching users: ${error.message}`);
        }

        // Fix N+1 query issue: Batch fetch all integrations for all users
        const organizationIds = (users || [])
            .map(user => user.organizations?.[0]?.id)
            .filter(Boolean);

        // Single query to get all integrations for all organizations
        const { data: allIntegrations } = await supabaseServiceClient
            .from('integration_configs')
            .select('organization_id, platform, handle, enabled')
            .in('organization_id', organizationIds)
            .eq('enabled', true);

        // Group integrations by organization_id for efficient lookup
        const integrationsByOrgId = (allIntegrations || []).reduce((acc, integration) => {
            if (!acc[integration.organization_id]) {
                acc[integration.organization_id] = [];
            }
            acc[integration.organization_id].push(integration);
            return acc;
        }, {});

        // Process users with their corresponding integrations
        const usersWithHandles = (users || []).map((user) => {
            try {
                // Get integrations for this user's organization from the grouped data
                const userIntegrations = integrationsByOrgId[user.organizations?.[0]?.id] || [];

                // Format handles for display
                const handles = userIntegrations.map(integration => 
                    `@${integration.handle || 'unknown'} (${integration.platform})`
                ).join(', ');

                // Calculate usage statistics
                const organization = user.organizations?.[0];
                const roastsUsed = organization?.monthly_responses_used || 0;
                const roastsLimit = organization?.monthly_responses_limit || 100;
                const analysisUsed = user.monthly_messages_sent || 0;
                
                // Get plan-specific analysis limit using normalized plan
                const normalizedUserPlan = normalizePlanId(user.plan);
                const planLimits = {
                    [PLAN_IDS.FREE]: 100,
                    [PLAN_IDS.PRO]: 1000, 
                    [PLAN_IDS.PLUS]: 5000
                };
                const analysisLimit = planLimits[normalizedUserPlan] || 100;

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    plan: user.plan,
                    handles: handles || 'No connections',
                    usage: {
                        roasts: `${roastsUsed}/${roastsLimit}`,
                        analysis: `${analysisUsed}/${analysisLimit}`
                    },
                    active: user.active,
                    suspended: user.suspended,
                    is_admin: user.is_admin,
                    created_at: user.created_at,
                    last_activity_at: user.last_activity_at
                };
            } catch (integrationError) {
                logger.warn('Error processing user data:', { 
                    userId: user.id, 
                    error: integrationError.message 
                });
                
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    plan: user.plan,
                    handles: 'Error loading',
                    usage: {
                        roasts: '0/0',
                        analysis: '0/0'
                    },
                    active: user.active,
                    suspended: user.suspended,
                    is_admin: user.is_admin,
                    created_at: user.created_at,
                    last_activity_at: user.last_activity_at
                };
            }
        });

        res.json({
            success: true,
            data: {
                users: usersWithHandles,
                pagination: {
                    total: count || 0,
                    limit: parseInt(limit),
                    offset: actualOffset,
                    page: parseInt(page),
                    total_pages: Math.ceil((count || 0) / parseInt(limit)),
                    has_more: (actualOffset + parseInt(limit)) < (count || 0)
                },
                filters: {
                    search,
                    plan,
                    active_only
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
 * PATCH /api/admin/users/:userId/plan
 * Cambiar plan de usuario manualmente (Issue #235)
 * Issue #261: Enhanced with detailed JSDoc documentation
 * 
 * @description Manually updates a user's subscription plan. This is an admin-only operation
 * that bypasses normal billing processes. Updates both user and organization records,
 * creates activity log entries, and normalizes plan IDs for consistency.
 * 
 * @param {string} req.params.userId - The UUID of the user whose plan should be changed
 * @param {string} req.body.plan - The new plan ID (free, pro, plus, basic, creator_plus)
 * @param {Object} req.user - The authenticated admin user object
 * @param {string} req.user.email - Admin user's email for audit logging
 * 
 * @returns {Object} Response object containing:
 *   - success: boolean
 *   - data: Object with updated user data and success message
 *   - user: Updated user object from database
 *   - message: Descriptive success message
 * 
 * @throws {400} Bad request if plan is invalid or user already has the specified plan
 * @throws {404} Not found if user doesn't exist
 * @throws {500} Internal server error if database operations fail
 * 
 * @example
 * PATCH /api/admin/users/123e4567-e89b-12d3-a456-426614174000/plan
 * Body: { "plan": "pro" }
 * 
 * @security Requires admin authentication via isAdminMiddleware
 * @audit Creates entry in user_activities table with admin details
 * @sideeffects Updates user.plan, organization.plan_id, logs activity
 */
router.patch('/users/:userId/plan', async (req, res) => {
    try {
        const { userId } = req.params;
        const { plan } = req.body;

        // Validate plan using shared constants
        if (!plan || !isValidPlan(plan, 'admin_assignable')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid plan',
                message: `Plan debe ser uno de: ${VALID_PLANS.ADMIN_ASSIGNABLE.join(', ')}`
            });
        }

        // Normalize plan ID for consistency
        const normalizedPlan = normalizePlanId(plan);

        // Get current user to check if exists
        const { data: currentUser, error: fetchError } = await supabaseServiceClient
            .from('users')
            .select('id, email, name, plan')
            .eq('id', userId)
            .single();

        if (fetchError || !currentUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'Usuario no encontrado'
            });
        }

        // Check if plan is different (compare normalized versions)
        const currentNormalizedPlan = normalizePlanId(currentUser.plan);
        if (currentNormalizedPlan === normalizedPlan) {
            return res.status(400).json({
                success: false,
                error: 'Plan unchanged',
                message: 'El usuario ya tiene este plan'
            });
        }

        // Update user plan
        const { data: updatedUser, error: updateError } = await supabaseServiceClient
            .from('users')
            .update({ 
                plan: normalizedPlan,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
            throw new Error(`Error updating user plan: ${updateError.message}`);
        }

        // Update organization plan if user owns an organization
        const { data: organizations } = await supabaseServiceClient
            .from('organizations')
            .select('id, plan_id')
            .eq('owner_id', userId);

        if (organizations && organizations.length > 0) {
            await supabaseServiceClient
                .from('organizations')
                .update({ 
                    plan_id: normalizedPlan,
                    updated_at: new Date().toISOString()
                })
                .eq('owner_id', userId);
        }

        // Log the plan change
        logger.info('User plan changed by admin:', {
            targetUserId: userId,
            targetUserEmail: currentUser.email,
            oldPlan: currentUser.plan,
            oldPlanNormalized: currentNormalizedPlan,
            newPlan: normalizedPlan,
            originalInput: plan,
            performedBy: req.user.email,
            organizationsUpdated: organizations?.length || 0
        });

        // Security audit logging - temporarily disabled until service is available
        logger.info('Admin plan change', {
            actor_id: req.user.id,
            actor_email: req.user.email,
            target_id: userId,
            target_email: currentUser.email,
            old_plan: currentNormalizedPlan,
            new_plan: normalizedPlan,
            ip: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        });

        // Create activity log entry
        await supabaseServiceClient
            .from('user_activities')
            .insert({
                user_id: userId,
                activity_type: 'plan_changed',
                metadata: {
                    old_plan: currentUser.plan,
                    new_plan: plan,
                    changed_by_admin: req.user.email
                }
            });

        res.json({
            success: true,
            data: {
                user: updatedUser,
                message: `Plan cambiado exitosamente de ${currentNormalizedPlan} a ${normalizedPlan}`
            }
        });

    } catch (error) {
        logger.error('Update user plan endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update user plan',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/users/:userId
 * Obtener detalles completos de un usuario para vista de superusuario (Issue #235)
 */
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Get user details with extended information
        const { data: user, error: userError } = await supabaseServiceClient
            .from('users')
            .select(`
                id, email, name, plan, is_admin, active, suspended, suspended_reason, 
                suspended_at, suspended_by, created_at, updated_at, last_login_at, last_activity_at,
                total_messages_sent, monthly_messages_sent, total_tokens_consumed, monthly_tokens_consumed,
                timezone, language,
                organizations!owner_id (
                    id, name, slug, plan_id, subscription_status, monthly_responses_used, 
                    monthly_responses_limit, settings, created_at, updated_at
                )
            `)
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'Usuario no encontrado'
            });
        }

        // Get user's integrations
        const organization = user.organizations?.[0];
        let integrations = [];
        if (organization) {
            const { data: integrationsData } = await supabaseServiceClient
                .from('integration_configs')
                .select(`
                    id, platform, enabled, handle, settings, created_at, updated_at,
                    tone, response_frequency, shield_enabled
                `)
                .eq('organization_id', organization.id);

            integrations = integrationsData || [];
        }

        // Get recent activities
        const { data: activities } = await supabaseServiceClient
            .from('user_activities')
            .select('id, activity_type, platform, tokens_used, metadata, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        // Get usage statistics for the last 6 months
        const { data: usageStats } = await supabaseServiceClient
            .from('usage_tracking')
            .select('resource_type, platform, quantity, cost_cents, year, month')
            .eq('user_id', userId)
            .gte('created_at', new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false });

        // Calculate usage summaries
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        const monthlyUsage = (usageStats || [])
            .filter(stat => stat.year === currentYear && stat.month === currentMonth)
            .reduce((acc, stat) => {
                acc[stat.resource_type] = (acc[stat.resource_type] || 0) + stat.quantity;
                return acc;
            }, {});

        // Format comprehensive user data
        const userData = {
            id: user.id,
            email: user.email,
            name: user.name,
            plan: user.plan,
            is_admin: user.is_admin,
            active: user.active,
            suspended: user.suspended,
            suspended_reason: user.suspended_reason,
            suspended_at: user.suspended_at,
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_login_at: user.last_login_at,
            last_activity_at: user.last_activity_at,
            profile: {
                timezone: user.timezone,
                language: user.language
            },
            usage: {
                total_messages_sent: user.total_messages_sent,
                monthly_messages_sent: user.monthly_messages_sent,
                total_tokens_consumed: user.total_tokens_consumed,
                monthly_tokens_consumed: user.monthly_tokens_consumed,
                current_month: monthlyUsage
            },
            organization: organization ? {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                plan_id: organization.plan_id,
                subscription_status: organization.subscription_status,
                monthly_responses_used: organization.monthly_responses_used,
                monthly_responses_limit: organization.monthly_responses_limit,
                settings: organization.settings,
                created_at: organization.created_at,
                updated_at: organization.updated_at
            } : null,
            integrations: integrations,
            recent_activities: activities || [],
            usage_history: usageStats || []
        };

        res.json({
            success: true,
            data: userData
        });

    } catch (error) {
        logger.error('Get user details endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user details',
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
                node_env: process.env.NODE_ENV === 'production' ? 'production' : 'non-production'
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
        
        // Validate plan ID using shared constants
        if (!isValidPlan(planId, 'all')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid plan ID'
            });
        }

        // Normalize plan ID for consistency
        const normalizedPlanId = normalizePlanId(planId);
        
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
        const updatedLimits = await planLimitsService.updatePlanLimits(normalizedPlanId, updates, adminId);
        
        logger.info('Plan limits updated', {
            planId: normalizedPlanId,
            originalPlanId: planId,
            updatedBy: adminId,
            changes: Object.keys(updates)
        });
        
        res.json({
            success: true,
            data: {
                planId: normalizedPlanId,
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

/**
 * PATCH /api/admin/users/:userId/config
 * Update user configuration (plan, shield, auto-reply, tone, persona)
 * Issue #241: User dashboard admin functionality
 */
router.patch('/users/:userId/config', async (req, res) => {
    try {
        const { userId } = req.params;
        const { plan, tone, shieldEnabled, autoReplyEnabled, persona } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // Build update object
        const updates = {};
        
        if (plan !== undefined) updates.plan = plan;
        if (tone !== undefined) updates.tone = tone;
        if (shieldEnabled !== undefined) updates.shield_enabled = shieldEnabled;
        if (autoReplyEnabled !== undefined) updates.auto_reply_enabled = autoReplyEnabled;
        
        // Handle persona fields
        if (persona) {
            if (persona.defines !== undefined) updates.persona_defines = persona.defines;
            if (persona.doesntTolerate !== undefined) updates.persona_doesnt_tolerate = persona.doesntTolerate;
            if (persona.doesntCare !== undefined) updates.persona_doesnt_care = persona.doesntCare;
        }

        // Update user
        const { data: updatedUser, error: updateError } = await supabaseServiceClient
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (updateError) {
            throw new Error(`Error updating user configuration: ${updateError.message}`);
        }

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Log the action
        logger.info('User configuration updated by admin:', {
            userId,
            updatedBy: req.user.email,
            updates: Object.keys(updates)
        });

        res.json({
            success: true,
            data: {
                user: updatedUser,
                message: 'User configuration updated successfully'
            }
        });

    } catch (error) {
        logger.error('Update user config endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update user configuration',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/users/:userId/reauth-integrations
 * Invalidate user's integration tokens (force re-authentication)
 * Issue #241: User dashboard admin functionality
 */
router.post('/users/:userId/reauth-integrations', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // Check if user exists
        const { data: user, error: userError } = await supabaseServiceClient
            .from('users')
            .select('id, email')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Invalidate integration tokens
        const { error: tokenError } = await supabaseServiceClient
            .from('integration_tokens')
            .update({ 
                is_valid: false,
                invalidated_at: new Date().toISOString(),
                invalidated_by: req.user.id,
                invalidation_reason: 'admin_forced_reauth'
            })
            .eq('user_id', userId);

        if (tokenError) {
            logger.warn('Error invalidating integration tokens:', tokenError.message);
        }

        // Also clear any cached integration data
        const { error: cacheError } = await supabaseServiceClient
            .from('user_integrations')
            .update({
                status: 'disconnected',
                last_sync_at: null,
                sync_error: 'Authentication required - tokens invalidated by admin'
            })
            .eq('user_id', userId);

        if (cacheError) {
            logger.warn('Error updating integration status:', cacheError.message);
        }

        // Log the action
        logger.info('User integrations invalidated by admin:', {
            userId,
            userEmail: user.email,
            invalidatedBy: req.user.email,
            reason: 'admin_forced_reauth'
        });

        res.json({
            success: true,
            data: {
                message: `Integration tokens invalidated for user ${user.email}. User will need to re-authenticate their social media accounts.`
            }
        });

    } catch (error) {
        logger.error('Reauth integrations endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to invalidate integration tokens',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/users/:userId/activity
 * Get detailed user activity (roasts, shield intercepted comments, integrations)
 * Issue #241: User dashboard admin functionality
 */
router.get('/users/:userId/activity', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10 } = req.query;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // Check if user exists
        const { data: user, error: userError } = await supabaseServiceClient
            .from('users')
            .select('id, email')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Get last 10 roasts generated
        const { data: roasts, error: roastsError } = await supabaseServiceClient
            .from('roast_responses')
            .select(`
                id, original_comment, roast_response, platform, 
                toxicity_score, created_at, metadata
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (roastsError) {
            logger.warn('Error fetching user roasts:', roastsError.message);
        }

        // Get last 10 comments intercepted by Shield
        const { data: shieldIntercepts, error: shieldError } = await supabaseServiceClient
            .from('shield_actions')
            .select(`
                id, comment_text, platform, toxicity_score, 
                action_taken, created_at, metadata
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (shieldError) {
            logger.warn('Error fetching shield intercepts:', shieldError.message);
        }

        // Get integrations status
        const { data: integrations, error: integrationsError } = await supabaseServiceClient
            .from('user_integrations')
            .select(`
                platform, status, connected_at, last_sync_at, 
                sync_error, handle, metadata
            `)
            .eq('user_id', userId);

        if (integrationsError) {
            logger.warn('Error fetching user integrations:', integrationsError.message);
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email
                },
                recent_roasts: roasts || [],
                shield_intercepts: shieldIntercepts || [],
                integrations_status: integrations || [],
                last_updated: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Get user activity endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user activity',
            message: error.message
        });
    }
});

/**
 * PUT /api/admin/backoffice/thresholds
 * Update global Shield thresholds for backoffice configuration
 * SPEC 15 - Backoffice MVP
 */
router.put('/backoffice/thresholds', async (req, res) => {
    try {
        const { tau_roast_lower, tau_shield, tau_critical, aggressiveness } = req.body;

        // Validate tau_roast_lower
        if (typeof tau_roast_lower !== 'number' || tau_roast_lower < 0 || tau_roast_lower > 1) {
            return res.status(400).json({
                success: false,
                error: 'tau_roast_lower must be a number between 0 and 1',
            });
        }

        // Validate tau_shield
        if (typeof tau_shield !== 'number' || tau_shield < 0 || tau_shield > 1) {
            return res.status(400).json({
                success: false,
                error: 'tau_shield must be a number between 0 and 1',
            });
        }

        // Validate tau_critical
        if (typeof tau_critical !== 'number' || tau_critical < 0 || tau_critical > 1) {
            return res.status(400).json({
                success: false,
                error: 'tau_critical must be a number between 0 and 1',
            });
        }

        // Validate aggressiveness
        const validAggressiveness = [90, 95, 98, 100];
        if (!validAggressiveness.includes(aggressiveness)) {
            return res.status(400).json({
                success: false,
                error: 'aggressiveness must be one of: 90, 95, 98, 100',
            });
        }

        // Validate threshold hierarchy: tau_roast_lower < tau_shield < tau_critical
        if (tau_roast_lower >= tau_shield) {
            return res.status(400).json({
                success: false,
                error: 'tau_roast_lower must be less than tau_shield',
            });
        }

        if (tau_shield >= tau_critical) {
            return res.status(400).json({
                success: false,
                error: 'tau_shield must be less than tau_critical',
            });
        }

        // Update global shield settings in database
        const { data: updatedSettings, error: updateError } = await supabaseServiceClient
            .from('global_shield_settings')
            .update({
                tau_roast_lower,
                tau_shield,
                tau_critical,
                aggressiveness,
                updated_at: new Date().toISOString(),
                updated_by: req.user.id
            })
            .eq('id', 1) // Assuming single global configuration row
            .select()
            .single();

        if (updateError) {
            // If row doesn't exist, insert new one
            if (updateError.code === 'PGRST116') {
                const { data: insertedSettings, error: insertError } = await supabaseServiceClient
                    .from('global_shield_settings')
                    .insert({
                        id: 1,
                        tau_roast_lower,
                        tau_shield,
                        tau_critical,
                        aggressiveness,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        updated_by: req.user.id
                    })
                    .select()
                    .single();

                if (insertError) {
                    throw new Error(`Error inserting global shield settings: ${insertError.message}`);
                }

                logger.info('Global shield thresholds created by admin', {
                    tau_roast_lower,
                    tau_shield,
                    tau_critical,
                    aggressiveness,
                    createdBy: req.user.email
                });

                return res.json({
                    success: true,
                    message: 'Thresholds created successfully',
                    data: insertedSettings
                });
            } else {
                throw new Error(`Error updating global shield settings: ${updateError.message}`);
            }
        }

        logger.info('Global shield thresholds updated by admin', {
            tau_roast_lower,
            tau_shield,
            tau_critical,
            aggressiveness,
            updatedBy: req.user.email
        });

        res.json({
            success: true,
            message: 'Thresholds updated successfully',
            data: updatedSettings
        });

    } catch (error) {
        logger.error('Update backoffice thresholds endpoint error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to update thresholds',
            message: error.message
        });
    }
});

module.exports = router;