/**
 * Roast API routes
 * Provides endpoints for roast generation with OpenAI integration,
 * Perspective API moderation, and comprehensive rate limiting
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { flags } = require('../config/flags');
const RoastGeneratorEnhanced = require('../services/roastGeneratorEnhanced');
const RoastGeneratorMock = require('../services/roastGeneratorMock');
const { supabaseServiceClient } = require('../config/supabase');
const { getPlanFeatures } = require('../services/planService');

// Import rate limiting and moderation services
const { createRoastRateLimiter } = require('../middleware/roastRateLimiter');
const PerspectiveService = require('../services/perspectiveService');

// Initialize services
let roastGenerator;
let perspectiveService;

// Initialize roast generator based on flags
if (flags.isEnabled('ENABLE_REAL_OPENAI')) {
    try {
        roastGenerator = new RoastGeneratorEnhanced();
        logger.info('✅ Real OpenAI roast generator initialized');
    } catch (error) {
        logger.warn('⚠️ Failed to initialize OpenAI, falling back to mock:', error.message);
        roastGenerator = new RoastGeneratorMock();
    }
} else {
    roastGenerator = new RoastGeneratorMock();
    logger.info('🎭 Mock roast generator initialized (ENABLE_REAL_OPENAI disabled)');
}

// Initialize Perspective API service
if (flags.isEnabled('ENABLE_PERSPECTIVE_API')) {
    try {
        perspectiveService = new PerspectiveService();
        logger.info('✅ Perspective API service initialized');
    } catch (error) {
        logger.warn('⚠️ Failed to initialize Perspective API:', error.message);
        perspectiveService = null;
    }
} else {
    logger.info('🎭 Perspective API disabled (ENABLE_PERSPECTIVE_API disabled)');
    perspectiveService = null;
}

// Apply rate limiting to roast endpoints
const roastRateLimit = createRoastRateLimiter();

/**
 * Validate roast request parameters
 */
function validateRoastRequest(req) {
    const { text, tone, intensity, humorType } = req.body;
    const errors = [];

    // Validate text
    if (!text || typeof text !== 'string') {
        errors.push('Text is required and must be a string');
    } else if (text.trim().length === 0) {
        errors.push('Text cannot be empty');
    } else if (text.length > 2000) {
        errors.push('Text must be less than 2000 characters');
    }

    // Validate optional parameters
    const validTones = ['sarcastic', 'witty', 'clever', 'playful', 'savage'];
    if (tone && !validTones.includes(tone)) {
        errors.push(`Tone must be one of: ${validTones.join(', ')}`);
    }

    const validHumorTypes = ['witty', 'clever', 'sarcastic', 'playful', 'observational'];
    if (humorType && !validHumorTypes.includes(humorType)) {
        errors.push(`Humor type must be one of: ${validHumorTypes.join(', ')}`);
    }

    if (intensity && (typeof intensity !== 'number' || intensity < 1 || intensity > 5)) {
        errors.push('Intensity must be a number between 1 and 5');
    }

    return errors;
}

/**
 * Get user plan and limits
 */
async function getUserPlanInfo(userId) {
    try {
        const { data: userSub, error } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan, status')
            .eq('user_id', userId)
            .single();

        if (error || !userSub) {
            return { plan: 'free', status: 'active' };
        }

        return {
            plan: userSub.plan || 'free',
            status: userSub.status || 'active'
        };
    } catch (error) {
        logger.error('Error fetching user plan:', error);
        return { plan: 'free', status: 'active' };
    }
}

/**
 * Check if user has sufficient credits
 */
async function checkUserCredits(userId, plan) {
    try {
        const planFeatures = getPlanFeatures(plan);
        const monthlyLimit = planFeatures.limits.roastsPerMonth;

        if (monthlyLimit === -1) {
            return { hasCredits: true, remaining: -1, limit: -1 };
        }

        // Get current month usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: usage, error } = await supabaseServiceClient
            .from('roast_usage')
            .select('count')
            .eq('user_id', userId)
            .gte('created_at', startOfMonth.toISOString())
            .single();

        const currentUsage = usage?.count || 0;
        const remaining = monthlyLimit - currentUsage;

        return {
            hasCredits: remaining > 0,
            remaining: Math.max(0, remaining),
            limit: monthlyLimit,
            used: currentUsage
        };
    } catch (error) {
        logger.error('Error checking user credits:', error);
        // Default to allowing the request if we can't check
        return { hasCredits: true, remaining: 1, limit: 50 };
    }
}

/**
 * Record roast usage
 */
async function recordRoastUsage(userId, metadata = {}) {
    try {
        await supabaseServiceClient
            .from('roast_usage')
            .insert({
                user_id: userId,
                count: 1,
                metadata,
                created_at: new Date().toISOString()
            });
    } catch (error) {
        logger.error('Error recording roast usage:', error);
        // Don't fail the request if we can't record usage
    }
}

/**
 * Analyze content with Perspective API
 */
async function analyzeContent(text) {
    if (!perspectiveService) {
        // Return safe defaults when Perspective API is disabled
        return {
            toxicityScore: 0.1,
            categories: [],
            safe: true,
            analysis: {
                toxicity: 0.1,
                severeToxicity: 0.05,
                identityAttack: 0.05,
                insult: 0.1,
                profanity: 0.05,
                threat: 0.02
            }
        };
    }

    try {
        const analysis = await perspectiveService.analyzeText(text);
        const toxicityScore = analysis.toxicity || 0;
        const safe = toxicityScore < 0.7; // Threshold for safe content

        return {
            toxicityScore,
            categories: analysis.categories || [],
            safe,
            analysis
        };
    } catch (error) {
        logger.error('Perspective API analysis failed:', error);
        // Return safe defaults on error
        return {
            toxicityScore: 0.1,
            categories: [],
            safe: true,
            analysis: { toxicity: 0.1 },
            error: error.message
        };
    }
}

/**
 * POST /api/roast/preview
 * Generate a roast preview without consuming credits
 * Requires authentication
 */
router.post('/preview', authenticateToken, roastRateLimit, async (req, res) => {
    const startTime = Date.now();
    
    try {
        // Validate request
        const validationErrors = validateRoastRequest(req);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors,
                timestamp: new Date().toISOString()
            });
        }

        const { text, tone = 'sarcastic', intensity = 3, humorType = 'witty' } = req.body;
        const userId = req.user.id;

        // Get user plan info
        const userPlan = await getUserPlanInfo(userId);

        // Analyze content with Perspective API
        const contentAnalysis = await analyzeContent(text);

        // Check if content is safe for roasting
        if (!contentAnalysis.safe) {
            return res.status(400).json({
                success: false,
                error: 'Content not suitable for roasting',
                details: {
                    toxicityScore: contentAnalysis.toxicityScore,
                    categories: contentAnalysis.categories,
                    reason: 'Content exceeds toxicity threshold'
                },
                timestamp: new Date().toISOString()
            });
        }

        // Prepare roast generation config
        const roastConfig = {
            plan: userPlan.plan,
            tone,
            humor_type: humorType,
            intensity_level: intensity,
            preview_mode: true
        };

        // Generate roast
        const generationResult = await roastGenerator.generateRoast(
            text,
            contentAnalysis.toxicityScore,
            tone,
            roastConfig
        );

        const processingTime = Date.now() - startTime;

        // Log successful preview generation
        logger.info('Roast preview generated', {
            userId,
            plan: userPlan.plan,
            tone,
            intensity,
            humorType,
            toxicityScore: contentAnalysis.toxicityScore,
            processingTimeMs: processingTime,
            roastLength: generationResult.roast?.length || 0
        });

        // Return successful response
        res.json({
            success: true,
            data: {
                roast: generationResult.roast,
                metadata: {
                    tone,
                    intensity,
                    humorType,
                    toxicityScore: contentAnalysis.toxicityScore,
                    safe: contentAnalysis.safe,
                    preview: true,
                    plan: userPlan.plan,
                    processingTimeMs: processingTime,
                    generatedAt: new Date().toISOString()
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        logger.error('Roast preview generation failed', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack,
            processingTimeMs: processingTime
        });

        res.status(500).json({
            success: false,
            error: 'Failed to generate roast preview',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/roast/generate
 * Generate a roast and consume user credits
 * Requires authentication
 */
router.post('/generate', authenticateToken, roastRateLimit, async (req, res) => {
    const startTime = Date.now();
    
    try {
        // Validate request
        const validationErrors = validateRoastRequest(req);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors,
                timestamp: new Date().toISOString()
            });
        }

        const { text, tone = 'sarcastic', intensity = 3, humorType = 'witty' } = req.body;
        const userId = req.user.id;

        // Get user plan info
        const userPlan = await getUserPlanInfo(userId);

        // Check user credits
        const creditCheck = await checkUserCredits(userId, userPlan.plan);
        if (!creditCheck.hasCredits) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient credits',
                details: {
                    remaining: creditCheck.remaining,
                    limit: creditCheck.limit,
                    used: creditCheck.used,
                    plan: userPlan.plan
                },
                timestamp: new Date().toISOString()
            });
        }

        // Analyze content with Perspective API
        const contentAnalysis = await analyzeContent(text);

        // Check if content is safe for roasting
        if (!contentAnalysis.safe) {
            return res.status(400).json({
                success: false,
                error: 'Content not suitable for roasting',
                details: {
                    toxicityScore: contentAnalysis.toxicityScore,
                    categories: contentAnalysis.categories,
                    reason: 'Content exceeds toxicity threshold'
                },
                timestamp: new Date().toISOString()
            });
        }

        // Prepare roast generation config
        const roastConfig = {
            plan: userPlan.plan,
            tone,
            humor_type: humorType,
            intensity_level: intensity,
            preview_mode: false
        };

        // Generate roast
        const generationResult = await roastGenerator.generateRoast(
            text,
            contentAnalysis.toxicityScore,
            tone,
            roastConfig
        );

        // Record usage (consume credits)
        await recordRoastUsage(userId, {
            tone,
            intensity,
            humorType,
            toxicityScore: contentAnalysis.toxicityScore,
            roastLength: generationResult.roast?.length || 0
        });

        const processingTime = Date.now() - startTime;

        // Log successful generation
        logger.info('Roast generated and credits consumed', {
            userId,
            plan: userPlan.plan,
            tone,
            intensity,
            humorType,
            toxicityScore: contentAnalysis.toxicityScore,
            processingTimeMs: processingTime,
            roastLength: generationResult.roast?.length || 0,
            creditsRemaining: creditCheck.remaining - 1
        });

        // Return successful response
        res.json({
            success: true,
            data: {
                roast: generationResult.roast,
                metadata: {
                    tone,
                    intensity,
                    humorType,
                    toxicityScore: contentAnalysis.toxicityScore,
                    safe: contentAnalysis.safe,
                    preview: false,
                    plan: userPlan.plan,
                    processingTimeMs: processingTime,
                    generatedAt: new Date().toISOString()
                },
                credits: {
                    remaining: Math.max(0, creditCheck.remaining - 1),
                    limit: creditCheck.limit,
                    used: creditCheck.used + 1
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        logger.error('Roast generation failed', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack,
            processingTimeMs: processingTime
        });

        res.status(500).json({
            success: false,
            error: 'Failed to generate roast',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/roast/credits
 * Get user's current credit status
 * Requires authentication
 */
router.get('/credits', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userPlan = await getUserPlanInfo(userId);
        const creditCheck = await checkUserCredits(userId, userPlan.plan);

        res.json({
            success: true,
            data: {
                plan: userPlan.plan,
                status: userPlan.status,
                credits: {
                    remaining: creditCheck.remaining,
                    limit: creditCheck.limit,
                    used: creditCheck.used,
                    unlimited: creditCheck.limit === -1
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get credit status', {
            userId: req.user?.id,
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to get credit status',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
