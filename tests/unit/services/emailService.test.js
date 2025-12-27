// Mock Resend (ROA-370: Migrated from SendGrid)
import { vi } from 'vitest';

const mockResendSend = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockResendSend
    }
  }))
}));

// Mock file system for template loading
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn()
  }
}));

// Mock handlebars
vi.mock('handlebars', () => ({
  compile: vi.fn()
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }))
  }
}));

// Mock flags
vi.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: vi.fn().mockReturnValue(true)
  }
}));

import { Resend } from 'resend';
import fs from 'fs';
import handlebars from 'handlebars';
import { logger } from '../../../src/utils/logger';
import { flags } from '../../../src/config/flags';

describe('EmailService', () => {
  let emailService;

  beforeAll(() => {
    // Set up environment before requiring the module (ROA-370: Updated for Resend)
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.RESEND_FROM_EMAIL = 'test@roastr.ai';
    process.env.RESEND_FROM_NAME = 'Test Roastr';
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

    // Mock Resend success response (ROA-370: Updated from SendGrid)
    mockResendSend.mockResolvedValue({
      id: 'test-message-id',
      from: 'Test Roastr <test@roastr.ai>',
      to: ['user@test.com'],
      created_at: '2025-12-27T10:00:00Z'
    });
  });

  describe('Service Configuration', () => {
    it('should initialize with proper configuration', () => {
      expect(emailService.isConfigured).toBe(true);
      // Note: setApiKey is called during module initialization
    });

    it('should handle missing API key', () => {
      delete process.env.RESEND_API_KEY;
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
        provider: 'Resend', // ROA-370: Updated from SendGrid
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
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@test.com'], // ROA-370: Resend expects array
          subject: '🎉 Welcome to Roastr.ai!',
          from: 'Test Roastr <test@roastr.ai>' // ROA-370: Resend format
        })
      );
    });

    it('should handle missing user name', async () => {
      const result = await emailService.sendWelcomeEmail('user@test.com', {});

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalled();

      const callArgs = mockResendSend.mock.calls[0][0];
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
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@test.com'], // ROA-370: Resend expects array
          subject: '🔐 Reset Your Password'
        })
      );
    });

    it('should use default values for missing reset data', async () => {
      const result = await emailService.sendPasswordResetEmail('user@test.com', {
        resetLink: 'https://test.roastr.ai/reset?token=abc123'
      });

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalled();
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

      const result = await emailService.sendPaymentFailedNotification(
        'user@test.com',
        subscriptionData
      );

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@test.com'], // ROA-370: Resend expects array
          subject: '⚠️ Payment Failed - Action Required'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Resend send error with retry', async () => {
      const sendError = new Error('Resend API error');
      mockResendSend
        .mockRejectedValueOnce(sendError)
        .mockRejectedValueOnce(sendError)
        .mockResolvedValueOnce([
          {
            headers: { 'x-message-id': 'retry-success' }
          }
        ]);

      const result = await emailService.sendWelcomeEmail('user@test.com', {
        userName: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(3);
      expect(mockResendSend).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const sendError = new Error('Resend API error');
      mockResendSend.mockRejectedValue(sendError);

      const result = await emailService.sendWelcomeEmail('user@test.com', {
        userName: 'Test User'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Resend API error');
      expect(result.retriesAttempted).toBe(3);
      expect(mockResendSend).toHaveBeenCalledTimes(3);
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
      expect(mockResendSend).not.toHaveBeenCalled();

      // Restore configuration
      emailService.isConfigured = true;
    });
  });

  describe('Export File Deletion Notification (Issue #278)', () => {
    it('should send export file deletion notification successfully', async () => {
      const userEmail = 'user123@example.com';
      const filename = 'user-data-export-abc-1234567890.zip';
      const reason = 'security_cleanup';

      const result = await emailService.sendExportFileDeletionNotification(
        userEmail,
        filename,
        reason
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userEmail,
          subject: '🗑️ Data Export File Deleted',
          from: 'Test Roastr <test@roastr.ai>' // ROA-370: Resend format
        })
      );
    });

    it('should handle token expiration reason', async () => {
      const userEmail = 'user123@example.com';
      const filename = 'user-data-export-abc-1234567890.zip';
      const reason = 'token_expired';

      const result = await emailService.sendExportFileDeletionNotification(
        userEmail,
        filename,
        reason
      );

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalled();
    });

    it('should handle missing reason gracefully', async () => {
      const userEmail = 'user123@example.com';
      const filename = 'user-data-export-abc-1234567890.zip';

      const result = await emailService.sendExportFileDeletionNotification(userEmail, filename);

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalled();
    });
  });

  describe('Export File Cleanup Notification (Issue #278)', () => {
    it('should send export file cleanup notification successfully', async () => {
      const userEmail = 'user123@example.com';
      const filename = 'user-data-export-abc-1234567890.zip';
      const reason = 'expired_after_download';

      const result = await emailService.sendExportFileCleanupNotification(
        userEmail,
        filename,
        reason
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userEmail,
          subject: '🧹 Data Export Cleanup Complete',
          from: 'Test Roastr <test@roastr.ai>' // ROA-370: Resend format
        })
      );
    });

    it('should handle expired after creation reason', async () => {
      const userEmail = 'user123@example.com';
      const filename = 'user-data-export-abc-1234567890.zip';
      const reason = 'expired_after_creation';

      const result = await emailService.sendExportFileCleanupNotification(
        userEmail,
        filename,
        reason
      );

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalled();
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
      expect(mockResendSend).not.toHaveBeenCalled();

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
