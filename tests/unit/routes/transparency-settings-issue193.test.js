/**
 * Test suite for Transparency Settings API (Issue #193)
 * PATCH /api/user/settings/transparency-mode and GET /api/user/settings/transparency-mode
 */

const request = require('supertest');
const express = require('express');

// Setup same mocks as other route tests
process.env.ENABLE_SUPABASE = 'true';

const mockSupabaseServiceClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  update: jest.fn().mockReturnThis()
};

const mockCreateUserClient = jest.fn(() => mockSupabaseServiceClient);

jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabaseServiceClient,
  createUserClient: mockCreateUserClient
}));

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { id: 'test-user-id', email: 'test@example.com', transparency_mode: 'bio' };
  next();
});

jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken
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
  },
  SafeUtils: { safeUserIdPrefix: jest.fn((id) => id.substring(0, 8) + '...') }
}));

const mockLogUserSettingChange = jest.fn();
jest.mock('../../../src/services/auditService', () => ({
  logUserSettingChange: mockLogUserSettingChange
}));

const mockFlags = {
  isEnabled: jest.fn()
};
jest.mock('../../../src/config/flags', () => ({
  flags: mockFlags
}));

jest.mock('../../../src/services/transparencyService', () => ({
  getBioText: jest.fn((lang) => {
    const texts = {
      es: 'Algunos mensajes de hate son respondidos automáticamente por @Roastr',
      en: 'Some hate messages are automatically responded to by @Roastr'
    };
    return texts[lang] || texts.es;
  })
}));

// Import the routes after mocking
const userRoutes = require('../../../src/routes/user');
const app = express();
app.use(express.json());
app.use('/api/user', userRoutes);

describe('Transparency Settings API (Issue #193)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup flags for Supabase enabled
    mockFlags.isEnabled.mockReturnValue(true);
    // Setup audit service to resolve successfully
    mockLogUserSettingChange.mockResolvedValue();
  });

  describe('PATCH /api/user/settings/transparency-mode', () => {
    it('should successfully update transparency mode to signature', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: 'signature' },
        error: null
      });

      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'signature' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('signature');
      expect(mockSupabaseServiceClient.update).toHaveBeenCalledWith({
        transparency_mode: 'signature'
      });
    });

    it('should successfully update transparency mode to creative', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: 'creative' },
        error: null
      });

      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'creative' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('creative');
    });

    it('should successfully update transparency mode to bio (default)', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: 'bio' },
        error: null
      });

      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'bio' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('bio');
    });

    it('should reject invalid transparency mode', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'invalid-mode' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        'Invalid transparency mode. Must be one of: bio, signature, creative'
      );
    });

    it('should reject missing mode parameter', async () => {
      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        'Invalid transparency mode. Must be one of: bio, signature, creative'
      );
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const response = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'signature' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to update transparency mode');
    });
  });

  describe('GET /api/user/settings/transparency-mode', () => {
    it('should return current transparency mode (bio)', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: 'bio' },
        error: null
      });

      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('bio');
      expect(response.body.data.bio_text).toBe(
        'Algunos mensajes de hate son respondidos automáticamente por @Roastr'
      );
    });

    it('should return current transparency mode (signature)', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: 'signature' },
        error: null
      });

      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('signature');
      expect(response.body.data.bio_text).toBeNull();
    });

    it('should return current transparency mode (creative)', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: 'creative' },
        error: null
      });

      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('creative');
      expect(response.body.data.bio_text).toBeNull();
    });

    it('should default to bio mode when no transparency_mode is set', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: null },
        error: null
      });

      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transparency_mode).toBe('bio');
      expect(response.body.data.bio_text).toBe(
        'Algunos mensajes de hate son respondidos automáticamente por @Roastr'
      );
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve transparency mode');
    });
  });

  describe('Issue #193 Acceptance Criteria Validation', () => {
    it('should validate that bio option is default', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: null }, // New user with no setting
        error: null
      });

      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(response.body.data.transparency_mode).toBe('bio');
      expect(response.body.data.bio_text).toBeTruthy();
    });

    it('should validate that bio text is provided for copy functionality', async () => {
      mockSupabaseServiceClient.single.mockResolvedValue({
        data: { transparency_mode: 'bio' },
        error: null
      });

      const response = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      // Bio text should be available for copy functionality
      expect(response.body.data.bio_text).toBe(
        'Algunos mensajes de hate son respondidos automáticamente por @Roastr'
      );
    });

    it('should validate that mode changes are reflected immediately', async () => {
      // First, set to creative mode
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: { transparency_mode: 'creative' },
        error: null
      });

      const updateResponse = await request(app)
        .patch('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token')
        .send({ mode: 'creative' });

      expect(updateResponse.body.data.transparency_mode).toBe('creative');

      // Then verify the change is reflected in GET
      mockSupabaseServiceClient.single.mockResolvedValueOnce({
        data: { transparency_mode: 'creative' },
        error: null
      });

      const getResponse = await request(app)
        .get('/api/user/settings/transparency-mode')
        .set('Authorization', 'Bearer fake-token');

      expect(getResponse.body.data.transparency_mode).toBe('creative');
      expect(getResponse.body.data.bio_text).toBeNull(); // Creative mode doesn't provide bio text
    });

    it('should handle all three transparency modes as specified in Issue #193', async () => {
      const modes = ['bio', 'signature', 'creative'];

      for (const mode of modes) {
        mockSupabaseServiceClient.single.mockResolvedValueOnce({
          data: { transparency_mode: mode },
          error: null
        });

        const response = await request(app)
          .patch('/api/user/settings/transparency-mode')
          .set('Authorization', 'Bearer fake-token')
          .send({ mode });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.transparency_mode).toBe(mode);
      }
    });
  });
});
