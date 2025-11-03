const request = require('supertest');
const express = require('express');

// Mock all external dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn()
  },
  createUserClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis()
  }))
}));

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id' };
    req.accessToken = 'mock-token';
    next();
  })
}));

jest.mock('../../../src/services/encryptionService', () => ({
  encrypt: jest.fn((text) => `encrypted_${text}`),
  decrypt: jest.fn((encrypted) => encrypted.replace('encrypted_', '')),
  sanitizeForEncryption: jest.fn((text) => text.trim())
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

describe('Roastr Persona - Lo que me da igual (Issue #150)', () => {
  let app;
  let mockUserClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Setup user routes
    const userRoutes = require('../../../src/routes/user');
    app.use('/api/user', userRoutes);
    
    // Get the mocked user client
    const { createUserClient } = require('../../../src/config/supabase');
    mockUserClient = createUserClient();
  });

  describe('GET /api/user/roastr-persona', () => {
    it('should return tolerance field data when present', async () => {
      // Mock database response with tolerance data
      mockUserClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: 'encrypted_identity_data',
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: '2024-01-01T00:00:00Z',
          lo_que_me_define_updated_at: '2024-01-01T00:00:00Z',
          lo_que_no_tolero_encrypted: 'encrypted_intolerance_data',
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_created_at: '2024-01-01T00:00:00Z',
          lo_que_no_tolero_updated_at: '2024-01-01T00:00:00Z',
          lo_que_me_da_igual_encrypted: 'encrypted_tolerance_data',
          lo_que_me_da_igual_visible: false,
          lo_que_me_da_igual_created_at: '2024-01-01T00:00:00Z',
          lo_que_me_da_igual_updated_at: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        loQueMeDefine: 'identity_data',
        loQueNoTolero: 'intolerance_data',
        loQueMeDaIgual: 'tolerance_data',
        hasContent: true,
        hasIntoleranceContent: true,
        hasToleranceContent: true,
        isToleranceVisible: false,
        toleranceCreatedAt: '2024-01-01T00:00:00Z',
        toleranceUpdatedAt: '2024-01-01T00:00:00Z'
      });
    });

    it('should handle missing tolerance data gracefully', async () => {
      // Mock database response without tolerance data
      mockUserClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: null,
          lo_que_me_define_updated_at: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_created_at: null,
          lo_que_no_tolero_updated_at: null,
          lo_que_me_da_igual_encrypted: null,
          lo_que_me_da_igual_visible: false,
          lo_que_me_da_igual_created_at: null,
          lo_que_me_da_igual_updated_at: null
        },
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        loQueMeDefine: null,
        loQueNoTolero: null,
        loQueMeDaIgual: null,
        hasContent: false,
        hasIntoleranceContent: false,
        hasToleranceContent: false
      });
    });
  });

  describe('POST /api/user/roastr-persona', () => {
    beforeEach(() => {
      // Mock existing data query
      mockUserClient.select.mockReturnThis();
      mockUserClient.eq.mockReturnThis();
      mockUserClient.single.mockResolvedValue({
        data: {
          lo_que_me_define_encrypted: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_me_da_igual_encrypted: null
        },
        error: null
      });
    });

    it('should save tolerance field successfully', async () => {
      // Mock successful update
      mockUserClient.update.mockReturnThis();
      mockUserClient.single.mockResolvedValueOnce({
        data: {
          lo_que_me_define_encrypted: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_me_da_igual_encrypted: null
        },
        error: null
      }).mockResolvedValueOnce({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: null,
          lo_que_me_define_updated_at: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_created_at: null,
          lo_que_no_tolero_updated_at: null,
          lo_que_me_da_igual_encrypted: 'encrypted_bromas sobre calvos, insultos genéricos',
          lo_que_me_da_igual_visible: false,
          lo_que_me_da_igual_created_at: '2024-01-01T00:00:00Z',
          lo_que_me_da_igual_updated_at: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .send({
          loQueMeDaIgual: 'bromas sobre calvos, insultos genéricos',
          isToleranceVisible: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        loQueMeDaIgual: 'bromas sobre calvos, insultos genéricos',
        hasToleranceContent: true,
        isToleranceVisible: false,
        toleranceCreatedAt: '2024-01-01T00:00:00Z',
        toleranceUpdatedAt: '2024-01-01T00:00:00Z'
      });
    });

    it('should validate tolerance field length', async () => {
      const longText = 'a'.repeat(301); // Exceeds 300 character limit

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .send({
          loQueMeDaIgual: longText,
          isToleranceVisible: false
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cannot exceed 300 characters');
    });

    it('should clear tolerance field when null provided', async () => {
      // Mock successful update with null value
      mockUserClient.update.mockReturnThis();
      mockUserClient.single.mockResolvedValueOnce({
        data: {
          lo_que_me_define_encrypted: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_me_da_igual_encrypted: 'encrypted_existing_data'
        },
        error: null
      }).mockResolvedValueOnce({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: null,
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: null,
          lo_que_me_define_updated_at: null,
          lo_que_no_tolero_encrypted: null,
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_created_at: null,
          lo_que_no_tolero_updated_at: null,
          lo_que_me_da_igual_encrypted: null,
          lo_que_me_da_igual_visible: false,
          lo_que_me_da_igual_created_at: null,
          lo_que_me_da_igual_updated_at: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .post('/api/user/roastr-persona')
        .send({
          loQueMeDaIgual: null,
          isToleranceVisible: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        loQueMeDaIgual: null,
        hasToleranceContent: false
      });
    });
  });

  describe('DELETE /api/user/roastr-persona', () => {
    it('should delete tolerance field specifically', async () => {
      // Mock successful delete
      mockUserClient.update.mockReturnThis();
      mockUserClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_updated_at: null,
          lo_que_no_tolero_updated_at: null,
          lo_que_me_da_igual_updated_at: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .delete('/api/user/roastr-persona?field=tolerance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('(tolerance)');
      expect(response.body.data).toMatchObject({
        field: 'tolerance',
        toleranceDeletedAt: '2024-01-01T00:00:00Z',
        identityDeletedAt: null,
        intoleranceDeletedAt: null
      });
    });

    it('should delete all fields including tolerance when field=all', async () => {
      // Mock successful delete
      mockUserClient.update.mockReturnThis();
      mockUserClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_updated_at: '2024-01-01T00:00:00Z',
          lo_que_no_tolero_updated_at: '2024-01-01T00:00:00Z',
          lo_que_me_da_igual_updated_at: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .delete('/api/user/roastr-persona?field=all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('completely');
      expect(response.body.data).toMatchObject({
        field: 'all',
        toleranceDeletedAt: '2024-01-01T00:00:00Z',
        identityDeletedAt: '2024-01-01T00:00:00Z',
        intoleranceDeletedAt: '2024-01-01T00:00:00Z'
      });
    });

    it('should validate field parameter includes tolerance option', async () => {
      const response = await request(app)
        .delete('/api/user/roastr-persona?field=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Must be "identity", "intolerance", "tolerance", or "all"');
    });
  });

  describe('Integration with existing fields', () => {
    it('should handle all three roastr persona fields together', async () => {
      // Mock database response with all fields
      mockUserClient.single.mockResolvedValue({
        data: {
          id: 'test-user-id',
          lo_que_me_define_encrypted: 'encrypted_identity',
          lo_que_me_define_visible: false,
          lo_que_me_define_created_at: '2024-01-01T00:00:00Z',
          lo_que_me_define_updated_at: '2024-01-01T00:00:00Z',
          lo_que_no_tolero_encrypted: 'encrypted_intolerance',
          lo_que_no_tolero_visible: false,
          lo_que_no_tolero_created_at: '2024-01-01T00:00:00Z',
          lo_que_no_tolero_updated_at: '2024-01-01T00:00:00Z',
          lo_que_me_da_igual_encrypted: 'encrypted_tolerance',
          lo_que_me_da_igual_visible: false,
          lo_que_me_da_igual_created_at: '2024-01-01T00:00:00Z',
          lo_que_me_da_igual_updated_at: '2024-01-01T00:00:00Z'
        },
        error: null
      });

      const response = await request(app)
        .get('/api/user/roastr-persona')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        // Identity field
        loQueMeDefine: 'identity',
        hasContent: true,
        // Intolerance field
        loQueNoTolero: 'intolerance', 
        hasIntoleranceContent: true,
        // Tolerance field
        loQueMeDaIgual: 'tolerance',
        hasToleranceContent: true
      });
    });
  });
});