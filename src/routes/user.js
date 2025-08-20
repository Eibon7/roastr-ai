const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient, createUserClient } = require('../config/supabase');
const UserIntegrationsService = require('../services/mockIntegrationsService');
const { flags } = require('../config/flags');
const DataExportService = require('../services/dataExportService');
const emailService = require('../services/emailService');
const auditService = require('../services/auditService');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

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
            logger.info('Mock mode: User preferences updated', { userId: userId.substr(0, 8) + '...', humor_tone, humor_style });
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
 */
router.delete('/account', authenticateToken, async (req, res) => {
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
                userId: userId.substr(0, 8) + '...',
                error: emailError.message
            });
        }

        logger.info('Account deletion requested', {
            userId: userId.substr(0, 8) + '...',
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
 */
router.post('/account/deletion/cancel', authenticateToken, async (req, res) => {
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
                userId: userId.substr(0, 8) + '...',
                error: emailError.message
            });
        }

        logger.info('Account deletion cancelled', {
            userId: userId.substr(0, 8) + '...',
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
 */
router.get('/data-export', authenticateToken, async (req, res) => {
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
            userId: userId.substr(0, 8) + '...',
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
 * GET /api/user/data-export/download/:token
 * Download exported data using secure token
 */
router.get('/data-export/download/:token', async (req, res) => {
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
                token: token.substr(0, 8) + '...'
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

module.exports = router;