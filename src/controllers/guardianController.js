/**
 * Guardian Controller
 * Phase 17: Governance Interface & Alerts
 *
 * Controller layer for Guardian API endpoints
 * - Request/response handling
 * - Query parameter parsing
 * - Input validation
 * - Error handling with proper HTTP status codes
 */

const guardianCaseService = require('../services/guardianCaseService');
const logger = require('../utils/logger');

/**
 * List Guardian cases with filtering
 * GET /api/guardian/cases?severity=CRITICAL&action=REVIEW&limit=50
 *
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function listCasesController(req, res) {
  try {
    const { severity, action, limit } = req.query;

    // Build filters object
    const filters = {};

    // Validate and apply severity filter
    if (severity) {
      const validSeverities = ['CRITICAL', 'SENSITIVE', 'SAFE'];
      if (!validSeverities.includes(severity)) {
        return res.status(400).json({
          error: 'Invalid severity value',
          validValues: validSeverities
        });
      }
      filters.severity = severity;
    }

    // Validate and apply action filter
    if (action) {
      const validActions = ['BLOCKED', 'REVIEW', 'APPROVED', 'DENIED'];
      if (!validActions.includes(action)) {
        return res.status(400).json({
          error: 'Invalid action value',
          validValues: validActions
        });
      }
      filters.action = action;
    }

    // Validate and apply limit
    if (limit) {
      // SECURITY: Strict validation - only digits allowed (prevents "50abc" from being parsed as 50)
      if (!/^\d+$/.test(limit)) {
        return res.status(400).json({
          error: 'Invalid limit parameter',
          message: 'Limit must be a positive integer (digits only)',
          received: limit,
          validExample: '50'
        });
      }

      const parsedLimit = parseInt(limit, 10);

      if (parsedLimit < 1 || parsedLimit > 1000) {
        return res.status(400).json({
          error: 'Limit out of range',
          message: 'Limit must be between 1 and 1000',
          received: parsedLimit,
          validRange: { min: 1, max: 1000 }
        });
      }

      filters.limit = parsedLimit;
    }

    // Call service layer
    const cases = await guardianCaseService.listCases(filters);

    // Return response
    res.json({
      cases,
      total: cases.length,
      filters: filters
    });
  } catch (error) {
    logger.error('Guardian controller error in listCases', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    res.status(500).json({
      error: 'Failed to list Guardian cases',
      message: error.message
    });
  }
}

/**
 * Approve a Guardian case
 * POST /api/guardian/cases/:caseId/approve
 * Body: { approver: "Name" }
 *
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function approveCaseController(req, res) {
  try {
    const { caseId } = req.params;
    const { approver } = req.body;

    // Validate request body
    if (!approver) {
      return res.status(400).json({
        error: 'Approver name is required',
        field: 'approver'
      });
    }

    // Call service layer
    const updatedCase = await guardianCaseService.approveCase(caseId, approver);

    // Return success response
    res.json({
      case_id: updatedCase.case_id,
      action: updatedCase.action,
      approved_by: updatedCase.approved_by,
      approved_at: updatedCase.approved_at,
      message: `Case ${caseId} approved successfully`
    });
  } catch (error) {
    logger.error('Guardian controller error in approveCase', {
      error: error.message,
      stack: error.stack,
      caseId: req.params.caseId,
      approver: req.body.approver
    });

    // Handle specific error types
    if (error.message === 'Case not found') {
      return res.status(404).json({
        error: 'Case not found',
        caseId: req.params.caseId
      });
    }

    if (
      error.message.includes('Name') ||
      error.message.includes('Invalid case ID') ||
      error.message === 'Case already resolved'
    ) {
      return res.status(400).json({
        error: error.message
      });
    }

    // Generic server error
    res.status(500).json({
      error: 'Failed to approve case',
      message: error.message
    });
  }
}

/**
 * Deny a Guardian case
 * POST /api/guardian/cases/:caseId/deny
 * Body: { denier: "Name", reason: "Reason text" }
 *
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function denyCaseController(req, res) {
  try {
    const { caseId } = req.params;
    const { denier, reason } = req.body;

    // Validate request body
    if (!denier) {
      return res.status(400).json({
        error: 'Denier name is required',
        field: 'denier'
      });
    }

    if (!reason) {
      return res.status(400).json({
        error: 'Denial reason is required',
        field: 'reason'
      });
    }

    // Call service layer
    const updatedCase = await guardianCaseService.denyCase(caseId, denier, reason);

    // Return success response
    res.json({
      case_id: updatedCase.case_id,
      action: updatedCase.action,
      denied_by: updatedCase.denied_by,
      denied_at: updatedCase.denied_at,
      denial_reason: updatedCase.denial_reason,
      message: `Case ${caseId} denied successfully`
    });
  } catch (error) {
    logger.error('Guardian controller error in denyCase', {
      error: error.message,
      stack: error.stack,
      caseId: req.params.caseId,
      denier: req.body.denier
    });

    // Handle specific error types
    if (error.message === 'Case not found') {
      return res.status(404).json({
        error: 'Case not found',
        caseId: req.params.caseId
      });
    }

    if (
      error.message.includes('Name') ||
      error.message.includes('reason') ||
      error.message.includes('Invalid case ID') ||
      error.message === 'Case already resolved'
    ) {
      return res.status(400).json({
        error: error.message
      });
    }

    // Generic server error
    res.status(500).json({
      error: 'Failed to deny case',
      message: error.message
    });
  }
}

module.exports = {
  listCasesController,
  approveCaseController,
  denyCaseController
};
