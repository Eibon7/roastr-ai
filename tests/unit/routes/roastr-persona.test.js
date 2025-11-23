/**
 * Roastr Persona API Endpoints Tests
 * Issue #148: Test "Lo que me define" field functionality
 *
 * Tests the complete Roastr Persona feature including:
 * - Field encryption/decryption
 * - Privacy controls
 * - API endpoints (GET, POST, DELETE)
 * - Input validation
 * - Security measures
 */

const request = require('supertest');
const express = require('express');

// Setup same mocks as other tests
process.env.ENABLE_MOCK_MODE = 'true';
process.env.ROASTR_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock dependencies
const mockSupabaseServiceClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn(),
  rpc: jest.fn().mockResolvedValue({
    // Issue #618 - Add rpc method for update_roastr_persona_transactional
    data: {
      success: true,
      updated_fields: {
        lo_que_me_define_encrypted: null,
        lo_que_no_tolero_encrypted: null,
        lo_que_me_da_igual_encrypted: null
      }
    },
    error: null
  })
};

const mockCreateUserClient = jest.fn(() => mockSupabaseServiceClient);

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient,
  createUserClient: mockCreateUserClient
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { id: 'test-user-id' };
  req.accessToken = 'mock-token';
  next();
});

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
}));

// Issue #618 - Mock logger and SafeUtils together
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
  },
  SafeUtils: {
    safeUserIdPrefix: jest.fn((userId) => `${userId.substring(0, 8)}...`)
  }
}));

// Issue #618 - Mock feature flags to enable ENABLE_SUPABASE
jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn((flag) => flag === 'ENABLE_SUPABASE') // Enable SUPABASE flag
  }
}));

// Issue #618 - Mock PersonaInputSanitizer
jest.mock('../../../src/services/personaInputSanitizer', () => {
  return jest.fn().mockImplementation(() => ({
    sanitizePersonaInput: jest.fn((text) => text), // Pass through for tests
    getValidationErrorMessage: jest.fn(() => 'Invalid input')
  }));
});

// Issue #618 - Mock EmbeddingsService (not used in simple update tests)
jest.mock('../../../src/services/embeddingsService', () => {
  return jest.fn().mockImplementation(() => ({
    generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
  }));
});

// Issue #618 - Mock rate limiters (middleware pass-through)
jest.mock('../../../src/middleware/roastrPersonaRateLimiter', () => ({
  roastrPersonaReadLimiter: (req, res, next) => next(),
  roastrPersonaWriteLimiter: (req, res, next) => next(),
  roastrPersonaDeleteLimiter: (req, res, next) => next()
}));

const userRoutes = require('../../../src/routes/user');
const encryptionService = require('../../../src/services/encryptionService');

describe('Roastr Persona API Endpoints', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/user', userRoutes);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/user/roastr-persona', () => {
    it('should return empty persona when user has not defined it', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: null,
          lo_que_me_define_updated_at: null
        },
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        loQueMeDefine: null,
        isVisible: false,
        createdAt: null,
        updatedAt: null,
        hasContent: false
      });
    });

    it('should decrypt and return user persona when defined', async () => {
      const testPersona = 'mujer trans, vegana, gamer';
      const encryptedPersona = encryptionService.encrypt(testPersona);

      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: encryptedPersona,
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: '2024-01-01T10:00:00Z',
          lo_que_me_define_updated_at: '2024-01-01T10:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.loQueMeDefine).toBe(testPersona);
      expect(response.body.data.hasContent).toBe(true);
    });

    it('should handle decryption errors gracefully', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: 'invalid-encrypted-data',
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: '2024-01-01T10:00:00Z',
          lo_que_me_define_updated_at: '2024-01-01T10:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.loQueMeDefine).toBe(null);
    });

    it('should handle database errors', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/user/roastr-persona', () => {
    beforeEach(() => {
      // Mock successful database response
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: '2024-01-01T10:00:00Z',
          lo_que_me_define_updated_at: '2024-01-01T10:00:00Z'
        },
        error: null
      });
    });

    it('should create new persona successfully', async () => {
      const testPersona = 'mujer trans, vegana, gamer';

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: testPersona,
          isVisible: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');

      // Check that RPC was called with encrypted data (Issue #618 - CodeRabbit fix)
      expect(mockSupabaseServiceClient.rpc).toHaveBeenCalled();
      const rpcCall = mockSupabaseServiceClient.rpc.mock.calls[0];
      expect(rpcCall[0]).toBe('update_roastr_persona_transactional');
      const updateData = rpcCall[1].p_update_data;
      expect(updateData.lo_que_me_define_encrypted).toBeTruthy();
      expect(updateData.lo_que_me_define_visible).toBe(false);
    });

    it('should validate input length', async () => {
      const longPersona = 'a'.repeat(301); // Exceeds 300 character limit

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: longPersona,
          isVisible: false
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('300 caracteres');
    });

    it('should validate input type', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: 123, // Invalid type
          isVisible: false
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be a string');
    });

    it('should validate isVisible parameter', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: 'test persona',
          isVisible: 'not-boolean'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be a boolean');
    });

    it('should clear persona when empty string provided', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: '',
          isVisible: false
        });

      expect(response.status).toBe(200);

      // Issue #618 - Check rpc call instead of update (route uses .rpc() transactional update)
      const rpcCall = mockSupabaseServiceClient.rpc.mock.calls[0];
      expect(rpcCall).toBeDefined();
      const updateData = rpcCall[1].p_update_data;
      expect(updateData.lo_que_me_define_encrypted).toBe(null);
    });

    it('should clear persona when null provided', async () => {
      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: null,
          isVisible: false
        });

      expect(response.status).toBe(200);

      // Issue #618 - Check rpc call instead of update (route uses .rpc() transactional update)
      const rpcCall = mockSupabaseServiceClient.rpc.mock.calls[0];
      expect(rpcCall).toBeDefined();
      const updateData = rpcCall[1].p_update_data;
      expect(updateData.lo_que_me_define_encrypted).toBe(null);
    });

    it('should sanitize input', async () => {
      const dirtyInput = '  test persona with\x00null\x01bytes  ';

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: dirtyInput,
          isVisible: false
        });

      expect(response.status).toBe(200);

      // Verify the input was sanitized (no null bytes, trimmed)
      // Issue #618 - Check rpc call instead of update (route uses .rpc() transactional update)
      const rpcCall = mockSupabaseServiceClient.rpc.mock.calls[0];
      expect(rpcCall).toBeDefined();
      const updateData = rpcCall[1].p_update_data;
      expect(updateData.lo_que_me_define_encrypted).toBeTruthy();

      // Review #3366641810: Assert sanitizer invocation for stronger guarantees
      const PersonaInputSanitizer = require('../../../src/services/personaInputSanitizer');
      const sanitizerInstance = PersonaInputSanitizer.mock.results.at(-1)?.value;
      expect(sanitizerInstance.sanitizePersonaInput).toHaveBeenCalled();
    });

    it('should handle database errors during update', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: 'test persona',
          isVisible: false
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/user/roastr-persona', () => {
    it('should delete persona successfully', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_updated_at: '2024-01-01T12:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .delete('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('eliminada exitosamente');

      // Check that RPC was called to clear the fields (Issue #618 - CodeRabbit fix)
      expect(mockSupabaseServiceClient.rpc).toHaveBeenCalled();
      const rpcCall = mockSupabaseServiceClient.rpc.mock.calls[0];
      expect(rpcCall[0]).toBe('update_roastr_persona_transactional');
      const updateData = rpcCall[1].p_update_data;
      expect(updateData.lo_que_me_define_encrypted).toBe(null);
      expect(updateData.lo_que_me_define_visible).toBe(false);
    });

    it('should handle database errors during deletion', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' }
      });

      const response = await request(app)
        .delete('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // Review #3366641810: Override mock to actually enforce auth check
      const originalMock = mockAuthenticateToken.getMockImplementation();
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        if (!req.headers.authorization) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = { id: 'test-user-id' };
        req.accessToken = 'mock-token';
        next();
      });

      const app = express();
      app.use(express.json());
      app.use('/api/user', userRoutes);

      try {
        // Test without authorization header
        const getResponse = await request(app).get('/api/user/roastr-persona');
        expect(getResponse.status).toBe(401);

        const postResponse = await request(app)
          .post('/api/user/roastr-persona')
          .send({ loQueMeDefine: 'test' });
        expect(postResponse.status).toBe(401);

        const deleteResponse = await request(app).delete('/api/user/roastr-persona');
        expect(deleteResponse.status).toBe(401);
      } finally {
        // Review #3366641810: Restore original mock implementation
        if (originalMock) {
          mockAuthenticateToken.mockImplementation(originalMock);
        } else {
          mockAuthenticateToken.mockImplementation((req, res, next) => {
            req.user = { id: 'test-user-id' };
            req.accessToken = 'mock-token';
            next();
          });
        }
      }
    });
  });

  describe('Privacy and Security', () => {
    it('should always store encrypted data', async () => {
      const testPersona = 'sensitive identity information';

      await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: testPersona,
          isVisible: false
        });

      // Issue #618 - Check rpc call instead of update (route uses .rpc() transactional update)
      const rpcCall = mockSupabaseServiceClient.rpc.mock.calls[0];
      expect(rpcCall).toBeDefined();
      const updateData = rpcCall[1].p_update_data;
      const encryptedData = updateData.lo_que_me_define_encrypted;

      // Encrypted data should not contain the original text
      expect(encryptedData).not.toContain(testPersona);
      expect(encryptedData).toBeTruthy();

      // Should be able to decrypt it back
      const decrypted = encryptionService.decrypt(encryptedData);
      expect(decrypted).toBe(testPersona);
    });

    it('should default isVisible to false for privacy', async () => {
      await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: 'test persona'
          // isVisible not provided
        });

      // Issue #618 - Check rpc call instead of update (route uses .rpc() transactional update)
      const rpcCall = mockSupabaseServiceClient.rpc.mock.calls[0];
      expect(rpcCall).toBeDefined();
      const updateData = rpcCall[1].p_update_data;
      expect(updateData.lo_que_me_define_visible).toBe(false);
    });

    it('should log security events without exposing sensitive data', async () => {
      const testPersona = 'sensitive data';

      await request(app)
        .post('/api/user/roastr-persona')
        .set('Authorization', 'Bearer fake-token')
        .send({
          loQueMeDefine: testPersona,
          isVisible: false
        });

      // Check that logger was called but doesn't contain sensitive data
      const { logger } = require('../../../src/utils/logger');
      expect(logger.info).toHaveBeenCalled();

      // Verify no sensitive data in logs
      const logCalls = logger.info.mock.calls;
      logCalls.forEach((call) => {
        const logMessage = JSON.stringify(call);
        expect(logMessage).not.toContain(testPersona);
      });
    });
  });
});
