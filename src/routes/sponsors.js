/**
 * Sponsors API Routes - Brand Safety for Plus Plan Users
 * Issue #859: CRUD endpoints for sponsor management
 */

const express = require('express');
const router = express.Router();
const SponsorService = require('../services/sponsorService');
const { authenticateToken } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planGating');
const { logger } = require('../utils/logger');
const rateLimit = require('express-rate-limit');
const CostControl = require('../services/costControl'); // Issue #859: Cost tracking for tag extraction

// Initialize services
const sponsorService = new SponsorService();
const costControl = new CostControl(); // Issue #859: Cost tracking

// Rate limiter for tag extraction (expensive OpenAI call)
const tagExtractionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many tag extraction requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * POST /api/sponsors
 * Create a new sponsor configuration
 * 
 * Body:
 * - name (string, required): Sponsor name
 * - url (string, optional): Sponsor website
 * - tags (array, optional): Detection tags
 * - severity (string, optional): low, medium, high, zero_tolerance (default: medium)
 * - tone (string, optional): normal, professional, light_humor, aggressive_irony (default: normal)
 * - priority (number, optional): 1 (high) to 5 (low) (default: 3)
 * - actions (array, optional): Actions to apply
 * 
 * Auth: Required (Plus plan)
 */
router.post('/', authenticateToken, requirePlan('plus', { feature: 'brand_safety' }), async (req, res) => {
  try {
    const userId = req.user.id;
    const sponsorData = req.body;

    // Validate required fields
    if (!sponsorData.name || sponsorData.name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Sponsor name is required',
        code: 'SPONSOR_NAME_REQUIRED'
      });
    }

    // Validate severity if provided
    const validSeverities = ['low', 'medium', 'high', 'zero_tolerance'];
    if (sponsorData.severity && !validSeverities.includes(sponsorData.severity)) {
      return res.status(400).json({
        success: false,
        error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
        code: 'INVALID_SEVERITY'
      });
    }

    // Validate tone if provided
    const validTones = ['normal', 'professional', 'light_humor', 'aggressive_irony'];
    if (sponsorData.tone && !validTones.includes(sponsorData.tone)) {
      return res.status(400).json({
        success: false,
        error: `Invalid tone. Must be one of: ${validTones.join(', ')}`,
        code: 'INVALID_TONE'
      });
    }

    // Validate priority if provided
    if (sponsorData.priority && (sponsorData.priority < 1 || sponsorData.priority > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Priority must be between 1 and 5',
        code: 'INVALID_PRIORITY'
      });
    }

    // Create sponsor
    const sponsor = await sponsorService.createSponsor(userId, sponsorData);

    res.status(201).json({
      success: true,
      data: sponsor,
      message: 'Sponsor created successfully'
    });
  } catch (error) {
    logger.error('❌ POST /api/sponsors error:', { error: error.message, userId: req.user?.id });
    
    if (error.message.includes('DUPLICATE')) {
      return res.status(409).json({
        success: false,
        error: 'A sponsor with this name already exists',
        code: 'SPONSOR_DUPLICATE'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create sponsor',
      code: 'SPONSOR_CREATE_ERROR'
    });
  }
});

/**
 * GET /api/sponsors
 * List all sponsors for the authenticated user
 * 
 * Query Parameters:
 * - includeInactive (boolean, optional): Include inactive sponsors (default: false)
 * 
 * Auth: Required (Plus plan)
 */
router.get('/', authenticateToken, requirePlan('plus', { feature: 'brand_safety' }), async (req, res) => {
  try {
    const userId = req.user.id;
    const includeInactive = req.query.includeInactive === 'true';

    const sponsors = await sponsorService.getSponsors(userId, includeInactive);

    res.json({
      success: true,
      data: sponsors,
      count: sponsors.length
    });
  } catch (error) {
    logger.error('❌ GET /api/sponsors error:', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sponsors',
      code: 'SPONSORS_FETCH_ERROR'
    });
  }
});

/**
 * GET /api/sponsors/:id
 * Get a specific sponsor by ID
 * 
 * Params:
 * - id (string, required): Sponsor UUID
 * 
 * Auth: Required (Plus plan)
 */
router.get('/:id', authenticateToken, requirePlan('plus', { feature: 'brand_safety' }), async (req, res) => {
  try {
    const userId = req.user.id;
    const sponsorId = req.params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sponsorId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sponsor ID format',
        code: 'INVALID_SPONSOR_ID'
      });
    }

    const sponsor = await sponsorService.getSponsorById(sponsorId, userId);

    if (!sponsor) {
      return res.status(404).json({
        success: false,
        error: 'Sponsor not found',
        code: 'SPONSOR_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: sponsor
    });
  } catch (error) {
    logger.error('❌ GET /api/sponsors/:id error:', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sponsor',
      code: 'SPONSOR_FETCH_ERROR'
    });
  }
});

/**
 * PUT /api/sponsors/:id
 * Update a sponsor
 * 
 * Params:
 * - id (string, required): Sponsor UUID
 * 
 * Body: Any sponsor fields to update
 * 
 * Auth: Required (Plus plan)
 */
router.put('/:id', authenticateToken, requirePlan('plus', { feature: 'brand_safety' }), async (req, res) => {
  try {
    const userId = req.user.id;
    const sponsorId = req.params.id;
    const updates = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sponsorId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sponsor ID format',
        code: 'INVALID_SPONSOR_ID'
      });
    }

    // Validate severity if provided
    const validSeverities = ['low', 'medium', 'high', 'zero_tolerance'];
    if (updates.severity && !validSeverities.includes(updates.severity)) {
      return res.status(400).json({
        success: false,
        error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
        code: 'INVALID_SEVERITY'
      });
    }

    // Validate tone if provided
    const validTones = ['normal', 'professional', 'light_humor', 'aggressive_irony'];
    if (updates.tone && !validTones.includes(updates.tone)) {
      return res.status(400).json({
        success: false,
        error: `Invalid tone. Must be one of: ${validTones.join(', ')}`,
        code: 'INVALID_TONE'
      });
    }

    // Update sponsor
    const sponsor = await sponsorService.updateSponsor(sponsorId, userId, updates);

    res.json({
      success: true,
      data: sponsor,
      message: 'Sponsor updated successfully'
    });
  } catch (error) {
    logger.error('❌ PUT /api/sponsors/:id error:', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update sponsor',
      code: 'SPONSOR_UPDATE_ERROR'
    });
  }
});

/**
 * DELETE /api/sponsors/:id
 * Delete a sponsor
 * 
 * Params:
 * - id (string, required): Sponsor UUID
 * 
 * Auth: Required (Plus plan)
 */
router.delete('/:id', authenticateToken, requirePlan('plus', { feature: 'brand_safety' }), async (req, res) => {
  try {
    const userId = req.user.id;
    const sponsorId = req.params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sponsorId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sponsor ID format',
        code: 'INVALID_SPONSOR_ID'
      });
    }

    // Delete sponsor
    await sponsorService.deleteSponsor(sponsorId, userId);

    res.json({
      success: true,
      message: 'Sponsor deleted successfully'
    });
  } catch (error) {
    logger.error('❌ DELETE /api/sponsors/:id error:', { error: error.message, userId: req.user?.id });
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete sponsor',
      code: 'SPONSOR_DELETE_ERROR'
    });
  }
});

/**
 * POST /api/sponsors/extract-tags
 * Extract tags from sponsor URL using AI
 * 
 * Body:
 * - url (string, required): Sponsor website URL
 * 
 * Auth: Required (Plus plan)
 * Rate Limit: 5 requests/minute
 */
router.post('/extract-tags', authenticateToken, requirePlan('plus'), tagExtractionLimiter, async (req, res) => {
  try {
    const { url } = req.body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
        code: 'URL_REQUIRED'
      });
    }

    // Extract tags
    const tags = await sponsorService.extractTagsFromURL(url);

    // Issue #859: Record usage for cost tracking
    try {
      const userId = req.user.id;
      // Get user's organization
      const { data: userOrg } = await sponsorService.supabase
        .from('users')
        .select('organization_id')
        .eq('id', userId)
        .single();
      
      if (userOrg && userOrg.organization_id) {
        await costControl.recordUsage(
          userOrg.organization_id,
          'api',
          'extract_sponsor_tags',
          {
            url: url,
            tagsCount: tags.length
          },
          userId,
          1
        );
        logger.info('✅ Recorded tag extraction usage', { userId, tagsCount: tags.length });
      }
    } catch (trackingError) {
      // Non-blocking: log but don't fail the request
      logger.warn('⚠️  Failed to record tag extraction usage', {
        error: trackingError.message,
        userId: req.user.id
      });
    }

    res.json({
      success: true,
      data: {
        url: url,
        tags: tags,
        count: tags.length
      },
      message: `Extracted ${tags.length} tags successfully`
    });
  } catch (error) {
    logger.error('❌ POST /api/sponsors/extract-tags error:', { error: error.message, userId: req.user?.id });
    
    // Handle specific errors
    if (error.message.includes('INVALID_URL')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format. Must be a valid HTTP/HTTPS URL.',
        code: 'INVALID_URL'
      });
    }
    
    if (error.message.includes('FETCH_TIMEOUT')) {
      return res.status(408).json({
        success: false,
        error: 'URL fetch timeout. Please check the URL and try again.',
        code: 'FETCH_TIMEOUT'
      });
    }
    
    if (error.message.includes('OPENAI_UNAVAILABLE')) {
      return res.status(503).json({
        success: false,
        error: 'Tag extraction service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to extract tags from URL',
      code: 'TAG_EXTRACTION_ERROR'
    });
  }
});

module.exports = router;
