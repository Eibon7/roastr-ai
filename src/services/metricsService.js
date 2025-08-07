const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');

class MetricsService {
    
    /**
     * Obtener métricas avanzadas del dashboard
     */
    async getDashboardMetrics() {
        try {
            const metrics = {};
            
            // Obtener métricas de usuarios
            metrics.users = await this.getUserMetrics();
            
            // Obtener métricas de roasts
            metrics.roasts = await this.getRoastMetrics();
            
            // Obtener ranking de usuarios
            metrics.topUsers = await this.getTopUsers();
            
            // Obtener estado de integraciones
            metrics.integrations = await this.getIntegrationsStatus();
            
            return metrics;
            
        } catch (error) {
            logger.error('Error getting dashboard metrics:', error.message);
            throw error;
        }
    }

    /**
     * Obtener métricas de usuarios
     */
    async getUserMetrics() {
        try {
            // Obtener estadísticas básicas de usuarios
            const { data: users, error: usersError } = await supabaseServiceClient
                .from('users')
                .select('id, created_at, is_admin, active, suspended, total_messages_sent, monthly_messages_sent');

            if (usersError) {
                throw new Error(`Error fetching users: ${usersError.message}`);
            }

            const now = new Date();
            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            return {
                total: users?.length || 0,
                active: users?.filter(u => u.active && !u.suspended).length || 0,
                suspended: users?.filter(u => u.suspended).length || 0,
                admins: users?.filter(u => u.is_admin).length || 0,
                new_this_week: users?.filter(u => new Date(u.created_at) >= startOfWeek).length || 0,
                new_this_month: users?.filter(u => new Date(u.created_at) >= startOfMonth).length || 0
            };

        } catch (error) {
            logger.error('Error getting user metrics:', error.message);
            throw error;
        }
    }

    /**
     * Obtener métricas de roasts generados
     */
    async getRoastMetrics() {
        try {
            // Obtener actividades de tipo respuesta/roast
            const { data: activities, error: activitiesError } = await supabaseServiceClient
                .from('user_activities')
                .select('id, activity_type, created_at, tokens_used')
                .in('activity_type', ['response_generated', 'message_sent']);

            if (activitiesError) {
                logger.warn('Error fetching roast activities:', activitiesError.message);
                // Fallback con datos simulados basados en usuarios
                return await this.getFallbackRoastMetrics();
            }

            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const roastActivities = activities?.filter(a => a.activity_type === 'response_generated') || [];

            return {
                total: roastActivities.length,
                today: roastActivities.filter(r => new Date(r.created_at) >= startOfDay).length,
                this_week: roastActivities.filter(r => new Date(r.created_at) >= startOfWeek).length,
                this_month: roastActivities.filter(r => new Date(r.created_at) >= startOfMonth).length,
                total_tokens: roastActivities.reduce((sum, r) => sum + (r.tokens_used || 0), 0)
            };

        } catch (error) {
            logger.error('Error getting roast metrics:', error.message);
            return await this.getFallbackRoastMetrics();
        }
    }

    /**
     * Métricas de roasts fallback cuando no hay datos en user_activities
     */
    async getFallbackRoastMetrics() {
        try {
            // Usar datos de usuarios como base para estimación
            const { data: users, error } = await supabaseServiceClient
                .from('users')
                .select('total_messages_sent, monthly_messages_sent');

            if (error) {
                throw error;
            }

            const totalRoasts = users?.reduce((sum, u) => sum + (u.total_messages_sent || 0), 0) || 0;
            const monthlyRoasts = users?.reduce((sum, u) => sum + (u.monthly_messages_sent || 0), 0) || 0;

            return {
                total: totalRoasts,
                today: Math.floor(monthlyRoasts * 0.1), // Estimación 10% del mensual para hoy
                this_week: Math.floor(monthlyRoasts * 0.3), // Estimación 30% del mensual para la semana
                this_month: monthlyRoasts,
                total_tokens: totalRoasts * 150 // Estimación promedio de tokens por roast
            };

        } catch (error) {
            logger.error('Error getting fallback roast metrics:', error.message);
            // Datos por defecto si todo falla
            return {
                total: 0,
                today: 0,
                this_week: 0,
                this_month: 0,
                total_tokens: 0
            };
        }
    }

    /**
     * Obtener top 5 usuarios por volumen de roasts
     */
    async getTopUsers() {
        try {
            const { data: users, error } = await supabaseServiceClient
                .from('users')
                .select('id, email, name, total_messages_sent, monthly_messages_sent')
                .order('total_messages_sent', { ascending: false })
                .limit(5);

            if (error) {
                throw new Error(`Error fetching top users: ${error.message}`);
            }

            return users?.map(user => ({
                id: user.id,
                email: user.email,
                name: user.name || 'Usuario sin nombre',
                total_roasts: user.total_messages_sent || 0,
                monthly_roasts: user.monthly_messages_sent || 0
            })) || [];

        } catch (error) {
            logger.error('Error getting top users:', error.message);
            return [];
        }
    }

    /**
     * Obtener estado de integraciones
     */
    async getIntegrationsStatus() {
        try {
            // Obtener configuraciones de integraciones de la BD
            const { data: integrationConfigs, error } = await supabaseServiceClient
                .from('integration_configs')
                .select('platform, enabled, updated_at')
                .eq('enabled', true);

            // Lista de integraciones disponibles
            const availableIntegrations = ['twitter', 'youtube', 'bluesky', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok'];
            const enabledFromEnv = process.env.INTEGRATIONS_ENABLED?.split(',') || ['twitter', 'youtube', 'bluesky'];

            // Obtener última actividad por plataforma
            const { data: lastActivities, error: activitiesError } = await supabaseServiceClient
                .from('user_activities')
                .select('platform, created_at')
                .not('platform', 'is', null)
                .order('created_at', { ascending: false });

            // Procesar estado de cada integración
            const integrations = availableIntegrations.map(platform => {
                const isEnabledInEnv = enabledFromEnv.includes(platform);
                const dbConfig = integrationConfigs?.find(config => config.platform === platform);
                const lastActivity = lastActivities?.find(activity => activity.platform === platform);

                let status = 'disabled';
                let lastExecuted = null;

                if (isEnabledInEnv || dbConfig) {
                    if (lastActivity) {
                        status = 'active';
                        lastExecuted = lastActivity.created_at;
                    } else {
                        status = 'configured';
                    }
                }

                return {
                    platform,
                    name: this.getIntegrationDisplayName(platform),
                    status,
                    enabled: isEnabledInEnv || (dbConfig?.enabled || false),
                    last_executed: lastExecuted,
                    icon: this.getIntegrationIcon(platform)
                };
            });

            // Estadísticas generales
            const stats = {
                total: integrations.length,
                enabled: integrations.filter(i => i.enabled).length,
                active: integrations.filter(i => i.status === 'active').length,
                configured: integrations.filter(i => i.status === 'configured').length
            };

            return {
                integrations,
                stats
            };

        } catch (error) {
            logger.error('Error getting integrations status:', error.message);
            return this.getFallbackIntegrationsStatus();
        }
    }

    /**
     * Estado de integraciones fallback
     */
    getFallbackIntegrationsStatus() {
        const enabledFromEnv = process.env.INTEGRATIONS_ENABLED?.split(',') || ['twitter', 'youtube', 'bluesky'];
        const availableIntegrations = ['twitter', 'youtube', 'bluesky', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok'];

        const integrations = availableIntegrations.map(platform => ({
            platform,
            name: this.getIntegrationDisplayName(platform),
            status: enabledFromEnv.includes(platform) ? 'configured' : 'disabled',
            enabled: enabledFromEnv.includes(platform),
            last_executed: enabledFromEnv.includes(platform) ? new Date().toISOString() : null,
            icon: this.getIntegrationIcon(platform)
        }));

        const stats = {
            total: integrations.length,
            enabled: integrations.filter(i => i.enabled).length,
            active: integrations.filter(i => i.status === 'active').length,
            configured: integrations.filter(i => i.status === 'configured').length
        };

        return { integrations, stats };
    }

    /**
     * Obtener nombre para mostrar de la integración
     */
    getIntegrationDisplayName(platform) {
        const names = {
            twitter: 'Twitter',
            youtube: 'YouTube',
            bluesky: 'Bluesky',
            instagram: 'Instagram',
            facebook: 'Facebook',
            discord: 'Discord',
            twitch: 'Twitch',
            reddit: 'Reddit',
            tiktok: 'TikTok'
        };
        return names[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
    }

    /**
     * Obtener icono de la integración
     */
    getIntegrationIcon(platform) {
        const icons = {
            twitter: 'fab fa-twitter',
            youtube: 'fab fa-youtube',
            bluesky: 'fas fa-cloud',
            instagram: 'fab fa-instagram',
            facebook: 'fab fa-facebook',
            discord: 'fab fa-discord',
            twitch: 'fab fa-twitch',
            reddit: 'fab fa-reddit',
            tiktok: 'fab fa-tiktok'
        };
        return icons[platform] || 'fas fa-plug';
    }

    /**
     * Actualizar métricas de usuario después de una acción
     */
    async updateUserMetrics(userId, action, metadata = {}) {
        try {
            // Actualizar contadores según la acción
            let updateData = {};
            
            switch (action) {
                case 'roast_generated':
                    updateData = {
                        total_messages_sent: await this.incrementUserCounter(userId, 'total_messages_sent'),
                        monthly_messages_sent: await this.incrementUserCounter(userId, 'monthly_messages_sent')
                    };
                    break;
                case 'tokens_consumed':
                    updateData = {
                        total_tokens_consumed: await this.incrementUserCounter(userId, 'total_tokens_consumed', metadata.tokens || 0),
                        monthly_tokens_consumed: await this.incrementUserCounter(userId, 'monthly_tokens_consumed', metadata.tokens || 0)
                    };
                    break;
            }

            if (Object.keys(updateData).length > 0) {
                const { error } = await supabaseServiceClient
                    .from('users')
                    .update(updateData)
                    .eq('id', userId);

                if (error) {
                    logger.error('Error updating user metrics:', error.message);
                }
            }

        } catch (error) {
            logger.error('Error in updateUserMetrics:', error.message);
        }
    }

    /**
     * Incrementar contador específico de usuario
     */
    async incrementUserCounter(userId, field, increment = 1) {
        try {
            const { data: user, error } = await supabaseServiceClient
                .from('users')
                .select(field)
                .eq('id', userId)
                .single();

            if (error) {
                logger.error(`Error fetching user ${field}:`, error.message);
                return increment;
            }

            return (user[field] || 0) + increment;

        } catch (error) {
            logger.error('Error incrementing user counter:', error.message);
            return increment;
        }
    }
}

module.exports = new MetricsService();