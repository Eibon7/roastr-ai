const { createUserClient } = require('../config/supabase');
const { logger } = require('../utils/logger');

class UserIntegrationsService {
    
    /**
     * Get user's integration configurations
     */
    async getUserIntegrations(accessToken) {
        try {
            const userClient = createUserClient(accessToken);
            
            // Get current user
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            
            if (authError || !user) {
                throw new Error('Invalid or expired token');
            }

            // Get user's organization
            const { data: org, error: orgError } = await userClient
                .from('organizations')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (orgError) {
                throw new Error('Organization not found');
            }

            // Get integration configurations
            const { data: integrations, error: intError } = await userClient
                .from('integration_configs')
                .select('*')
                .eq('organization_id', org.id)
                .order('created_at', { ascending: false });

            if (intError) {
                throw new Error(`Failed to fetch integrations: ${intError.message}`);
            }

            // Remove sensitive credential data before returning
            const publicIntegrations = integrations.map(integration => ({
                id: integration.id,
                platform: integration.platform,
                enabled: integration.enabled,
                tone: integration.tone,
                humor_type: integration.humor_type,
                response_frequency: integration.response_frequency,
                trigger_words: integration.trigger_words,
                shield_enabled: integration.shield_enabled,
                created_at: integration.created_at,
                updated_at: integration.updated_at
            }));

            return publicIntegrations;

        } catch (error) {
            logger.error('Get user integrations error:', error.message);
            throw error;
        }
    }

    /**
     * Create or update integration configuration for user
     */
    async updateIntegration(accessToken, platform, config) {
        try {
            const userClient = createUserClient(accessToken);
            
            // Get current user
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            
            if (authError || !user) {
                throw new Error('Invalid or expired token');
            }

            // Get user's organization
            const { data: org, error: orgError } = await userClient
                .from('organizations')
                .select('id, plan_id')
                .eq('owner_id', user.id)
                .single();

            if (orgError) {
                throw new Error('Organization not found');
            }

            // Validate platform
            const validPlatforms = ['twitter', 'youtube', 'bluesky', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok'];
            if (!validPlatforms.includes(platform)) {
                throw new Error(`Invalid platform: ${platform}`);
            }

            // Enforce per-platform account limits consistently using a shared map
            // Normalize plan ID to handle legacy values
            const normalizePlanId = (planId) => {
                if (!planId) return 'starter_trial';
                const normalized = planId.toLowerCase().trim();
                if (normalized === 'free' || normalized === 'basic') return 'starter_trial';
                if (normalized === 'creator_plus' || normalized === 'creator') return 'plus';
                return normalized;
            };
            
            const limitsByPlan = { 
                starter_trial: 1, 
                starter: 1, 
                pro: 2, 
                plus: 2,
                custom: 999
            };
            const normalizedPlan = normalizePlanId(org.plan_id);
            const maxPerPlatform = limitsByPlan[normalizedPlan] ?? 1;
            
            // Check per-platform limit for this specific platform
            const { data: platformAccounts } = await userClient
                .from('integration_configs')
                .select('id, platform')
                .eq('organization_id', org.id)
                .eq('platform', platform)
                .eq('enabled', true);
            
            const count = Array.isArray(platformAccounts) ? platformAccounts.length : 0;
            if (count >= maxPerPlatform) {
                throw new Error(`Plan limit reached: ${maxPerPlatform} account(s) per platform on ${normalizedPlan}.`);
            }

            // Prepare update data
            const updateData = {
                organization_id: org.id,
                platform,
                enabled: config.enabled !== undefined ? config.enabled : true,
                tone: config.tone || 'sarcastic',
                humor_type: config.humor_type || 'witty',
                response_frequency: config.response_frequency || 1.0,
                trigger_words: config.trigger_words || ['roast', 'burn', 'insult'],
                shield_enabled: config.shield_enabled || false,
                config: config.config || {},
                credentials: config.credentials || {}
            };

            // Upsert integration config
            const { data, error } = await userClient
                .from('integration_configs')
                .upsert(updateData, { 
                    onConflict: 'organization_id,platform',
                    returning: 'representation'
                })
                .select()
                .single();

            if (error) {
                throw new Error(`Failed to update integration: ${error.message}`);
            }

            logger.info('Integration updated:', { 
                userId: user.id, 
                platform, 
                enabled: updateData.enabled 
            });

            // Return without sensitive data
            return {
                id: data.id,
                platform: data.platform,
                enabled: data.enabled,
                tone: data.tone,
                humor_type: data.humor_type,
                response_frequency: data.response_frequency,
                trigger_words: data.trigger_words,
                shield_enabled: data.shield_enabled,
                created_at: data.created_at,
                updated_at: data.updated_at
            };

        } catch (error) {
            logger.error('Update integration error:', error.message);
            throw error;
        }
    }

    /**
     * Delete integration configuration
     */
    async deleteIntegration(accessToken, platform) {
        try {
            const userClient = createUserClient(accessToken);
            
            // Get current user
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            
            if (authError || !user) {
                throw new Error('Invalid or expired token');
            }

            // Get user's organization
            const { data: org, error: orgError } = await userClient
                .from('organizations')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (orgError) {
                throw new Error('Organization not found');
            }

            // Delete integration config
            const { error } = await userClient
                .from('integration_configs')
                .delete()
                .eq('organization_id', org.id)
                .eq('platform', platform);

            if (error) {
                throw new Error(`Failed to delete integration: ${error.message}`);
            }

            logger.info('Integration deleted:', { 
                userId: user.id, 
                platform 
            });

            return { message: 'Integration deleted successfully' };

        } catch (error) {
            logger.error('Delete integration error:', error.message);
            throw error;
        }
    }

    /**
     * Get available platforms and their status for user's plan
     */
    async getAvailablePlatforms(accessToken) {
        try {
            const userClient = createUserClient(accessToken);
            
            // Get current user
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            
            if (authError || !user) {
                throw new Error('Invalid or expired token');
            }

            // Get user's organization
            const { data: org, error: orgError } = await userClient
                .from('organizations')
                .select('id, plan_id')
                .eq('owner_id', user.id)
                .single();

            if (orgError) {
                throw new Error('Organization not found');
            }

            // Get current integrations count (per-platform)
            const { data: currentIntegrations } = await userClient
                .from('integration_configs')
                .select('platform')
                .eq('organization_id', org.id)
                .eq('enabled', true);

            const activeCount = Array.isArray(currentIntegrations) ? currentIntegrations.length : 0;

            // Define platform availability based on plan
            const platforms = [
                { id: 'twitter', name: 'Twitter/X', available: true },
                { id: 'youtube', name: 'YouTube', available: true },
                { id: 'bluesky', name: 'Bluesky', available: org.plan_id !== 'starter_trial' },
                { id: 'instagram', name: 'Instagram', available: org.plan_id !== 'starter_trial' },
                { id: 'facebook', name: 'Facebook', available: org.plan_id !== 'starter_trial' },
                { id: 'discord', name: 'Discord', available: org.plan_id !== 'starter_trial' },
                { id: 'twitch', name: 'Twitch', available: org.plan_id !== 'starter_trial' },
                { id: 'reddit', name: 'Reddit', available: org.plan_id !== 'starter_trial' },
                { id: 'tiktok', name: 'TikTok', available: org.plan_id === 'plus' || org.plan_id === 'custom' }
            ];

            return {
                platforms,
                plan: org.plan_id,
                activeIntegrations: activeCount,
                limits: {
                    starter_trial: 1,
                    starter: 1,
                    pro: 2,
                    plus: 2,
                    custom: 999
                }
            };

        } catch (error) {
            logger.error('Get available platforms error:', error.message);
            throw error;
        }
    }

    /**
     * Get integration usage metrics for user
     */
    async getIntegrationsMetrics(accessToken) {
        try {
            const userClient = createUserClient(accessToken);
            
            // Get current user
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            
            if (authError || !user) {
                throw new Error('Invalid or expired token');
            }

            // Get user's organization
            const { data: org, error: orgError } = await userClient
                .from('organizations')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (orgError) {
                throw new Error('Organization not found');
            }

            // Get usage data from current month
            const currentDate = new Date();
            const { data: usage, error: usageError } = await userClient
                .from('monthly_usage')
                .select('*')
                .eq('organization_id', org.id)
                .eq('year', currentDate.getFullYear())
                .eq('month', currentDate.getMonth() + 1)
                .single();

            // Get recent comments and responses
            const { data: recentComments } = await userClient
                .from('comments')
                .select('platform, created_at')
                .eq('organization_id', org.id)
                .order('created_at', { ascending: false })
                .limit(100);

            const { data: recentResponses } = await userClient
                .from('responses')
                .select('created_at, tokens_used, cost_cents')
                .eq('organization_id', org.id)
                .order('created_at', { ascending: false })
                .limit(100);

            return {
                currentMonth: usage || {
                    total_responses: 0,
                    responses_by_platform: {},
                    total_cost_cents: 0
                },
                recentActivity: {
                    comments: recentComments || [],
                    responses: recentResponses || []
                }
            };

        } catch (error) {
            logger.error('Get integrations metrics error:', error.message);
            throw error;
        }
    }
}

module.exports = new UserIntegrationsService();