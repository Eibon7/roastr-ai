/**
 * Sponsors API Routes (Brand Safety - Plan Plus)
 *
 * REST API for sponsor/brand management:
 * - POST /api/sponsors - Create sponsor
 * - GET /api/sponsors - List sponsors
 * - GET /api/sponsors/:id - Get single sponsor
 * - PUT /api/sponsors/:id - Update sponsor
 * - DELETE /api/sponsors/:id - Delete sponsor
 * - POST /api/sponsors/extract-tags - Extract tags from URL (OpenAI)
 *
 * Access Control:
 * - Authentication: Required (JWT)
 * - Plan: Plus plan required (via requirePlan middleware)
 * - Tenant isolation: Via user_id from JWT token
 *
 * Rate Limiting:
 * - Tag extraction: 5 requests/min per user (via express-rate-limit)
 *
 * @see src/services/sponsorService.js
 * @see docs/plan/issue-859.md
 */

const express = require('express');
const SponsorService = require('../services/sponsorService');
const { authenticateToken } = require('../middleware/auth');
const { requirePlan } = require('../middleware/requirePlan');
const CostControl = require('../services/costControl');
const { logger } = require('../utils/logger');
const rateLimit = require('express-rate-limit');

/**
 * Factory function to create sponsors router with dependency injection
 * @param {Object} services - Injected services (for testing)
 * @param {SponsorService} services.sponsorService - Sponsor service instance
 * @param {CostControl} services.costControl - Cost control instance
 * @returns {express.Router} Configured router
 */
function createSponsorsRouter(services = {}) {
  const router = express.Router();
  
  // Use injected services or create default instances
  const sponsorService = services.sponsorService || new SponsorService();
  const costControl = services.costControl || new CostControl();

  // Rate limiter for tag extraction (expensive OpenAI operation)
  const tagExtractionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: 'RATE_LIMIT_EXCEEDED: Too many tag extraction requests, try again later',
    standardHeaders: true,
    legacyHeaders: false
  });

  // ============================================================================
  // MIDDLEWARE: All routes require authentication + Plus plan
  // ============================================================================

  router.use(authenticateToken);
  router.use(requirePlan('plus', { feature: 'brand_safety' }));

  // ============================================================================
  // ROUTES
  // ============================================================================

  /**
  * POST /api/sponsors
  * Create a new sponsor
  *
  * Body:
  * {
  *   "name": "Nike",
  *   "url": "https://www.nike.com", // optional
  *   "tags": ["sportswear", "sneakers"], // optional
  *   "severity": "high", // low, medium, high, zero_tolerance (default: medium)
  *   "tone": "professional", // normal, professional, light_humor, aggressive_irony (default: normal)
  *   "priority": 1, // 1 (high) to 5 (low), default 3
  *   "actions": ["hide_comment", "def_roast"] // optional array
  * }
  *
  * Response 201:
  * {
  *   "success": true,
  *   "data": { id, user_id, name, url, tags, severity, tone, priority, actions, active, created_at, updated_at }
  * }
  */
  router.post('/', async (req, res) => {
    try {
      const userId = req.user.id;
      const sponsorData = req.body;

      const sponsor = await sponsorService.createSponsor(userId, sponsorData);

      res.status(201).json({
        success: true,
        data: sponsor
      });

    } catch (error) {
      logger.error('Failed to create sponsor', {
        userId: req.user.id,
        error: error.message
      });

      if (error.message === 'USER_ID_REQUIRED' || error.message === 'SPONSOR_NAME_REQUIRED') {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message
        });
      }

      if (error.message.includes('INVALID_PRIORITY')) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to create sponsor'
      });
    }
  });

  /**
  * GET /api/sponsors
  * List all sponsors for authenticated user
  *
  * Query params:
  * - includeInactive (boolean): Include inactive sponsors (default: false)
  *
  * Response 200:
  * {
  *   "success": true,
  *   "data": [ ...sponsors ],
  *   "count": 5
  * }
  */
  router.get('/', async (req, res) => {
    try {
      const userId = req.user.id;
      const includeInactive = req.query.includeInactive === 'true';

      const sponsors = await sponsorService.getSponsors(userId, includeInactive);

      res.status(200).json({
        success: true,
        data: sponsors,
        count: sponsors.length
      });

    } catch (error) {
      logger.error('Failed to list sponsors', {
        userId: req.user.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to list sponsors'
      });
    }
  });

  /**
  * GET /api/sponsors/:id
  * Get a single sponsor by ID
  *
  * Response 200:
  * {
  *   "success": true,
  *   "data": { ...sponsor }
  * }
  *
  * Response 404: Sponsor not found
  */
  router.get('/:id', async (req, res) => {
    try {
      const userId = req.user.id;
      const sponsorId = req.params.id;

      const sponsor = await sponsorService.getSponsor(sponsorId, userId);

      if (!sponsor) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Sponsor not found'
        });
      }

      res.status(200).json({
        success: true,
        data: sponsor
      });

    } catch (error) {
      logger.error('Failed to get sponsor', {
        userId: req.user.id,
        sponsorId: req.params.id,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to get sponsor'
      });
    }
  });

  /**
  * PUT /api/sponsors/:id
  * Update a sponsor
  *
  * Body: Partial sponsor object (any of name, url, tags, severity, tone, priority, actions, active)
  *
  * Response 200:
  * {
  *   "success": true,
  *   "data": { ...updated sponsor }
  * }
  *
  * Response 404: Sponsor not found
  */
  router.put('/:id', async (req, res) => {
    try {
      const userId = req.user.id;
      const sponsorId = req.params.id;
      const updates = req.body;

      const sponsor = await sponsorService.updateSponsor(sponsorId, userId, updates);

      if (!sponsor) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Sponsor not found'
        });
      }

      res.status(200).json({
        success: true,
        data: sponsor
      });

    } catch (error) {
      logger.error('Failed to update sponsor', {
        userId: req.user.id,
        sponsorId: req.params.id,
        error: error.message
      });

      if (error.message.includes('INVALID_PRIORITY')) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to update sponsor'
      });
    }
  });

  /**
  * DELETE /api/sponsors/:id
  * Delete a sponsor
  *
  * Response 200:
  * {
  *   "success": true,
  *   "message": "Sponsor deleted successfully"
  * }
  *
  * Response 404: Sponsor not found
  */
  router.delete('/:id', async (req, res) => {
    try {
      const userId = req.user.id;
      const sponsorId = req.params.id;

      await sponsorService.deleteSponsor(sponsorId, userId);

      res.status(200).json({
        success: true,
        message: 'Sponsor deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete sponsor', {
        userId: req.user.id,
        sponsorId: req.params.id,
        error: error.message
      });

      if (error.message === 'SPONSOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Sponsor not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to delete sponsor'
      });
    }
  });

  /**
  * POST /api/sponsors/extract-tags
  * Extract relevant tags from a sponsor URL using OpenAI
  *
  * Rate limited: 5 requests/min per user
  * Cost tracked: 2 cents per extraction (via CostControl)
  *
  * Body:
  * {
  *   "url": "https://www.nike.com"
  * }
  *
  * Response 200:
  * {
  *   "success": true,
  *   "data": {
  *     "url": "https://www.nike.com",
  *     "tags": ["sportswear", "athletics", "sneakers", "apparel", "sports"]
  *   }
  * }
  *
  * Response 400: Invalid URL or missing URL
  * Response 429: Rate limit exceeded
  * Response 500: OpenAI error or internal error
  */
  router.post('/extract-tags', tagExtractionLimiter, async (req, res) => {
    try {
      const userId = req.user.id;
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'URL is required'
        });
      }

      // Record usage BEFORE extraction (avoid free abuse on errors)
      await costControl.recordUsage(userId, 'extract_sponsor_tags');

      // Extract tags
      const tags = await sponsorService.extractTagsFromURL(url);

      res.status(200).json({
        success: true,
        data: {
          url,
          tags
        }
      });

    } catch (error) {
      logger.error('Failed to extract tags from URL', {
        userId: req.user.id,
        url: req.body.url,
        error: error.message
      });

      if (error.message === 'URL_REQUIRED' || error.message === 'INVALID_URL') {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message
        });
      }

      if (error.message === 'OPENAI_UNAVAILABLE') {
        return res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: 'OpenAI service is not configured'
        });
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to extract tags from URL'
      });
    }
  });

  return router;
}

// Export factory function for testing
module.exports = createSponsorsRouter;

// Also export as default for backward compatibility
module.exports.default = createSponsorsRouter();
