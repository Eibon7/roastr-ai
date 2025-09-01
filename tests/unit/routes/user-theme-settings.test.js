const request = require('supertest');
const express = require('express');
const userRoutes = require('../../../src/routes/user');
const { authenticateToken } = require('../../../src/middleware/auth');
const { createUserClient } = require('../../../src/config/supabase');
const auditService = require('../../../src/services/auditService');
const flags = require('../../../src/config/flags');

// Mock dependencies
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/services/auditService');
jest.mock('../../../src/config/flags');

const app = express();
app.use(express.json());
app.use('/api/user', userRoutes);

describe('User Theme Settings API', () => {
  let mockUserClient;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com'
    };

    mockUserClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn()
            }))
          }))
        }))
      }))
    };

    authenticateToken.mockImplementation((req, res, next) => {
      req.user = mockUser;
      req.headers = { authorization: 'Bearer test-token' };
      next();
    });

    createUserClient.mockReturnValue(mockUserClient);
    auditService.logUserSettingChange = jest.fn();
    flags.isEnabled = jest.fn().mockReturnValue(true);
  });

  describe('GET /api/user/settings/theme', () => {
    it('should return user theme settings successfully', async () => {
      const mockPreferences = {
        theme: 'dark',
        other_setting: 'value'
      };

      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: { preferences: mockPreferences },
        error: null
      });

      const response = await request(app)
        .get('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          theme: 'dark',
          options: [
            { value: 'light', label: 'Claro', description: 'Tema claro siempre activo' },
            { value: 'dark', label: 'Oscuro', description: 'Tema oscuro siempre activo' },
            { value: 'system', label: 'Sistema', description: 'Sigue la configuración del sistema', isDefault: true }
          ]
        }
      });
    });

    it('should return default theme when no preferences exist', async () => {
      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: { preferences: null },
        error: null
      });

      const response = await request(app)
        .get('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data.theme).toBe('system');
    });

    it('should return mock response when Supabase is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .get('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.data.theme).toBe('system');
    });

    it('should handle database errors', async () => {
      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      const response = await request(app)
        .get('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to retrieve theme setting'
      });
    });
  });

  describe('PATCH /api/user/settings/theme', () => {
    it('should update theme setting successfully', async () => {
      const currentPreferences = { theme: 'light', other_setting: 'value' };
      const updatedPreferences = { theme: 'dark', other_setting: 'value' };

      // Mock current preferences fetch
      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: { preferences: currentPreferences },
        error: null
      });

      // Mock update
      mockUserClient.from().update().eq().select().single.mockResolvedValue({
        data: { preferences: updatedPreferences },
        error: null
      });

      const response = await request(app)
        .patch('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token')
        .send({ theme: 'dark' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Theme setting updated successfully',
        data: {
          theme: 'dark'
        }
      });

      expect(auditService.logUserSettingChange).toHaveBeenCalledWith(
        mockUser.id,
        'theme',
        {
          old_value: 'light',
          new_value: 'dark'
        },
        expect.any(Object)
      );
    });

    it('should validate theme values', async () => {
      const response = await request(app)
        .patch('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token')
        .send({ theme: 'invalid-theme' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid theme. Must be one of: light, dark, system'
      });
    });

    it('should require theme parameter', async () => {
      const response = await request(app)
        .patch('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid theme. Must be one of: light, dark, system'
      });
    });

    it('should handle missing current preferences', async () => {
      // Mock current preferences fetch (no preferences)
      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: { preferences: null },
        error: null
      });

      // Mock update
      mockUserClient.from().update().eq().select().single.mockResolvedValue({
        data: { preferences: { theme: 'dark' } },
        error: null
      });

      const response = await request(app)
        .patch('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token')
        .send({ theme: 'dark' });

      expect(response.status).toBe(200);
      expect(auditService.logUserSettingChange).toHaveBeenCalledWith(
        mockUser.id,
        'theme',
        {
          old_value: 'system',
          new_value: 'dark'
        },
        expect.any(Object)
      );
    });

    it('should return mock response when Supabase is disabled', async () => {
      flags.isEnabled.mockReturnValue(false);

      const response = await request(app)
        .patch('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token')
        .send({ theme: 'dark' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Theme setting updated successfully',
        data: {
          theme: 'dark'
        }
      });
    });

    it('should handle database errors during fetch', async () => {
      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      const response = await request(app)
        .patch('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token')
        .send({ theme: 'dark' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to update theme setting'
      });
    });

    it('should handle database errors during update', async () => {
      // Mock successful fetch
      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: { preferences: { theme: 'light' } },
        error: null
      });

      // Mock failed update
      mockUserClient.from().update().eq().select().single.mockResolvedValue({
        data: null,
        error: new Error('Update failed')
      });

      const response = await request(app)
        .patch('/api/user/settings/theme')
        .set('Authorization', 'Bearer test-token')
        .send({ theme: 'dark' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to update theme setting'
      });
    });

    it('should test all valid theme values', async () => {
      const validThemes = ['light', 'dark', 'system'];

      for (const theme of validThemes) {
        // Reset mocks
        jest.clearAllMocks();
        
        mockUserClient.from().select().eq().single.mockResolvedValue({
          data: { preferences: { theme: 'system' } },
          error: null
        });

        mockUserClient.from().update().eq().select().single.mockResolvedValue({
          data: { preferences: { theme } },
          error: null
        });

        const response = await request(app)
          .patch('/api/user/settings/theme')
          .set('Authorization', 'Bearer test-token')
          .send({ theme });

        expect(response.status).toBe(200);
        expect(response.body.data.theme).toBe(theme);
      }
    });
  });

  describe('Authentication', () => {
    it('should require authentication for GET theme settings', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/user/settings/theme');

      expect(response.status).toBe(401);
    });

    it('should require authentication for PATCH theme settings', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .patch('/api/user/settings/theme')
        .send({ theme: 'dark' });

      expect(response.status).toBe(401);
    });
  });
});
