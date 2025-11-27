/**
 * Integration Tests: Admin Tones API
 *
 * Tests CRUD operations for roast tones via admin API endpoints.
 *
 * Issue #876: Dynamic Roast Tone Configuration System
 * Issue #1022: Refactored to use real database (not mocks)
 */

const request = require('supertest');
const { app } = require('../../../../src/index');
const { supabaseServiceClient } = require('../../../../src/config/supabase');

describe('Admin Tones API Integration Tests', () => {
  let adminToken;
  let userToken;
  let testTone1;
  let testTone2;

  beforeAll(() => {
    // Use bypass tokens that work with auth middleware in test mode
    adminToken = 'mock-admin-token-for-testing';
    userToken = 'mock-user-token-for-testing';
  });

  beforeEach(async () => {
    // Clean up test tones from previous runs
    // NOTE: Migration-seeded tones (flanders, balanceado, canalla) will remain in DB
    const { error: deleteError } = await supabaseServiceClient
      .from('roast_tones')
      .delete()
      .like('name', 'test-%');

    // NOTE: DELETE might fail due to "at least 1 active tone" trigger - that's OK
    // We'll use UPSERT instead of INSERT to handle existing tones

    // Create/update test tones in real database using UPSERT
    const { data: tone1, error: error1 } = await supabaseServiceClient
      .from('roast_tones')
      .upsert(
        {
          name: 'test-flanders',
          display_name: { es: 'Flanders Test', en: 'Light Test' },
          description: { es: 'Tono amable de prueba', en: 'Gentle test tone' },
          intensity: 2,
          personality: 'Educado',
          resources: ['Ironía sutil'],
          restrictions: ['NO insultos'],
          examples: [
            {
              es: { input: 'input es', output: 'output es' },
              en: { input: 'input en', output: 'output en' }
            }
          ],
          active: true,
          is_default: false,
          sort_order: 0
        },
        { onConflict: 'name' }
      )
      .select()
      .single();

    if (error1) {
      console.error('Error upserting testTone1:', error1);
      throw error1;
    }
    testTone1 = Array.isArray(tone1) ? tone1[0] : tone1;

    const { data: tone2, error: error2 } = await supabaseServiceClient
      .from('roast_tones')
      .upsert(
        {
          name: 'test-balanceado',
          display_name: { es: 'Balanceado Test', en: 'Balanced Test' },
          description: { es: 'Equilibrio de prueba', en: 'Balance test' },
          intensity: 3,
          personality: 'Ingenioso',
          resources: ['Juegos de palabras'],
          restrictions: ['NO vulgaridad'],
          examples: [
            {
              es: { input: 'input2 es', output: 'output2 es' },
              en: { input: 'input2 en', output: 'output2 en' }
            }
          ],
          active: true,
          is_default: false,
          sort_order: 1
        },
        { onConflict: 'name' }
      )
      .select()
      .single();

    if (error2) throw error2;
    testTone2 = Array.isArray(tone2) ? tone2[0] : tone2;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabaseServiceClient.from('roast_tones').delete().like('name', 'test-%');
  });

  describe('GET /api/admin/tones', () => {
    it('should return all tones for admin users', async () => {
      const response = await request(app)
        .get('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // Should include our test tones
      const toneNames = response.body.data.map((t) => t.name);
      expect(toneNames).toContain('test-flanders');
      expect(toneNames).toContain('test-balanceado');
    });

    it('should return 401 for non-admin users', async () => {
      await request(app)
        .get('/api/admin/tones')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);
    });

    it('should return 401 without authentication', async () => {
      await request(app).get('/api/admin/tones').expect(401);
    });
  });

  describe('GET /api/admin/tones/:id', () => {
    it('should return a specific tone by ID', async () => {
      const response = await request(app)
        .get(`/api/admin/tones/${testTone1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('test-flanders');
      expect(response.body.data.id).toBe(testTone1.id);
    });

    it('should return 404 if tone not found', async () => {
      const response = await request(app)
        .get('/api/admin/tones/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        'Tone with ID 00000000-0000-0000-0000-000000000000 not found'
      );
    });
  });

  describe('POST /api/admin/tones', () => {
    const newTone = {
      name: 'test-canalla',
      display_name: { es: 'Canalla Test', en: 'Savage Test' },
      description: { es: 'Directo de prueba', en: 'Direct test' },
      intensity: 4,
      personality: 'Picante',
      resources: ['Sarcasmo'],
      restrictions: ['NO tabúes'],
      examples: [
        {
          es: { input: 'input3 es', output: 'output3 es' },
          en: { input: 'input3 en', output: 'output3 en' }
        }
      ],
      active: true,
      is_default: false
    };

    it('should create a new tone with valid data', async () => {
      const response = await request(app)
        .post('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTone)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('test-canalla');
      expect(response.body.data.id).toBeDefined();

      // Verify it was actually created in database
      const { data: created } = await supabaseServiceClient
        .from('roast_tones')
        .select()
        .eq('name', 'test-canalla')
        .single();

      expect(created).toBeDefined();
      expect(created.intensity).toBe(4);
    });

    it('should reject tone creation with invalid name', async () => {
      const invalidTone = { ...newTone, name: 'INVALID NAME' };

      const response = await request(app)
        .post('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTone)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
      expect(response.body.error).toContain('name must contain only lowercase letters');
    });

    it('should reject tone creation with missing required fields', async () => {
      const incompleteTone = { name: 'test-incomplete' };

      const response = await request(app)
        .post('/api/admin/tones')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(incompleteTone)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
      expect(response.body.error).toContain('display_name is required');
    });

    it('should reject tone creation with intensity out of range', async () => {
      const invalidTone = { ...newTone, name: 'test-invalid-intensity', intensity: 6 };

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
      const response = await request(app)
        .put(`/api/admin/tones/${testTone1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ intensity: 3 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.intensity).toBe(3);

      // Verify update in database
      const { data: updated } = await supabaseServiceClient
        .from('roast_tones')
        .select()
        .eq('id', testTone1.id)
        .single();

      expect(updated.intensity).toBe(3);
    });

    it('should not allow deactivating the last active tone', async () => {
      // Deactivate ALL tones except testTone1
      await supabaseServiceClient
        .from('roast_tones')
        .update({ active: false })
        .neq('id', testTone1.id);

      const response = await request(app)
        .put(`/api/admin/tones/${testTone1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot deactivate the last active tone');
    });
  });

  describe('DELETE /api/admin/tones/:id', () => {
    it('should delete a tone', async () => {
      await request(app)
        .delete(`/api/admin/tones/${testTone2.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify deletion
      const { data: deleted } = await supabaseServiceClient
        .from('roast_tones')
        .select()
        .eq('id', testTone2.id)
        .single();

      expect(deleted).toBeNull();
    });

    it('should not allow deleting the last active tone', async () => {
      // Delete ALL tones except testTone1
      await supabaseServiceClient.from('roast_tones').delete().neq('id', testTone1.id);

      const response = await request(app)
        .delete(`/api/admin/tones/${testTone1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        'Cannot delete the last active tone. At least one tone must remain active.'
      );
    });
  });

  describe('POST /api/admin/tones/:id/activate', () => {
    it('should activate an inactive tone', async () => {
      // First deactivate testTone2
      await supabaseServiceClient
        .from('roast_tones')
        .update({ active: false })
        .eq('id', testTone2.id);

      const response = await request(app)
        .post(`/api/admin/tones/${testTone2.id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(true);

      // Verify in database
      const { data: activated } = await supabaseServiceClient
        .from('roast_tones')
        .select()
        .eq('id', testTone2.id)
        .single();

      expect(activated.active).toBe(true);
    });
  });

  describe('POST /api/admin/tones/:id/deactivate', () => {
    it('should deactivate an active tone when others exist', async () => {
      const response = await request(app)
        .post(`/api/admin/tones/${testTone2.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toBe(false);

      // Verify in database
      const { data: deactivated } = await supabaseServiceClient
        .from('roast_tones')
        .select()
        .eq('id', testTone2.id)
        .single();

      expect(deactivated.active).toBe(false);
    });

    it('should not allow deactivating the last active tone', async () => {
      // Deactivate ALL tones except testTone1
      await supabaseServiceClient
        .from('roast_tones')
        .update({ active: false })
        .neq('id', testTone1.id);

      const response = await request(app)
        .post(`/api/admin/tones/${testTone1.id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/tones/reorder', () => {
    it('should reorder tones', async () => {
      const orderArray = [
        { id: testTone2.id, sort_order: 0 },
        { id: testTone1.id, sort_order: 1 }
      ];

      const response = await request(app)
        .put('/api/admin/tones/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderArray })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify order in database
      const { data: tones } = await supabaseServiceClient
        .from('roast_tones')
        .select()
        .in('id', [testTone1.id, testTone2.id])
        .order('sort_order');

      expect(tones[0].id).toBe(testTone2.id);
      expect(tones[1].id).toBe(testTone1.id);
    });

    it('should reject invalid order array', async () => {
      const response = await request(app)
        .put('/api/admin/tones/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderArray: 'not-an-array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('orderArray must be an array');
    });

    it('should reject empty order array', async () => {
      const response = await request(app)
        .put('/api/admin/tones/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderArray: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('orderArray cannot be empty');
    });
  });
});
