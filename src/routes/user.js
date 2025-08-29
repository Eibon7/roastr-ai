const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger, SafeUtils } = require('../utils/logger');
const { supabaseServiceClient, createUserClient } = require('../config/supabase');
const UserIntegrationsService = require('../services/mockIntegrationsService');
const { flags } = require('../config/flags');
const DataExportService = require('../services/dataExportService');
const emailService = require('../services/emailService');
const auditService = require('../services/auditService');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const encryptionService = require('../services/encryptionService');
const EmbeddingsService = require('../services/embeddingsService');
const PersonaInputSanitizer = require('../services/personaInputSanitizer');
const transparencyService = require('../services/transparencyService');
const {
  accountDeletionLimiter,
  dataExportLimiter,
  dataDownloadLimiter,
  deletionCancellationLimiter,
  gdprGlobalLimiter
} = require('../middleware/gdprRateLimiter');
const {
  roastrPersonaReadLimiter,
  roastrPersonaWriteLimiter,
  roastrPersonaDeleteLimiter
} = require('../middleware/roastrPersonaRateLimiter');

const router = express.Router();
const integrationsService = new UserIntegrationsService();
const embeddingsService = new EmbeddingsService();
const personaSanitizer = new PersonaInputSanitizer();

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

        // Validate platform name
        const validPlatforms = ['twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'];
        if (!validPlatforms.includes(platform)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid platform'
            });
        }

        // Use mock integrations service
        const result = await integrationsService.connectIntegration(userId, platform);
        
        if (result.success) {
            // Simulate OAuth process with delay
            setTimeout(() => {
                logger.info('Mock OAuth completed for platform:', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
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
 * GET /api/user/accounts/:id
 * Get detailed information about a specific connected account
 * Issue #256: Modal de cuenta conectada
 */
router.get('/accounts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Validate account ID format
        if (!id || id.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Account ID is required'
            });
        }

        // Get account details from integrations service
        const accountDetails = await integrationsService.getAccountDetails(userId, id);
        
        if (!accountDetails.success) {
            if (accountDetails.error === 'Account not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Account not found or does not belong to user'
                });
            }
            throw new Error(accountDetails.error);
        }

        res.json({
            success: true,
            data: accountDetails.data
        });

    } catch (error) {
        logger.error('Get account details error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            accountId: req.params.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve account details'
        });
    }
});

/**
 * GET /api/user/accounts/:id/roasts
 * Get recent roasts for a specific account
 * Issue #256: Lista de los últimos 10 roasts
 */
router.get('/accounts/:id/roasts', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = parseInt(req.query.offset) || 0;

        // Get recent roasts for this account
        const roastsResult = await integrationsService.getAccountRoasts(userId, id, { limit, offset });
        
        if (!roastsResult.success) {
            if (roastsResult.error === 'Account not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Account not found or does not belong to user'
                });
            }
            throw new Error(roastsResult.error);
        }

        res.json({
            success: true,
            data: roastsResult.data,
            pagination: {
                limit,
                offset,
                total: roastsResult.total || 0
            }
        });

    } catch (error) {
        logger.error('Get account roasts error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            accountId: req.params.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve account roasts'
        });
    }
});

/**
 * POST /api/user/accounts/:id/roasts/:roastId/approve
 * Approve a pending roast for publication
 * Issue #256: Aprobar roast functionality
 */
router.post('/accounts/:id/roasts/:roastId/approve', authenticateToken, async (req, res) => {
    try {
        const { id, roastId } = req.params;
        const userId = req.user.id;

        const result = await integrationsService.approveRoast(userId, id, roastId);
        
        if (!result.success) {
            if (result.error === 'Roast not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Roast not found or does not belong to account'
                });
            }
            throw new Error(result.error);
        }

        // Log the approval action
        logger.info('Roast approved:', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            accountId: id,
            roastId: roastId
        });

        res.json({
            success: true,
            message: 'Roast approved successfully',
            data: result.data
        });

    } catch (error) {
        logger.error('Approve roast error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            accountId: req.params.id,
            roastId: req.params.roastId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to approve roast'
        });
    }
});

/**
 * POST /api/user/accounts/:id/roasts/:roastId/decline
 * Decline a pending roast
 * Issue #256: Declinar roast functionality
 */
router.post('/accounts/:id/roasts/:roastId/decline', authenticateToken, async (req, res) => {
    try {
        const { id, roastId } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;

        const result = await integrationsService.declineRoast(userId, id, roastId, reason);
        
        if (!result.success) {
            if (result.error === 'Roast not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Roast not found or does not belong to account'
                });
            }
            throw new Error(result.error);
        }

        // Log the decline action
        logger.info('Roast declined:', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            accountId: id,
            roastId: roastId,
            reason: reason || 'No reason provided'
        });

        res.json({
            success: true,
            message: 'Roast declined successfully',
            data: result.data
        });

    } catch (error) {
        logger.error('Decline roast error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            accountId: req.params.id,
            roastId: req.params.roastId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to decline roast'
        });
    }
});

/**
 * POST /api/user/accounts/:id/roasts/:roastId/regenerate
 * Regenerate a roast with potentially different parameters
 * Issue #256: Regenerar roast functionality
 */
router.post('/accounts/:id/roasts/:roastId/regenerate', authenticateToken, async (req, res) => {
    try {
        const { id, roastId } = req.params;
        const userId = req.user.id;
        const { tone, intensity } = req.body;

        const result = await integrationsService.regenerateRoast(userId, id, roastId, { tone, intensity });
        
        if (!result.success) {
            if (result.error === 'Roast not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Roast not found or does not belong to account'
                });
            }
            if (result.error === 'Usage limit exceeded') {
                return res.status(429).json({
                    success: false,
                    error: 'Monthly roast limit exceeded. Upgrade your plan to continue.'
                });
            }
            throw new Error(result.error);
        }

        // Log the regeneration action
        logger.info('Roast regenerated:', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            accountId: id,
            originalRoastId: roastId,
            newRoastId: result.data.id
        });

        res.json({
            success: true,
            message: 'Roast regenerated successfully',
            data: result.data
        });

    } catch (error) {
        logger.error('Regenerate roast error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            accountId: req.params.id,
            roastId: req.params.roastId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to regenerate roast'
        });
    }
});

/**
 * PATCH /api/user/accounts/:id/settings
 * Update account-specific settings
 * Issue #256: Settings de la cuenta (auto-approval, shield, tone)
 */
router.patch('/accounts/:id/settings', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const settings = req.body;

        // Validate settings
        const allowedSettings = ['autoApprove', 'shieldEnabled', 'shieldLevel', 'defaultTone'];
        const validSettings = {};
        
        for (const [key, value] of Object.entries(settings)) {
            if (allowedSettings.includes(key)) {
                validSettings[key] = value;
            }
        }

        if (Object.keys(validSettings).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid settings provided'
            });
        }

        // Validate specific setting values
        if (validSettings.shieldLevel !== undefined) {
            if (typeof validSettings.shieldLevel !== 'number' || validSettings.shieldLevel < 1 || validSettings.shieldLevel > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Shield level must be a number between 1 and 100'
                });
            }
        }

        if (validSettings.defaultTone !== undefined) {
            const validTones = ['Flanders', 'Ligero', 'Balanceado', 'Canalla', '+18'];
            if (!validTones.includes(validSettings.defaultTone)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid tone. Must be one of: ${validTones.join(', ')}`
                });
            }
        }

        const result = await integrationsService.updateAccountSettings(userId, id, validSettings);
        
        if (!result.success) {
            if (result.error === 'Account not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Account not found or does not belong to user'
                });
            }
            throw new Error(result.error);
        }

        // Log the settings update
        logger.info('Account settings updated:', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            accountId: id,
            updatedSettings: Object.keys(validSettings)
        });

        res.json({
            success: true,
            message: 'Account settings updated successfully',
            data: result.data
        });

    } catch (error) {
        logger.error('Update account settings error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            accountId: req.params.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update account settings'
        });
    }
});

/**
 * DELETE /api/user/accounts/:id
 * Disconnect/delete a connected social media account
 * Issue #256: Desconectar cuenta functionality
 */
router.delete('/accounts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { confirmation } = req.body;

        // Require explicit confirmation
        if (confirmation !== 'DISCONNECT') {
            return res.status(400).json({
                success: false,
                error: 'Please provide confirmation: "DISCONNECT" to confirm account deletion'
            });
        }

        const result = await integrationsService.disconnectAccount(userId, id);
        
        if (!result.success) {
            if (result.error === 'Account not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Account not found or does not belong to user'
                });
            }
            throw new Error(result.error);
        }

        // Log the disconnection
        logger.info('Account disconnected:', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            accountId: id,
            platform: result.data.platform
        });

        res.json({
            success: true,
            message: `${result.data.platform} account disconnected successfully`,
            data: result.data
        });

    } catch (error) {
        logger.error('Disconnect account error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            accountId: req.params.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to disconnect account'
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
        let updatedUser = null;
        
        // In mock mode, skip database operations and return success
        if (flags.isEnabled('ENABLE_SUPABASE')) {
            const { data, error: userError } = await userClient
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
            
            updatedUser = data;
        } else {
            // Mock mode: simulate successful update
            logger.info('Mock mode: User preferences updated', { userId: userId?.substr(0, 8) + '...' || 'unknown', humor_tone, humor_style });
        }

        // If user selected preferred platforms, create integration configs for them
        if (preferred_platforms.length > 0 && flags.isEnabled('ENABLE_SUPABASE')) {
            // Get user's organization (only in real mode)
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

        // Prepare response data
        const responseData = {
            user: {
                id: userId,
                onboarding_complete: true,
                preferences: {
                    humor_tone,
                    humor_style,
                    response_frequency,
                    auto_respond,
                    shield_enabled,
                    preferred_platforms,
                    onboarding_completed_at: new Date().toISOString()
                }
            }
        };

        // In real mode, use database response if available
        if (flags.isEnabled('ENABLE_SUPABASE') && updatedUser) {
            responseData.user = {
                id: updatedUser.id,
                onboarding_complete: updatedUser.onboarding_complete,
                preferences: updatedUser.preferences
            };
        }

        res.json({
            success: true,
            message: 'Preferences saved successfully',
            data: responseData
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

/**
 * DELETE /api/user/account
 * Request account deletion with GDPR compliance
 * Rate limited: 3 attempts per hour per IP/user (Issue #115)
 */
router.delete('/account', authenticateToken, gdprGlobalLimiter, accountDeletionLimiter, async (req, res) => {
    try {
        const { password, confirmation } = req.body;
        const userId = req.user.id;

        // Require password confirmation for security
        if (!password) {
            return res.status(400).json({
                success: false,
                error: 'Password confirmation required'
            });
        }

        // Require explicit confirmation
        if (confirmation !== 'DELETE') {
            return res.status(400).json({
                success: false,
                error: 'Please type "DELETE" to confirm account deletion'
            });
        }

        // Get user details
        const { data: userData, error: userError } = await supabaseServiceClient
            .from('users')
            .select('id, email, name')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // CRITICAL SECURITY FIX (Issue #113): Validate password against Supabase Auth
        // This prevents unauthorized account deletion by validating the user's identity
        const { supabaseAnonClient } = require('../config/supabase');
        
        // Check if running in mock mode or if Supabase is not configured
        if (flags.isEnabled('ENABLE_SUPABASE')) {
            try {
                const { data: signInData, error: passwordError } = await supabaseAnonClient.auth.signInWithPassword({
                    email: userData.email,
                    password: password
                });

                if (passwordError) {
                    // Log failed password validation attempt for audit trail
                    await auditService.logAccountDeletionAttempt(userId, {
                        success: false,
                        reason: 'invalid_password',
                        ip_address: req.ip || req.connection?.remoteAddress,
                        user_agent: req.get('User-Agent')
                    }, req);

                    logger.warn('Account deletion blocked - invalid password:', { 
                        userId: SafeUtils.safeUserIdPrefix(userId),
                        email: userData.email,
                        error: passwordError.message 
                    });

                    return res.status(401).json({
                        success: false,
                        error: 'Invalid password. Please verify your password to delete your account.'
                    });
                }

                // Password validated successfully - log successful validation
                await auditService.logAccountDeletionAttempt(userId, {
                    success: true,
                    reason: 'password_validated',
                    ip_address: req.ip || req.connection?.remoteAddress,
                    user_agent: req.get('User-Agent')
                }, req);

                logger.info('Account deletion - password verified:', { 
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    email: userData.email
                });

            } catch (validationError) {
                // Log validation error for audit trail
                await auditService.logAccountDeletionAttempt(userId, {
                    success: false,
                    reason: 'validation_error',
                    error: validationError.message,
                    ip_address: req.ip || req.connection?.remoteAddress,
                    user_agent: req.get('User-Agent')
                }, req);

                logger.error('Account deletion - password validation failed:', { 
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    error: validationError.message 
                });

                return res.status(500).json({
                    success: false,
                    error: 'Password validation failed. Please try again.'
                });
            }
        } else {
            // Mock mode: Skip real password validation but still log for audit trail
            logger.info('Mock mode: Skipping password validation for account deletion', { 
                userId: SafeUtils.safeUserIdPrefix(userId),
                email: userData.email 
            });
            
            // Still log the attempt for consistency
            await auditService.logAccountDeletionAttempt(userId, {
                success: true,
                reason: 'password_validated_mock_mode',
                ip_address: req.ip || req.connection?.remoteAddress,
                user_agent: req.get('User-Agent')
            }, req);
        }

        // Check if there's already a pending deletion request
        const { data: existingRequest } = await supabaseServiceClient
            .from('account_deletion_requests')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .single();

        if (existingRequest) {
            return res.status(409).json({
                success: false,
                error: 'Account deletion already requested',
                data: {
                    requestId: existingRequest.id,
                    scheduledDeletionDate: existingRequest.scheduled_deletion_at,
                    gracePeriodDays: existingRequest.grace_period_days
                }
            });
        }

        const gracePeriodDays = 30;
        const scheduledDeletionAt = new Date();
        scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + gracePeriodDays);

        // Create deletion request
        const { data: deletionRequest, error: insertError } = await supabaseServiceClient
            .from('account_deletion_requests')
            .insert({
                user_id: userId,
                user_email: userData.email,
                user_name: userData.name,
                scheduled_deletion_at: scheduledDeletionAt.toISOString(),
                grace_period_days: gracePeriodDays,
                status: 'pending',
                ip_address: req.ip || req.connection?.remoteAddress,
                user_agent: req.get('User-Agent')
            })
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }

        // Generate data export immediately
        const dataExportService = new DataExportService();
        const exportResult = await dataExportService.exportUserData(userId);
        
        let dataExportUrl = null;
        let dataExportExpiresAt = null;
        
        if (exportResult.success) {
            dataExportUrl = `${req.protocol}://${req.get('host')}${exportResult.downloadUrl}`;
            dataExportExpiresAt = exportResult.expiresAt;

            // Update deletion request with export info
            await supabaseServiceClient
                .from('account_deletion_requests')
                .update({
                    data_exported_at: new Date().toISOString(),
                    data_export_url: dataExportUrl,
                    data_export_expires_at: dataExportExpiresAt.toISOString()
                })
                .eq('id', deletionRequest.id);

            // Log data export
            await auditService.logDataExport(userId, {
                filename: exportResult.filename,
                size: exportResult.size,
                expiresAt: dataExportExpiresAt
            });
        }

        // Log deletion request
        await auditService.logAccountDeletionRequest(userId, deletionRequest.id, {
            gracePeriodDays,
            scheduledDeletionAt: scheduledDeletionAt.toISOString(),
            dataExportGenerated: !!exportResult.success
        }, req);

        // Send confirmation email
        try {
            await emailService.sendAccountDeletionRequestedEmail(userData.email, {
                userName: userData.name || userData.email,
                gracePeriodDays,
                scheduledDeletionDate: scheduledDeletionAt.toLocaleDateString(),
                dataExportUrl,
                dataExportExpiresAt: dataExportExpiresAt?.toLocaleDateString()
            });
        } catch (emailError) {
            logger.warn('Failed to send deletion confirmation email', {
                userId: SafeUtils.safeUserIdPrefix(userId),
                error: emailError.message
            });
        }

        logger.info('Account deletion requested', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            email: userData.email,
            requestId: deletionRequest.id,
            scheduledDeletionAt: scheduledDeletionAt.toISOString()
        });

        res.json({
            success: true,
            message: 'Account deletion requested successfully',
            data: {
                requestId: deletionRequest.id,
                scheduledDeletionDate: scheduledDeletionAt.toISOString(),
                gracePeriodDays,
                dataExportUrl,
                dataExportExpiresAt: dataExportExpiresAt?.toISOString(),
                cancellationUrl: `${req.protocol}://${req.get('host')}/api/user/account/deletion/cancel`
            }
        });

    } catch (error) {
        logger.error('Account deletion request failed', {
            userId: req.user?.id?.substr(0, 8) + '...',
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to process account deletion request'
        });
    }
});

/**
 * POST /api/user/account/deletion/cancel
 * Cancel pending account deletion during grace period
 * Rate limited: 5 attempts per hour per IP/user (Issue #115)
 */
router.post('/account/deletion/cancel', authenticateToken, gdprGlobalLimiter, deletionCancellationLimiter, async (req, res) => {
    try {
        const { reason } = req.body;
        const userId = req.user.id;

        // Find pending deletion request
        const { data: deletionRequest, error: findError } = await supabaseServiceClient
            .from('account_deletion_requests')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .single();

        if (findError || !deletionRequest) {
            return res.status(404).json({
                success: false,
                error: 'No pending account deletion request found'
            });
        }

        // Check if still within grace period
        const now = new Date();
        const scheduledDeletion = new Date(deletionRequest.scheduled_deletion_at);
        
        if (now >= scheduledDeletion) {
            return res.status(400).json({
                success: false,
                error: 'Grace period has expired, deletion cannot be cancelled'
            });
        }

        // Update deletion request status
        const { error: updateError } = await supabaseServiceClient
            .from('account_deletion_requests')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancellation_reason: reason || 'User requested cancellation'
            })
            .eq('id', deletionRequest.id);

        if (updateError) {
            throw updateError;
        }

        // Log cancellation
        await auditService.logAccountDeletionCancellation(userId, deletionRequest.id, {
            reason: reason || 'User requested cancellation',
            cancelled_within_hours: Math.round((scheduledDeletion.getTime() - now.getTime()) / (1000 * 60 * 60))
        }, req);

        // Send cancellation confirmation email
        try {
            const { data: userData } = await supabaseServiceClient
                .from('users')
                .select('name, email')
                .eq('id', userId)
                .single();

            await emailService.sendAccountDeletionCancelledEmail(userData.email, {
                userName: userData.name || userData.email,
                cancellationDate: new Date().toLocaleDateString()
            });
        } catch (emailError) {
            logger.warn('Failed to send deletion cancellation email', {
                userId: SafeUtils.safeUserIdPrefix(userId),
                error: emailError.message
            });
        }

        logger.info('Account deletion cancelled', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            requestId: deletionRequest.id,
            reason: reason || 'User requested'
        });

        res.json({
            success: true,
            message: 'Account deletion cancelled successfully',
            data: {
                requestId: deletionRequest.id,
                cancelledAt: new Date().toISOString(),
                reason: reason || 'User requested cancellation'
            }
        });

    } catch (error) {
        logger.error('Account deletion cancellation failed', {
            userId: req.user?.id?.substr(0, 8) + '...',
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to cancel account deletion'
        });
    }
});

/**
 * GET /api/user/account/deletion/status
 * Get status of account deletion request
 */
router.get('/account/deletion/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: deletionRequest } = await supabaseServiceClient
            .from('account_deletion_requests')
            .select('*')
            .eq('user_id', userId)
            .order('requested_at', { ascending: false })
            .limit(1)
            .single();

        if (!deletionRequest) {
            return res.json({
                success: true,
                data: {
                    hasDeletionRequest: false,
                    status: null
                }
            });
        }

        const now = new Date();
        const scheduledDeletion = new Date(deletionRequest.scheduled_deletion_at);
        const daysUntilDeletion = Math.ceil((scheduledDeletion.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        res.json({
            success: true,
            data: {
                hasDeletionRequest: true,
                requestId: deletionRequest.id,
                status: deletionRequest.status,
                requestedAt: deletionRequest.requested_at,
                scheduledDeletionAt: deletionRequest.scheduled_deletion_at,
                daysUntilDeletion: Math.max(0, daysUntilDeletion),
                gracePeriodDays: deletionRequest.grace_period_days,
                canCancel: deletionRequest.status === 'pending' && daysUntilDeletion > 0,
                dataExportUrl: deletionRequest.data_export_url,
                dataExportExpiresAt: deletionRequest.data_export_expires_at,
                cancelledAt: deletionRequest.cancelled_at,
                completedAt: deletionRequest.completed_at
            }
        });

    } catch (error) {
        logger.error('Failed to get deletion status', {
            userId: req.user?.id?.substr(0, 8) + '...',
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve deletion status'
        });
    }
});

/**
 * GET /api/user/data-export
 * Generate and download GDPR data export
 * Rate limited: 5 attempts per hour per IP/user (Issue #115)
 */
router.get('/data-export', authenticateToken, gdprGlobalLimiter, dataExportLimiter, async (req, res) => {
    try {
        const userId = req.user.id;

        // Log data access
        await auditService.logGdprAction({
            action: 'personal_data_accessed',
            userId,
            actorId: userId,
            actorType: 'user',
            resourceType: 'data_export',
            resourceId: 'user_data_export_request',
            details: {
                access_method: 'api_endpoint',
                export_type: 'full_export'
            },
            legalBasis: 'gdpr_article_15_right_of_access',
            retentionPeriodDays: 730
        }, req);

        const dataExportService = new DataExportService();
        const exportResult = await dataExportService.exportUserData(userId);

        if (!exportResult.success) {
            throw new Error('Data export generation failed');
        }

        // Log successful export
        await auditService.logDataExport(userId, {
            filename: exportResult.filename,
            size: exportResult.size,
            expiresAt: exportResult.expiresAt
        });

        const downloadUrl = `${req.protocol}://${req.get('host')}${exportResult.downloadUrl}`;

        logger.info('GDPR data export generated', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            filename: exportResult.filename,
            size: exportResult.size
        });

        res.json({
            success: true,
            message: 'Data export generated successfully',
            data: {
                downloadUrl,
                filename: exportResult.filename,
                size: exportResult.size,
                expiresAt: exportResult.expiresAt.toISOString()
            }
        });

    } catch (error) {
        logger.error('GDPR data export failed', {
            userId: req.user?.id?.substr(0, 8) + '...',
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to generate data export'
        });
    }
});

/**
 * POST /api/user/data-export
 * Request GDPR data export via email (Issue #258)
 * Rate limited: 5 attempts per hour per IP/user
 */
router.post('/data-export', authenticateToken, gdprGlobalLimiter, dataExportLimiter, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user details for email
        const { data: userData, error: userError } = await supabaseServiceClient
            .from('users')
            .select('email, name')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Log data access request
        await auditService.logGdprAction({
            action: 'personal_data_export_requested',
            userId,
            actorId: userId,
            actorType: 'user',
            resourceType: 'data_export_request',
            resourceId: 'user_data_export_email_request',
            details: {
                access_method: 'profile_settings',
                export_type: 'email_request',
                user_email: userData.email
            },
            legalBasis: 'gdpr_article_15_right_of_access',
            retentionPeriodDays: 730
        }, req);

        // Generate data export
        const dataExportService = new DataExportService();
        const exportResult = await dataExportService.exportUserData(userId);

        if (!exportResult.success) {
            throw new Error('Data export generation failed');
        }

        // Generate full download URL
        const downloadUrl = `${req.protocol}://${req.get('host')}${exportResult.downloadUrl}`;

        // Send email with download link
        await emailService.sendDataExportEmail(userData.email, {
            userName: userData.name || 'User',
            downloadUrl,
            filename: exportResult.filename,
            size: Math.round(exportResult.size / 1024), // Size in KB
            expiresAt: exportResult.expiresAt,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@roastr.ai'
        });

        // Log successful export request
        await auditService.logDataExport(userId, {
            filename: exportResult.filename,
            size: exportResult.size,
            expiresAt: exportResult.expiresAt,
            deliveryMethod: 'email',
            emailSent: true
        });

        logger.info('GDPR data export requested via email', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            email: SafeUtils.maskEmail(userData.email),
            filename: exportResult.filename,
            size: exportResult.size
        });

        res.json({
            success: true,
            message: 'Data export has been generated and sent to your email address',
            data: {
                email: userData.email,
                filename: exportResult.filename,
                size: exportResult.size,
                expiresAt: exportResult.expiresAt.toISOString(),
                estimatedDeliveryMinutes: 5
            }
        });

    } catch (error) {
        logger.error('GDPR data export email request failed', {
            userId: req.user?.id?.substr(0, 8) + '...',
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to process data export request'
        });
    }
});

/**
 * GET /api/user/data-export/download/:token
 * Download exported data using secure token
 * Rate limited: 10 attempts per hour per IP/token (Issue #115)
 */
router.get('/data-export/download/:token', gdprGlobalLimiter, dataDownloadLimiter, async (req, res) => {
    try {
        const { token } = req.params;

        const dataExportService = new DataExportService();
        const downloadToken = dataExportService.validateDownloadToken(token);

        if (!downloadToken) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or expired download link'
            });
        }

        const filepath = downloadToken.filepath;
        const filename = downloadToken.filename;

        // Check if file exists
        try {
            await fs.access(filepath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: 'Export file not found or has expired'
            });
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Stream the file
        const fileStream = require('fs').createReadStream(filepath);
        fileStream.pipe(res);

        fileStream.on('end', () => {
            logger.info('GDPR data export downloaded', {
                filename,
                token: SafeUtils.safeUserIdPrefix(token, 8)
            });
        });

        fileStream.on('error', (error) => {
            logger.error('File download error', { error: error.message });
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'File download failed'
                });
            }
        });

    } catch (error) {
        logger.error('Download endpoint error', {
            token: req.params.token?.substr(0, 8) + '...',
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Download failed'
        });
    }
});

/**
 * GET /api/user/gdpr-audit
 * Get GDPR audit trail for user
 */
router.get('/gdpr-audit', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = parseInt(req.query.offset) || 0;

        const auditResult = await auditService.getGdprAuditTrail(userId, limit, offset);

        if (!auditResult.success) {
            throw new Error(auditResult.error);
        }

        res.json({
            success: true,
            data: auditResult.data
        });

    } catch (error) {
        logger.error('Failed to get GDPR audit trail', {
            userId: req.user?.id?.substr(0, 8) + '...',
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit trail'
        });
    }
});

/**
 * GET /api/user/roastr-persona
 * Get user's Roastr Persona configuration including "lo que me define" and "lo que no tolero"
 */
router.get('/roastr-persona', authenticateToken, roastrPersonaReadLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        const { data: userData, error } = await userClient
            .from('users')
            .select(`
                id,
                lo_que_me_define_encrypted,
                lo_que_me_define_visible,
                lo_que_me_define_created_at,
                lo_que_me_define_updated_at,
                lo_que_no_tolero_encrypted,
                lo_que_no_tolero_visible,
                lo_que_no_tolero_created_at,
                lo_que_no_tolero_updated_at,
                lo_que_me_da_igual_encrypted,
                lo_que_me_da_igual_visible,
                lo_que_me_da_igual_created_at,
                lo_que_me_da_igual_updated_at
            `)
            .eq('id', userId)
            .single();

        if (error) {
            throw new Error(`Failed to fetch Roastr Persona: ${error.message}`);
        }

        // Decrypt the lo_que_me_define field if it exists
        let loQueMeDefine = null;
        if (userData.lo_que_me_define_encrypted) {
            try {
                loQueMeDefine = encryptionService.decrypt(userData.lo_que_me_define_encrypted);
            } catch (decryptError) {
                logger.error('Failed to decrypt lo_que_me_define:', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    error: decryptError.message
                });
                // Return empty if decryption fails
                loQueMeDefine = null;
            }
        }

        // Decrypt the lo_que_no_tolero field if it exists
        let loQueNoTolero = null;
        if (userData.lo_que_no_tolero_encrypted) {
            try {
                loQueNoTolero = encryptionService.decrypt(userData.lo_que_no_tolero_encrypted);
            } catch (decryptError) {
                logger.error('Failed to decrypt lo_que_no_tolero:', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    error: decryptError.message
                });
                // Return empty if decryption fails
                loQueNoTolero = null;
            }
        }

        // Decrypt the lo_que_me_da_igual field if it exists
        let loQueMeDaIgual = null;
        if (userData.lo_que_me_da_igual_encrypted) {
            try {
                loQueMeDaIgual = encryptionService.decrypt(userData.lo_que_me_da_igual_encrypted);
            } catch (decryptError) {
                logger.error('Failed to decrypt lo_que_me_da_igual:', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    error: decryptError.message
                });
                // Return empty if decryption fails
                loQueMeDaIgual = null;
            }
        }

        res.json({
            success: true,
            data: {
                loQueMeDefine,
                isVisible: userData.lo_que_me_define_visible || false,
                createdAt: userData.lo_que_me_define_created_at,
                updatedAt: userData.lo_que_me_define_updated_at,
                hasContent: !!userData.lo_que_me_define_encrypted,
                // Intolerance fields
                loQueNoTolero,
                isIntoleranceVisible: userData.lo_que_no_tolero_visible || false,
                intoleranceCreatedAt: userData.lo_que_no_tolero_created_at,
                intoleranceUpdatedAt: userData.lo_que_no_tolero_updated_at,
                hasIntoleranceContent: !!userData.lo_que_no_tolero_encrypted,
                // Tolerance fields (lo que me da igual)
                loQueMeDaIgual,
                isToleranceVisible: userData.lo_que_me_da_igual_visible || false,
                toleranceCreatedAt: userData.lo_que_me_da_igual_created_at,
                toleranceUpdatedAt: userData.lo_que_me_da_igual_updated_at,
                hasToleranceContent: !!userData.lo_que_me_da_igual_encrypted
            }
        });

    } catch (error) {
        logger.error('Get Roastr Persona error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve Roastr Persona'
        });
    }
});

/**
 * POST /api/user/roastr-persona
 * Save or update user's Roastr Persona including "lo que me define" and "lo que no tolero"
 */
router.post('/roastr-persona', authenticateToken, roastrPersonaWriteLimiter, async (req, res) => {
    try {
        const { 
            loQueMeDefine, 
            isVisible = false,
            loQueNoTolero,
            isIntoleranceVisible = false,
            loQueMeDaIgual,
            isToleranceVisible = false 
        } = req.body;
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        // Validate loQueMeDefine input with prompt injection detection
        if (loQueMeDefine !== null && loQueMeDefine !== undefined) {
            if (typeof loQueMeDefine !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'loQueMeDefine must be a string'
                });
            }

            // Apply prompt injection sanitization first
            const sanitizedPersona = personaSanitizer.sanitizePersonaInput(loQueMeDefine);
            if (sanitizedPersona === null) {
                return res.status(400).json({
                    success: false,
                    error: personaSanitizer.getValidationErrorMessage(loQueMeDefine),
                    rejectedForSecurity: true
                });
            }

            // Apply encryption sanitization and validate length
            const encryptionSanitized = encryptionService.sanitizeForEncryption(sanitizedPersona);
            if (encryptionSanitized.length > 300) {
                return res.status(400).json({
                    success: false,
                    error: 'loQueMeDefine cannot exceed 300 characters'
                });
            }

            if (encryptionSanitized.length === 0 && loQueMeDefine.trim().length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'loQueMeDefine contains invalid characters'
                });
            }
        }

        // Validate loQueNoTolero input with prompt injection detection
        if (loQueNoTolero !== null && loQueNoTolero !== undefined) {
            if (typeof loQueNoTolero !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'loQueNoTolero must be a string'
                });
            }

            // Apply prompt injection sanitization first
            const sanitizedIntolerance = personaSanitizer.sanitizePersonaInput(loQueNoTolero);
            if (sanitizedIntolerance === null) {
                return res.status(400).json({
                    success: false,
                    error: personaSanitizer.getValidationErrorMessage(loQueNoTolero),
                    rejectedForSecurity: true
                });
            }

            // Apply encryption sanitization and validate length
            const encryptionSanitized = encryptionService.sanitizeForEncryption(sanitizedIntolerance);
            if (encryptionSanitized.length > 300) {
                return res.status(400).json({
                    success: false,
                    error: 'loQueNoTolero cannot exceed 300 characters'
                });
            }

            if (encryptionSanitized.length === 0 && loQueNoTolero.trim().length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'loQueNoTolero contains invalid characters'
                });
            }
        }

        // Validate loQueMeDaIgual input with prompt injection detection
        if (loQueMeDaIgual !== null && loQueMeDaIgual !== undefined) {
            if (typeof loQueMeDaIgual !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'loQueMeDaIgual must be a string'
                });
            }

            // Apply prompt injection sanitization first
            const sanitizedTolerance = personaSanitizer.sanitizePersonaInput(loQueMeDaIgual);
            if (sanitizedTolerance === null) {
                return res.status(400).json({
                    success: false,
                    error: personaSanitizer.getValidationErrorMessage(loQueMeDaIgual),
                    rejectedForSecurity: true
                });
            }

            // Apply encryption sanitization and validate length
            const encryptionSanitized = encryptionService.sanitizeForEncryption(sanitizedTolerance);
            if (encryptionSanitized.length > 300) {
                return res.status(400).json({
                    success: false,
                    error: 'loQueMeDaIgual cannot exceed 300 characters'
                });
            }

            if (encryptionSanitized.length === 0 && loQueMeDaIgual.trim().length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'loQueMeDaIgual contains invalid characters'
                });
            }
        }

        // Validate visibility settings
        if (typeof isVisible !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'isVisible must be a boolean'
            });
        }

        if (typeof isIntoleranceVisible !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'isIntoleranceVisible must be a boolean'
            });
        }

        if (typeof isToleranceVisible !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'isToleranceVisible must be a boolean'
            });
        }

        // Get existing data to determine if we need to set created_at timestamps
        const { data: existingData } = await userClient
            .from('users')
            .select('lo_que_me_define_encrypted, lo_que_no_tolero_encrypted, lo_que_me_da_igual_encrypted')
            .eq('id', userId)
            .single();

        // Prepare sanitized versions for encryption
        let sanitizedLoQueMeDefine = null;
        let sanitizedLoQueNoTolero = null;
        let sanitizedLoQueMeDaIgual = null;

        // Pre-sanitize all inputs that passed validation
        if (loQueMeDefine !== undefined && loQueMeDefine !== null && loQueMeDefine.trim() !== '') {
            sanitizedLoQueMeDefine = personaSanitizer.sanitizePersonaInput(loQueMeDefine);
            // If it reaches here, it should be valid (already checked above)
        }

        if (loQueNoTolero !== undefined && loQueNoTolero !== null && loQueNoTolero.trim() !== '') {
            sanitizedLoQueNoTolero = personaSanitizer.sanitizePersonaInput(loQueNoTolero);
        }

        if (loQueMeDaIgual !== undefined && loQueMeDaIgual !== null && loQueMeDaIgual.trim() !== '') {
            sanitizedLoQueMeDaIgual = personaSanitizer.sanitizePersonaInput(loQueMeDaIgual);
        }

        // Prepare update data
        let updateData = {};

        // Handle the lo_que_me_define field if provided
        if (loQueMeDefine !== undefined) {
            updateData.lo_que_me_define_visible = isVisible;
            updateData.lo_que_me_define_updated_at = new Date().toISOString();

            if (loQueMeDefine === null || loQueMeDefine.trim() === '' || sanitizedLoQueMeDefine === null) {
                // User wants to clear the field or input was rejected
                updateData.lo_que_me_define_encrypted = null;
            } else {
                // Encrypt the sanitized and validated content
                const encryptionSanitized = encryptionService.sanitizeForEncryption(sanitizedLoQueMeDefine);
                try {
                    updateData.lo_que_me_define_encrypted = encryptionService.encrypt(encryptionSanitized);
                    
                    // Set created_at if this is the first time setting the field
                    if (!existingData?.lo_que_me_define_encrypted) {
                        updateData.lo_que_me_define_created_at = new Date().toISOString();
                    }
                } catch (encryptError) {
                    logger.error('Failed to encrypt lo_que_me_define:', {
                        userId: SafeUtils.safeUserIdPrefix(userId),
                        error: encryptError.message
                    });
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to secure personal data'
                    });
                }
            }
        }

        // Handle the lo_que_no_tolero field if provided
        if (loQueNoTolero !== undefined) {
            updateData.lo_que_no_tolero_visible = isIntoleranceVisible;
            updateData.lo_que_no_tolero_updated_at = new Date().toISOString();

            if (loQueNoTolero === null || loQueNoTolero.trim() === '' || sanitizedLoQueNoTolero === null) {
                // User wants to clear the field or input was rejected
                updateData.lo_que_no_tolero_encrypted = null;
            } else {
                // Encrypt the sanitized and validated content
                const encryptionSanitized = encryptionService.sanitizeForEncryption(sanitizedLoQueNoTolero);
                try {
                    updateData.lo_que_no_tolero_encrypted = encryptionService.encrypt(encryptionSanitized);
                    
                    // Set created_at if this is the first time setting the field
                    if (!existingData?.lo_que_no_tolero_encrypted) {
                        updateData.lo_que_no_tolero_created_at = new Date().toISOString();
                    }
                } catch (encryptError) {
                    logger.error('Failed to encrypt lo_que_no_tolero:', {
                        userId: SafeUtils.safeUserIdPrefix(userId),
                        error: encryptError.message
                    });
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to secure intolerance data'
                    });
                }
            }
        }

        // Handle the lo_que_me_da_igual field if provided
        if (loQueMeDaIgual !== undefined) {
            updateData.lo_que_me_da_igual_visible = isToleranceVisible;
            updateData.lo_que_me_da_igual_updated_at = new Date().toISOString();

            if (loQueMeDaIgual === null || loQueMeDaIgual.trim() === '' || sanitizedLoQueMeDaIgual === null) {
                // User wants to clear the field or input was rejected
                updateData.lo_que_me_da_igual_encrypted = null;
            } else {
                // Encrypt the sanitized and validated content
                const encryptionSanitized = encryptionService.sanitizeForEncryption(sanitizedLoQueMeDaIgual);
                try {
                    updateData.lo_que_me_da_igual_encrypted = encryptionService.encrypt(encryptionSanitized);
                    
                    // Set created_at if this is the first time setting the field
                    if (!existingData?.lo_que_me_da_igual_encrypted) {
                        updateData.lo_que_me_da_igual_created_at = new Date().toISOString();
                    }
                } catch (encryptError) {
                    logger.error('Failed to encrypt lo_que_me_da_igual:', {
                        userId: SafeUtils.safeUserIdPrefix(userId),
                        error: encryptError.message
                    });
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to secure tolerance data'
                    });
                }
            }
        }

        // Only proceed if there's something to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields provided for update'
            });
        }

        // Use transactional update function for data consistency (Issue #154)
        const { data: updateResult, error: updateError } = await userClient
            .rpc('update_roastr_persona_transactional', {
                p_user_id: userId,
                p_update_data: updateData
            });

        if (updateError || !updateResult?.success) {
            const errorMessage = updateError?.message || updateResult?.error || 'Unknown error';
            throw new Error(`Failed to update Roastr Persona: ${errorMessage}`);
        }

        // Extract updated user data from the result
        const updatedUser = updateResult.updated_fields;

        // Generate embeddings for updated fields (Issue #151)
        await generateEmbeddingsForPersona(userId, {
            loQueMeDefine: loQueMeDefine && loQueMeDefine.trim() !== '' ? loQueMeDefine : null,
            loQueNoTolero: loQueNoTolero && loQueNoTolero.trim() !== '' ? loQueNoTolero : null,
            loQueMeDaIgual: loQueMeDaIgual && loQueMeDaIgual.trim() !== '' ? loQueMeDaIgual : null
        }, userClient);

        // Log the update for audit trail (the triggers will handle detailed logging)
        logger.info('Roastr Persona updated:', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            hasIdentityContent: !!updatedUser.lo_que_me_define_encrypted,
            hasIntoleranceContent: !!updatedUser.lo_que_no_tolero_encrypted,
            hasToleranceContent: !!updatedUser.lo_que_me_da_igual_encrypted,
            fieldsUpdated: Object.keys(updateData).filter(key => key.includes('encrypted')),
            action: 'updated'
        });

        // Prepare response (decrypt for immediate return)
        let responseLoQueMeDefine = null;
        if (updatedUser.lo_que_me_define_encrypted) {
            try {
                responseLoQueMeDefine = encryptionService.decrypt(updatedUser.lo_que_me_define_encrypted);
            } catch (decryptError) {
                logger.error('Failed to decrypt lo_que_me_define for response:', decryptError.message);
                responseLoQueMeDefine = '[Encrypted]';
            }
        }

        let responseLoQueNoTolero = null;
        if (updatedUser.lo_que_no_tolero_encrypted) {
            try {
                responseLoQueNoTolero = encryptionService.decrypt(updatedUser.lo_que_no_tolero_encrypted);
            } catch (decryptError) {
                logger.error('Failed to decrypt lo_que_no_tolero for response:', decryptError.message);
                responseLoQueNoTolero = '[Encrypted]';
            }
        }

        let responseLoQueMeDaIgual = null;
        if (updatedUser.lo_que_me_da_igual_encrypted) {
            try {
                responseLoQueMeDaIgual = encryptionService.decrypt(updatedUser.lo_que_me_da_igual_encrypted);
            } catch (decryptError) {
                logger.error('Failed to decrypt lo_que_me_da_igual for response:', decryptError.message);
                responseLoQueMeDaIgual = '[Encrypted]';
            }
        }

        res.json({
            success: true,
            message: 'Roastr Persona updated successfully',
            data: {
                loQueMeDefine: responseLoQueMeDefine,
                isVisible: updatedUser.lo_que_me_define_visible,
                createdAt: updatedUser.lo_que_me_define_created_at,
                updatedAt: updatedUser.lo_que_me_define_updated_at,
                hasContent: !!updatedUser.lo_que_me_define_encrypted,
                // Intolerance fields
                loQueNoTolero: responseLoQueNoTolero,
                isIntoleranceVisible: updatedUser.lo_que_no_tolero_visible,
                intoleranceCreatedAt: updatedUser.lo_que_no_tolero_created_at,
                intoleranceUpdatedAt: updatedUser.lo_que_no_tolero_updated_at,
                hasIntoleranceContent: !!updatedUser.lo_que_no_tolero_encrypted,
                // Tolerance fields (lo que me da igual)
                loQueMeDaIgual: responseLoQueMeDaIgual,
                isToleranceVisible: updatedUser.lo_que_me_da_igual_visible,
                toleranceCreatedAt: updatedUser.lo_que_me_da_igual_created_at,
                toleranceUpdatedAt: updatedUser.lo_que_me_da_igual_updated_at,
                hasToleranceContent: !!updatedUser.lo_que_me_da_igual_encrypted
            }
        });

    } catch (error) {
        logger.error('Save Roastr Persona error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to save Roastr Persona'
        });
    }
});

/**
 * DELETE /api/user/roastr-persona
 * Delete user's Roastr Persona content (privacy feature)
 * Query params: ?field=identity|intolerance|tolerance|all (default: all)
 */
router.delete('/roastr-persona', authenticateToken, roastrPersonaDeleteLimiter, async (req, res) => {
    try {
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);
        const { field = 'all' } = req.query;

        // Validate field parameter
        if (!['identity', 'intolerance', 'tolerance', 'all'].includes(field)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid field parameter. Must be "identity", "intolerance", "tolerance", or "all"'
            });
        }

        let updateData = {};
        const timestamp = new Date().toISOString();

        // Determine what to delete based on field parameter
        if (field === 'identity' || field === 'all') {
            updateData.lo_que_me_define_encrypted = null;
            updateData.lo_que_me_define_visible = false;
            updateData.lo_que_me_define_updated_at = timestamp;
        }

        if (field === 'intolerance' || field === 'all') {
            updateData.lo_que_no_tolero_encrypted = null;
            updateData.lo_que_no_tolero_visible = false;
            updateData.lo_que_no_tolero_updated_at = timestamp;
        }

        if (field === 'tolerance' || field === 'all') {
            updateData.lo_que_me_da_igual_encrypted = null;
            updateData.lo_que_me_da_igual_visible = false;
            updateData.lo_que_me_da_igual_updated_at = timestamp;
        }

        // Use transactional delete function for data consistency (Issue #154)
        const { data: deleteResult, error: deleteError } = await userClient
            .rpc('delete_roastr_persona_transactional', {
                p_user_id: userId,
                p_field_type: field
            });

        if (deleteError || !deleteResult?.success) {
            const errorMessage = deleteError?.message || deleteResult?.error || 'Unknown error';
            throw new Error(`Failed to delete Roastr Persona: ${errorMessage}`);
        }
        
        // Extract field-specific timestamps from the result
        const updatedUser = {
            lo_que_me_define_updated_at: field === 'identity' || field === 'all' ? timestamp : null,
            lo_que_no_tolero_updated_at: field === 'intolerance' || field === 'all' ? timestamp : null,
            lo_que_me_da_igual_updated_at: field === 'tolerance' || field === 'all' ? timestamp : null
        };

        logger.info('Roastr Persona deleted:', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            field: field,
            deletedAt: timestamp,
            fieldsCleared: Object.keys(updateData).filter(key => key.includes('encrypted'))
        });

        res.json({
            success: true,
            message: `Roastr Persona ${field === 'all' ? 'completely' : `(${field})`} deleted successfully`,
            data: {
                field: field,
                deletedAt: timestamp,
                identityDeletedAt: field === 'identity' || field === 'all' ? updatedUser.lo_que_me_define_updated_at : null,
                intoleranceDeletedAt: field === 'intolerance' || field === 'all' ? updatedUser.lo_que_no_tolero_updated_at : null,
                toleranceDeletedAt: field === 'tolerance' || field === 'all' ? updatedUser.lo_que_me_da_igual_updated_at : null
            }
        });

    } catch (error) {
        logger.error('Delete Roastr Persona error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to delete Roastr Persona'
        });
    }
});

/**
 * Generate embeddings for Roastr Persona fields
 * Issue #151: Semantic enrichment with embeddings
 */
async function generateEmbeddingsForPersona(userId, personaData, userClient) {
    try {
        const { loQueMeDefine, loQueNoTolero, loQueMeDaIgual } = personaData;
        
        // Only generate embeddings if at least one field has content
        if (!loQueMeDefine && !loQueNoTolero && !loQueMeDaIgual) {
            logger.debug('No persona content to generate embeddings for', {
                userId: userId?.substr(0, 8) + '...' || 'unknown'
            });
            return;
        }

        const updateData = {
            embeddings_generated_at: new Date().toISOString(),
            embeddings_model: 'text-embedding-3-small',
            embeddings_version: 1
        };

        // Generate embedding for "lo que me define" field
        if (loQueMeDefine) {
            try {
                const termsWithEmbeddings = await embeddingsService.processPersonaText(loQueMeDefine);
                
                if (termsWithEmbeddings.length > 0) {
                    // Store embeddings as JSON array of objects with terms and embeddings
                    updateData.lo_que_me_define_embedding = JSON.stringify(termsWithEmbeddings);
                    
                    logger.debug('Generated identity embeddings', {
                        userId: SafeUtils.safeUserIdPrefix(userId),
                        termsCount: termsWithEmbeddings.length,
                        textLength: loQueMeDefine.length
                    });
                }
            } catch (error) {
                logger.error('Failed to generate identity embeddings', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    error: error.message,
                    textLength: loQueMeDefine.length
                });
                // Don't fail the entire request for embedding errors
            }
        } else {
            // Clear embedding if field was cleared
            updateData.lo_que_me_define_embedding = null;
        }

        // Generate embedding for "lo que no tolero" field
        if (loQueNoTolero) {
            try {
                const termsWithEmbeddings = await embeddingsService.processPersonaText(loQueNoTolero);
                
                if (termsWithEmbeddings.length > 0) {
                    updateData.lo_que_no_tolero_embedding = JSON.stringify(termsWithEmbeddings);
                    
                    logger.debug('Generated intolerance embeddings', {
                        userId: SafeUtils.safeUserIdPrefix(userId),
                        termsCount: termsWithEmbeddings.length,
                        textLength: loQueNoTolero.length
                    });
                }
            } catch (error) {
                logger.error('Failed to generate intolerance embeddings', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    error: error.message,
                    textLength: loQueNoTolero.length
                });
                // Don't fail the entire request for embedding errors
            }
        } else {
            // Clear embedding if field was cleared
            updateData.lo_que_no_tolero_embedding = null;
        }

        // Generate embedding for "lo que me da igual" field
        if (loQueMeDaIgual) {
            try {
                const termsWithEmbeddings = await embeddingsService.processPersonaText(loQueMeDaIgual);
                
                if (termsWithEmbeddings.length > 0) {
                    updateData.lo_que_me_da_igual_embedding = JSON.stringify(termsWithEmbeddings);
                    
                    logger.debug('Generated tolerance embeddings', {
                        userId: SafeUtils.safeUserIdPrefix(userId),
                        termsCount: termsWithEmbeddings.length,
                        textLength: loQueMeDaIgual.length
                    });
                }
            } catch (error) {
                logger.error('Failed to generate tolerance embeddings', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    error: error.message,
                    textLength: loQueMeDaIgual.length
                });
                // Don't fail the entire request for embedding errors
            }
        } else {
            // Clear embedding if field was cleared
            updateData.lo_que_me_da_igual_embedding = null;
        }

        // Update embeddings in database if any were generated or cleared
        if (Object.keys(updateData).length > 3) { // More than just metadata fields
            const { error: embeddingUpdateError } = await userClient
                .from('users')
                .update(updateData)
                .eq('id', userId);

            if (embeddingUpdateError) {
                logger.error('Failed to save embeddings to database', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    error: embeddingUpdateError.message,
                    updateFields: Object.keys(updateData)
                });
                // Don't fail the entire request for embedding storage errors
            } else {
                logger.info('Successfully generated and stored persona embeddings', {
                    userId: SafeUtils.safeUserIdPrefix(userId),
                    embeddingsGenerated: Object.keys(updateData).filter(key => key.includes('embedding') && updateData[key] !== null).length,
                    embeddingsCleared: Object.keys(updateData).filter(key => key.includes('embedding') && updateData[key] === null).length,
                    model: updateData.embeddings_model,
                    version: updateData.embeddings_version
                });
            }
        }

    } catch (error) {
        logger.error('Unexpected error in embedding generation', {
            userId: SafeUtils.safeUserIdPrefix(userId),
            error: error.message,
            stack: error.stack
        });
        // Don't throw - we don't want embedding errors to break persona updates
    }
}

/**
 * GET /api/user/entitlements
 * Get user's current entitlements and plan limits
 */
router.get('/entitlements', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        // Get user's entitlements from account_entitlements table
        const { data: entitlements, error } = await userClient
            .from('account_entitlements')
            .select('*')
            .eq('account_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No entitlements found, return default free plan
                const defaultEntitlements = {
                    analysis_limit_monthly: 100,
                    roast_limit_monthly: 50,
                    model: 'gpt-3.5-turbo',
                    shield_enabled: false,
                    rqc_mode: 'basic',
                    plan_name: 'free',
                    stripe_price_id: null,
                    stripe_product_id: null
                };

                return res.json({
                    success: true,
                    data: defaultEntitlements
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: entitlements
        });

    } catch (error) {
        logger.error('Get user entitlements error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve entitlements'
        });
    }
});

/**
 * GET /api/user/usage
 * Get user's current monthly usage
 */
router.get('/usage', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        // Get current month's usage from usage_counters table
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

        const { data: usage, error } = await userClient
            .from('usage_counters')
            .select('*')
            .eq('account_id', userId)
            .eq('month', currentMonth)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No usage found for current month, return zero usage
                const defaultUsage = {
                    analysis_used: 0,
                    roast_used: 0,
                    month: currentMonth,
                    costCents: 0
                };

                return res.json({
                    success: true,
                    data: defaultUsage
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: {
                analysis_used: usage.analysis_count || 0,
                roast_used: usage.roast_count || 0,
                month: usage.month,
                costCents: usage.cost_cents || 0
            }
        });

    } catch (error) {
        logger.error('Get user usage error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve usage data'
        });
    }
});

/**
 * GET /api/user
 * Get user profile with plan information (enhanced for billing page)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userClient = createUserClient(req.accessToken);

        // Get user information with entitlements
        const { data: user, error } = await userClient
            .from('users')
            .select(`
                id,
                email,
                full_name,
                plan,
                stripe_customer_id,
                created_at,
                updated_at
            `)
            .eq('id', userId)
            .single();

        if (error) {
            throw error;
        }

        // Get entitlements to include in user response
        const { data: entitlements } = await userClient
            .from('account_entitlements')
            .select('plan_name, model, shield_enabled, rqc_mode')
            .eq('account_id', userId)
            .single();

        const userResponse = {
            ...user,
            plan: entitlements?.plan_name || user.plan || 'free',
            model: entitlements?.model || 'gpt-3.5-turbo',
            shield_enabled: entitlements?.shield_enabled || false,
            rqc_mode: entitlements?.rqc_mode || 'basic'
        };

        res.json({
            success: true,
            data: userResponse
        });

    } catch (error) {
        logger.error('Get user profile error:', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve user profile'
        });
    }
});

/**
 * PATCH /api/user/settings/transparency-mode
 * Update user's AI transparency mode preference (Issue #187)
 */
router.patch('/settings/transparency-mode', authenticateToken, async (req, res) => {
    try {
        const { mode } = req.body;
        const userId = req.user.id;

        // Validate transparency mode
        const validModes = ['bio', 'signature', 'creative'];
        if (!mode || !validModes.includes(mode)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid transparency mode. Must be one of: bio, signature, creative'
            });
        }

        // Update user's transparency mode
        if (flags.isEnabled('ENABLE_SUPABASE')) {
            const userClient = createUserClient(req.headers.authorization.replace('Bearer ', ''));
            
            const { data, error } = await userClient
                .from('users')
                .update({ transparency_mode: mode })
                .eq('id', userId)
                .select('transparency_mode')
                .single();

            if (error) {
                throw error;
            }

            // Log the change
            await auditService.logUserSettingChange(userId, 'transparency_mode', {
                old_value: req.user.transparency_mode || 'bio',
                new_value: mode
            }, req);

            logger.info('Transparency mode updated', {
                userId: SafeUtils.safeUserIdPrefix(userId),
                mode
            });

            res.json({
                success: true,
                message: 'Transparency mode updated successfully',
                data: {
                    transparency_mode: data.transparency_mode,
                    bio_text: mode === 'bio' ? transparencyService.getBioText('es') : null
                }
            });
        } else {
            // Mock mode response
            logger.info('Mock mode: Transparency mode updated', {
                userId: SafeUtils.safeUserIdPrefix(userId),
                mode
            });

            res.json({
                success: true,
                message: 'Transparency mode updated successfully',
                data: {
                    transparency_mode: mode,
                    bio_text: mode === 'bio' ? transparencyService.getBioText('es') : null
                }
            });
        }

    } catch (error) {
        logger.error('Update transparency mode error', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update transparency mode'
        });
    }
});

/**
 * GET /api/user/settings/transparency-mode
 * Get user's current transparency mode setting
 */
router.get('/settings/transparency-mode', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        if (flags.isEnabled('ENABLE_SUPABASE')) {
            const userClient = createUserClient(req.headers.authorization.replace('Bearer ', ''));
            
            const { data, error } = await userClient
                .from('users')
                .select('transparency_mode')
                .eq('id', userId)
                .single();

            if (error) {
                throw error;
            }

            res.json({
                success: true,
                data: {
                    transparency_mode: data.transparency_mode || 'bio',
                    bio_text: (!data.transparency_mode || data.transparency_mode === 'bio') 
                        ? transparencyService.getBioText('es') 
                        : null,
                    options: [
                        {
                            value: 'bio',
                            label: 'Aviso en Bio',
                            description: 'Añade el aviso manualmente en tu biografía',
                            is_default: true
                        },
                        {
                            value: 'signature',
                            label: 'Firma clásica',
                            description: 'Cada roast termina con "— Generado por Roastr.AI"'
                        },
                        {
                            value: 'creative',
                            label: 'Disclaimers creativos',
                            description: 'Disclaimers aleatorios y divertidos en cada roast'
                        }
                    ]
                }
            });
        } else {
            // Mock mode response
            res.json({
                success: true,
                data: {
                    transparency_mode: 'bio',
                    bio_text: transparencyService.getBioText('es'),
                    options: [
                        {
                            value: 'bio',
                            label: 'Aviso en Bio',
                            description: 'Añade el aviso manualmente en tu biografía',
                            is_default: true
                        },
                        {
                            value: 'signature',
                            label: 'Firma clásica',
                            description: 'Cada roast termina con "— Generado por Roastr.AI"'
                        },
                        {
                            value: 'creative',
                            label: 'Disclaimers creativos',
                            description: 'Disclaimers aleatorios y divertidos en cada roast'
                        }
                    ]
                }
            });
        }

    } catch (error) {
        logger.error('Get transparency mode error', {
            userId: SafeUtils.safeUserIdPrefix(req.user.id),
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve transparency mode'
        });
    }
});

/**
 * GET /api/user/settings/transparency-explanation
 * Get unified transparency system explanation and bio recommendation (Issue #196, Optimized #199)
 */
router.get('/settings/transparency-explanation', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const language = req.user.language || 'es';
        
        // Use optimized unified method (Issue #199) - single call instead of multiple
        const transparencyInfo = await transparencyService.getTransparencyInfo(language, userId);

        res.json({
            success: true,
            data: transparencyInfo
        });

    } catch (error) {
        logger.error('Get transparency explanation error', {
            userId: req.user?.id?.substring(0, 8) + '...' || 'unknown',
            error: error.message,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve transparency information'
        });
    }
});

module.exports = router;