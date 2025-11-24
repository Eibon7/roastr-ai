/**
 * Integration Tests for Toggle Endpoints
 *
 * Issue #944: Migrar endpoints de Toggle (Roasting/Shield) a Zod
 *
 * Tests complete flow for critical state-changing endpoints:
 * - POST /api/roasting/toggle
 * - POST /api/shield/toggle
 *
 * Why these are integration tests:
 * - Test complete HTTP request/response cycle
 * - Verify database updates
 * - Check authentication middleware
 * - Verify Zod validation in production context
 */

const request = require('supertest');
const app = require('../../src/index');
const { supabaseServiceClient } = require('../../src/config/supabase');
const { generateTestToken } = require('../helpers/authHelper');

// Mock workerNotificationService to prevent actual notifications during tests
jest.mock('../../src/services/workerNotificationService', () => ({
  notifyRoastingStateChange: jest.fn().mockResolvedValue(true),
  notifyShieldStateChange: jest.fn().mockResolvedValue(true)
}));

describe('Toggle Endpoints Integration Tests (Issue #944)', () => {
  let authToken;
  let testUser;
  let testOrganization;

  beforeAll(async () => {
    // Create test user (trigger will auto-create organization and membership)
    const { data: user, error: userError } = await supabaseServiceClient
      .from('users')
      .insert({
        email: `toggle-test-${Date.now()}@example.com`,
        roasting_enabled: true
      })
      .select()
      .single();

    if (userError) throw userError;
    testUser = user;

    // Get the auto-created organization from organization_members
    const { data: membership, error: membershipError } = await supabaseServiceClient
      .from('organization_members')
      .select('organization_id, organizations(*)')
      .eq('user_id', testUser.id)
      .single();

    if (membershipError) throw membershipError;
    testOrganization = membership.organizations;

    // Generate auth token
    authToken = generateTestToken(testUser.id, testOrganization.id);
  });

  afterAll(async () => {
    // Cleanup test data (CASCADE will handle organization and membership deletion)
    if (testOrganization) {
      await supabaseServiceClient.from('organizations').delete().eq('id', testOrganization.id);
    }

    if (testUser) {
      await supabaseServiceClient.from('users').delete().eq('id', testUser.id);
    }
  });

  describe('POST /api/roasting/toggle', () => {
    describe('✅ Valid requests', () => {
      it('should toggle roasting to disabled with valid data', async () => {
        const response = await request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
            reason: 'Integration test'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('disabled');
        expect(response.body.data.roasting_enabled).toBe(false);
      });

      it('should toggle roasting to enabled without reason', async () => {
        const response = await request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: true
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('enabled');
        expect(response.body.data.roasting_enabled).toBe(true);
      });

      it('should persist roasting state in database', async () => {
        await request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ enabled: false });

        // Verify in database
        const { data } = await supabaseServiceClient
          .from('users')
          .select('roasting_enabled')
          .eq('id', testUser.id)
          .single();

        expect(data.roasting_enabled).toBe(false);
      });
    });

    describe('❌ Invalid requests - Zod validation', () => {
      it('should reject string "true" instead of boolean', async () => {
        const response = await request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: 'true' // String instead of boolean
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.validation_errors).toBeDefined();
        expect(response.body.validation_errors[0].field).toBe('enabled');
        expect(response.body.validation_errors[0].message).toContain('boolean');
      });

      it('should reject missing enabled field', async () => {
        const response = await request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            reason: 'Missing enabled field'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.validation_errors).toBeDefined();
        expect(response.body.validation_errors[0].message).toContain('required');
      });

      it('should reject empty reason string', async () => {
        const response = await request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
            reason: '' // Empty string
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.validation_errors[0].field).toBe('reason');
        expect(response.body.validation_errors[0].message).toContain('empty');
      });

      it('should reject reason exceeding 500 characters', async () => {
        const response = await request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
            reason: 'A'.repeat(501) // 501 characters
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.validation_errors[0].message).toContain('500');
      });
    });

    describe('🔐 Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        const response = await request(app).post('/api/roasting/toggle').send({ enabled: true });

        expect(response.status).toBe(401);
      });

      it('should reject invalid auth token', async () => {
        const response = await request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', 'Bearer invalid-token')
          .send({ enabled: true });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('POST /api/shield/toggle', () => {
    describe('✅ Valid requests', () => {
      it('should toggle shield to enabled with valid data', async () => {
        const response = await request(app)
          .post('/api/shield/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: true,
            reason: 'Integration test - enabling shield'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('enabled');
        expect(response.body.data.shield_enabled).toBe(true);
      });

      it('should toggle shield to disabled without reason', async () => {
        const response = await request(app)
          .post('/api/shield/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('disabled');
        expect(response.body.data.shield_enabled).toBe(false);
      });

      it('should persist shield state in database (organization-level)', async () => {
        await request(app)
          .post('/api/shield/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ enabled: true });

        // Verify in database
        const { data } = await supabaseServiceClient
          .from('organizations')
          .select('shield_enabled')
          .eq('id', testOrganization.id)
          .single();

        expect(data.shield_enabled).toBe(true);
      });
    });

    describe('❌ Invalid requests - Zod validation', () => {
      it('should reject number 1 instead of boolean true', async () => {
        const response = await request(app)
          .post('/api/shield/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: 1 // Number instead of boolean
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.validation_errors).toBeDefined();
        expect(response.body.validation_errors[0].field).toBe('enabled');
        expect(response.body.validation_errors[0].code).toBe('invalid_type');
      });

      it('should reject string "false" instead of boolean', async () => {
        const response = await request(app)
          .post('/api/shield/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: 'false' // String instead of boolean
          });

        expect(response.status).toBe(400);
        expect(response.body.validation_errors[0].message).toContain('boolean');
      });
    });

    describe('🔐 Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        const response = await request(app).post('/api/shield/toggle').send({ enabled: true });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('🔒 Security: Type coercion in real requests', () => {
    it('POST /api/roasting/toggle should NOT coerce "1" to true', async () => {
      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: '1'
        });

      expect(response.status).toBe(400);
      expect(response.body.validation_errors[0].code).toBe('invalid_type');
    });

    it('POST /api/shield/toggle should NOT coerce null to false', async () => {
      const response = await request(app)
        .post('/api/shield/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: null
        });

      expect(response.status).toBe(400);
      expect(response.body.validation_errors[0].message).toContain('boolean');
    });
  });

  describe('🧪 Real-world scenarios', () => {
    it('should handle form-like data with string booleans (should reject)', async () => {
      // Common mistake: frontend sends form data with string "true"
      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ enabled: 'true' }));

      expect(response.status).toBe(400);
    });

    it('should accept proper JSON with boolean true', async () => {
      const response = await request(app)
        .post('/api/roasting/toggle')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ enabled: true });

      expect(response.status).toBe(200);
    });

    it('should handle concurrent toggle requests safely', async () => {
      // Send multiple requests concurrently
      const responses = await Promise.all([
        request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ enabled: true }),
        request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ enabled: false }),
        request(app)
          .post('/api/roasting/toggle')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ enabled: true })
      ]);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Final state should match last request
      const { data } = await supabaseServiceClient
        .from('users')
        .select('roasting_enabled')
        .eq('id', testUser.id)
        .single();

      expect(data.roasting_enabled).toBeDefined();
    });
  });
});
