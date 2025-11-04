const request = require('supertest');
const express = require('express');
const userRoutes = require('../../../src/routes/user');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const DataExportService = require('../../../src/services/dataExportService');
const emailService = require('../../../src/services/emailService');
const auditService = require('../../../src/services/auditService');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn()
  },
  supabaseAnonClient: {
    auth: {
      signInWithPassword: jest.fn()
    }
  }
}));

jest.mock('../../../src/services/dataExportService');
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/auditService');

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    req.accessToken = 'mock-token';
    next();
  }
}));

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

describe('Account Deletion API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/user', userRoutes);
    jest.clearAllMocks();
  });

  describe('DELETE /api/user/account', () => {
    it('should successfully request account deletion', async () => {
      const { supabaseAnonClient } = require('../../../src/config/supabase');
      const mockUserData = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      const mockDeletionRequest = {
        id: 'deletion-request-id',
        user_id: 'test-user-id',
        scheduled_deletion_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const mockExportResult = {
        success: true,
        downloadUrl: '/api/user/data-export/download/test-token',
        filename: 'export.zip',
        size: 1024,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
      };

      // Mock password validation (Issue #113)
      supabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'test-user-id' }, session: { access_token: 'token' } },
        error: null
      });

      // Mock Supabase calls
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn();
      const mockInsert = jest.fn().mockReturnThis();
      const mockUpdate = jest.fn().mockReturnThis();

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
        insert: mockInsert,
        update: mockUpdate
      });

      // First call: get user data
      // Second call: check existing deletion request (returns null)
      // Third call: insert new deletion request
      // Fourth call: update deletion request with export info
      mockSingle
        .mockResolvedValueOnce({ data: mockUserData, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      mockInsert.mockResolvedValue({ data: mockDeletionRequest, error: null });
      mockUpdate.mockResolvedValue({ data: mockDeletionRequest, error: null });

      // Mock DataExportService
      DataExportService.mockImplementation(() => ({
        exportUserData: jest.fn().mockResolvedValue(mockExportResult)
      }));

      // Mock services
      auditService.logAccountDeletionAttempt.mockResolvedValue({ success: true });
      auditService.logAccountDeletionRequest.mockResolvedValue({ success: true });
      auditService.logDataExport.mockResolvedValue({ success: true });
      emailService.sendAccountDeletionRequestedEmail.mockResolvedValue({ success: true });

      const response = await request(app)
        .delete('/api/user/account')
        .send({
          password: 'test-password',
          confirmation: 'DELETE'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account deletion requested successfully',
        data: {
          requestId: mockDeletionRequest.id,
          gracePeriodDays: 30,
          dataExportUrl: expect.stringContaining('/api/user/data-export/download/'),
          cancellationUrl: expect.stringContaining('/api/user/account/deletion/cancel')
        }
      });

      expect(auditService.logAccountDeletionRequest).toHaveBeenCalledWith(
        'test-user-id',
        mockDeletionRequest.id,
        expect.any(Object),
        expect.any(Object)
      );

      expect(emailService.sendAccountDeletionRequestedEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          userName: 'Test User',
          gracePeriodDays: 30
        })
      );
    });

    it('should reject deletion request without password', async () => {
      const response = await request(app)
        .delete('/api/user/account')
        .send({
          confirmation: 'DELETE'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Password confirmation required'
      });
    });

    it('should reject deletion request without proper confirmation', async () => {
      const response = await request(app)
        .delete('/api/user/account')
        .send({
          password: 'test-password',
          confirmation: 'DELETE_ME'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Please type "DELETE" to confirm account deletion'
      });
    });

    it('should return conflict if deletion already requested', async () => {
      const { supabaseAnonClient } = require('../../../src/config/supabase');
      const mockUserData = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      const mockExistingRequest = {
        id: 'existing-request-id',
        scheduled_deletion_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        grace_period_days: 30
      };

      // Mock password validation (Issue #113)
      supabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'test-user-id' }, session: { access_token: 'token' } },
        error: null
      });

      // Mock audit service
      auditService.logAccountDeletionAttempt.mockResolvedValue({ success: true });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn();

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      });

      mockSingle
        .mockResolvedValueOnce({ data: mockUserData, error: null })
        .mockResolvedValueOnce({ data: mockExistingRequest, error: null });

      const response = await request(app)
        .delete('/api/user/account')
        .send({
          password: 'test-password',
          confirmation: 'DELETE'
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Account deletion already requested',
        data: {
          requestId: 'existing-request-id'
        }
      });
    });

    // Issue #113: Password validation tests
    it('should reject deletion request with invalid password', async () => {
      const { supabaseAnonClient } = require('../../../src/config/supabase');
      const mockUserData = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn();

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      });

      // Mock user data retrieval
      mockSingle.mockResolvedValueOnce({ data: mockUserData, error: null });

      // Mock invalid password validation
      supabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      // Mock audit service
      auditService.logAccountDeletionAttempt.mockResolvedValue({ success: true });

      const response = await request(app)
        .delete('/api/user/account')
        .send({
          password: 'wrong-password',
          confirmation: 'DELETE'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid password. Please verify your password to delete your account.'
      });

      expect(supabaseAnonClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'wrong-password'
      });

      expect(auditService.logAccountDeletionAttempt).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          success: false,
          reason: 'invalid_password'
        }),
        expect.any(Object)
      );
    });

    it('should successfully validate password and proceed with deletion', async () => {
      const { supabaseAnonClient } = require('../../../src/config/supabase');
      const mockUserData = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      const mockDeletionRequest = {
        id: 'deletion-request-id',
        user_id: 'test-user-id',
        scheduled_deletion_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const mockExportResult = {
        success: true,
        downloadUrl: '/api/user/data-export/download/test-token',
        filename: 'export.zip',
        size: 1024,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn();
      const mockInsert = jest.fn().mockReturnThis();
      const mockUpdate = jest.fn().mockReturnThis();

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
        insert: mockInsert,
        update: mockUpdate
      });

      // Mock successful password validation
      supabaseAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'test-user-id' }, session: { access_token: 'token' } },
        error: null
      });

      // Mock database calls
      mockSingle
        .mockResolvedValueOnce({ data: mockUserData, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      mockInsert.mockResolvedValue({ data: mockDeletionRequest, error: null });
      mockUpdate.mockResolvedValue({ data: mockDeletionRequest, error: null });

      // Mock services
      DataExportService.mockImplementation(() => ({
        exportUserData: jest.fn().mockResolvedValue(mockExportResult)
      }));

      auditService.logAccountDeletionAttempt.mockResolvedValue({ success: true });
      auditService.logAccountDeletionRequest.mockResolvedValue({ success: true });
      auditService.logDataExport.mockResolvedValue({ success: true });
      emailService.sendAccountDeletionRequestedEmail.mockResolvedValue();

      const response = await request(app)
        .delete('/api/user/account')
        .send({
          password: 'correct-password',
          confirmation: 'DELETE'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account deletion requested successfully',
        data: expect.objectContaining({
          requestId: 'deletion-request-id',
          gracePeriodDays: 30
        })
      });

      expect(supabaseAnonClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'correct-password'
      });

      expect(auditService.logAccountDeletionAttempt).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          success: true,
          reason: 'password_validated'
        }),
        expect.any(Object)
      );
    });

    it('should handle password validation errors gracefully', async () => {
      const { supabaseAnonClient } = require('../../../src/config/supabase');
      const mockUserData = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn();

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      });

      mockSingle.mockResolvedValueOnce({ data: mockUserData, error: null });

      // Mock password validation throwing an error
      supabaseAnonClient.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));

      // Mock audit service
      auditService.logAccountDeletionAttempt.mockResolvedValue({ success: true });

      const response = await request(app)
        .delete('/api/user/account')
        .send({
          password: 'test-password',
          confirmation: 'DELETE'
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Password validation failed. Please try again.'
      });

      expect(auditService.logAccountDeletionAttempt).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          success: false,
          reason: 'validation_error',
          error: 'Network error'
        }),
        expect.any(Object)
      );
    });
  });

  describe('POST /api/user/account/deletion/cancel', () => {
    it('should successfully cancel account deletion', async () => {
      const mockDeletionRequest = {
        id: 'deletion-request-id',
        user_id: 'test-user-id',
        scheduled_deletion_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      };

      const mockUserData = {
        name: 'Test User',
        email: 'test@example.com'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn();
      const mockUpdate = jest.fn().mockReturnThis();

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
        update: mockUpdate
      });

      mockSingle
        .mockResolvedValueOnce({ data: mockDeletionRequest, error: null })
        .mockResolvedValueOnce({ data: mockUserData, error: null });

      mockUpdate.mockResolvedValue({ data: null, error: null });

      auditService.logAccountDeletionCancellation.mockResolvedValue({ success: true });
      emailService.sendAccountDeletionCancelledEmail.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/user/account/deletion/cancel')
        .send({
          reason: 'Changed my mind'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account deletion cancelled successfully',
        data: {
          requestId: 'deletion-request-id',
          reason: 'Changed my mind'
        }
      });

      expect(auditService.logAccountDeletionCancellation).toHaveBeenCalled();
      expect(emailService.sendAccountDeletionCancelledEmail).toHaveBeenCalled();
    });

    it('should return 404 if no pending deletion request exists', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      });

      const response = await request(app)
        .post('/api/user/account/deletion/cancel')
        .send({
          reason: 'Changed my mind'
        })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'No pending account deletion request found'
      });
    });

    it('should return 400 if grace period has expired', async () => {
      const mockDeletionRequest = {
        id: 'deletion-request-id',
        user_id: 'test-user-id',
        scheduled_deletion_at: new Date(Date.now() - 1000).toISOString(), // Already expired
        status: 'pending'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockDeletionRequest, error: null });

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle
      });

      const response = await request(app)
        .post('/api/user/account/deletion/cancel')
        .send({
          reason: 'Changed my mind'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Grace period has expired, deletion cannot be cancelled'
      });
    });
  });

  describe('GET /api/user/account/deletion/status', () => {
    it('should return deletion status when request exists', async () => {
      const mockDeletionRequest = {
        id: 'deletion-request-id',
        status: 'pending',
        requested_at: '2025-08-19T10:00:00Z',
        scheduled_deletion_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        grace_period_days: 30,
        data_export_url: 'http://localhost:3000/api/user/data-export/download/token',
        data_export_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        cancelled_at: null,
        completed_at: null
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockDeletionRequest, error: null });

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        limit: mockLimit,
        single: mockSingle
      });

      const response = await request(app)
        .get('/api/user/account/deletion/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          hasDeletionRequest: true,
          requestId: 'deletion-request-id',
          status: 'pending',
          canCancel: true,
          gracePeriodDays: 30
        }
      });
    });

    it('should return no deletion request when none exists', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });

      supabaseServiceClient.from = jest.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        limit: mockLimit,
        single: mockSingle
      });

      const response = await request(app)
        .get('/api/user/account/deletion/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          hasDeletionRequest: false,
          status: null
        }
      });
    });
  });

  describe('GET /api/user/data-export', () => {
    it('should generate and return data export', async () => {
      const mockExportResult = {
        success: true,
        downloadUrl: '/api/user/data-export/download/test-token',
        filename: 'export.zip',
        size: 1024,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
      };

      DataExportService.mockImplementation(() => ({
        exportUserData: jest.fn().mockResolvedValue(mockExportResult)
      }));

      auditService.logGdprAction.mockResolvedValue({ success: true });
      auditService.logDataExport.mockResolvedValue({ success: true });

      const response = await request(app)
        .get('/api/user/data-export')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Data export generated successfully',
        data: {
          downloadUrl: expect.stringContaining('/api/user/data-export/download/'),
          filename: 'export.zip',
          size: 1024
        }
      });

      expect(auditService.logGdprAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'personal_data_accessed',
          legalBasis: 'gdpr_article_15_right_of_access'
        }),
        expect.any(Object)
      );
    });
  });
});