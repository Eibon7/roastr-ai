/**
 * Persona Routes
 *
 * REST API endpoints for user persona management
 *
 * Endpoints:
 * - GET /api/persona - Retrieve current user's persona
 * - POST /api/persona - Create/update persona
 * - DELETE /api/persona - Delete persona (GDPR compliance)
 *
 * @see docs/plan/issue-595.md for API specification
 * @see src/services/PersonaService.js for business logic
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const PersonaService = require('../services/PersonaService');
const { logger } = require('../utils/logger');
const { createPersonaSchema } = require('../validators/zod/persona.schema');
const { formatZodError, isZodError } = require('../validators/zod/formatZodError');

const router = express.Router();

/**
 * GET /api/persona
 *
 * Retrieve current user's persona (decrypted)
 *
 * @auth Required (JWT)
 * @returns {Object} persona - Decrypted persona fields + metadata
 *
 * Response format:
 * {
 *   success: true,
 *   data: {
 *     lo_que_me_define: "text",
 *     lo_que_no_tolero: "text",
 *     lo_que_me_da_igual: "text",
 *     metadata: {
 *       lo_que_me_define_updated_at: "timestamp",
 *       embeddings_generated_at: "timestamp",
 *       plan: "pro"
 *     }
 *   }
 * }
 */
router.get('/api/persona', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const persona = await PersonaService.getPersona(userId);

    res.json({
      success: true,
      data: persona
    });
  } catch (error) {
    logger.error('GET /api/persona failed', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve persona',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/persona
 *
 * Create or update user's persona
 *
 * @auth Required (JWT)
 * @body {Object} persona - Persona fields to update
 * @returns {Object} result - Success status
 *
 * Request body:
 * {
 *   lo_que_me_define: "Soy developer sarcástico",
 *   lo_que_no_tolero: "Body shaming",
 *   lo_que_me_da_igual: "Humor negro"
 * }
 *
 * Response format:
 * {
 *   success: true,
 *   data: {
 *     fieldsUpdated: ["lo_que_me_define", "lo_que_no_tolero"]
 *   }
 * }
 *
 * Error responses:
 * - 400: Validation error (invalid input)
 * - 403: Plan restriction (field not available for user's plan)
 * - 500: Internal error
 */
router.post('/api/persona', authenticateToken, async (req, res) => {
  try {
    // Validate input with Zod (Issue #942)
    const validatedData = createPersonaSchema.parse(req.body);

    const userId = req.user.id;
    const { lo_que_me_define, lo_que_no_tolero, lo_que_me_da_igual } = validatedData;

    // Get user plan (from JWT or database)
    let userPlan = req.user.plan;

    // If plan not in JWT, fetch from database
    if (!userPlan) {
      const { data: user, error: userError } = await require('../config')
        .supabaseServiceClient.from('users')
        .select('plan')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('Failed to retrieve user plan');
      }

      userPlan = user.plan;
    }

    // Update persona
    const result = await PersonaService.updatePersona(
      userId,
      { lo_que_me_define, lo_que_no_tolero, lo_que_me_da_igual },
      userPlan
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle Zod validation errors (Issue #942)
    if (isZodError(error)) {
      logger.warn('POST /api/persona validation failed', {
        userId: req.user?.id,
        errors: error.issues
      });
      return res.status(400).json(formatZodError(error));
    }

    logger.error('POST /api/persona failed', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    // Handle plan restriction errors
    if (error.message.includes('PLAN_RESTRICTION')) {
      return res.status(403).json({
        success: false,
        error: error.message,
        code: 'PLAN_RESTRICTION',
        upgrade_url: '/pricing'
      });
    }

    // Handle character limit errors
    if (error.message.includes('CHARACTER_LIMIT_EXCEEDED')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: 'CHARACTER_LIMIT_EXCEEDED'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update persona',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/persona
 *
 * Delete user's persona (GDPR compliance)
 *
 * Sets all persona fields to NULL.
 * Embeddings are also removed.
 *
 * @auth Required (JWT)
 * @returns {void} 204 No Content on success
 *
 * Response:
 * - 204: No Content (success)
 * - 500: Internal error
 */
router.delete('/api/persona', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await PersonaService.deletePersona(userId);

    // 204 No Content (successful deletion)
    res.status(204).send();
  } catch (error) {
    logger.error('DELETE /api/persona failed', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete persona',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/persona/health
 *
 * Health check for persona service
 *
 * @public No authentication required
 * @returns {Object} health - Service health status
 */
router.get('/api/persona/health', async (req, res) => {
  try {
    const health = await PersonaService.healthCheck();

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
