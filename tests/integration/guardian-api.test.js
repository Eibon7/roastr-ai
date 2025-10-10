/**
 * Guardian API - Integration Tests
 * Phase 17: Governance Interface & Alerts
 *
 * Tests all Guardian REST API endpoints end-to-end
 */

const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('../../src/index');
const { getMockAdminAuthHeader } = require('../helpers/authHelper');

const CASES_DIR = path.join(__dirname, '../../docs/guardian/cases');

// Generate valid timestamp-based case ID
function generateTestCaseId(offset = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds() + offset).padStart(3, '0');
  return `${year}-${month}-${day}-${hour}-${min}-${sec}-${ms}`;
}

const TEST_CASE_ID = generateTestCaseId(100);

describe('Guardian API Integration Tests', () => {
  // Create test case before tests
  beforeAll(async () => {
    const testCase = {
      case_id: TEST_CASE_ID,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL',
      action: 'REVIEW',
      actor: 'integration-test',
      domains: ['test'],
      files_changed: ['test.js'],
      approved_by: null,
      approved_at: null,
      denied_by: null,
      denied_at: null,
      denial_reason: null
    };

    const filePath = path.join(CASES_DIR, `${TEST_CASE_ID}.json`);
    await fs.writeFile(filePath, JSON.stringify(testCase, null, 2), 'utf8');
  });

  // Clean up test case after tests
  afterAll(async () => {
    try {
      const filePath = path.join(CASES_DIR, `${TEST_CASE_ID}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('GET /api/guardian/cases', () => {
    test('should list all Guardian cases', async () => {
      const response = await request(app)
        .get('/api/guardian/cases')
        .set(getMockAdminAuthHeader())
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('cases');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.cases)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });

    test('should filter cases by severity=CRITICAL', async () => {
      const response = await request(app)
        .get('/api/guardian/cases?severity=CRITICAL')
        .set(getMockAdminAuthHeader())
        .expect(200);

      expect(response.body.cases).toBeInstanceOf(Array);
      response.body.cases.forEach(c => {
        expect(c.severity).toBe('CRITICAL');
      });
    });

    test('should filter cases by action=REVIEW', async () => {
      const response = await request(app)
        .get('/api/guardian/cases?action=REVIEW')
        .set(getMockAdminAuthHeader())
        .expect(200);

      expect(response.body.cases).toBeInstanceOf(Array);
      response.body.cases.forEach(c => {
        expect(c.action).toBe('REVIEW');
      });
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/guardian/cases?limit=2')
        .set(getMockAdminAuthHeader())
        .expect(200);

      expect(response.body.cases.length).toBeLessThanOrEqual(2);
    });

    test('should return 400 for invalid severity', async () => {
      const response = await request(app)
        .get('/api/guardian/cases?severity=INVALID')
        .set(getMockAdminAuthHeader())
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid severity');
    });

    test('should return 400 for invalid action', async () => {
      const response = await request(app)
        .get('/api/guardian/cases?action=INVALID')
        .set(getMockAdminAuthHeader())
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid action');
    });

    test('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/api/guardian/cases?limit=9999')
        .set(getMockAdminAuthHeader())
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Limit out of range');
    });
  });

  describe('POST /api/guardian/cases/:caseId/approve', () => {
    test('should approve a case successfully', async () => {
      const response = await request(app)
        .post(`/api/guardian/cases/${TEST_CASE_ID}/approve`)
        .set(getMockAdminAuthHeader())
        .send({ approver: 'Integration Test User' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('case_id', TEST_CASE_ID);
      expect(response.body).toHaveProperty('action', 'APPROVED');
      expect(response.body).toHaveProperty('approved_by', 'Integration Test User');
      expect(response.body).toHaveProperty('approved_at');
      expect(response.body).toHaveProperty('message');
    });

    test('should return 400 for missing approver', async () => {
      const response = await request(app)
        .post(`/api/guardian/cases/${TEST_CASE_ID}/approve`)
        .set(getMockAdminAuthHeader())
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Approver name is required');
    });

    test('should return 400 for invalid case ID format', async () => {
      const response = await request(app)
        .post('/api/guardian/cases/INVALID-CASE-ID/approve')
        .set(getMockAdminAuthHeader())
        .send({ approver: 'Test User' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid case ID');
    });

    test('should return 404 for non-existent case', async () => {
      const response = await request(app)
        .post('/api/guardian/cases/2025-99-99-99-99-99-999/approve')
        .set(getMockAdminAuthHeader())
        .send({ approver: 'Test User' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Case not found');
    });

    test('should return 400 for already resolved case', async () => {
      // Try to approve again (already approved in previous test)
      const response = await request(app)
        .post(`/api/guardian/cases/${TEST_CASE_ID}/approve`)
        .set(getMockAdminAuthHeader())
        .send({ approver: 'Another User' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already resolved');
    });
  });

  describe('POST /api/guardian/cases/:caseId/deny', () => {
    // Create a separate test case for denial tests with valid timestamp format
    const DENY_TEST_CASE_ID = generateTestCaseId(200);

    beforeAll(async () => {
      const testCase = {
        case_id: DENY_TEST_CASE_ID,
        timestamp: new Date().toISOString(),
        severity: 'SENSITIVE',
        action: 'REVIEW',
        actor: 'integration-test',
        domains: ['test'],
        files_changed: ['test.js'],
        approved_by: null,
        approved_at: null,
        denied_by: null,
        denied_at: null,
        denial_reason: null
      };

      const filePath = path.join(CASES_DIR, `${DENY_TEST_CASE_ID}.json`);
      await fs.writeFile(filePath, JSON.stringify(testCase, null, 2), 'utf8');
    });

    afterAll(async () => {
      try {
        const filePath = path.join(CASES_DIR, `${DENY_TEST_CASE_ID}.json`);
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should deny a case successfully', async () => {
      const response = await request(app)
        .post(`/api/guardian/cases/${DENY_TEST_CASE_ID}/deny`)
        .set(getMockAdminAuthHeader())
        .send({
          denier: 'Integration Test User',
          reason: 'This is a valid denial reason for integration testing'
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('case_id', DENY_TEST_CASE_ID);
      expect(response.body).toHaveProperty('action', 'DENIED');
      expect(response.body).toHaveProperty('denied_by', 'Integration Test User');
      expect(response.body).toHaveProperty('denied_at');
      expect(response.body).toHaveProperty('denial_reason');
      expect(response.body.denial_reason).toContain('valid denial reason');
    });

    test('should return 400 for missing denier', async () => {
      const response = await request(app)
        .post(`/api/guardian/cases/${DENY_TEST_CASE_ID}/deny`)
        .set(getMockAdminAuthHeader())
        .send({ reason: 'Has reason but no denier' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Denier name is required');
    });

    test('should return 400 for missing reason', async () => {
      const response = await request(app)
        .post(`/api/guardian/cases/${DENY_TEST_CASE_ID}/deny`)
        .set(getMockAdminAuthHeader())
        .send({ denier: 'Test User' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Denial reason is required');
    });

    test('should return 400 for reason too short', async () => {
      const response = await request(app)
        .post(`/api/guardian/cases/${DENY_TEST_CASE_ID}/deny`)
        .set(getMockAdminAuthHeader())
        .send({ denier: 'Test User', reason: 'Short' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('at least 10 characters');
    });

    test('should return 400 for invalid case ID format', async () => {
      const response = await request(app)
        .post('/api/guardian/cases/INVALID-CASE-ID/deny')
        .set(getMockAdminAuthHeader())
        .send({ denier: 'Test User', reason: 'Valid reason with sufficient length' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid case ID');
    });

    test('should return 404 for non-existent case', async () => {
      const response = await request(app)
        .post('/api/guardian/cases/2025-99-99-99-99-99-998/deny')
        .set(getMockAdminAuthHeader())
        .send({ denier: 'Test User', reason: 'Valid reason with sufficient length' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Case not found');
    });
  });
});
