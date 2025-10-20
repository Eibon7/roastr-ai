/**
 * Integration Tests: Persona API Endpoints
 *
 * Tests full HTTP request/response cycle for persona endpoints
 *
 * Endpoints tested:
 * - GET /api/persona
 * - POST /api/persona
 * - DELETE /api/persona
 * - GET /api/persona/health
 *
 * @see src/routes/persona.js
 * @see docs/plan/issue-595.md (Phase 5 integration tests)
 */

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const personaRoutes = require('../../src/routes/persona');
const PersonaService = require('../../src/services/PersonaService');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Mock PersonaService
jest.mock('../../src/services/PersonaService');
jest.mock('../../src/utils/logger');

// Mock auth middleware to parse JWT locally
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Parse JWT locally for testing (require inside mock to avoid scope issues)
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, 'test-secret-key');
      req.user = { id: decoded.id, plan: decoded.plan };
      req.accessToken = token;

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  }
}));

// JWT secret for test tokens
const JWT_SECRET = 'test-secret-key';
process.env.JWT_SECRET = JWT_SECRET;

// Create test app
const app = express();
app.use(bodyParser.json());
app.use(personaRoutes);

/**
 * Generate test JWT token
 */
function generateToken(userId, plan = 'pro') {
  return jwt.sign(
    { id: userId, plan },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Persona API Integration Tests', () => {
  beforeAll(() => {
    // Set encryption key
    if (!process.env.PERSONA_ENCRYPTION_KEY) {
      process.env.PERSONA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/persona', () => {
    it('should return 200 with persona data', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      const mockPersona = {
        lo_que_me_define: 'Soy developer sarcástico',
        lo_que_no_tolero: 'Body shaming',
        lo_que_me_da_igual: 'Humor negro',
        metadata: {
          plan: 'pro',
          embeddings_generated_at: '2025-10-19T12:00:00Z'
        }
      };

      PersonaService.getPersona.mockResolvedValue(mockPersona);

      const response = await request(app)
        .get('/api/persona')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lo_que_me_define).toBe('Soy developer sarcástico');
      expect(PersonaService.getPersona).toHaveBeenCalledWith(userId);
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app).get('/api/persona');

      expect(response.status).toBe(401);
    });

    it('should return 404 if user not found', async () => {
      const userId = 'nonexistent';
      const token = generateToken(userId);

      PersonaService.getPersona.mockRejectedValue(new Error('User user-123 not found'));

      const response = await request(app)
        .get('/api/persona')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('USER_NOT_FOUND');
    });

    it('should return 500 on internal error', async () => {
      const userId = 'user-123';
      const token = generateToken(userId);

      PersonaService.getPersona.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/persona')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/persona', () => {
    it('should return 200 and update persona (Pro user)', async () => {
      const userId = 'pro-user';
      const token = generateToken(userId, 'pro');

      const requestBody = {
        lo_que_me_define: 'Soy developer',
        lo_que_no_tolero: 'Body shaming',
        lo_que_me_da_igual: 'Humor negro'
      };

      PersonaService.updatePersona.mockResolvedValue({
        success: true,
        fieldsUpdated: ['lo_que_me_define', 'lo_que_no_tolero', 'lo_que_me_da_igual']
      });

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.fieldsUpdated).toHaveLength(3);

      expect(PersonaService.updatePersona).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          lo_que_me_define: 'Soy developer',
          lo_que_no_tolero: 'Body shaming',
          lo_que_me_da_igual: 'Humor negro'
        }),
        'pro'
      );
    });

    it('should return 403 for plan restriction (Free user)', async () => {
      const userId = 'free-user';
      const token = generateToken(userId, 'free');

      PersonaService.updatePersona.mockRejectedValue(
        new Error('PLAN_RESTRICTION: "lo_que_me_define" requires Starter plan or higher. Current plan: free')
      );

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send({ lo_que_me_define: 'Test' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PLAN_RESTRICTION');
      expect(response.body.upgrade_url).toBe('/pricing');
    });

    it('should return 403 for Starter user trying to set tolerance field', async () => {
      const userId = 'starter-user';
      const token = generateToken(userId, 'starter');

      PersonaService.updatePersona.mockRejectedValue(
        new Error('PLAN_RESTRICTION: "lo_que_me_da_igual" requires Pro plan or higher')
      );

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send({ lo_que_me_da_igual: 'Test' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('PLAN_RESTRICTION');
    });

    it('should return 400 for validation errors', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      const invalidBody = {
        lo_que_me_define: 'A'.repeat(301) // Exceeds 300 char limit
      };

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toBeTruthy();
    });

    it('should return 400 for character limit exceeded', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      PersonaService.updatePersona.mockRejectedValue(
        new Error('CHARACTER_LIMIT_EXCEEDED: "lo_que_me_define" exceeds 300 character limit')
      );

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send({ lo_que_me_define: 'A'.repeat(250) }); // Passes validator but fails service

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('CHARACTER_LIMIT_EXCEEDED');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/persona')
        .send({ lo_que_me_define: 'Test' });

      expect(response.status).toBe(401);
    });

    it('should sanitize HTML/script tags', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      PersonaService.updatePersona.mockResolvedValue({ success: true, fieldsUpdated: [] });

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send({ lo_que_me_define: '<script>alert("XSS")</script>' });

      expect(response.status).toBe(200);

      // Verify that express-validator escaped the script tag
      const updateCall = PersonaService.updatePersona.mock.calls[0][1];
      expect(updateCall.lo_que_me_define).not.toContain('<script>');
    });

    it('should handle partial updates', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      PersonaService.updatePersona.mockResolvedValue({
        success: true,
        fieldsUpdated: ['lo_que_no_tolero']
      });

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send({ lo_que_no_tolero: 'Only this field' });

      expect(response.status).toBe(200);
      expect(response.body.data.fieldsUpdated).toEqual(['lo_que_no_tolero']);
    });

    it('should handle empty request body', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      PersonaService.updatePersona.mockResolvedValue({
        success: true,
        fieldsUpdated: []
      });

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/persona', () => {
    it('should return 204 on successful deletion', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      PersonaService.deletePersona.mockResolvedValue();

      const response = await request(app)
        .delete('/api/persona')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(PersonaService.deletePersona).toHaveBeenCalledWith(userId);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).delete('/api/persona');

      expect(response.status).toBe(401);
    });

    it('should return 500 on deletion error', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      PersonaService.deletePersona.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/persona')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/persona/health', () => {
    it('should return 200 when service is healthy', async () => {
      PersonaService.healthCheck.mockResolvedValue({
        status: 'healthy',
        encryption: 'working',
        embeddings: 'healthy',
        database: 'connected'
      });

      const response = await request(app).get('/api/persona/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.encryption).toBe('working');
    });

    it('should return 503 when service is unhealthy', async () => {
      PersonaService.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        error: 'Database connection failed'
      });

      const response = await request(app).get('/api/persona/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBeTruthy();
    });

    it('should not require authentication', async () => {
      PersonaService.healthCheck.mockResolvedValue({ status: 'healthy' });

      const response = await request(app).get('/api/persona/health');

      expect(response.status).toBe(200);
    });

    it('should return 503 on healthCheck error', async () => {
      PersonaService.healthCheck.mockRejectedValue(new Error('Health check failed'));

      const response = await request(app).get('/api/persona/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('E2E Workflow Tests', () => {
    it('should complete full create-read-delete cycle', async () => {
      const userId = 'user-e2e';
      const token = generateToken(userId, 'pro');

      // 1. Create persona
      PersonaService.updatePersona.mockResolvedValue({
        success: true,
        fieldsUpdated: ['lo_que_me_define']
      });

      const createResponse = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send({ lo_que_me_define: 'Soy developer' });

      expect(createResponse.status).toBe(200);

      // 2. Read persona
      PersonaService.getPersona.mockResolvedValue({
        lo_que_me_define: 'Soy developer',
        lo_que_no_tolero: null,
        lo_que_me_da_igual: null,
        metadata: { plan: 'pro' }
      });

      const readResponse = await request(app)
        .get('/api/persona')
        .set('Authorization', `Bearer ${token}`);

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.data.lo_que_me_define).toBe('Soy developer');

      // 3. Delete persona
      PersonaService.deletePersona.mockResolvedValue();

      const deleteResponse = await request(app)
        .delete('/api/persona')
        .set('Authorization', `Bearer ${token}`);

      expect(deleteResponse.status).toBe(204);
    });

    it('should handle plan upgrade workflow', async () => {
      const userId = 'user-upgrade';

      // 1. Starter user creates 2 fields
      const starterToken = generateToken(userId, 'starter');

      PersonaService.updatePersona.mockResolvedValue({
        success: true,
        fieldsUpdated: ['lo_que_me_define', 'lo_que_no_tolero']
      });

      const starterResponse = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${starterToken}`)
        .send({
          lo_que_me_define: 'Identity',
          lo_que_no_tolero: 'Intolerance'
        });

      expect(starterResponse.status).toBe(200);

      // 2. User upgrades to Pro
      const proToken = generateToken(userId, 'pro');

      // 3. Pro user adds 3rd field
      PersonaService.updatePersona.mockResolvedValue({
        success: true,
        fieldsUpdated: ['lo_que_me_da_igual']
      });

      const proResponse = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${proToken}`)
        .send({ lo_que_me_da_igual: 'Tolerance' });

      expect(proResponse.status).toBe(200);
    });
  });

  describe('Security Tests', () => {
    it('should reject malformed JWT tokens', async () => {
      const response = await request(app)
        .get('/api/persona')
        .set('Authorization', 'Bearer invalid-token-format');

      expect(response.status).toBe(401);
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { id: 'user-123', plan: 'pro' },
        JWT_SECRET,
        { expiresIn: '0s' } // Expired immediately
      );

      const response = await request(app)
        .get('/api/persona')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should prevent user A from accessing user B persona', async () => {
      const userAToken = generateToken('user-A', 'pro');

      PersonaService.getPersona.mockResolvedValue({
        lo_que_me_define: 'User A data',
        metadata: {}
      });

      const response = await request(app)
        .get('/api/persona')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(response.status).toBe(200);

      // Verify PersonaService was called with correct user ID
      expect(PersonaService.getPersona).toHaveBeenCalledWith('user-A');
      expect(PersonaService.getPersona).not.toHaveBeenCalledWith('user-B');
    });

    it('should sanitize SQL injection attempts', async () => {
      const userId = 'user-123';
      const token = generateToken(userId, 'pro');

      PersonaService.updatePersona.mockResolvedValue({ success: true, fieldsUpdated: [] });

      const response = await request(app)
        .post('/api/persona')
        .set('Authorization', `Bearer ${token}`)
        .send({ lo_que_me_define: "'; DROP TABLE users; --" });

      expect(response.status).toBe(200);

      // Verify sanitization happened (HTML escaping)
      // express-validator's .escape() converts dangerous HTML chars
      const updateCall = PersonaService.updatePersona.mock.calls[0][1];
      expect(updateCall.lo_que_me_define).toContain('&#x27;'); // Escaped single quote
      expect(updateCall.lo_que_me_define).not.toContain("'"); // Original quote removed

      // Note: SQL keywords like "DROP TABLE" remain because we use parameterized queries
      // which prevent SQL injection regardless of content. HTML escaping prevents XSS.
    });
  });
});
