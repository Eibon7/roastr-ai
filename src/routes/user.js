const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient, createUserClient } = require('../config/supabase');

const router = express.Router();

/**
 * GET /api/user/integrations
 * Get user's platform integrations
 */
router.get('/integrations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);
        
        // Get user's organization
        const { data: userData, error: userError } = await userClient
            .from('users')
            .select('id, organizations!owner_id (id)')
            .eq('id', userId)
            .single();

        if (userError || !userData.organizations[0]) {
            return res.status(404).json({
                success: false,
                error: 'User organization not found'
            });
        }

        const organizationId = userData.organizations[0].id;

        // Get all integration configs for the organization
        const { data: integrations, error } = await userClient
            .from('integration_configs')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch integrations: ${error.message}`);
        }

        // Add mock data for platforms not yet configured
        const availablePlatforms = [
            'twitter', 'instagram', 'facebook', 'youtube', 
            'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'
        ];

        const allIntegrations = availablePlatforms.map(platform => {
            const existing = integrations.find(i => i.platform === platform);
            if (existing) {
                return {
                    id: existing.id,
                    platform: existing.platform,
                    status: existing.enabled ? 'connected' : 'disconnected',
                    enabled: existing.enabled,
                    created_at: existing.created_at,
                    updated_at: existing.updated_at,
                    settings: existing.settings || {}
                };
            } else {
                return {
                    id: null,
                    platform: platform,
                    status: 'disconnected',
                    enabled: false,
                    created_at: null,
                    updated_at: null,
                    settings: {}
                };
            }
        });

        res.json({
            success: true,
            data: allIntegrations
        });

    } catch (error) {
        logger.error('Get user integrations error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve integrations'
        });
    }
});

/**
 * POST /api/user/integrations/connect
 * Connect a platform integration
 */
router.post('/integrations/connect', authenticateToken, async (req, res) => {
    try {
        const { platform } = req.body;
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        if (!platform) {
            return res.status(400).json({
                success: false,
                error: 'Platform is required'
            });
        }

        // Validate platform
        const validPlatforms = [
            'twitter', 'instagram', 'facebook', 'youtube', 
            'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'
        ];

        if (!validPlatforms.includes(platform)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid platform'
            });
        }

        // Get user's organization
        const { data: userData, error: userError } = await userClient
            .from('users')
            .select('id, organizations!owner_id (id)')
            .eq('id', userId)
            .single();

        if (userError || !userData.organizations[0]) {
            return res.status(404).json({
                success: false,
                error: 'User organization not found'
            });
        }

        const organizationId = userData.organizations[0].id;

        // Check if integration already exists
        const { data: existingIntegration, error: checkError } = await userClient
            .from('integration_configs')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('platform', platform)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw new Error(`Failed to check existing integration: ${checkError.message}`);
        }

        let result;

        if (existingIntegration) {
            // Update existing integration
            const { data: updatedIntegration, error: updateError } = await userClient
                .from('integration_configs')
                .update({
                    enabled: true,
                    settings: {
                        ...existingIntegration.settings,
                        connected_at: new Date().toISOString(),
                        mock_connection: true, // Indicate this is a mock connection
                        access_token: `mock_token_${Date.now()}` // Mock token
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingIntegration.id)
                .select()
                .single();

            if (updateError) {
                throw new Error(`Failed to update integration: ${updateError.message}`);
            }

            result = updatedIntegration;
        } else {
            // Create new integration
            const { data: newIntegration, error: createError } = await userClient
                .from('integration_configs')
                .insert({
                    organization_id: organizationId,
                    platform: platform,
                    enabled: true,
                    settings: {
                        connected_at: new Date().toISOString(),
                        mock_connection: true, // Indicate this is a mock connection
                        access_token: `mock_token_${Date.now()}`, // Mock token
                        tone: 'sarcastic',
                        humor_type: 'witty',
                        response_frequency: 0.7
                    }
                })
                .select()
                .single();

            if (createError) {
                throw new Error(`Failed to create integration: ${createError.message}`);
            }

            result = newIntegration;
        }

        logger.info('Platform integration connected:', {
            userId,
            platform,
            integrationId: result.id,
            mock: true
        });

        res.json({
            success: true,
            message: `${platform} connected successfully`,
            data: {
                id: result.id,
                platform: result.platform,
                status: 'connected',
                enabled: result.enabled,
                created_at: result.created_at,
                updated_at: result.updated_at
            }
        });

    } catch (error) {
        logger.error('Connect platform integration error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to connect platform'
        });
    }
});

/**
 * POST /api/user/integrations/disconnect
 * Disconnect a platform integration
 */
router.post('/integrations/disconnect', authenticateToken, async (req, res) => {
    try {
        const { platform } = req.body;
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        if (!platform) {
            return res.status(400).json({
                success: false,
                error: 'Platform is required'
            });
        }

        // Get user's organization
        const { data: userData, error: userError } = await userClient
            .from('users')
            .select('id, organizations!owner_id (id)')
            .eq('id', userId)
            .single();

        if (userError || !userData.organizations[0]) {
            return res.status(404).json({
                success: false,
                error: 'User organization not found'
            });
        }

        const organizationId = userData.organizations[0].id;

        // Find and disable the integration
        const { data: integration, error: findError } = await userClient
            .from('integration_configs')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('platform', platform)
            .single();

        if (findError) {
            if (findError.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    error: 'Integration not found'
                });
            }
            throw new Error(`Failed to find integration: ${findError.message}`);
        }

        // Update integration to disabled
        const { data: updatedIntegration, error: updateError } = await userClient
            .from('integration_configs')
            .update({
                enabled: false,
                settings: {
                    ...integration.settings,
                    disconnected_at: new Date().toISOString(),
                    access_token: null // Remove token
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', integration.id)
            .select()
            .single();

        if (updateError) {
            throw new Error(`Failed to disconnect integration: ${updateError.message}`);
        }

        logger.info('Platform integration disconnected:', {
            userId,
            platform,
            integrationId: integration.id
        });

        res.json({
            success: true,
            message: `${platform} disconnected successfully`,
            data: {
                id: updatedIntegration.id,
                platform: updatedIntegration.platform,
                status: 'disconnected',
                enabled: updatedIntegration.enabled,
                updated_at: updatedIntegration.updated_at
            }
        });

    } catch (error) {
        logger.error('Disconnect platform integration error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to disconnect platform'
        });
    }
});

/**
 * POST /api/user/preferences
 * Save user onboarding preferences
 */
router.post('/preferences', authenticateToken, async (req, res) => {
    try {
        const {
            preferred_platforms = [],
            humor_tone = 'sarcastic',
            humor_style = 'witty',
            response_frequency = 0.7,
            auto_respond = true,
            shield_enabled = true
        } = req.body;

        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        // Validate preferred_platforms
        const validPlatforms = [
            'twitter', 'instagram', 'facebook', 'youtube', 
            'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'
        ];

        const invalidPlatforms = preferred_platforms.filter(p => !validPlatforms.includes(p));
        if (invalidPlatforms.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid platforms: ${invalidPlatforms.join(', ')}`
            });
        }

        // Validate humor_tone
        const validTones = ['sarcastic', 'subtle', 'direct', 'playful', 'witty'];
        if (!validTones.includes(humor_tone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid humor tone'
            });
        }

        // Validate humor_style
        const validStyles = ['witty', 'clever', 'dry', 'savage', 'friendly'];
        if (!validStyles.includes(humor_style)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid humor style'
            });
        }

        // Update user preferences and mark onboarding as complete
        const { data: updatedUser, error: userError } = await userClient
            .from('users')
            .update({
                preferences: {
                    humor_tone,
                    humor_style,
                    response_frequency,
                    auto_respond,
                    shield_enabled,
                    preferred_platforms,
                    onboarding_completed_at: new Date().toISOString()
                },
                onboarding_complete: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (userError) {
            throw new Error(`Failed to update user preferences: ${userError.message}`);
        }

        // If user selected preferred platforms, create integration configs for them
        if (preferred_platforms.length > 0) {
            // Get user's organization
            const { data: userData, error: orgError } = await userClient
                .from('users')
                .select('id, organizations!owner_id (id)')
                .eq('id', userId)
                .single();

            if (!orgError && userData.organizations[0]) {
                const organizationId = userData.organizations[0].id;

                // Create integration configs for preferred platforms
                const integrationPromises = preferred_platforms.map(async (platform) => {
                    // Check if integration already exists
                    const { data: existing, error: checkError } = await userClient
                        .from('integration_configs')
                        .select('id')
                        .eq('organization_id', organizationId)
                        .eq('platform', platform)
                        .single();

                    if (checkError && checkError.code !== 'PGRST116') {
                        logger.warn('Error checking existing integration:', checkError.message);
                        return null;
                    }

                    if (!existing) {
                        // Create new integration config
                        const { data: newIntegration, error: createError } = await userClient
                            .from('integration_configs')
                            .insert({
                                organization_id: organizationId,
                                platform: platform,
                                enabled: false, // User needs to manually connect
                                settings: {
                                    tone: humor_tone,
                                    humor_type: humor_style,
                                    response_frequency,
                                    auto_respond,
                                    shield_enabled,
                                    from_onboarding: true
                                }
                            })
                            .select()
                            .single();

                        if (createError) {
                            logger.warn(`Failed to create integration config for ${platform}:`, createError.message);
                            return null;
                        }

                        return newIntegration;
                    }

                    return existing;
                });

                await Promise.all(integrationPromises);
            }
        }

        logger.info('User preferences saved and onboarding completed:', {
            userId,
            preferences: {
                humor_tone,
                humor_style,
                preferred_platforms_count: preferred_platforms.length
            }
        });

        res.json({
            success: true,
            message: 'Preferences saved successfully',
            data: {
                user: {
                    id: updatedUser.id,
                    onboarding_complete: updatedUser.onboarding_complete,
                    preferences: updatedUser.preferences
                }
            }
        });

    } catch (error) {
        logger.error('Save user preferences error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to save preferences'
        });
    }
});

/**
 * GET /api/user/profile
 * Get user profile information
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        const { data: userProfile, error } = await userClient
            .from('users')
            .select(`
                id, email, name, plan, is_admin, active, 
                onboarding_complete, preferences, created_at,
                organizations!owner_id (id, name, plan_id)
            `)
            .eq('id', userId)
            .single();

        if (error) {
            throw new Error(`Failed to fetch user profile: ${error.message}`);
        }

        res.json({
            success: true,
            data: userProfile
        });

    } catch (error) {
        logger.error('Get user profile error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve user profile'
        });
    }
});

module.exports = router;