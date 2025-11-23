/**
 * Tests unitarios para las rutas de Guardian (/api/guardian)
 * Issue #925: Tests para Routes Básicas (0% → 60%+)
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies BEFORE requiring the routes
jest.mock('../../../src/middleware/isAdmin');
jest.mock('../../../src/controllers/guardianController');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Now require the modules after mocking
const guardianRoutes = require('../../../src/routes/guardian');
const { isAdminMiddleware } = require('../../../src/middleware/isAdmin');
const guardianController = require('../../../src/controllers/guardianController');

describe('Guardian Routes Tests', () => {
  let app;
  let mockAdminUser;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup express app
    app = express();
    app.use(express.json());
    app.use('/api/guardian', guardianRoutes);

    // Mock admin user
    mockAdminUser = {
      id: 'admin-user-123',
      email: 'admin@example.com',
      isAdmin: true,
      role: 'admin'
    };

    // Mock admin middleware (passes by default)
    isAdminMiddleware.mockImplementation((req, res, next) => {
      req.user = mockAdminUser; // Set admin user
      next();
    });

    // Default mocks for controller methods (async)
    guardianController.listCasesController.mockImplementation(async (req, res) => {
      res.json({ cases: [], total: 0, filters: {} });
    });

    guardianController.approveCaseController.mockImplementation(async (req, res) => {
      res.json({ success: true });
    });

    guardianController.denyCaseController.mockImplementation(async (req, res) => {
      res.json({ success: true });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/guardian/cases', () => {
    it('should list cases successfully', async () => {
      const mockCases = [
        { case_id: 'case-1', severity: 'CRITICAL', action: 'REVIEW' },
        { case_id: 'case-2', severity: 'SENSITIVE', action: 'APPROVED' }
      ];

      guardianController.listCasesController.mockImplementation(async (req, res) => {
        res.json({
          cases: mockCases,
          total: mockCases.length,
          filters: {}
        });
      });

      const response = await request(app).get('/api/guardian/cases').expect(200);

      expect(response.body).toHaveProperty('cases');
      expect(response.body.cases).toHaveLength(2);
    });

    it('should filter by severity when provided', async () => {
      guardianController.listCasesController.mockImplementation(async (req, res) => {
        // Verify query param was passed
        if (req.query.severity === 'CRITICAL') {
          res.json({
            cases: [{ case_id: 'case-1', severity: 'CRITICAL' }],
            total: 1,
            filters: { severity: 'CRITICAL' }
          });
        } else {
          res.json({ cases: [], total: 0 });
        }
      });

      const response = await request(app).get('/api/guardian/cases?severity=CRITICAL').expect(200);

      expect(response.body.filters.severity).toBe('CRITICAL');
    });

    it('should filter by action when provided', async () => {
      guardianController.listCasesController.mockImplementation(async (req, res) => {
        if (req.query.action === 'REVIEW') {
          res.json({
            cases: [{ case_id: 'case-1', action: 'REVIEW' }],
            total: 1,
            filters: { action: 'REVIEW' }
          });
        } else {
          res.json({ cases: [], total: 0 });
        }
      });

      const response = await request(app).get('/api/guardian/cases?action=REVIEW').expect(200);

      expect(response.body.filters.action).toBe('REVIEW');
    });

    it('should filter by limit when provided', async () => {
      guardianController.listCasesController.mockImplementation(async (req, res) => {
        if (req.query.limit === '50') {
          res.json({
            cases: [],
            total: 0,
            filters: { limit: 50 }
          });
        } else {
          res.json({ cases: [], total: 0 });
        }
      });

      const response = await request(app).get('/api/guardian/cases?limit=50').expect(200);

      expect(response.body.filters.limit).toBe(50);
    });

    it('should require admin authentication', async () => {
      // Mock admin middleware to reject
      isAdminMiddleware.mockImplementation((req, res, next) => {
        res.status(403).json({ error: 'Admin access required' });
      });

      const response = await request(app).get('/api/guardian/cases').expect(403);

      expect(response.body.error).toBe('Admin access required');
    });
  });

  describe('POST /api/guardian/cases/:caseId/approve', () => {
    it('should approve case successfully', async () => {
      const caseId = '2025-01-15-10-30-00-123';

      guardianController.approveCaseController.mockImplementation(async (req, res) => {
        res.json({
          case_id: req.params.caseId,
          action: 'APPROVED',
          approved_by: req.body.approver,
          approved_at: new Date().toISOString(),
          message: `Case ${req.params.caseId} approved successfully`
        });
      });

      const response = await request(app)
        .post(`/api/guardian/cases/${caseId}/approve`)
        .send({ approver: 'Test Admin' })
        .expect(200);

      expect(response.body).toMatchObject({
        case_id: caseId,
        action: 'APPROVED',
        approved_by: 'Test Admin'
      });
    });

    it('should handle missing approver name', async () => {
      guardianController.approveCaseController.mockImplementation(async (req, res) => {
        if (!req.body.approver) {
          return res.status(400).json({
            error: 'Approver name is required',
            field: 'approver'
          });
        }
        res.json({ success: true });
      });

      const caseId = '2025-01-15-10-30-00-123';
      const response = await request(app)
        .post(`/api/guardian/cases/${caseId}/approve`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should handle case not found', async () => {
      guardianController.approveCaseController.mockImplementation(async (req, res) => {
        res.status(404).json({
          error: 'Case not found',
          caseId: req.params.caseId
        });
      });

      const caseId = 'nonexistent-case-id';
      const response = await request(app)
        .post(`/api/guardian/cases/${caseId}/approve`)
        .send({ approver: 'Test Admin' })
        .expect(404);

      expect(response.body.error).toBe('Case not found');
    });
  });

  describe('POST /api/guardian/cases/:caseId/deny', () => {
    it('should deny case successfully', async () => {
      const caseId = '2025-01-15-10-30-00-456';

      guardianController.denyCaseController.mockImplementation(async (req, res) => {
        res.json({
          case_id: req.params.caseId,
          action: 'DENIED',
          denied_by: req.body.denier,
          denied_at: new Date().toISOString(),
          denial_reason: req.body.reason,
          message: `Case ${req.params.caseId} denied successfully`
        });
      });

      const response = await request(app)
        .post(`/api/guardian/cases/${caseId}/deny`)
        .send({
          denier: 'Test Admin',
          reason: 'Reason'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        case_id: caseId,
        action: 'DENIED'
      });
    });

    it('should handle missing denier name', async () => {
      guardianController.denyCaseController.mockImplementation(async (req, res) => {
        if (!req.body.denier) {
          return res.status(400).json({
            error: 'Denier name is required',
            field: 'denier'
          });
        }
        res.json({ success: true });
      });

      const caseId = '2025-01-15-10-30-00-456';
      const response = await request(app)
        .post(`/api/guardian/cases/${caseId}/deny`)
        .send({ reason: 'Some reason' })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should handle missing denial reason', async () => {
      guardianController.denyCaseController.mockImplementation(async (req, res) => {
        if (!req.body.reason) {
          return res.status(400).json({
            error: 'Denial reason is required',
            field: 'reason'
          });
        }
        res.json({ success: true });
      });

      const caseId = '2025-01-15-10-30-00-456';
      const response = await request(app)
        .post(`/api/guardian/cases/${caseId}/deny`)
        .send({ denier: 'Test Admin' })
        .expect(400);

      expect(response.body.error).toContain('reason');
    });

    it('should handle case not found', async () => {
      guardianController.denyCaseController.mockImplementation(async (req, res) => {
        res.status(404).json({
          error: 'Case not found',
          caseId: req.params.caseId
        });
      });

      const caseId = 'nonexistent-case-id';
      const response = await request(app)
        .post(`/api/guardian/cases/${caseId}/deny`)
        .send({
          denier: 'Test Admin',
          reason: 'Test reason'
        })
        .expect(404);

      expect(response.body.error).toBe('Case not found');
    });
  });

  describe('Authentication Middleware Integration', () => {
    it('should require admin authentication for all routes', async () => {
      // Verify isAdminMiddleware is called
      isAdminMiddleware.mockClear();

      await request(app).get('/api/guardian/cases');

      expect(isAdminMiddleware).toHaveBeenCalled();
    });
  });
});
