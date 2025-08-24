/**
 * Tests for transparency mode API endpoints (Issue #187)
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies before importing
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: {
    from: jest.fn(),
  },
  createUserClient: jest.fn(),
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { 
    id: 'test-user-123', 
    email: 'test@example.com',
    transparency_mode: 'bio' 
  };
  next();
});

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken,
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  SafeUtils: {
    safeUserIdPrefix: jest.fn(id => id?.substring(0, 8) + '...'),
  },
}));

jest.mock('../../../src/services/auditService', () => ({
  logUserSettingChange: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../../../src/config/flags', () => ({
  flags: {
    isEnabled: jest.fn().mockReturnValue(false), // Mock mode by default
  },
}));

const userRoutes = require('../../../src/routes/user');

describe('Transparency Settings API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/user', userRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/user/settings/transparency-mode', () => {
    it('should return current transparency mode settings', async () => {
      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.transparency_mode).toBe('bio');
      expect(response.body.data.bio_text).toBe('Respuestas a comentarios inapropiados proporcionados por @Roastr.AI');
      expect(response.body.data.options).toHaveLength(3);
      
      const bioOption = response.body.data.options.find(opt => opt.value === 'bio');
      expect(bioOption.is_default).toBe(true);
      expect(bioOption.label).toBe('Aviso en Bio');
    });

    it('should handle authentication errors', async () => {
      // Mock authentication failure
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/user/settings/transparency-mode');

      expect(response.status).toBe(401);
      
      // Reset mock to default behavior
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { 
          id: 'test-user-123', 
          email: 'test@example.com',
          transparency_mode: 'bio' 
        };
        next();
      });
    });
  });

  describe('PATCH /api/user/settings/transparency-mode', () => {
    it('should update transparency mode to signature successfully', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'signature' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('signature');
      expect(response.body.data.bio_text).toBe(null); // Should be null for non-bio modes
    });

    it('should update transparency mode to creative successfully', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'creative' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('creative');
      expect(response.body.data.bio_text).toBe(null);
    });

    it('should update transparency mode to bio successfully', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'bio' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('bio');
      expect(response.body.data.bio_text).toBe('Respuestas a comentarios inapropiados proporcionados por @Roastr.AI');
    });

    it('should reject invalid transparency modes', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'invalid_mode' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid transparency mode');
    });

    it('should reject requests without mode parameter', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid transparency mode');
    });

    it('should handle empty mode parameter', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid transparency mode');
    });

    it('should handle null mode parameter', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: null });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid transparency mode');
    });

    it('should handle authentication errors', async () => {
      // Mock authentication failure
      mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .send({ mode: 'signature' });

      expect(response.status).toBe(401);
      
      // Reset mock to default behavior
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { 
          id: 'test-user-123', 
          email: 'test@example.com',
          transparency_mode: 'bio' 
        };
        next();
      });
    });
  });

  describe('Integration with real Supabase (when enabled)', () => {
    beforeEach(() => {
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(true); // Enable Supabase for these tests
    });

    afterEach(() => {
      const { flags } = require('../../../src/config/flags');
      flags.isEnabled.mockReturnValue(false); // Reset to mock mode
    });

    it('should handle Supabase errors gracefully when getting transparency mode', async () => {
      const { createUserClient } = require('../../../src/config/supabase');
      const mockUserClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
              })
            })
          })
        })
      };
      createUserClient.mockReturnValue(mockUserClient);

      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve transparency mode');
    });

    it('should handle Supabase errors gracefully when updating transparency mode', async () => {
      const { createUserClient } = require('../../../src/config/supabase');
      const mockUserClient = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' }
                })
              })
            })
          })
        })
      };
      createUserClient.mockReturnValue(mockUserClient);

      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'signature' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to update transparency mode');
    });

    it('should successfully update transparency mode with real Supabase', async () => {
      const { createUserClient } = require('../../../src/config/supabase');
      const mockUserClient = {
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { transparency_mode: 'signature' },
                  error: null
                })
              })
            })
          })
        })
      };
      createUserClient.mockReturnValue(mockUserClient);

      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'signature' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('signature');
    });
  });
});