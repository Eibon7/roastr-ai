/**
 * Guardian API Routes
 * Phase 17: Governance Interface & Alerts
 *
 * REST API endpoints for Guardian governance
 * Base path: /api/guardian
 *
 * SECURITY: All routes require admin authentication
 */

const express = require('express');
const router = express.Router();
const guardianController = require('../controllers/guardianController');
const { isAdminMiddleware } = require('../middleware/isAdmin');

/**
 * GET /api/guardian/cases
 * List all Guardian cases with optional filtering
 *
 * SECURITY: Requires admin authentication
 *
 * Query parameters:
 * - severity: CRITICAL | SENSITIVE | SAFE
 * - action: BLOCKED | REVIEW | APPROVED | DENIED
 * - limit: number (1-1000)
 *
 * Response: { cases: GuardianCase[], total: number, filters: object }
 */
router.get(
  '/cases',
  isAdminMiddleware,
  guardianController.listCasesController
);

/**
 * POST /api/guardian/cases/:caseId/approve
 * Approve a Guardian case
 *
 * SECURITY: Requires admin authentication
 *
 * Params:
 * - caseId: Case ID (e.g., 2025-10-09-18-07-06-685)
 *
 * Body:
 * - approver: string (2-100 chars)
 *
 * Response: { case_id, action, approved_by, approved_at, message }
 */
router.post(
  '/cases/:caseId/approve',
  isAdminMiddleware,
  guardianController.approveCaseController
);

/**
 * POST /api/guardian/cases/:caseId/deny
 * Deny a Guardian case
 *
 * SECURITY: Requires admin authentication
 *
 * Params:
 * - caseId: Case ID (e.g., 2025-10-09-18-07-06-685)
 *
 * Body:
 * - denier: string (2-100 chars)
 * - reason: string (10-500 chars)
 *
 * Response: { case_id, action, denied_by, denied_at, denial_reason, message }
 */
router.post(
  '/cases/:caseId/deny',
  isAdminMiddleware,
  guardianController.denyCaseController
);

module.exports = router;
