/**
 * Guardian API Routes
 * Phase 17: Governance Interface & Alerts
 *
 * REST API endpoints for Guardian governance
 * Base path: /api/guardian
 */

const express = require('express');
const router = express.Router();
const guardianController = require('../controllers/guardianController');

// Note: Authentication middleware should be added when available
// const { requireAdmin } = require('../middleware/auth');

/**
 * GET /api/guardian/cases
 * List all Guardian cases with optional filtering
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
  // requireAdmin, // TODO: Add admin authentication when middleware is ready
  guardianController.listCasesController
);

/**
 * POST /api/guardian/cases/:caseId/approve
 * Approve a Guardian case
 *
 * Params:
 * - caseId: Case ID (e.g., CASE-20251010-001)
 *
 * Body:
 * - approver: string (2-100 chars)
 *
 * Response: { case_id, action, approved_by, approved_at, message }
 */
router.post(
  '/cases/:caseId/approve',
  // requireAdmin, // TODO: Add admin authentication when middleware is ready
  guardianController.approveCaseController
);

/**
 * POST /api/guardian/cases/:caseId/deny
 * Deny a Guardian case
 *
 * Params:
 * - caseId: Case ID (e.g., CASE-20251010-001)
 *
 * Body:
 * - denier: string (2-100 chars)
 * - reason: string (10-500 chars)
 *
 * Response: { case_id, action, denied_by, denied_at, denial_reason, message }
 */
router.post(
  '/cases/:caseId/deny',
  // requireAdmin, // TODO: Add admin authentication when middleware is ready
  guardianController.denyCaseController
);

module.exports = router;
