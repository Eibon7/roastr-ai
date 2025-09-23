/**
 * Tier Validation Routes
 * Issue #368: SPEC 10 — Límites por tier (análisis, roasts, cuentas por red) + gating de features
 * 
 * Provides API endpoints for validating tier limits and feature access
 */

const express = require('express');
const router = express.Router();
const tierValidationService = require('../services/tierValidationService');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { generalRateLimit } = require('../middleware/security');
const { supabaseServiceClient } = require('../config/supabase');

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(generalRateLimit);

/**
 * Helper function to validate organization membership
 * @param {string} userId - User ID from auth token
 * @param {string} organizationId - Organization ID from request (optional)
 * @returns {Promise<{success: boolean, organizationId?: string, error?: string}>}
 */
async function validateOrganizationAccess(userId, organizationId = null) {
    try {
        // If no organizationId provided, get user's primary organization
        if (!organizationId) {
            const { data: membership, error } = await supabaseServiceClient
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();
            
            if (error || !membership) {
                return { 
                    success: false, 
                    error: 'No active organization membership found' 
                };
            }
            
            return { 
                success: true, 
                organizationId: membership.organization_id 
            };
        }
        
        // Validate user belongs to specified organization
        const { data: membership, error } = await supabaseServiceClient
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', userId)
            .eq('organization_id', organizationId)
            .eq('status', 'active')
            .single();
        
        if (error || !membership) {
            return { 
                success: false, 
                error: 'User does not have access to specified organization' 
            };
        }
        
        return { 
            success: true, 
            organizationId: organizationId 
        };
        
    } catch (error) {
        logger.error('Error validating organization access:', error);
        return { 
            success: false, 
            error: 'Internal error validating organization access' 
        };
    }
}

/**
 * POST /api/tier-validation/action
 * Validate if user can perform a specific action
 */
router.post('/action', async (req, res) => {
    try {
        const { action, options = {}, organizationId } = req.body;
        const userId = req.user.id;

        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'Action type is required'
            });
        }

        // Validate organization access
        const orgValidation = await validateOrganizationAccess(userId, organizationId);
        if (!orgValidation.success) {
            return res.status(403).json({
                success: false,
                error: orgValidation.error,
                code: 'ORGANIZATION_ACCESS_DENIED'
            });
        }

        const validation = await tierValidationService.validateAction(userId, action, {
            ...options,
            organizationId: orgValidation.organizationId
        });

        // Return appropriate status code based on validation result
        const statusCode = validation.allowed ? 200 : 403;

        res.status(statusCode).json({
            success: validation.allowed,
            data: {
                ...validation,
                organizationId: orgValidation.organizationId
            }
        });

    } catch (error) {
        logger.error('Error in action validation endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during validation'
        });
    }
});

/**
 * POST /api/tier-validation/feature
 * Validate if user has access to a specific feature
 */
router.post('/feature', async (req, res) => {
    try {
        const { feature, organizationId } = req.body;
        const userId = req.user.id;

        if (!feature) {
            return res.status(400).json({
                success: false,
                error: 'Feature name is required'
            });
        }

        // Validate organization access
        const orgValidation = await validateOrganizationAccess(userId, organizationId);
        if (!orgValidation.success) {
            return res.status(403).json({
                success: false,
                error: orgValidation.error,
                code: 'ORGANIZATION_ACCESS_DENIED'
            });
        }

        const validation = await tierValidationService.validateFeature(userId, feature, {
            organizationId: orgValidation.organizationId
        });

        // Return appropriate status code based on validation result
        const statusCode = validation.available ? 200 : 403;

        res.status(statusCode).json({
            success: validation.available,
            data: {
                ...validation,
                organizationId: orgValidation.organizationId
            }
        });

    } catch (error) {
        logger.error('Error in feature validation endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during feature validation'
        });
    }
});

/**
 * GET /api/tier-validation/tier
 * Get user's current tier information with usage data
 */
router.get('/tier', async (req, res) => {
    try {
        const userId = req.user.id;
        const { organizationId } = req.query;

        // Validate organization access
        const orgValidation = await validateOrganizationAccess(userId, organizationId);
        if (!orgValidation.success) {
            return res.status(403).json({
                success: false,
                error: orgValidation.error,
                code: 'ORGANIZATION_ACCESS_DENIED'
            });
        }

        const userTier = await tierValidationService.getUserTierWithUTC(userId);
        const currentUsage = await tierValidationService.getCurrentUsage ? 
            await tierValidationService.getCurrentUsage(userId, { organizationId: orgValidation.organizationId }) : 
            await tierValidationService.getUserUsage(userId, userTier);

        // Sanitize usage data for response
        const sanitizedUsage = tierValidationService.sanitizeUsageForResponse(currentUsage);

        res.json({
            success: true,
            data: {
                tier: userTier,
                usage: sanitizedUsage,
                organizationId: orgValidation.organizationId
            }
        });

    } catch (error) {
        logger.error('Error in tier info endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error retrieving tier information'
        });
    }
});

/**
 * POST /api/tier-validation/upgrade
 * Handle tier upgrade with immediate limit reset
 */
router.post('/upgrade', async (req, res) => {
    try {
        const { newTier, oldTier, metadata = {}, organizationId } = req.body;
        const userId = req.user.id;

        if (!newTier || !oldTier) {
            return res.status(400).json({
                success: false,
                error: 'Both newTier and oldTier are required'
            });
        }

        // Validate organization access
        const orgValidation = await validateOrganizationAccess(userId, organizationId);
        if (!orgValidation.success) {
            return res.status(403).json({
                success: false,
                error: orgValidation.error,
                code: 'ORGANIZATION_ACCESS_DENIED'
            });
        }

        const result = await tierValidationService.handleTierUpgrade(userId, newTier, oldTier, {
            ...metadata,
            organizationId: orgValidation.organizationId
        });
        
        // Cache invalidation is handled automatically in handleTierUpgrade
        // No additional invalidation needed here

        res.json({
            success: true,
            data: {
                ...result,
                organizationId: orgValidation.organizationId
            }
        });

    } catch (error) {
        logger.error('Error in tier upgrade endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during tier upgrade'
        });
    }
});

/**
 * POST /api/tier-validation/downgrade
 * Handle tier downgrade with billing cycle delay
 */
router.post('/downgrade', async (req, res) => {
    try {
        const { newTier, oldTier, metadata = {}, organizationId } = req.body;
        const userId = req.user.id;

        if (!newTier || !oldTier) {
            return res.status(400).json({
                success: false,
                error: 'Both newTier and oldTier are required'
            });
        }

        // Validate organization access
        const orgValidation = await validateOrganizationAccess(userId, organizationId);
        if (!orgValidation.success) {
            return res.status(403).json({
                success: false,
                error: orgValidation.error,
                code: 'ORGANIZATION_ACCESS_DENIED'
            });
        }

        const result = await tierValidationService.handleTierDowngradeEnhanced ? 
            await tierValidationService.handleTierDowngradeEnhanced(userId, newTier, oldTier, {
                ...metadata,
                organizationId: orgValidation.organizationId
            }) :
            await tierValidationService.handleTierDowngrade(userId, newTier, oldTier, {
                ...metadata,
                organizationId: orgValidation.organizationId
            });

        res.json({
            success: true,
            data: {
                ...result,
                organizationId: orgValidation.organizationId
            }
        });

    } catch (error) {
        logger.error('Error in tier downgrade endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during tier downgrade'
        });
    }
});

/**
 * POST /api/tier-validation/record-usage
 * Record usage action atomically
 */
router.post('/record-usage', async (req, res) => {
    try {
        const { actionType, metadata = {}, organizationId } = req.body;
        const userId = req.user.id;

        if (!actionType) {
            return res.status(400).json({
                success: false,
                error: 'Action type is required'
            });
        }

        // Validate organization access
        const orgValidation = await validateOrganizationAccess(userId, organizationId);
        if (!orgValidation.success) {
            return res.status(403).json({
                success: false,
                error: orgValidation.error,
                code: 'ORGANIZATION_ACCESS_DENIED'
            });
        }

        const recorded = await tierValidationService.recordUsageActionAtomic(userId, actionType, {
            ...metadata,
            organizationId: orgValidation.organizationId
        });
        
        // Cache invalidation is handled automatically in recordUsageActionAtomic
        // No additional invalidation needed here

        res.json({
            success: recorded,
            data: { 
                recorded,
                organizationId: orgValidation.organizationId,
                cacheInvalidated: recorded // Cache is invalidated when recording succeeds
            }
        });

    } catch (error) {
        logger.error('Error in record usage endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error recording usage'
        });
    }
});

/**
 * POST /api/tier-validation/record-usage-batch
 * Record multiple usage actions in batch
 */
router.post('/record-usage-batch', async (req, res) => {
    try {
        const { actions, organizationId } = req.body;
        const userId = req.user.id;

        if (!Array.isArray(actions)) {
            return res.status(400).json({
                success: false,
                error: 'Actions array is required'
            });
        }

        // Validate organization access
        const orgValidation = await validateOrganizationAccess(userId, organizationId);
        if (!orgValidation.success) {
            return res.status(403).json({
                success: false,
                error: orgValidation.error,
                code: 'ORGANIZATION_ACCESS_DENIED'
            });
        }

        // Add organizationId to all actions
        const actionsWithOrg = actions.map(action => ({
            ...action,
            metadata: {
                ...action.metadata,
                organizationId: orgValidation.organizationId
            }
        }));

        const result = await tierValidationService.recordUsageActionsBatch(userId, actionsWithOrg);
        
        // Cache invalidation is handled automatically in recordUsageActionsBatch
        // No additional invalidation needed here

        res.json({
            success: result.success > 0,
            data: {
                ...result,
                organizationId: orgValidation.organizationId,
                cacheInvalidated: result.success > 0 // Cache is invalidated when at least one record succeeds
            }
        });

    } catch (error) {
        logger.error('Error in batch record usage endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error recording batch usage'
        });
    }
});

/**
 * POST /api/tier-validation/check-feature
 * Check feature access based on tier limits (public method)
 */
router.post('/check-feature', async (req, res) => {
    try {
        const { feature, tierLimits, planId, organizationId } = req.body;
        const userId = req.user.id;

        if (!feature || !tierLimits || !planId) {
            return res.status(400).json({
                success: false,
                error: 'Feature, tierLimits, and planId are required'
            });
        }

        // Optional organization validation for enhanced security
        let validatedOrgId = null;
        if (organizationId) {
            const orgValidation = await validateOrganizationAccess(userId, organizationId);
            if (!orgValidation.success) {
                return res.status(403).json({
                    success: false,
                    error: orgValidation.error,
                    code: 'ORGANIZATION_ACCESS_DENIED'
                });
            }
            validatedOrgId = orgValidation.organizationId;
        }

        const result = tierValidationService.checkFeatureAccess(feature, tierLimits, planId);

        res.json({
            success: true,
            data: {
                ...result,
                organizationId: validatedOrgId
            }
        });

    } catch (error) {
        logger.error('Error in check feature endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error checking feature access'
        });
    }
});

/**
 * GET /api/tier-validation/health
 * Health check endpoint for tier validation service
 */
router.get('/health', async (req, res) => {
    try {
        // Basic health check - verify service functionality
        const testUsage = {
            roastsThisMonth: 5,
            analysisThisMonth: 10,
            platformAccounts: { twitter: 1, youtube: 1 }
        };

        const sanitized = tierValidationService.sanitizeUsageForResponse(testUsage);
        
        const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'tier-validation',
            version: '1.0.0',
            testResult: sanitized
        };

        res.json({
            success: true,
            data: healthStatus
        });

    } catch (error) {
        logger.error('Error in tier validation health check:', error);
        res.status(503).json({
            success: false,
            error: 'Service unhealthy',
            data: {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                service: 'tier-validation'
            }
        });
    }
});

module.exports = router;