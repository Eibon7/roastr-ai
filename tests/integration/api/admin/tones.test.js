/**
 * Integration Tests: Admin Tones API
 * 
 * Tests CRUD operations for roast tones via admin API endpoints.
 * 
 * Issue #876: Dynamic Roast Tone Configuration System
 */

const request = require('supertest');
const { getToneConfigService } = require('../../../../src/services/toneConfigService');

// Mock dependencies
jest.mock('../../../../src/config/supabase', () => {
  const factory = require('../../../helpers/supabaseMockFactory');
  return {
    supabaseServiceClient: factory.createSupabaseMock({
      admin_tones: []
    })
  };
});
const { supabaseServiceClient } = require('../../../../src/config/supabase');
jest.mock('../../../../src/utils/logger');

describe('Admin Tones API Integration Tests', () => {
  let app;
  let adminToken;
  let userToken;
  let mockTones;

  beforeAll(() => {
    // Import app after mocks are set up
    ({ app } = require('../../../../src/index'));
    
    // Mock tokens (in real tests, these would be generated from test auth)
    adminToken = 'mock-admin-jwt-token';
    userToken = 'mock-user-jwt-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    supabaseServiceClient._reset();

    mockTones = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'flanders',
        display_name: { es: 'Flanders', en: 'Light' },
        description: { es: 'Tono amable', en: 'Gentle tone' },
        intensity: 2,
        personality: 'Educado',
        resources: ['Ironía sutil'],
        restrictions: ['NO insultos'],
        examples: [{ es: { input: 'input es', output: 'output es' }, en: { input: 'input en', output: 'output en' } }],
        active: true,
        is_default: true,
        sort_order: 0,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'balanceado',
        display_name: { es: 'Balanceado', en: 'Balanced' },
        description: { es: 'Equilibrio', en: 'Balance' },
        intensity: 3,
        personality: 'Ingenioso',
        resources: ['Juegos de palabras'],
        restrictions: ['NO vulgaridad'],
        examples: [{ es: { input: 'input2 es', output: 'output2 es' }, en: { input: 'input2 en', output: 'output2 en' } }],
        active: true,
        is_default: false,
        sort_order: 1,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    ];

    // Setup default mock behavior for roast_tones table
    supabaseServiceClient.from.mockImplementation((table) => {
      if (table === 'roast_tones' || table === 'admin_tones') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: mockTones, error: null }),
          single: jest.fn().mockResolvedValue({ data: mockTones[0], error: null }),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          delete: jest.fn().mockResolvedValue({ data: null, error: null }),
          upsert: jest.fn().mockResolvedValue({ data: mockTones, error: null })
        };
      }
      // Default for other tables
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };
    });

    // Mock authenticateToken middleware to bypass auth
    jest.spyOn(require('../../../../src/middleware/auth'), 'authenticateToken')
      .mockImplementation((req, res, next) => {
        req.user = { id: 'admin-user-id', is_admin: true };
        next();
      });

    // Mock requireAdmin middleware
    jest.spyOn(require('../../../../src/middleware/auth'), 'requireAdmin')
      .mockImplementation((req, res, next) => {
        if (req.user && req.user.is_admin) {
          next();
        } else {
          res.status(401).json({ success: false, error: 'Unauthorized' });
        }
      });
  });

  describe('GET /api/admin/tones', () => {
    it('should return all tones for admin users', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTones, error: null }),
      });

      const response = await request(app)
        .get('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('flanders');
    });

    it('should return 401 for non-admin users', async () => {
      await request(app)
        .get('/api/admin/tones')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/admin/tones')
        .expect(401);
    });

    it('should handle database errors gracefully', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('DB connection failed') }),
      });

      const response = await request(app)
        .get('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve tones');
    });
  });

  describe('GET /api/admin/tones/:id', () => {
    it('should return a specific tone by ID', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTones[0], error: null }),
      });

      const response = await request(app)
        .get(`/api/admin/tones/${mockTones[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('flanders');
    });

    it('should return 404 if tone not found', async () => {
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      });

      const response = await request(app)
        .get('/api/admin/tones/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Tone not found');
    });
  });

  describe('POST /api/admin/tones', () => {
    const newTone = {
      name: 'canalla',
      display_name: { es: 'Canalla', en: 'Savage' },
      description: { es: 'Directo', en: 'Direct' },
      intensity: 4,
      personality: 'Picante',
      resources: ['Sarcasmo'],
      restrictions: ['NO tabúes'],
      examples: [{ es: { input: 'input3 es', output: 'output3 es' }, en: { input: 'input3 en', output: 'output3 en' } }],
      active: true,
      is_default: false,
    };

    it('should create a new tone with valid data', async () => {
      supabaseServiceClient.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { ...newTone, id: 'new-id' }, error: null }),
      });

      const response = await request(app)
        .post('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTone)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('canalla');
      
      // Should invalidate cache
      const toneService = getToneConfigService();
      expect(toneService.cache).toBeNull();
    });

    it('should reject tone creation with invalid name', async () => {
      const invalidTone = { ...newTone, name: 'INVALID NAME' };

      const response = await request(app)
        .post('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTone)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject tone creation with missing required fields', async () => {
      const incompleteTone = { name: 'incomplete' };

      const response = await request(app)
        .post('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteTone)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should reject tone creation with intensity out of range', async () => {
      const invalidTone = { ...newTone, intensity: 6 };

      const response = await request(app)
        .post('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTone)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/tones/:id', () => {
    it('should update an existing tone', async () => {
      const updatedData = { ...mockTones[0], intensity: 3 };

      supabaseServiceClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: updatedData, error: null }),
      });

      const response = await request(app)
        .put(`/api/admin/tones/${mockTones[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ intensity: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intensity).toBe(3);
    });

    it('should not allow deactivating the last active tone', async () => {
      // Mock: Only one active tone exists
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [mockTones[0]], error: null }),
      });

      const response = await request(app)
        .put(`/api/admin/tones/${mockTones[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot deactivate the last active tone');
    });
  });

  describe('DELETE /api/admin/tones/:id', () => {
    it('should delete a tone', async () => {
      // Mock: Multiple active tones exist
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockTones, error: null }),
      }).mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      await request(app)
        .delete(`/api/admin/tones/${mockTones[1].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should not allow deleting the last active tone', async () => {
      // Mock: Only one active tone exists
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [mockTones[0]], error: null }),
      });

      const response = await request(app)
        .delete(`/api/admin/tones/${mockTones[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot delete the last active tone');
    });
  });

  describe('POST /api/admin/tones/:id/activate', () => {
    it('should activate an inactive tone', async () => {
      const inactiveTone = { ...mockTones[1], active: false };

      supabaseServiceClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { ...inactiveTone, active: true }, error: null }),
      });

      const response = await request(app)
        .post(`/api/admin/tones/${inactiveTone.id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(true);
    });
  });

  describe('POST /api/admin/tones/:id/deactivate', () => {
    it('should deactivate an active tone when others exist', async () => {
      // Mock: Multiple active tones exist
      supabaseServiceClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockTones, error: null }),
      }).mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { ...mockTones[1], active: false }, error: null }),
      });

      const response = await request(app)
        .post(`/api/admin/tones/${mockTones[1].id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(false);
    });

    it('should not allow deactivating the last active tone', async () => {
      // Mock: Only one active tone exists
      supabaseServiceClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [mockTones[0]], error: null }),
      });

      const response = await request(app)
        .post(`/api/admin/tones/${mockTones[0].id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/tones/reorder', () => {
    it('should reorder tones', async () => {
      const newOrder = [mockTones[1].id, mockTones[0].id];

      supabaseServiceClient.from.mockReturnValue({
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: mockTones, error: null }),
      });

      const response = await request(app)
        .put('/api/admin/tones/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order: newOrder })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid order array', async () => {
      const response = await request(app)
        .put('/api/admin/tones/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order: 'not-an-array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid order array provided');
    });

    it('should reject empty order array', async () => {
      const response = await request(app)
        .put('/api/admin/tones/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ order: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

