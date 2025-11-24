/**
 * Guardian Case Service
 * Phase 17: Governance Interface & Alerts
 *
 * Service layer for Guardian case management
 * - File I/O for case JSON files
 * - Filtering and sorting
 * - Approval/denial mutations
 * - Input validation
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const CASES_DIR = path.join(__dirname, '../../docs/guardian/cases');

/**
 * Validate case ID format to prevent path traversal attacks
 *
 * SECURITY: Critical validation to prevent directory traversal
 * Expected format: YYYY-MM-DD-HH-MM-SS-mmm (e.g., 2025-10-09-18-07-06-685)
 *
 * @param {string} caseId - Case ID to validate
 * @returns {string} Validated case ID
 * @throws {Error} If case ID format is invalid
 */
function validateCaseId(caseId) {
  // Expected format: YYYY-MM-DD-HH-MM-SS-mmm (timestamp with milliseconds)
  const VALID_CASE_ID_REGEX = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/;

  if (!caseId || typeof caseId !== 'string') {
    throw new Error('Case ID must be a non-empty string');
  }

  // SECURITY: Reject any path traversal attempts
  if (caseId.includes('..') || caseId.includes('/') || caseId.includes('\\')) {
    logger.warn('Path traversal attempt detected', { caseId });
    throw new Error(
      `Invalid case ID: path traversal characters detected. ` +
        `Expected format: YYYY-MM-DD-HH-MM-SS-mmm`
    );
  }

  if (!VALID_CASE_ID_REGEX.test(caseId)) {
    throw new Error(
      `Invalid case ID format: ${caseId}. ` +
        `Expected format: YYYY-MM-DD-HH-MM-SS-mmm (e.g., 2025-10-09-18-07-06-685)`
    );
  }

  return caseId;
}

/**
 * List all Guardian cases with optional filtering
 *
 * @param {Object} filters - { severity?, action?, limit? }
 * @returns {Promise<Array>} List of cases
 *
 * @example
 * // List all cases
 * const cases = await listCases();
 *
 * @example
 * // Filter by severity
 * const criticalCases = await listCases({ severity: 'CRITICAL' });
 *
 * @example
 * // Filter by action status
 * const pendingCases = await listCases({ action: 'REVIEW' });
 */
async function listCases(filters = {}) {
  try {
    // Read all JSON files from cases directory
    const files = await fs.readdir(CASES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    // PERFORMANCE: Load all case data in parallel (not sequential)
    const casePromises = jsonFiles.map(async (file) => {
      const filePath = path.join(CASES_DIR, file);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    });

    let cases = await Promise.all(casePromises);

    // Apply severity filter
    if (filters.severity) {
      cases = cases.filter((c) => c.severity === filters.severity);
    }

    // Apply action filter
    if (filters.action) {
      cases = cases.filter((c) => c.action === filters.action);
    }

    // Sort by timestamp (newest first)
    cases.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply limit
    if (filters.limit) {
      cases = cases.slice(0, filters.limit);
    }

    return cases;
  } catch (error) {
    logger.error('Error listing Guardian cases', { error: error.message, stack: error.stack });
    throw new Error('Failed to list Guardian cases');
  }
}

/**
 * Get single case by ID
 *
 * @param {string} caseId - Case ID (e.g., CASE-20251010-001)
 * @returns {Promise<Object|null>} Case data or null if not found
 *
 * @example
 * const caseData = await getCaseById('CASE-20251010-001');
 * if (!caseData) {
 *   logger.info('Case not found');
 * }
 */
async function getCaseById(caseId) {
  try {
    // SECURITY: Validate caseId BEFORE path resolution to prevent traversal
    caseId = validateCaseId(caseId);

    const filePath = path.join(CASES_DIR, `${caseId}.json`);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // Case not found
    }
    if (error.message.includes('Invalid case ID')) {
      throw error; // Re-throw validation errors
    }
    logger.error(`Error reading Guardian case ${caseId}`, { error: error.message });
    throw new Error(`Failed to read case ${caseId}`);
  }
}

/**
 * Validate approver/denier name
 *
 * @param {string} name - Approver or denier name
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Name must be 100 characters or less' };
  }

  return { valid: true };
}

/**
 * Validate denial reason
 *
 * @param {string} reason - Denial reason
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateReason(reason) {
  if (!reason || typeof reason !== 'string') {
    return { valid: false, error: 'Denial reason is required' };
  }

  const trimmed = reason.trim();

  if (trimmed.length < 10) {
    return { valid: false, error: 'Denial reason must be at least 10 characters' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Denial reason must be 500 characters or less' };
  }

  return { valid: true };
}

/**
 * Approve a Guardian case
 *
 * @param {string} caseId - Case ID
 * @param {string} approver - Name of approver (2-100 chars)
 * @returns {Promise<Object>} Updated case
 * @throws {Error} If validation fails or case not found
 *
 * @example
 * try {
 *   const updated = await approveCase('CASE-20251010-001', 'Emilio Postigo');
 *   logger.info('Approved by:', updated.approved_by);
 * } catch (error) {
 *   logger.error('Approval failed:', error.message);
 * }
 */
async function approveCase(caseId, approver) {
  // Validate approver
  const validation = validateName(approver);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Get case
  const caseData = await getCaseById(caseId);
  if (!caseData) {
    throw new Error('Case not found');
  }

  // Check if already resolved
  if (caseData.approved_by || caseData.denied_by) {
    throw new Error('Case already resolved');
  }

  // Update case
  caseData.action = 'APPROVED';
  caseData.approved_by = approver.trim();
  caseData.approved_at = new Date().toISOString();

  // Write to file (atomic write for data integrity)
  const filePath = path.join(CASES_DIR, `${caseId}.json`);
  const tempPath = `${filePath}.tmp`;

  try {
    await fs.writeFile(tempPath, JSON.stringify(caseData, null, 2), 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (writeError) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch (unlinkError) {
      // Ignore unlink errors
    }
    throw new Error('Failed to save approval');
  }

  return caseData;
}

/**
 * Deny a Guardian case
 *
 * @param {string} caseId - Case ID
 * @param {string} denier - Name of denier (2-100 chars)
 * @param {string} reason - Denial reason (10-500 chars)
 * @returns {Promise<Object>} Updated case
 * @throws {Error} If validation fails or case not found
 *
 * @example
 * try {
 *   const updated = await denyCase(
 *     'CASE-20251010-001',
 *     'Emilio Postigo',
 *     'Changes violate pricing policy'
 *   );
 *   logger.info('Denied by:', updated.denied_by);
 * } catch (error) {
 *   logger.error('Denial failed:', error.message);
 * }
 */
async function denyCase(caseId, denier, reason) {
  // Validate denier
  const denierValidation = validateName(denier);
  if (!denierValidation.valid) {
    throw new Error(denierValidation.error);
  }

  // Validate reason
  const reasonValidation = validateReason(reason);
  if (!reasonValidation.valid) {
    throw new Error(reasonValidation.error);
  }

  // Get case
  const caseData = await getCaseById(caseId);
  if (!caseData) {
    throw new Error('Case not found');
  }

  // Check if already resolved
  if (caseData.approved_by || caseData.denied_by) {
    throw new Error('Case already resolved');
  }

  // Update case
  caseData.action = 'DENIED';
  caseData.denied_by = denier.trim();
  caseData.denied_at = new Date().toISOString();
  caseData.denial_reason = reason.trim();

  // Write to file (atomic write for data integrity)
  const filePath = path.join(CASES_DIR, `${caseId}.json`);
  const tempPath = `${filePath}.tmp`;

  try {
    await fs.writeFile(tempPath, JSON.stringify(caseData, null, 2), 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (writeError) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch (unlinkError) {
      // Ignore unlink errors
    }
    throw new Error('Failed to save denial');
  }

  return caseData;
}

module.exports = {
  listCases,
  getCaseById,
  approveCase,
  denyCase,
  // Export validators for testing
  validateCaseId,
  validateName,
  validateReason
};
