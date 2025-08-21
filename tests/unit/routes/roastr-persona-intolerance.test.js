const request = require('supertest');
const express = require('express');

describe('Roastr Persona - Lo que no tolero (Issue #149)', () => {
  let app;
  let mockSupabaseServiceClient;
  let mockAuthenticateToken;
  let mockEncryptionService;

  beforeEach(() => {
    // Mock Supabase service client
    mockSupabaseServiceClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn(),
      delete: jest.fn().mockReturnThis()
    };

    // Mock authentication middleware
    mockAuthenticateToken = jest.fn((req, res, next) => {
      req.user = { id: 'test-user-id' };
      req.accessToken = 'mock-access-token';
      next();
    });

    // Mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn((text) => `encrypted_${Buffer.from(text).toString('base64')}`),
      decrypt: jest.fn((encrypted) => {
        if (encrypted.startsWith('encrypted_')) {
          return Buffer.from(encrypted.replace('encrypted_', ''), 'base64').toString();
        }
        throw new Error('Invalid encrypted data');
      }),
      sanitizeForEncryption: jest.fn((text) => text.trim())
    };

    // Mock dependencies
    jest.mock('../../../src/config/supabase', () => ({
      supabaseServiceClient: mockSupabaseServiceClient,
      createUserClient: jest.fn(() => mockSupabaseServiceClient)
    }));

    jest.mock('../../../src/middleware/auth', () => ({
      authenticateToken: mockAuthenticateToken
    }));

    jest.mock('../../../src/services/encryptionService', () => mockEncryptionService);

    jest.mock('../../../src/utils/logger', () => ({
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
    }));

    // Create Express app with routes
    app = express();
    app.use(express.json());
    
    const userRoutes = require('../../../src/routes/user');
    app.use('/api/user', userRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('GET /api/user/roastr-persona', () => {
    it('should return both identity and intolerance data when available', async () => {
      const mockUserData = {
        id: 'test-user-id',
        lo_que_me_define_encrypted: 'encrypted_bXVqZXIgdHJhbnM=', // "mujer trans" encrypted
        lo_que_me_define_visible: false,
        lo_que_me_define_created_at: '2024-01-01T00:00:00Z',
        lo_que_me_define_updated_at: '2024-01-02T00:00:00Z',
        lo_que_no_tolero_encrypted: 'encrypted_aW5zdWx0b3MgcmFjaWFsZXM=', // "insultos raciales" encrypted
        lo_que_no_tolero_visible: false,
        lo_que_no_tolero_created_at: '2024-01-01T00:00:00Z',
        lo_que_no_tolero_updated_at: '2024-01-02T00:00:00Z'
      };

      mockSupabaseServiceClient.single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        loQueMeDefine: 'mujer trans',
        isVisible: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        hasContent: true,
        loQueNoTolero: 'insultos raciales',
        isIntoleranceVisible: false,
        intoleranceCreatedAt: '2024-01-01T00:00:00Z',
        intoleranceUpdatedAt: '2024-01-02T00:00:00Z',
        hasIntoleranceContent: true
      });
    });

    it('should handle missing intolerance data gracefully', async () => {
      const mockUserData = {
        id: 'test-user-id',
        lo_que_me_define_encrypted: 'encrypted_bXVqZXIgdHJhbnM=',
        lo_que_me_define_visible: false,
        lo_que_me_define_created_at: '2024-01-01T00:00:00Z',
        lo_que_me_define_updated_at: '2024-01-02T00:00:00Z',
        lo_que_no_tolero_encrypted: null,
        lo_que_no_tolero_visible: false,
        lo_que_no_tolero_created_at: null,
        lo_que_no_tolero_updated_at: null
      };

      mockSupabaseServiceClient.single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.data.loQueNoTolero).toBe(null);
      expect(response.body.data.hasIntoleranceContent).toBe(false);
    });

    it('should handle decryption errors gracefully', async () => {
      const mockUserData = {
        id: 'test-user-id',
        lo_que_me_define_encrypted: null,
        lo_que_me_define_visible: false,
        lo_que_me_define_created_at: null,
        lo_que_me_define_updated_at: null,
        lo_que_no_tolero_encrypted: 'invalid_encrypted_data',
        lo_que_no_tolero_visible: false,
        lo_que_no_tolero_created_at: '2024-01-01T00:00:00Z',
        lo_que_no_tolero_updated_at: '2024-01-02T00:00:00Z'
      };

      mockSupabaseServiceClient.single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      mockEncryptionService.decrypt.mockImplementation((encrypted) => {
        if (encrypted === 'invalid_encrypted_data') {
          throw new Error('Decryption failed');
        }
        return 'decrypted_text';
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.data.loQueNoTolero).toBe(null);
      expect(response.body.data.hasIntoleranceContent).toBe(true); // Field exists but couldn't decrypt
    });
  });

  describe('POST /api/user/roastr-persona', () => {
    beforeEach(() => {
      // Mock existing data check
      mockSupabaseServiceClient.single
        .mockResolvedValueOnce({
          data: { lo_que_me_define_encrypted: null, lo_que_no_tolero_encrypted: null },
          error: null
        })
        .mockResolvedValue({
          data: {
            id: 'test-user-id',
            lo_que_me_define_encrypted: null,
            lo_que_me_define_visible: false,
            lo_que_me_define_created_at: null,
            lo_que_me_define_updated_at: '2024-01-02T00:00:00Z',
            lo_que_no_tolero_encrypted: 'encrypted_aW5zdWx0b3MgcmFjaWFsZXM=',
            lo_que_no_tolero_visible: false,
            lo_que_no_tolero_created_at: '2024-01-02T00:00:00Z',
            lo_que_no_tolero_updated_at: '2024-01-02T00:00:00Z'
          },
          error: null
        });

      mockSupabaseServiceClient.update.mockResolvedValue({ error: null });
    });

    it('should save intolerance preferences successfully', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: 'insultos raciales, comentarios sobre peso',
          isIntoleranceVisible: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('actualizada');
      expect(response.body.data.loQueNoTolero).toBe('insultos raciales');
      expect(response.body.data.hasIntoleranceContent).toBe(true);

      // Verify encryption was called
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('insultos raciales, comentarios sobre peso');
    });

    it('should validate intolerance field length', async () => {
      const longText = 'a'.repeat(301);

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: longText,
          isIntoleranceVisible: false
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cannot exceed 300 characters');
    });

    it('should validate intolerance field type', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: 123, // Invalid type
          isIntoleranceVisible: false
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be a string');
    });

    it('should clear intolerance field when null is provided', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: null,
          isIntoleranceVisible: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify update was called with null for encrypted field
      expect(mockSupabaseServiceClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lo_que_no_tolero_encrypted: null
        })
      );
    });

    it('should save both identity and intolerance fields simultaneously', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueMeDefine: 'mujer trans, vegana',
          isVisible: false,
          loQueNoTolero: 'insultos raciales, comentarios sobre peso',
          isIntoleranceVisible: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify both fields were encrypted
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('mujer trans, vegana');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('insultos raciales, comentarios sobre peso');
    });

    it('should handle encryption errors gracefully', async () => {
      mockEncryptionService.encrypt.mockImplementation((text) => {
        if (text.includes('insultos')) {
          throw new Error('Encryption failed');
        }
        return `encrypted_${Buffer.from(text).toString('base64')}`;
      });

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: 'insultos raciales',
          isIntoleranceVisible: false
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to secure intolerance data');
    });

    it('should require at least one field for update', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No valid fields provided for update');
    });
  });

  describe('DELETE /api/user/roastr-persona', () => {
    beforeEach(() => {
      mockSupabaseServiceClient.update.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_updated_at: '2024-01-02T00:00:00Z',
          lo_que_no_tolero_updated_at: '2024-01-02T00:00:00Z'
        },
        error: null
      });
    });

    it('should delete only intolerance field when specified', async () => {
      const response = await request(app)
        .delete('/api/user/roastr-persona?field=intolerance')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('(intolerance)');
      expect(response.body.data.field).toBe('intolerance');

      // Verify only intolerance fields were updated
      expect(mockSupabaseServiceClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lo_que_no_tolero_encrypted: null,
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_updated_at: expect.any(String)
        })
      );

      // Verify identity fields were NOT updated
      expect(mockSupabaseServiceClient.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          lo_que_me_define_encrypted: null
        })
      );
    });

    it('should delete only identity field when specified', async () => {
      const response = await request(app)
        .delete('/api/user/roastr-persona?field=identity')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('(identity)');
      expect(response.body.data.field).toBe('identity');

      // Verify only identity fields were updated
      expect(mockSupabaseServiceClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_me_define_updated_at: expect.any(String)
        })
      );

      // Verify intolerance fields were NOT updated
      expect(mockSupabaseServiceClient.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          lo_que_no_tolero_encrypted: null
        })
      );
    });

    it('should delete all fields when field=all', async () => {
      const response = await request(app)
        .delete('/api/user/roastr-persona?field=all')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('completely');
      expect(response.body.data.field).toBe('all');

      // Verify both identity and intolerance fields were updated
      expect(mockSupabaseServiceClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_me_define_updated_at: expect.any(String),
          lo_que_no_tolero_encrypted: null,
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_updated_at: expect.any(String)
        })
      );
    });

    it('should default to deleting all fields when no field specified', async () => {
      const response = await request(app)
        .delete('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.data.field).toBe('all');
    });

    it('should validate field parameter', async () => {
      const response = await request(app)
        .delete('/api/user/roastr-persona?field=invalid')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid field parameter');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseServiceClient.update.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .delete('/api/user/roastr-persona?field=intolerance')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to delete Roastr Persona');
    });
  });

  describe('Security and Privacy', () => {
    it('should never expose encrypted data in responses', async () => {
      const mockUserData = {
        id: 'test-user-id',
        lo_que_me_define_encrypted: 'encrypted_data_should_not_be_exposed',
        lo_que_no_tolero_encrypted: 'encrypted_intolerance_should_not_be_exposed',
        lo_que_me_define_visible: false,
        lo_que_no_tolero_visible: false
      };

      mockSupabaseServiceClient.single.mockResolvedValue({
        data: mockUserData,
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token');

      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toContain('encrypted_data_should_not_be_exposed');
      expect(responseStr).not.toContain('encrypted_intolerance_should_not_be_exposed');
    });

    it('should require authentication for all endpoints', async () => {
      // Mock authentication to fail
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const getResponse = await request(app).get('/api/user/roastr-persona');
      expect(getResponse.status).toBe(401);

      const postResponse = await request(app)
        .post('/api/user/roastr-persona')
        .send({ loQueNoTolero: 'test' });
      expect(postResponse.status).toBe(401);

      const deleteResponse = await request(app).delete('/api/user/roastr-persona');
      expect(deleteResponse.status).toBe(401);
    });

    it('should sanitize input before encryption', async () => {
      mockSupabaseServiceClient.single
        .mockResolvedValueOnce({
          data: { lo_que_me_define_encrypted: null, lo_que_no_tolero_encrypted: null },
          error: null
        })
        .mockResolvedValue({
          data: {
            id: 'test-user-id',
            lo_que_no_tolero_encrypted: 'encrypted_data',
            lo_que_no_tolero_visible: false,
            lo_que_no_tolero_created_at: '2024-01-02T00:00:00Z',
            lo_que_no_tolero_updated_at: '2024-01-02T00:00:00Z'
          },
          error: null
        });

      mockSupabaseServiceClient.update.mockResolvedValue({ error: null });

      await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer mock-token')
        .send({
          loQueNoTolero: '  insultos raciales  ', // Input with extra spaces
          isIntoleranceVisible: false
        });

      // Verify sanitization was called
      expect(mockEncryptionService.sanitizeForEncryption).toHaveBeenCalledWith('  insultos raciales  ');
    });
  });
});