const request = require('supertest');
const express = require('express');

// Setup same mocks as other tests
process.env.ENABLE_MOCK_MODE = 'true';

const mockAuthenticateToken = jest.fn((req, res, next) => {
  req.user = { id: 'test-user-id', email: 'test@example.com' };
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
  SafeUtils: {
    safeUserIdPrefix: jest.fn((id) => id?.substring(0, 8) + '...' || 'unknown')
  }
}));

const userRoutes = require('../../../src/routes/user');
const app = express();
app.use(express.json());
app.use('/api/user', userRoutes);

describe('Style Settings Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/user/settings/style', () => {
    it('should return default style settings in mock mode', async () => {
      const response = await request(app)
        .get('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        style: 'sarcastic',
        settings: {
          intensity: 3,
          humor_type: 'witty',
          creativity: 3,
          politeness: 2
        }
      });
      expect(response.body.data.created_at).toBeNull();
      expect(response.body.data.updated_at).toBeNull();
    });

    it('should include authentication check', async () => {
      // Authentication is mocked in this test, so we just verify the mock is called
      await request(app).get('/api/user/settings/style').set('Authorization', 'Bearer test-token');

      expect(mockAuthenticateToken).toHaveBeenCalled();
    });
  });

  describe('POST /api/user/settings/style', () => {
    it('should update style successfully with valid data', async () => {
      const styleData = {
        style: 'witty',
        settings: {
          intensity: 4,
          humor_type: 'sarcastic',
          creativity: 5,
          politeness: 3
        }
      };

      const response = await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send(styleData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Style settings updated successfully');
      expect(response.body.data.style).toBe('witty');
      expect(response.body.data.settings).toMatchObject(styleData.settings);
      expect(response.body.data.updated_at).toBeDefined();
    });

    it('should accept style without settings', async () => {
      const styleData = {
        style: 'friendly'
      };

      const response = await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send(styleData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.style).toBe('friendly');
      expect(response.body.data.settings).toMatchObject({
        intensity: 3,
        humor_type: 'witty',
        creativity: 3,
        politeness: 2
      });
    });

    it('should reject invalid style values', async () => {
      const invalidData = {
        style: 'invalid_style'
      };

      const response = await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid style value');
    });

    it('should reject missing style', async () => {
      const invalidData = {
        settings: { intensity: 3 }
      };

      const response = await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Style is required');
    });

    it('should validate intensity range', async () => {
      const invalidData = {
        style: 'sarcastic',
        settings: {
          intensity: 10 // Invalid - should be 1-5
        }
      };

      const response = await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Intensity must be between 1 and 5');
    });

    it('should validate creativity range', async () => {
      const invalidData = {
        style: 'sarcastic',
        settings: {
          creativity: 0 // Invalid - should be 1-5
        }
      };

      const response = await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Creativity must be between 1 and 5');
    });

    it('should validate politeness range', async () => {
      const invalidData = {
        style: 'sarcastic',
        settings: {
          politeness: 6 // Invalid - should be 1-5
        }
      };

      const response = await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Politeness must be between 1 and 5');
    });

    it('should validate humor type', async () => {
      const invalidData = {
        style: 'sarcastic',
        settings: {
          humor_type: 'invalid_humor'
        }
      };

      const response = await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid humor type');
    });

    it('should accept all valid style options', async () => {
      const validStyles = ['sarcastic', 'witty', 'playful', 'direct', 'friendly', 'custom'];

      for (const style of validStyles) {
        const response = await request(app)
          .post('/api/user/settings/style')
          .set('Authorization', 'Bearer test-token')
          .send({ style });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.style).toBe(style);
      }
    });

    it('should accept all valid humor types', async () => {
      const validHumorTypes = ['witty', 'sarcastic', 'playful', 'dry', 'gentle', 'custom'];

      for (const humorType of validHumorTypes) {
        const response = await request(app)
          .post('/api/user/settings/style')
          .set('Authorization', 'Bearer test-token')
          .send({
            style: 'custom',
            settings: { humor_type: humorType }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.settings.humor_type).toBe(humorType);
      }
    });

    it('should include authentication check', async () => {
      // Authentication is mocked in this test, so we just verify the mock is called
      await request(app)
        .post('/api/user/settings/style')
        .set('Authorization', 'Bearer test-token')
        .send({ style: 'sarcastic' });

      expect(mockAuthenticateToken).toHaveBeenCalled();
    });
  });
});
