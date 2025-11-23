/**
 * Integration Tests: Sponsors API Routes
 *
 * Tests API endpoints for sponsor management (Plan Plus feature)
 *
 * Test Coverage:
 * - POST /api/sponsors (create sponsor)
 * - GET /api/sponsors (list sponsors)
 * - GET /api/sponsors/:id (get single sponsor)
 * - PUT /api/sponsors/:id (update sponsor)
 * - DELETE /api/sponsors/:id (delete sponsor)
 * - POST /api/sponsors/extract-tags (tag extraction with rate limiting)
 *
 * Tests authentication, plan gating (Plus only), validation, and error handling.
 *
 * @see src/routes/sponsors.js
 * @see src/services/sponsorService.js
 */

const request = require('supertest');
const express = require('express');
const sponsorsRouter = require('../../../src/routes/sponsors');

// Mock dependencies
jest.mock('../../../src/services/sponsorService');
jest.mock('../../../src/middleware/authenticateToken');
jest.mock('../../../src/middleware/requirePlan');
jest.mock('../../../src/services/costControl');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

const SponsorService = require('../../../src/services/sponsorService');
const authenticateToken = require('../../../src/middleware/authenticateToken');
const requirePlan = require('../../../src/middleware/requirePlan');
const CostControl = require('../../../src/services/costControl');

describe('Sponsors API Routes', () => {
  let app;
  let mockSponsorService;
  let mockCostControl;

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/sponsors', sponsorsRouter);

    // Mock authenticated user
    authenticateToken.mockImplementation((req, res, next) => {
      req.user = {
        id: 'user-123',
        email: 'test@example.com',
        plan: 'plus'
      };
      next();
    });

    // Mock plan gating (Plus plan required)
    requirePlan.mockImplementation(() => (req, res, next) => {
      if (req.user.plan === 'plus') {
        next();
      } else {
        res
          .status(403)
          .json({ error: 'PLAN_UPGRADE_REQUIRED', message: 'Plus plan required for Brand Safety' });
      }
    });

    // Mock SponsorService
    mockSponsorService = {
      createSponsor: jest.fn(),
      getSponsors: jest.fn(),
      getSponsor: jest.fn(),
      updateSponsor: jest.fn(),
      deleteSponsor: jest.fn(),
      extractTagsFromURL: jest.fn()
    };
    SponsorService.mockImplementation(() => mockSponsorService);

    // Mock CostControl
    mockCostControl = {
      recordUsage: jest.fn().mockResolvedValue(true)
    };
    CostControl.mockImplementation(() => mockCostControl);

    jest.clearAllMocks();
  });

  // ============================================================================
  // POST /api/sponsors - Create Sponsor
  // ============================================================================

  describe('POST /api/sponsors', () => {
    it('should create sponsor successfully', async () => {
      const newSponsor = {
        name: 'Nike',
        url: 'https://www.nike.com',
        tags: ['sportswear', 'sneakers'],
        severity: 'high',
        tone: 'professional',
        priority: 1,
        actions: ['hide_comment', 'def_roast']
      };

      const createdSponsor = {
        id: 'sponsor-123',
        user_id: 'user-123',
        ...newSponsor,
        active: true,
        created_at: '2025-11-17T12:00:00Z',
        updated_at: '2025-11-17T12:00:00Z'
      };

      mockSponsorService.createSponsor.mockResolvedValue(createdSponsor);

      const response = await request(app).post('/api/sponsors').send(newSponsor).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('sponsor-123');
      expect(response.body.data.name).toBe('Nike');
      expect(mockSponsorService.createSponsor).toHaveBeenCalledWith('user-123', newSponsor);
    });

    it('should reject request without authentication', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'UNAUTHORIZED' });
      });

      await request(app).post('/api/sponsors').send({ name: 'Nike' }).expect(401);
    });

    it('should reject request from non-Plus user', async () => {
      authenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 'user-123', plan: 'pro' };
        next();
      });

      await request(app).post('/api/sponsors').send({ name: 'Nike' }).expect(403);
    });

    it('should validate required fields', async () => {
      mockSponsorService.createSponsor.mockRejectedValue(new Error('SPONSOR_NAME_REQUIRED'));

      await request(app)
        .post('/api/sponsors')
        .send({}) // Missing name
        .expect(400);
    });

    it('should handle database errors', async () => {
      mockSponsorService.createSponsor.mockRejectedValue(
        new Error('DATABASE_ERROR: Connection failed')
      );

      await request(app).post('/api/sponsors').send({ name: 'Nike' }).expect(500);
    });
  });

  // ============================================================================
  // GET /api/sponsors - List Sponsors
  // ============================================================================

  describe('GET /api/sponsors', () => {
    it('should list active sponsors by default', async () => {
      const sponsors = [
        { id: 'sponsor-1', name: 'Nike', active: true },
        { id: 'sponsor-2', name: 'Adidas', active: true }
      ];

      mockSponsorService.getSponsors.mockResolvedValue(sponsors);

      const response = await request(app).get('/api/sponsors').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(sponsors);
      expect(response.body.count).toBe(2);
      expect(mockSponsorService.getSponsors).toHaveBeenCalledWith('user-123', false);
    });

    it('should list all sponsors when includeInactive=true', async () => {
      const sponsors = [
        { id: 'sponsor-1', name: 'Nike', active: true },
        { id: 'sponsor-2', name: 'Reebok', active: false }
      ];

      mockSponsorService.getSponsors.mockResolvedValue(sponsors);

      const response = await request(app).get('/api/sponsors?includeInactive=true').expect(200);

      expect(response.body.data).toEqual(sponsors);
      expect(mockSponsorService.getSponsors).toHaveBeenCalledWith('user-123', true);
    });

    it('should return empty array when no sponsors', async () => {
      mockSponsorService.getSponsors.mockResolvedValue([]);

      const response = await request(app).get('/api/sponsors').expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  // ============================================================================
  // GET /api/sponsors/:id - Get Single Sponsor
  // ============================================================================

  describe('GET /api/sponsors/:id', () => {
    it('should get sponsor by id', async () => {
      const sponsor = {
        id: 'sponsor-123',
        user_id: 'user-123',
        name: 'Nike',
        active: true
      };

      mockSponsorService.getSponsor.mockResolvedValue(sponsor);

      const response = await request(app).get('/api/sponsors/sponsor-123').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('sponsor-123');
      expect(mockSponsorService.getSponsor).toHaveBeenCalledWith('sponsor-123', 'user-123');
    });

    it('should return 404 when sponsor not found', async () => {
      mockSponsorService.getSponsor.mockResolvedValue(null);

      await request(app).get('/api/sponsors/nonexistent').expect(404);
    });
  });

  // ============================================================================
  // PUT /api/sponsors/:id - Update Sponsor
  // ============================================================================

  describe('PUT /api/sponsors/:id', () => {
    it('should update sponsor successfully', async () => {
      const updates = {
        severity: 'zero_tolerance',
        actions: ['hide_comment', 'block_user']
      };

      const updatedSponsor = {
        id: 'sponsor-123',
        user_id: 'user-123',
        name: 'Nike',
        ...updates,
        updated_at: '2025-11-17T12:30:00Z'
      };

      mockSponsorService.updateSponsor.mockResolvedValue(updatedSponsor);

      const response = await request(app)
        .put('/api/sponsors/sponsor-123')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.severity).toBe('zero_tolerance');
      expect(mockSponsorService.updateSponsor).toHaveBeenCalledWith(
        'sponsor-123',
        'user-123',
        updates
      );
    });

    it('should return 404 when sponsor not found', async () => {
      mockSponsorService.updateSponsor.mockResolvedValue(null);

      await request(app).put('/api/sponsors/nonexistent').send({ severity: 'high' }).expect(404);
    });
  });

  // ============================================================================
  // DELETE /api/sponsors/:id - Delete Sponsor
  // ============================================================================

  describe('DELETE /api/sponsors/:id', () => {
    it('should delete sponsor successfully', async () => {
      mockSponsorService.deleteSponsor.mockResolvedValue(true);

      const response = await request(app).delete('/api/sponsors/sponsor-123').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sponsor deleted successfully');
      expect(mockSponsorService.deleteSponsor).toHaveBeenCalledWith('sponsor-123', 'user-123');
    });

    it('should return 404 when sponsor not found', async () => {
      mockSponsorService.deleteSponsor.mockRejectedValue(new Error('SPONSOR_NOT_FOUND'));

      await request(app).delete('/api/sponsors/nonexistent').expect(404);
    });
  });

  // ============================================================================
  // POST /api/sponsors/extract-tags - Tag Extraction
  // ============================================================================

  describe('POST /api/sponsors/extract-tags', () => {
    it('should extract tags successfully', async () => {
      const url = 'https://www.nike.com';
      const tags = ['sportswear', 'athletics', 'sneakers'];

      mockSponsorService.extractTagsFromURL.mockResolvedValue(tags);

      const response = await request(app)
        .post('/api/sponsors/extract-tags')
        .send({ url })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toEqual(tags);
      expect(mockSponsorService.extractTagsFromURL).toHaveBeenCalledWith(url);
      expect(mockCostControl.recordUsage).toHaveBeenCalledWith('user-123', 'extract_sponsor_tags');
    });

    it('should validate URL is required', async () => {
      await request(app)
        .post('/api/sponsors/extract-tags')
        .send({}) // Missing url
        .expect(400);
    });

    it('should handle invalid URLs', async () => {
      mockSponsorService.extractTagsFromURL.mockRejectedValue(new Error('INVALID_URL'));

      await request(app).post('/api/sponsors/extract-tags').send({ url: 'not-a-url' }).expect(400);
    });

    it('should handle OpenAI errors', async () => {
      mockSponsorService.extractTagsFromURL.mockRejectedValue(new Error('OPENAI_ERROR'));

      await request(app)
        .post('/api/sponsors/extract-tags')
        .send({ url: 'https://www.nike.com' })
        .expect(500);
    });

    it('should track cost even on errors', async () => {
      mockSponsorService.extractTagsFromURL.mockRejectedValue(new Error('OPENAI_ERROR'));

      await request(app)
        .post('/api/sponsors/extract-tags')
        .send({ url: 'https://www.nike.com' })
        .expect(500);

      // Cost control should still be called even if extraction failed
      expect(mockCostControl.recordUsage).toHaveBeenCalledWith('user-123', 'extract_sponsor_tags');
    });
  });
});
