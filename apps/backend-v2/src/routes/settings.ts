/**
 * Settings API Routes - v2
 *
 * Public endpoint for retrieving SSOT settings safe for frontend consumption.
 *
 * @module routes/settings
 */

import { Router, Request, Response } from 'express';
import { getPublicSettings } from '../lib/loadSettings';

const router = Router();

/**
 * GET /api/v2/settings/public
 *
 * Returns public settings from SSOT that are safe to expose to frontend.
 *
 * Filters out:
 * - Internal configuration
 * - Security-sensitive values
 * - Admin-only settings
 *
 * Returns:
 * - Plan limits and features
 * - Platform constraints
 * - Roasting configuration (public parts)
 * - Response frequency options
 *
 * @route GET /api/v2/settings/public
 * @access Public (no authentication required for public settings)
 *
 * @example
 * GET /api/v2/settings/public
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "plans": {
 *       "starter": { "monthly_limit": 100, "features": [...] },
 *       "pro": { "monthly_limit": 500, "features": [...] }
 *     },
 *     "platforms": { ... },
 *     "roasting": { "supported_tones": [...] },
 *     "response_frequency": { ... }
 *   }
 * }
 */
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const publicSettings = await getPublicSettings();

    res.json({
      success: true,
      data: publicSettings
    });
  } catch (error: any) {
    console.error('Error loading public settings:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to load public settings',
      message: error.message
    });
  }
});

export default router;
