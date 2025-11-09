// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn()
}));

// Mock file system for template loading
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn()
    }
}));

// Mock handlebars
jest.mock('handlebars', () => ({
    compile: jest.fn()
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn().mockReturnValue(true)
    }
}));

const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const handlebars = require('handlebars');
const { logger } = require('../../../src/utils/logger');
const { flags } = require('../../../src/config/flags');

describe('EmailService', () => {
    let emailService;

    beforeAll(() => {
        // Set up environment before requiring the module
        process.env.SENDGRID_API_KEY = 'test-api-key';
        process.env.SENDGRID_FROM_EMAIL = 'test@roastr.ai';
        process.env.SENDGRID_FROM_NAME = 'Test Roastr';
        process.env.APP_URL = 'https://test.roastr.ai';
        process.env.SUPPORT_EMAIL = 'support@test.roastr.ai';
        
        // Require the service after setting environment
        emailService = require('../../../src/services/emailService');
    });
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock flags to enable email
        flags.isEnabled.mockReturnValue(true);
        
        // Mock handlebars template
        const mockTemplate = jest.fn().mockReturnValue('<h1>Test Email</h1>');
        handlebars.compile.mockReturnValue(mockTemplate);
        
        // Mock file read
        fs.promises.readFile.mockResolvedValue('<h1>{{userName}}</h1>');
        
        // Mock SendGrid success response
        sgMail.send.mockResolvedValue([{
            headers: {
                'x-message-id': 'test-message-id'
            }
        }]);
    });

    describe('Service Configuration', () => {
        it('should initialize with proper configuration', () => {
            expect(emailService.isConfigured).toBe(true);
            // Note: setApiKey is called during module initialization
        });

        it('should handle missing API key', () => {
            delete process.env.SENDGRID_API_KEY;
            flags.isEnabled.mockReturnValue(false);
            
            // Create new instance to test initialization
            jest.isolateModules(() => {
                const testService = require('../../../src/services/emailService');
                expect(testService.isConfigured).toBe(false);
            });
        });

        it('should return service status', () => {
            const status = emailService.getStatus();
            
            expect(status).toEqual({
                configured: true,
                provider: 'SendGrid',
                templatesLoaded: expect.any(Number),
                featureFlag: true
            });
        });
    });

    describe('Welcome Email', () => {
        it('should send welcome email successfully', async () => {
            const result = await emailService.sendWelcomeEmail('user@test.com', {
                userName: 'Test User',
                language: 'es'
            });

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-message-id');
            expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
                to: 'user@test.com',
                subject: '🎉 Welcome to Roastr.ai!',
                from: 'test@roastr.ai',
                fromName: 'Test Roastr'
            }));
        });

        it('should handle missing user name', async () => {
            const result = await emailService.sendWelcomeEmail('user@test.com', {});

            expect(result.success).toBe(true);
            expect(sgMail.send).toHaveBeenCalled();
            
            const callArgs = sgMail.send.mock.calls[0][0];
            expect(callArgs.to).toBe('user@test.com');
        });
    });

    describe('Password Reset Email', () => {
        it('should send password reset email successfully', async () => {
            const resetData = {
                userName: 'Test User',
                resetLink: 'https://test.roastr.ai/reset?token=abc123',
                expiryTime: '1 hour'
            };

            const result = await emailService.sendPasswordResetEmail('user@test.com', resetData);

            expect(result.success).toBe(true);
            expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
                to: 'user@test.com',
                subject: '🔐 Reset Your Password'
            }));
        });

        it('should use default values for missing reset data', async () => {
            const result = await emailService.sendPasswordResetEmail('user@test.com', {
                resetLink: 'https://test.roastr.ai/reset?token=abc123'
            });

            expect(result.success).toBe(true);
            expect(sgMail.send).toHaveBeenCalled();
        });
    });

    describe('Payment Failed Email', () => {
        it('should send payment failed notification successfully', async () => {
            const subscriptionData = {
                userName: 'Test User',
                planName: 'Pro',
                failedAmount: '$9.99',
                nextAttemptDate: '2024-01-01'
            };

            const result = await emailService.sendPaymentFailedNotification('user@test.com', subscriptionData);

            expect(result.success).toBe(true);
            expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
                to: 'user@test.com',
                subject: '⚠️ Payment Failed - Action Required'
            }));
        });
    });

    describe('Error Handling', () => {
        it('should handle SendGrid send error with retry', async () => {
            const sendError = new Error('SendGrid API error');
            sgMail.send
                .mockRejectedValueOnce(sendError)
                .mockRejectedValueOnce(sendError)
                .mockResolvedValueOnce([{
                    headers: { 'x-message-id': 'retry-success' }
                }]);

            const result = await emailService.sendWelcomeEmail('user@test.com', {
                userName: 'Test User'
            });

            expect(result.success).toBe(true);
            expect(result.attempt).toBe(3);
            expect(sgMail.send).toHaveBeenCalledTimes(3);
        });

        it('should fail after max retries', async () => {
            const sendError = new Error('SendGrid API error');
            sgMail.send.mockRejectedValue(sendError);

            const result = await emailService.sendWelcomeEmail('user@test.com', {
                userName: 'Test User'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('SendGrid API error');
            expect(result.retriesAttempted).toBe(3);
            expect(sgMail.send).toHaveBeenCalledTimes(3);
        });

        it('should handle template loading error', async () => {
            // Clear the template cache first
            emailService.templates.clear();
            fs.promises.readFile.mockRejectedValueOnce(new Error('Template not found'));

            const result = await emailService.sendWelcomeEmail('user@test.com', {
                userName: 'Test User'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Template not found');
        });

        it('should skip sending when service not configured', async () => {
            // Mock service as not configured
            emailService.isConfigured = false;

            const result = await emailService.sendWelcomeEmail('user@test.com', {
                userName: 'Test User'
            });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Email service not configured');
            expect(sgMail.send).not.toHaveBeenCalled();

            // Restore configuration
            emailService.isConfigured = true;
        });
    });

    describe('Export File Deletion Notification (Issue #278)', () => {
        it('should send export file deletion notification successfully', async () => {
            const userEmail = 'user123@example.com';
            const filename = 'user-data-export-abc-1234567890.zip';
            const reason = 'security_cleanup';

            const result = await emailService.sendExportFileDeletionNotification(userEmail, filename, reason);

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-message-id');
            expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
                to: userEmail,
                subject: '🗑️ Data Export File Deleted',
                from: 'test@roastr.ai'
            }));
        });

        it('should handle token expiration reason', async () => {
            const userEmail = 'user123@example.com';
            const filename = 'user-data-export-abc-1234567890.zip';
            const reason = 'token_expired';

            const result = await emailService.sendExportFileDeletionNotification(userEmail, filename, reason);

            expect(result.success).toBe(true);
            expect(sgMail.send).toHaveBeenCalled();
        });

        it('should handle missing reason gracefully', async () => {
            const userEmail = 'user123@example.com';
            const filename = 'user-data-export-abc-1234567890.zip';

            const result = await emailService.sendExportFileDeletionNotification(userEmail, filename);

            expect(result.success).toBe(true);
            expect(sgMail.send).toHaveBeenCalled();
        });
    });

    describe('Export File Cleanup Notification (Issue #278)', () => {
        it('should send export file cleanup notification successfully', async () => {
            const userEmail = 'user123@example.com';
            const filename = 'user-data-export-abc-1234567890.zip';
            const reason = 'expired_after_download';

            const result = await emailService.sendExportFileCleanupNotification(userEmail, filename, reason);

            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-message-id');
            expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
                to: userEmail,
                subject: '🧹 Data Export Cleanup Complete',
                from: 'test@roastr.ai'
            }));
        });

        it('should handle expired after creation reason', async () => {
            const userEmail = 'user123@example.com';
            const filename = 'user-data-export-abc-1234567890.zip';
            const reason = 'expired_after_creation';

            const result = await emailService.sendExportFileCleanupNotification(userEmail, filename, reason);

            expect(result.success).toBe(true);
            expect(sgMail.send).toHaveBeenCalled();
        });

        it('should handle service not configured', async () => {
            emailService.isConfigured = false;

            const result = await emailService.sendExportFileCleanupNotification(
                'user123@example.com',
                'test-file.zip',
                'expired'
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Email service not configured');
            expect(sgMail.send).not.toHaveBeenCalled();

            // Restore configuration
            emailService.isConfigured = true;
        });
    });

    describe('HTML to Plain Text Conversion', () => {
        it('should convert HTML to plain text', () => {
            const html = '<h1>Hello</h1><p>This is a <strong>test</strong></p>';
            const plainText = emailService.htmlToPlainText(html);

            expect(plainText).toBe('HelloThis is a test');
        });

        it('should handle empty HTML', () => {
            const plainText = emailService.htmlToPlainText('');
            expect(plainText).toBe('');
        });
    });
});