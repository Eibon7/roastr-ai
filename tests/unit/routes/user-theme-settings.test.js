const request = require('supertest');
const express = require('express');
const userRoutes = require('../../../src/routes/user');
const { authenticateToken } = require('../../../src/middleware/auth');
const { createUserClient } = require('../../../src/config/supabase');
const auditService = require('../../../src/services/auditService');
<<<<<<< HEAD
const flags = require('../../../src/config/flags');
=======
const { flags } = require('../../../src/config/flags');
>>>>>>> origin/main

// Mock dependencies
jest.mock('../../../src/middleware/auth');
jest.mock('../../../src/config/supabase');
jest.mock('../../../src/services/auditService');
jest.mock('../../../src/config/flags');
<<<<<<< HEAD
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/SafeUtils');
=======
>>>>>>> origin/main

const app = express();
app.use(express.json());
app.use('/api/user', userRoutes);

describe('User Theme Settings API', () => {
  let mockUserClient;
  let mockUser;
<<<<<<< HEAD
  let selectSingleMock;
  let updateSingleMock;

  beforeEach(() => {
    jest.clearAllMocks();

=======

  beforeEach(() => {
    jest.clearAllMocks();
    
>>>>>>> origin/main
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com'
    };

<<<<<<< HEAD
    // Create stable mock functions
    selectSingleMock = jest.fn();
    updateSingleMock = jest.fn();

    // Create mock client with stable references
=======
>>>>>>> origin/main
    mockUserClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
<<<<<<< HEAD
            single: selectSingleMock
=======
            single: jest.fn()
>>>>>>> origin/main
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
<<<<<<< HEAD
              single: updateSingleMock
=======
              single: jest.fn()
>>>>>>> origin/main
            }))
          }))
        }))
      }))
    };

    authenticateToken.mockImplementation((req, res, next) => {
      req.user = mockUser;
<<<<<<< HEAD
      req.accessToken = 'test-token';
=======
      req.headers = { authorization: 'Bearer test-token' };
>>>>>>> origin/main
      next();
    });

    createUserClient.mockReturnValue(mockUserClient);
<<<<<<< HEAD
    auditService.logUserSettingChange = jest.fn().mockResolvedValue();
    flags.isEnabled = jest.fn((flag) => {
      if (flag === 'ENABLE_SUPABASE') return true;
      return false;
    });
=======
    auditService.logUserSettingChange = jest.fn();
    flags.isEnabled = jest.fn().mockReturnValue(true);
>>>>>>> origin/main
  });

  describe('GET /api/user/settings/theme', () => {
    it('should return user theme settings successfully', async () => {
      const mockPreferences = {
        theme: 'dark',
        other_setting: 'value'
      };

<<<<<<< HEAD
      selectSingleMock.mockResolvedValue({
=======
      mockUserClient.from().select().eq().single.mockResolvedValue({
>>>>>>> origin/main
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
<<<<<<< HEAD
      selectSingleMock.mockResolvedValue({
=======
      mockUserClient.from().select().eq().single.mockResolvedValue({
>>>>>>> origin/main
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
<<<<<<< HEAD
      selectSingleMock.mockRejectedValue(new Error('Database error'));
=======
      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });
>>>>>>> origin/main

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
<<<<<<< HEAD
      selectSingleMock.mockResolvedValue({
=======
      mockUserClient.from().select().eq().single.mockResolvedValue({
>>>>>>> origin/main
        data: { preferences: currentPreferences },
        error: null
      });

      // Mock update
<<<<<<< HEAD
      updateSingleMock.mockResolvedValue({
=======
      mockUserClient.from().update().eq().select().single.mockResolvedValue({
>>>>>>> origin/main
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
<<<<<<< HEAD
        message: 'Theme updated successfully',
=======
        message: 'Theme setting updated successfully',
>>>>>>> origin/main
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
<<<<<<< HEAD
      selectSingleMock.mockResolvedValue({
=======
      mockUserClient.from().select().eq().single.mockResolvedValue({
>>>>>>> origin/main
        data: { preferences: null },
        error: null
      });

      // Mock update
<<<<<<< HEAD
      updateSingleMock.mockResolvedValue({
=======
      mockUserClient.from().update().eq().select().single.mockResolvedValue({
>>>>>>> origin/main
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
<<<<<<< HEAD
        message: 'Theme updated successfully',
=======
        message: 'Theme setting updated successfully',
>>>>>>> origin/main
        data: {
          theme: 'dark'
        }
      });
    });

    it('should handle database errors during fetch', async () => {
<<<<<<< HEAD
      selectSingleMock.mockRejectedValue(new Error('Database error'));
=======
      mockUserClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });
>>>>>>> origin/main

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
<<<<<<< HEAD
      selectSingleMock.mockResolvedValue({
=======
      mockUserClient.from().select().eq().single.mockResolvedValue({
>>>>>>> origin/main
        data: { preferences: { theme: 'light' } },
        error: null
      });

      // Mock failed update
<<<<<<< HEAD
      updateSingleMock.mockRejectedValue(new Error('Update failed'));
=======
      mockUserClient.from().update().eq().select().single.mockResolvedValue({
        data: null,
        error: new Error('Update failed')
      });
>>>>>>> origin/main

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
        
<<<<<<< HEAD
        selectSingleMock.mockResolvedValue({
=======
        mockUserClient.from().select().eq().single.mockResolvedValue({
>>>>>>> origin/main
          data: { preferences: { theme: 'system' } },
          error: null
        });

<<<<<<< HEAD
        updateSingleMock.mockResolvedValue({
=======
        mockUserClient.from().update().eq().select().single.mockResolvedValue({
>>>>>>> origin/main
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
