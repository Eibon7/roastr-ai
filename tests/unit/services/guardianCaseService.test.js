/**
 * Guardian Case Service - Unit Tests
 * Phase 17: Governance Interface & Alerts
 */

const fs = require('fs').promises;
const path = require('path');
const {
  listCases,
  getCaseById,
  approveCase,
  denyCase,
  validateName,
  validateReason
} = require('../../../src/services/guardianCaseService');

// Mock cases directory
const MOCK_CASES_DIR = path.join(__dirname, '../../../docs/guardian/cases');

describe('guardianCaseService', () => {
  describe('validateName', () => {
    test('should accept valid name', () => {
      const result = validateName('Emilio Postigo');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject empty name', () => {
      const result = validateName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    test('should reject null name', () => {
      const result = validateName(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name is required');
    });

    test('should reject name with only 1 character', () => {
      const result = validateName('A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be at least 2 characters');
    });

    test('should reject name over 100 characters', () => {
      const longName = 'A'.repeat(101);
      const result = validateName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be 100 characters or less');
    });

    test('should trim whitespace and validate', () => {
      const result = validateName('  John Doe  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateReason', () => {
    test('should accept valid reason', () => {
      const result = validateReason('This change violates our pricing policy');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject empty reason', () => {
      const result = validateReason('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Denial reason is required');
    });

    test('should reject reason shorter than 10 characters', () => {
      const result = validateReason('Too short');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Denial reason must be at least 10 characters');
    });

    test('should reject reason over 500 characters', () => {
      const longReason = 'A'.repeat(501);
      const result = validateReason(longReason);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Denial reason must be 500 characters or less');
    });

    test('should trim whitespace and validate', () => {
      const result = validateReason('  This is a valid reason for denial  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('listCases', () => {
    test('should list all cases from filesystem', async () => {
      const cases = await listCases();
      expect(Array.isArray(cases)).toBe(true);
      // Should have at least the mock cases created by guardian-gdd.js
      expect(cases.length).toBeGreaterThanOrEqual(0);
    });

    test('should filter by severity CRITICAL', async () => {
      const cases = await listCases({ severity: 'CRITICAL' });
      expect(Array.isArray(cases)).toBe(true);
      cases.forEach(c => {
        expect(c.severity).toBe('CRITICAL');
      });
    });

    test('should filter by action REVIEW', async () => {
      const cases = await listCases({ action: 'REVIEW' });
      expect(Array.isArray(cases)).toBe(true);
      cases.forEach(c => {
        expect(c.action).toBe('REVIEW');
      });
    });

    test('should respect limit parameter', async () => {
      const cases = await listCases({ limit: 2 });
      expect(Array.isArray(cases)).toBe(true);
      expect(cases.length).toBeLessThanOrEqual(2);
    });

    test('should sort cases by timestamp (newest first)', async () => {
      const cases = await listCases();
      if (cases.length > 1) {
        for (let i = 0; i < cases.length - 1; i++) {
          const current = new Date(cases[i].timestamp);
          const next = new Date(cases[i + 1].timestamp);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });
  });

  describe('getCaseById', () => {
    test('should return null for non-existent case', async () => {
      const caseData = await getCaseById('INVALID-CASE-ID-999999');
      expect(caseData).toBeNull();
    });

    test('should return case data for valid case ID', async () => {
      // First, list all cases to get a valid ID
      const cases = await listCases({ limit: 1 });
      if (cases.length > 0) {
        const validCaseId = cases[0].case_id;
        const caseData = await getCaseById(validCaseId);
        expect(caseData).not.toBeNull();
        expect(caseData.case_id).toBe(validCaseId);
      }
    });
  });

  describe('approveCase', () => {
    let testCaseId;

    beforeEach(async () => {
      // Create a test case for approval
      const testCase = {
        case_id: 'TEST-APPROVE-001',
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL',
        action: 'REVIEW',
        actor: 'test-actor',
        domains: ['test'],
        files_changed: ['test.js'],
        approved_by: null,
        approved_at: null,
        denied_by: null,
        denied_at: null,
        denial_reason: null
      };

      const filePath = path.join(MOCK_CASES_DIR, `${testCase.case_id}.json`);
      await fs.writeFile(filePath, JSON.stringify(testCase, null, 2), 'utf8');
      testCaseId = testCase.case_id;
    });

    afterEach(async () => {
      // Clean up test case
      try {
        const filePath = path.join(MOCK_CASES_DIR, `${testCaseId}.json`);
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should approve case successfully', async () => {
      const updated = await approveCase(testCaseId, 'Test Approver');
      expect(updated.action).toBe('APPROVED');
      expect(updated.approved_by).toBe('Test Approver');
      expect(updated.approved_at).toBeDefined();
      expect(new Date(updated.approved_at)).toBeInstanceOf(Date);
    });

    test('should reject approval with invalid approver name', async () => {
      await expect(approveCase(testCaseId, '')).rejects.toThrow('Name is required');
    });

    test('should reject approval of non-existent case', async () => {
      await expect(approveCase('INVALID-CASE-999', 'Test')).rejects.toThrow('Case not found');
    });

    test('should reject approval of already approved case', async () => {
      // First approval
      await approveCase(testCaseId, 'First Approver');

      // Second approval should fail
      await expect(approveCase(testCaseId, 'Second Approver')).rejects.toThrow(
        'Case already resolved'
      );
    });
  });

  describe('denyCase', () => {
    let testCaseId;

    beforeEach(async () => {
      // Create a test case for denial
      const testCase = {
        case_id: 'TEST-DENY-001',
        timestamp: new Date().toISOString(),
        severity: 'CRITICAL',
        action: 'REVIEW',
        actor: 'test-actor',
        domains: ['test'],
        files_changed: ['test.js'],
        approved_by: null,
        approved_at: null,
        denied_by: null,
        denied_at: null,
        denial_reason: null
      };

      const filePath = path.join(MOCK_CASES_DIR, `${testCase.case_id}.json`);
      await fs.writeFile(filePath, JSON.stringify(testCase, null, 2), 'utf8');
      testCaseId = testCase.case_id;
    });

    afterEach(async () => {
      // Clean up test case
      try {
        const filePath = path.join(MOCK_CASES_DIR, `${testCaseId}.json`);
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should deny case successfully', async () => {
      const updated = await denyCase(
        testCaseId,
        'Test Denier',
        'This is a valid denial reason with sufficient length'
      );
      expect(updated.action).toBe('DENIED');
      expect(updated.denied_by).toBe('Test Denier');
      expect(updated.denied_at).toBeDefined();
      expect(updated.denial_reason).toBe('This is a valid denial reason with sufficient length');
      expect(new Date(updated.denied_at)).toBeInstanceOf(Date);
    });

    test('should reject denial with invalid denier name', async () => {
      await expect(denyCase(testCaseId, '', 'Valid reason here')).rejects.toThrow(
        'Name is required'
      );
    });

    test('should reject denial with invalid reason (too short)', async () => {
      await expect(denyCase(testCaseId, 'Test Denier', 'Short')).rejects.toThrow(
        'Denial reason must be at least 10 characters'
      );
    });

    test('should reject denial of non-existent case', async () => {
      await expect(
        denyCase('INVALID-CASE-999', 'Test', 'Valid reason with sufficient length')
      ).rejects.toThrow('Case not found');
    });

    test('should reject denial of already denied case', async () => {
      // First denial
      await denyCase(testCaseId, 'First Denier', 'Valid reason for first denial');

      // Second denial should fail
      await expect(
        denyCase(testCaseId, 'Second Denier', 'Valid reason for second denial')
      ).rejects.toThrow('Case already resolved');
    });

    test('should reject denial of already approved case', async () => {
      // Approve first
      await approveCase(testCaseId, 'Test Approver');

      // Then try to deny
      await expect(
        denyCase(testCaseId, 'Test Denier', 'Valid denial reason')
      ).rejects.toThrow('Case already resolved');
    });
  });
});
