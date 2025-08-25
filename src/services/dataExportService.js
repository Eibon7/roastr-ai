const JSZip = require('jszip');
const { supabaseServiceClient } = require('../config/supabase');
const { logger, SafeUtils } = require('../utils/logger');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class DataExportService {
    constructor() {
        this.exportDir = path.join(process.cwd(), 'temp', 'exports');
        this.signedUrlExpiryHours = 72; // 3 days
    }

    /**
     * Export all user data in GDPR-compliant format
     */
    async exportUserData(userId) {
        try {
            logger.info('Starting GDPR data export', { userId: SafeUtils.safeUserIdPrefix(userId) });

            // Collect all user data
            const userData = await this.collectUserData(userId);
            
            // Create ZIP file with organized structure
            const zipBuffer = await this.createZipFile(userData, userId);
            
            // Save to temp directory
            const filename = `user-data-export-${SafeUtils.safeUserIdPrefix(userId, 8).replace('...', '')}-${Date.now()}.zip`;
            const filepath = await this.saveExportFile(zipBuffer, filename);
            
            // Generate signed URL for download
            const downloadUrl = await this.generateSignedDownloadUrl(filepath, filename);
            
            logger.info('GDPR data export completed', { 
                userId: SafeUtils.safeUserIdPrefix(userId),
                filename,
                size: zipBuffer.length
            });

            return {
                success: true,
                downloadUrl,
                filename,
                size: zipBuffer.length,
                expiresAt: new Date(Date.now() + (this.signedUrlExpiryHours * 60 * 60 * 1000))
            };

        } catch (error) {
            logger.error('Data export failed', { 
                userId: SafeUtils.safeUserIdPrefix(userId),
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Collect all user data from database
     */
    async collectUserData(userId) {
        const data = {
            export_metadata: {
                export_date: new Date().toISOString(),
                user_id: userId,
                format_version: '1.0',
                legal_basis: 'GDPR Article 20 - Right to data portability'
            },
            user_profile: null,
            organizations: [],
            integrations: [],
            comments: [],
            responses: [],
            usage_records: [],
            user_activities: [],
            api_keys: [],
            audit_logs: []
        };

        try {
            // User profile
            const { data: userProfile } = await supabaseServiceClient
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (userProfile) {
                // Remove sensitive fields
                delete userProfile.stripe_customer_id;
                data.user_profile = userProfile;
            }

            // Organizations owned by user
            const { data: organizations } = await supabaseServiceClient
                .from('organizations')
                .select('*')
                .eq('owner_id', userId);
            
            if (organizations) {
                data.organizations = organizations.map(org => {
                    // Remove sensitive fields
                    delete org.stripe_subscription_id;
                    return org;
                });
            }

            // Get organization IDs for related data
            const orgIds = organizations?.map(org => org.id) || [];

            // Integration configurations
            if (orgIds.length > 0) {
                const { data: integrations } = await supabaseServiceClient
                    .from('integration_configs')
                    .select('*')
                    .in('organization_id', orgIds);
                
                if (integrations) {
                    data.integrations = integrations.map(integration => {
                        // Remove sensitive credential data
                        if (integration.credentials) {
                            integration.credentials = '[REDACTED - Contains API keys]';
                        }
                        return integration;
                    });
                }

                // Comments
                const { data: comments } = await supabaseServiceClient
                    .from('comments')
                    .select('*')
                    .in('organization_id', orgIds);
                
                data.comments = comments || [];

                // Responses
                const { data: responses } = await supabaseServiceClient
                    .from('responses')
                    .select('*')
                    .in('organization_id', orgIds);
                
                data.responses = responses || [];

                // Usage records
                const { data: usageRecords } = await supabaseServiceClient
                    .from('usage_records')
                    .select('*')
                    .in('organization_id', orgIds);
                
                data.usage_records = usageRecords || [];

                // API keys
                const { data: apiKeys } = await supabaseServiceClient
                    .from('api_keys')
                    .select('id, organization_id, name, key_preview, scopes, is_active, last_used_at, created_at, expires_at')
                    .in('organization_id', orgIds);
                
                data.api_keys = apiKeys || [];
            }

            // User activities
            const { data: userActivities } = await supabaseServiceClient
                .from('user_activities')
                .select('*')
                .eq('user_id', userId);
            
            data.user_activities = userActivities || [];

            // Audit logs related to user
            const { data: auditLogs } = await supabaseServiceClient
                .from('audit_logs')
                .select('*')
                .eq('user_id', userId);
            
            data.audit_logs = auditLogs || [];

            return data;

        } catch (error) {
            logger.error('Error collecting user data', { 
                userId: SafeUtils.safeUserIdPrefix(userId),
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Create ZIP file with structured data
     */
    async createZipFile(userData, userId) {
        const zip = new JSZip();

        // Add main data files
        zip.file('README.txt', this.generateReadmeText());
        zip.file('user_profile.json', JSON.stringify(userData.user_profile, null, 2));
        zip.file('organizations.json', JSON.stringify(userData.organizations, null, 2));
        zip.file('integrations.json', JSON.stringify(userData.integrations, null, 2));
        zip.file('export_metadata.json', JSON.stringify(userData.export_metadata, null, 2));

        // Activity data
        const activityFolder = zip.folder('activity');
        activityFolder.file('comments.json', JSON.stringify(userData.comments, null, 2));
        activityFolder.file('responses.json', JSON.stringify(userData.responses, null, 2));
        activityFolder.file('user_activities.json', JSON.stringify(userData.user_activities, null, 2));

        // Usage and billing
        const billingFolder = zip.folder('billing');
        billingFolder.file('usage_records.json', JSON.stringify(userData.usage_records, null, 2));

        // Security and access
        const securityFolder = zip.folder('security');
        securityFolder.file('api_keys.json', JSON.stringify(userData.api_keys, null, 2));
        securityFolder.file('audit_logs.json', JSON.stringify(userData.audit_logs, null, 2));

        // Generate summary report
        const summary = this.generateSummaryReport(userData);
        zip.file('data_summary.json', JSON.stringify(summary, null, 2));

        return await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6
            }
        });
    }

    /**
     * Generate README file content
     */
    generateReadmeText() {
        return `GDPR DATA EXPORT
================

This archive contains all your personal data stored in our system, exported in compliance with GDPR Article 20 (Right to data portability).

CONTENTS:
---------
- user_profile.json: Your account information and preferences
- organizations.json: Organizations you own or are a member of
- integrations.json: Your connected platform integrations (API keys redacted)
- activity/: Your platform activity and interactions
- billing/: Usage records and billing information
- security/: API keys and security audit logs
- data_summary.json: Summary statistics of your data
- export_metadata.json: Information about this export

DATA PROCESSING:
----------------
- Sensitive information like API keys and payment details have been redacted for security
- All timestamps are in ISO 8601 format (UTC)
- Data is organized by functional area for easy review

YOUR RIGHTS:
------------
Under GDPR, you have the right to:
- Request corrections to your data (Article 16)
- Request deletion of your data (Article 17)
- Restrict processing of your data (Article 18)
- Object to processing of your data (Article 21)

For questions about this export or to exercise your rights, contact our data protection team.

Generated on: ${new Date().toISOString()}
`;
    }

    /**
     * Generate data summary report
     */
    generateSummaryReport(userData) {
        return {
            export_date: userData.export_metadata.export_date,
            user_id: userData.export_metadata.user_id,
            data_categories: {
                user_profile: userData.user_profile ? 1 : 0,
                organizations: userData.organizations.length,
                integrations: userData.integrations.length,
                comments: userData.comments.length,
                responses: userData.responses.length,
                usage_records: userData.usage_records.length,
                user_activities: userData.user_activities.length,
                api_keys: userData.api_keys.length,
                audit_logs: userData.audit_logs.length
            },
            total_records: (
                (userData.user_profile ? 1 : 0) +
                userData.organizations.length +
                userData.integrations.length +
                userData.comments.length +
                userData.responses.length +
                userData.usage_records.length +
                userData.user_activities.length +
                userData.api_keys.length +
                userData.audit_logs.length
            ),
            data_retention_info: {
                user_profile: 'Retained until account deletion',
                activity_data: 'Retained for 2 years after account deletion for legal compliance',
                audit_logs: 'Retained for 7 years for security and legal compliance'
            }
        };
    }

    /**
     * Save export file to temporary directory
     */
    async saveExportFile(zipBuffer, filename) {
        try {
            // Ensure export directory exists
            await fs.mkdir(this.exportDir, { recursive: true });
            
            const filepath = path.join(this.exportDir, filename);
            await fs.writeFile(filepath, zipBuffer);
            
            return filepath;
        } catch (error) {
            logger.error('Error saving export file', { filename, error: error.message });
            throw error;
        }
    }

    /**
     * Generate signed URL for secure download
     */
    async generateSignedDownloadUrl(filepath, filename) {
        try {
            // In a production environment, this would typically upload to S3/GCS
            // and generate a pre-signed URL. For this implementation, we'll create
            // a secure token-based download URL
            
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = Date.now() + (this.signedUrlExpiryHours * 60 * 60 * 1000);
            
            // Store the token mapping (in production, use Redis or database)
            const downloadToken = {
                token,
                filepath,
                filename,
                expiresAt,
                createdAt: Date.now()
            };
            
            // This would be stored in a more persistent way in production
            global.downloadTokens = global.downloadTokens || new Map();
            global.downloadTokens.set(token, downloadToken);
            
            // Clean up expired tokens
            this.cleanupExpiredTokens();
            
            return `/api/user/data-export/download/${token}`;
            
        } catch (error) {
            logger.error('Error generating signed download URL', { error: error.message });
            throw error;
        }
    }

    /**
     * Clean up expired download tokens
     */
    cleanupExpiredTokens() {
        if (!global.downloadTokens) return;
        
        const now = Date.now();
        for (const [token, downloadToken] of global.downloadTokens.entries()) {
            if (downloadToken.expiresAt < now) {
                global.downloadTokens.delete(token);
                
                // Also delete the file
                fs.unlink(downloadToken.filepath).catch(err => {
                    logger.warn('Error deleting expired export file', { 
                        filepath: downloadToken.filepath,
                        error: err.message 
                    });
                });
            }
        }
    }

    /**
     * Validate and retrieve download token (timing-safe)
     */
    validateDownloadToken(token) {
        if (!global.downloadTokens || typeof token !== 'string') {
            return null;
        }

        // Convert token to Buffer for timing-safe comparison
        const tokenBuffer = Buffer.from(token);
        
        // Find matching token using timing-safe comparison
        let matchedToken = null;
        for (const [storedToken, downloadToken] of global.downloadTokens.entries()) {
            const storedTokenBuffer = Buffer.from(storedToken);
            
            // Both buffers must be same length for timingSafeEqual
            if (tokenBuffer.length === storedTokenBuffer.length) {
                try {
                    if (crypto.timingSafeEqual(tokenBuffer, storedTokenBuffer)) {
                        matchedToken = downloadToken;
                        break;
                    }
                } catch (e) {
                    // timingSafeEqual throws if lengths don't match (shouldn't happen here)
                    continue;
                }
            }
        }
        
        if (!matchedToken) {
            return null;
        }
        
        // Check expiration
        if (matchedToken.expiresAt < Date.now()) {
            global.downloadTokens.delete(token);
            return null;
        }

        return matchedToken;
    }

    /**
     * Anonymize user data for retention compliance
     */
    async anonymizeUserData(userId) {
        try {
            logger.info('Starting user data anonymization', { userId: userId?.substr(0, 8) + '...' || 'unknown' });

            // Anonymize audit logs (keep for legal compliance but remove PII)
            await supabaseServiceClient
                .from('audit_logs')
                .update({
                    user_id: null,
                    details: {},
                    ip_address: null,
                    user_agent: '[ANONYMIZED]'
                })
                .eq('user_id', userId);

            // Anonymize user activities (keep for analytics but remove PII)
            await supabaseServiceClient
                .from('user_activities')
                .update({
                    metadata: { anonymized: true }
                })
                .eq('user_id', userId);

            // Anonymize comments and responses (keep for moderation training but remove PII)
            const { data: organizations } = await supabaseServiceClient
                .from('organizations')
                .select('id')
                .eq('owner_id', userId);

            if (organizations && organizations.length > 0) {
                const orgIds = organizations.map(org => org.id);

                await supabaseServiceClient
                    .from('comments')
                    .update({
                        platform_user_id: '[ANONYMIZED]',
                        platform_username: '[ANONYMIZED]',
                        metadata: { anonymized: true }
                    })
                    .in('organization_id', orgIds);

                await supabaseServiceClient
                    .from('responses')
                    .update({
                        platform_response_id: null
                    })
                    .in('organization_id', orgIds);
            }

            logger.info('User data anonymization completed', { userId: userId?.substr(0, 8) + '...' || 'unknown' });

        } catch (error) {
            logger.error('Error anonymizing user data', { 
                userId: SafeUtils.safeUserIdPrefix(userId),
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Complete user data deletion
     */
    async deleteUserData(userId) {
        try {
            logger.info('Starting complete user data deletion', { userId: userId?.substr(0, 8) + '...' || 'unknown' });

            // Get user organizations first
            const { data: organizations } = await supabaseServiceClient
                .from('organizations')
                .select('id')
                .eq('owner_id', userId);

            // The CASCADE constraints will handle most deletions, but we'll be explicit
            // for important cleanup operations

            if (organizations && organizations.length > 0) {
                const orgIds = organizations.map(org => org.id);

                // Delete organization-related data
                await supabaseServiceClient.from('integration_configs').delete().in('organization_id', orgIds);
                await supabaseServiceClient.from('usage_records').delete().in('organization_id', orgIds);
                await supabaseServiceClient.from('monthly_usage').delete().in('organization_id', orgIds);
                await supabaseServiceClient.from('comments').delete().in('organization_id', orgIds);
                await supabaseServiceClient.from('responses').delete().in('organization_id', orgIds);
                await supabaseServiceClient.from('user_behaviors').delete().in('organization_id', orgIds);
                await supabaseServiceClient.from('job_queue').delete().in('organization_id', orgIds);
                await supabaseServiceClient.from('app_logs').delete().in('organization_id', orgIds);
                await supabaseServiceClient.from('api_keys').delete().in('organization_id', orgIds);

                // Delete organization memberships
                await supabaseServiceClient.from('organization_members').delete().in('organization_id', orgIds);
                
                // Delete organizations
                await supabaseServiceClient.from('organizations').delete().in('id', orgIds);
            }

            // Delete user-specific data
            await supabaseServiceClient.from('user_activities').delete().eq('user_id', userId);
            await supabaseServiceClient.from('account_deletion_requests').delete().eq('user_id', userId);
            
            // Finally delete the user (this will cascade to remaining references)
            await supabaseServiceClient.from('users').delete().eq('id', userId);

            logger.info('Complete user data deletion finished', { userId: userId?.substr(0, 8) + '...' || 'unknown' });

        } catch (error) {
            logger.error('Error deleting user data', { 
                userId: SafeUtils.safeUserIdPrefix(userId),
                error: error.message 
            });
            throw error;
        }
    }
}

module.exports = DataExportService;