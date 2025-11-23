/**
 * Admin Routes: Roast Tones Management
 *
 * CRUD endpoints for dynamic tone configuration.
 * Requires admin authentication.
 *
 * Issue #876: Dynamic Roast Tone Configuration System
 */

const express = require('express');
const { getToneConfigService } = require('../../services/toneConfigService');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { logger } = require('../../utils/logger');

const router = express.Router();
const toneService = getToneConfigService();

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/tones
 * List all tones (active + inactive)
 *
 * @returns {200} { success: true, data: Array<Tone> }
 * @returns {500} { success: false, error: string }
 */
router.get('/', async (req, res) => {
  try {
    logger.info('Admin fetching all tones', { userId: req.user.id });

    const tones = await toneService.getAllTones();

    logger.info('All tones fetched successfully', {
      userId: req.user.id,
      count: tones.length
    });

    return res.json({
      success: true,
      data: tones
    });
  } catch (error) {
    logger.error('Error fetching all tones', {
      userId: req.user.id,
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tones',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/tones/:id
 * Get single tone by ID
 *
 * @param {string} id - Tone UUID
 * @returns {200} { success: true, data: Tone }
 * @returns {404} { success: false, error: 'Tone not found' }
 * @returns {500} { success: false, error: string }
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Admin fetching tone', { userId: req.user.id, toneId: id });

    const tone = await toneService.getToneById(id);

    logger.info('Tone fetched successfully', {
      userId: req.user.id,
      toneId: id,
      toneName: tone.name
    });

    return res.json({
      success: true,
      data: tone
    });
  } catch (error) {
    logger.error('Error fetching tone', {
      userId: req.user.id,
      toneId: req.params.id,
      error: error.message
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tone',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/admin/tones
 * Create new tone
 *
 * @body {Object} toneData - Tone configuration
 * @returns {201} { success: true, data: Tone }
 * @returns {400} { success: false, error: 'Validation failed' }
 * @returns {409} { success: false, error: 'Tone name already exists' }
 * @returns {500} { success: false, error: string }
 */
router.post('/', async (req, res) => {
  try {
    const toneData = {
      ...req.body,
      created_by: req.user.id
    };

    logger.info('Admin creating tone', {
      userId: req.user.id,
      toneName: toneData.name
    });

    const created = await toneService.createTone(toneData);

    logger.info('Tone created successfully', {
      userId: req.user.id,
      toneId: created.id,
      toneName: created.name
    });

    return res.status(201).json({
      success: true,
      data: created
    });
  } catch (error) {
    logger.error('Error creating tone', {
      userId: req.user.id,
      toneName: req.body.name,
      error: error.message
    });

    if (error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to create tone',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/admin/tones/:id
 * Update existing tone
 *
 * @param {string} id - Tone UUID
 * @body {Object} updates - Fields to update
 * @returns {200} { success: true, data: Tone }
 * @returns {400} { success: false, error: 'Validation failed' }
 * @returns {404} { success: false, error: 'Tone not found' }
 * @returns {409} { success: false, error: 'Tone name already exists' }
 * @returns {500} { success: false, error: string }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    logger.info('Admin updating tone', {
      userId: req.user.id,
      toneId: id,
      fields: Object.keys(updates)
    });

    const updated = await toneService.updateTone(id, updates);

    logger.info('Tone updated successfully', {
      userId: req.user.id,
      toneId: id,
      toneName: updated.name
    });

    return res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Error updating tone', {
      userId: req.user.id,
      toneId: req.params.id,
      error: error.message
    });

    if (error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to update tone',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/admin/tones/:id
 * Delete tone
 *
 * @param {string} id - Tone UUID
 * @returns {200} { success: true, message: 'Tone deleted' }
 * @returns {400} { success: false, error: 'Cannot delete last active tone' }
 * @returns {404} { success: false, error: 'Tone not found' }
 * @returns {500} { success: false, error: string }
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Admin deleting tone', { userId: req.user.id, toneId: id });

    await toneService.deleteTone(id);

    logger.info('Tone deleted successfully', {
      userId: req.user.id,
      toneId: id
    });

    return res.json({
      success: true,
      message: 'Tone deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting tone', {
      userId: req.user.id,
      toneId: req.params.id,
      error: error.message
    });

    if (error.message.includes('last active tone')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to delete tone',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/admin/tones/:id/activate
 * Activate tone
 *
 * @param {string} id - Tone UUID
 * @returns {200} { success: true, data: Tone }
 * @returns {404} { success: false, error: 'Tone not found' }
 * @returns {500} { success: false, error: string }
 */
router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Admin activating tone', { userId: req.user.id, toneId: id });

    const activated = await toneService.activateTone(id);

    logger.info('Tone activated successfully', {
      userId: req.user.id,
      toneId: id,
      toneName: activated.name
    });

    return res.json({
      success: true,
      data: activated
    });
  } catch (error) {
    logger.error('Error activating tone', {
      userId: req.user.id,
      toneId: req.params.id,
      error: error.message
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to activate tone',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/admin/tones/:id/deactivate
 * Deactivate tone
 *
 * @param {string} id - Tone UUID
 * @returns {200} { success: true, data: Tone }
 * @returns {400} { success: false, error: 'Cannot deactivate last active tone' }
 * @returns {404} { success: false, error: 'Tone not found' }
 * @returns {500} { success: false, error: string }
 */
router.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Admin deactivating tone', { userId: req.user.id, toneId: id });

    const deactivated = await toneService.deactivateTone(id);

    logger.info('Tone deactivated successfully', {
      userId: req.user.id,
      toneId: id,
      toneName: deactivated.name
    });

    return res.json({
      success: true,
      data: deactivated
    });
  } catch (error) {
    logger.error('Error deactivating tone', {
      userId: req.user.id,
      toneId: req.params.id,
      error: error.message
    });

    if (error.message.includes('last active tone')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to deactivate tone',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /api/admin/tones/reorder
 * Reorder tones
 *
 * @body {Array<{id: string, sort_order: number}>} orderArray - New sort order
 * @returns {200} { success: true, data: Array<Tone> }
 * @returns {400} { success: false, error: 'Invalid order array' }
 * @returns {500} { success: false, error: string }
 */
router.put('/reorder', async (req, res) => {
  try {
    const { orderArray } = req.body;

    if (!Array.isArray(orderArray)) {
      return res.status(400).json({
        success: false,
        error: 'orderArray must be an array'
      });
    }

    logger.info('Admin reordering tones', {
      userId: req.user.id,
      count: orderArray.length
    });

    const reordered = await toneService.reorderTones(orderArray);

    logger.info('Tones reordered successfully', {
      userId: req.user.id,
      count: reordered.length
    });

    return res.json({
      success: true,
      data: reordered
    });
  } catch (error) {
    logger.error('Error reordering tones', {
      userId: req.user.id,
      error: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to reorder tones',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
