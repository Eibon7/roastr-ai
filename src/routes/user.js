const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient, createUserClient } = require('../config/supabase');
const UserIntegrationsService = require('../services/mockIntegrationsService');
const { flags } = require('../config/flags');

const router = express.Router();
const integrationsService = new UserIntegrationsService();

/**
 * GET /api/user/integrations
 * Get user's platform integrations with fallback to mock service
 */
router.get('/integrations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Use mock integrations service directly
        const result = await integrationsService.getUserIntegrations(userId);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }

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
 * Connect a platform integration with mock OAuth simulation
 */
router.post('/integrations/connect', authenticateToken, async (req, res) => {
    try {
        const { platform } = req.body;
        const userId = req.user.id;

        if (!platform) {
            return res.status(400).json({
                success: false,
                error: 'Platform is required'
            });
        }

        // Use mock integrations service
        const result = await integrationsService.connectIntegration(userId, platform);
        
        if (result.success) {
            // Simulate OAuth process with delay
            setTimeout(() => {
                logger.info('Mock OAuth completed for platform:', {
                    userId: userId.substr(0, 8) + '...',
                    platform
                });
            }, 1000);

            res.json({
                success: true,
                message: `${platform} connected successfully`,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }

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

        if (!platform) {
            return res.status(400).json({
                success: false,
                error: 'Platform is required'
            });
        }

        // Use mock integrations service
        const result = await integrationsService.disconnectIntegration(userId, platform);
        
        if (result.success) {
            res.json({
                success: true,
                message: `${platform} disconnected successfully`,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }

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