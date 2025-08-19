/**
 * Email notification service for billing and subscription events
 * Supports SendGrid with email templates for various notification types
 */

const sgMail = require('@sendgrid/mail');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');

class EmailService {
    constructor() {
        this.isConfigured = false;
        this.templates = new Map();
        this.init();
    }

    /**
     * Initialize email service
     */
    init() {
        // Check if SendGrid is configured
        if (process.env.SENDGRID_API_KEY && flags.isEnabled('ENABLE_EMAIL_NOTIFICATIONS')) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.isConfigured = true;
            logger.info('📧 Email service initialized with SendGrid');
        } else {
            logger.warn('📧 Email service disabled - missing SENDGRID_API_KEY or feature flag disabled');
        }
    }

    /**
     * Load and compile email template
     * @param {string} templateName - Template file name without extension
     * @returns {Promise<Function>} Compiled handlebars template
     */
    async loadTemplate(templateName) {
        if (this.templates.has(templateName)) {
            return this.templates.get(templateName);
        }

        try {
            const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);
            const templateContent = await fs.readFile(templatePath, 'utf8');
            const compiledTemplate = handlebars.compile(templateContent);
            
            this.templates.set(templateName, compiledTemplate);
            logger.info(`📧 Email template loaded: ${templateName}`);
            
            return compiledTemplate;
        } catch (error) {
            logger.error(`Failed to load email template ${templateName}:`, error);
            throw error;
        }
    }

    /**
     * Send email using SendGrid
     * @param {Object} options - Email options
     * @param {string} options.to - Recipient email
     * @param {string} options.subject - Email subject
     * @param {string} options.templateName - Template name
     * @param {Object} options.templateData - Data for template rendering
     * @param {number} options.retries - Number of retries (default: 3)
     * @returns {Promise<Object>} Send result
     */
    async sendEmail({ to, subject, templateName, templateData = {}, retries = 3 }) {
        if (!this.isConfigured) {
            logger.warn('📧 Email service not configured, skipping email send');
            return { success: false, reason: 'Email service not configured' };
        }

        try {
            // Load and render template
            const template = await this.loadTemplate(templateName);
            const htmlContent = template(templateData);

            // Prepare email message
            const msg = {
                to: to,
                from: process.env.SENDGRID_FROM_EMAIL || 'noreply@roastr.ai',
                fromName: process.env.SENDGRID_FROM_NAME || 'Roastr.ai',
                subject: subject,
                html: htmlContent,
                // Add plain text version
                text: this.htmlToPlainText(htmlContent)
            };

            // Send email with retry logic
            let lastError;
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const result = await sgMail.send(msg);
                    
                    logger.info('📧 Email sent successfully', {
                        to: to,
                        subject: subject,
                        templateName: templateName,
                        attempt: attempt,
                        messageId: result[0]?.headers?.['x-message-id']
                    });

                    return { 
                        success: true, 
                        messageId: result[0]?.headers?.['x-message-id'],
                        attempt: attempt
                    };
                } catch (error) {
                    lastError = error;
                    logger.warn(`📧 Email send attempt ${attempt} failed:`, {
                        to: to,
                        templateName: templateName,
                        error: error.message,
                        attempt: attempt
                    });

                    if (attempt < retries) {
                        // Wait before retry with exponential backoff
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    }
                }
            }

            // All retries failed
            logger.error('📧 Email send failed after all retries:', {
                to: to,
                templateName: templateName,
                retries: retries,
                error: lastError?.message
            });

            return { 
                success: false, 
                error: lastError?.message || 'Unknown error',
                retriesAttempted: retries
            };

        } catch (error) {
            logger.error('📧 Email service error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Convert HTML to plain text (basic implementation)
     * @param {string} html - HTML content
     * @returns {string} Plain text content
     */
    htmlToPlainText(html) {
        return html
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    /**
     * Send payment failed notification
     * @param {string} userEmail - User email address
     * @param {Object} subscriptionData - Subscription details
     * @returns {Promise<Object>} Send result
     */
    async sendPaymentFailedNotification(userEmail, subscriptionData) {
        return await this.sendEmail({
            to: userEmail,
            subject: '⚠️ Payment Failed - Action Required',
            templateName: 'payment_failed',
            templateData: {
                userName: subscriptionData.userName || 'User',
                planName: subscriptionData.planName || 'Pro',
                failedAmount: subscriptionData.failedAmount || 'N/A',
                nextAttemptDate: subscriptionData.nextAttemptDate,
                updatePaymentUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'https://app.roastr.ai/billing',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@roastr.ai'
            }
        });
    }

    /**
     * Send subscription canceled notification
     * @param {string} userEmail - User email address
     * @param {Object} subscriptionData - Subscription details
     * @returns {Promise<Object>} Send result
     */
    async sendSubscriptionCanceledNotification(userEmail, subscriptionData) {
        return await this.sendEmail({
            to: userEmail,
            subject: 'Subscription Canceled',
            templateName: 'subscription_canceled',
            templateData: {
                userName: subscriptionData.userName || 'User',
                planName: subscriptionData.planName || 'Pro',
                cancellationDate: subscriptionData.cancellationDate,
                accessUntilDate: subscriptionData.accessUntilDate,
                reactivateUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'https://app.roastr.ai/billing',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@roastr.ai'
            }
        });
    }

    /**
     * Send upgrade success notification
     * @param {string} userEmail - User email address
     * @param {Object} subscriptionData - Subscription details
     * @returns {Promise<Object>} Send result
     */
    async sendUpgradeSuccessNotification(userEmail, subscriptionData) {
        return await this.sendEmail({
            to: userEmail,
            subject: '🎉 Welcome to Your New Plan!',
            templateName: 'upgrade_success',
            templateData: {
                userName: subscriptionData.userName || 'User',
                oldPlanName: subscriptionData.oldPlanName || 'Free',
                newPlanName: subscriptionData.newPlanName || 'Pro',
                newFeatures: subscriptionData.newFeatures || [],
                activationDate: subscriptionData.activationDate,
                dashboardUrl: process.env.APP_URL || 'https://app.roastr.ai',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@roastr.ai'
            }
        });
    }

    /**
     * Send welcome email to new user
     * @param {string} userEmail - User email address
     * @param {Object} userData - User details
     * @returns {Promise<Object>} Send result
     */
    async sendWelcomeEmail(userEmail, userData) {
        return await this.sendEmail({
            to: userEmail,
            subject: '🎉 Welcome to Roastr.ai!',
            templateName: 'welcome',
            templateData: {
                userName: userData.userName || userData.name || 'there',
                dashboardUrl: process.env.APP_URL || 'https://app.roastr.ai',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@roastr.ai',
                language: userData.language || 'es'
            }
        });
    }

    /**
     * Send password reset email
     * @param {string} userEmail - User email address
     * @param {Object} resetData - Password reset details
     * @returns {Promise<Object>} Send result
     */
    async sendPasswordResetEmail(userEmail, resetData) {
        return await this.sendEmail({
            to: userEmail,
            subject: '🔐 Reset Your Password',
            templateName: 'password_reset',
            templateData: {
                userName: resetData.userName || 'User',
                resetLink: resetData.resetLink,
                expiryTime: resetData.expiryTime || '24 hours',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@roastr.ai'
            }
        });
    }

    /**
     * Send plan change notification
     * @param {string} userEmail - User email address
     * @param {Object} changeData - Plan change details
     * @returns {Promise<Object>} Send result
     */
    async sendPlanChangeNotification(userEmail, changeData) {
        const isUpgrade = changeData.newPlanName !== 'Free' && 
                         ['Pro', 'Creator+'].includes(changeData.newPlanName);
        
        return await this.sendEmail({
            to: userEmail,
            subject: isUpgrade ? '🚀 Plan Upgraded Successfully!' : '📋 Plan Changed',
            templateName: 'plan_change',
            templateData: {
                userName: changeData.userName || 'User',
                oldPlanName: changeData.oldPlanName || 'Free',
                newPlanName: changeData.newPlanName || 'Free',
                newFeatures: changeData.newFeatures || [],
                effectiveDate: changeData.effectiveDate || new Date().toLocaleDateString(),
                isUpgrade: isUpgrade,
                dashboardUrl: process.env.APP_URL || 'https://app.roastr.ai',
                billingUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'https://app.roastr.ai/billing',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@roastr.ai'
            }
        });
    }

    /**
     * Get service status
     * @returns {Object} Service configuration status
     */
    getStatus() {
        return {
            configured: this.isConfigured,
            provider: 'SendGrid',
            templatesLoaded: this.templates.size,
            featureFlag: flags.isEnabled('ENABLE_EMAIL_NOTIFICATIONS')
        };
    }
}

// Export singleton instance
module.exports = new EmailService();