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
const { 
    VALIDATION_CONSTANTS,
    isValidStyle,
    isValidLanguage,
    isValidPlatform,
    normalizeLanguage,
    normalizeStyle,
    normalizePlatform,
    getValidStylesForLanguage
} = require('../config/validationConstants');
const RoastGeneratorEnhanced = require('../services/roastGeneratorEnhanced');
const RoastGeneratorMock = require('../services/roastGeneratorMock');
const RoastEngine = require('../services/roastEngine');
const { supabaseServiceClient } = require('../config/supabase');
const { getPlanFeatures } = require('../services/planService');

// Import rate limiting and moderation services
const { createRoastRateLimiter } = require('../middleware/roastRateLimiter');
const PerspectiveService = require('../services/perspectiveService');

// Initialize services
let roastGenerator;
let roastEngine;
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

// Initialize roast engine (SPEC 7 - Issue #363) with feature flag guard
if (flags.isEnabled('ENABLE_ROAST_ENGINE')) {
    try {
        roastEngine = new RoastEngine();
        logger.info('🔥 Roast Engine initialized for SPEC 7 implementation');
    } catch (error) {
        logger.error('❌ Failed to initialize Roast Engine:', error.message);
        logger.warn('🛡️ Falling back to standard roast generation');
        roastEngine = null;
    }
} else {
    logger.info('🔧 Roast Engine disabled via feature flag');
    roastEngine = null;
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

// Create lighter rate limit for public endpoints
const publicRateLimit = require('express-rate-limit')({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes per IP
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting in test environment
        return process.env.NODE_ENV === 'test';
    }
});

/**
 * Validate roast request parameters (Enhanced for Issue #326)
 */
function validateRoastRequest(req) {
    const { text, tone, intensity, humorType, styleProfile, persona, platform } = req.body;
    const errors = [];

    // Validate text
    if (!text || typeof text !== 'string') {
        errors.push('Text is required and must be a string');
    } else if (text.trim().length === 0) {
        errors.push('Text cannot be empty');
    } else if (text.length > VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH) {
        errors.push(`Text must be less than ${VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH} characters`);
    }

    // Validate optional parameters using constants
    if (tone && !VALIDATION_CONSTANTS.VALID_TONES.includes(tone)) {
        errors.push(`Tone must be one of: ${VALIDATION_CONSTANTS.VALID_TONES.join(', ')}`);
    }

    if (humorType && !VALIDATION_CONSTANTS.VALID_HUMOR_TYPES.includes(humorType)) {
        errors.push(`Humor type must be one of: ${VALIDATION_CONSTANTS.VALID_HUMOR_TYPES.join(', ')}`);
    }

    if (intensity && (typeof intensity !== 'number' || intensity < VALIDATION_CONSTANTS.MIN_INTENSITY || intensity > VALIDATION_CONSTANTS.MAX_INTENSITY)) {
        errors.push(`Intensity must be a number between ${VALIDATION_CONSTANTS.MIN_INTENSITY} and ${VALIDATION_CONSTANTS.MAX_INTENSITY}`);
    }

    // Validate new parameters for Issue #326
    if (styleProfile && typeof styleProfile !== 'object') {
        errors.push('Style profile must be an object');
    }

    if (persona && typeof persona !== 'string') {
        errors.push('Persona must be a string');
    }

    if (platform && !isValidPlatform(platform)) {
        errors.push(`Platform must be one of: ${VALIDATION_CONSTANTS.VALID_PLATFORMS.join(', ')}`);
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
 * Check if user has sufficient roast credits (UTC-based calculation)
 */
async function checkUserCredits(userId, plan) {
    try {
        const planFeatures = getPlanFeatures(plan);
        const monthlyLimit = planFeatures.limits.roastsPerMonth;

        if (monthlyLimit === -1) {
            return { hasCredits: true, remaining: -1, limit: -1 };
        }

        // Get current month usage using UTC-based start of month calculation
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth();
        const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

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
 * Check if user has sufficient analysis credits (Issue #326)
 */
async function checkAnalysisCredits(userId, plan) {
    try {
        const planFeatures = getPlanFeatures(plan);
        // Analysis limit from database migration (monthly_analysis_limit)
        const monthlyAnalysisLimit = getAnalysisLimitForPlan(plan);

        if (monthlyAnalysisLimit === -1) {
            return { hasCredits: true, remaining: -1, limit: -1 };
        }

        // Get current month analysis usage
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth();
        const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

        const { data: usage, error } = await supabaseServiceClient
            .from('analysis_usage')
            .select('count')
            .eq('user_id', userId)
            .gte('created_at', startOfMonth.toISOString())
            .single();

        const currentUsage = usage?.count || 0;
        const remaining = monthlyAnalysisLimit - currentUsage;

        return {
            hasCredits: remaining > 0,
            remaining: Math.max(0, remaining),
            limit: monthlyAnalysisLimit,
            used: currentUsage
        };
    } catch (error) {
        logger.error('Error checking analysis credits:', error);
        // Default to allowing the request if we can't check
        return { hasCredits: true, remaining: 1, limit: 1000 };
    }
}

/**
 * Get analysis limit for plan (Issue #326)
 */
function getAnalysisLimitForPlan(plan) {
    const limits = {
        'free': 1000,
        'starter': 1000,
        'pro': 10000,
        'plus': 100000,
        'custom': -1
    };
    return limits[plan] || 1000;
}

/**
 * Get AI model for plan with GPT-5 auto-detection (Issue #326)
 */
async function getModelForPlan(plan) {
    try {
        const { getModelAvailabilityService } = require('../services/modelAvailabilityService');
        const modelService = getModelAvailabilityService();
        
        // Use the smart model selection with GPT-5 detection
        return await modelService.getModelForPlan(plan);
    } catch (error) {
        logger.error('Error getting model for plan, using fallback', {
            plan,
            error: error.message
        });
        
        // Safe fallback to previous logic
        const fallbackModels = {
            'free': 'gpt-3.5-turbo',
            'starter': 'gpt-4o',
            'pro': 'gpt-4o', 
            'plus': 'gpt-4o',
            'custom': 'gpt-4o'
        };
        return fallbackModels[plan] || 'gpt-4o';
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
 * Record analysis usage (Issue #326)
 */
async function recordAnalysisUsage(userId, metadata = {}) {
    try {
        await supabaseServiceClient
            .from('analysis_usage')
            .insert({
                user_id: userId,
                count: 1,
                metadata,
                created_at: new Date().toISOString()
            });
    } catch (error) {
        logger.error('Error recording analysis usage:', error);
        // Don't fail the request if we can't record usage
    }
}

/**
 * Atomically consume roast credits (check and record in single operation)
 */
async function consumeRoastCredits(userId, plan, metadata = {}) {
    try {
        const planFeatures = getPlanFeatures(plan);
        const monthlyLimit = planFeatures.limits.roastsPerMonth;

        const { data: result, error } = await supabaseServiceClient
            .rpc('consume_roast_credits', {
                p_user_id: userId,
                p_plan: plan,
                p_monthly_limit: monthlyLimit,
                p_metadata: metadata
            });

        if (error) {
            logger.error('Error consuming roast credits:', error);
            throw error;
        }

        return result;
    } catch (error) {
        logger.error('Error in consumeRoastCredits:', error);
        // Return failure result
        return {
            success: false,
            hasCredits: false,
            remaining: 0,
            limit: 50,
            used: 0,
            unlimited: false,
            error: error.message
        };
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
 * Generate a roast preview with analysis credit consumption (Issue #326)
 * Requires authentication
 * 
 * Request: { text, styleProfile, persona, platform }
 * Response: { roast, tokensUsed, analysisCountRemaining, roastsRemaining }
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

        const { 
            text, 
            styleProfile = {}, 
            persona = null, 
            platform = 'twitter',
            tone = 'sarcastic', 
            intensity = 3, 
            humorType = 'witty' 
        } = req.body;
        
        const userId = req.user.id;

        // Get user plan info
        const userPlan = await getUserPlanInfo(userId);

        // Check analysis credits BEFORE processing (Issue #326)
        const analysisCheck = await checkAnalysisCredits(userId, userPlan.plan);
        if (!analysisCheck.hasCredits) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient analysis credits',
                details: {
                    analysisCountRemaining: analysisCheck.remaining,
                    analysisLimit: analysisCheck.limit,
                    plan: userPlan.plan,
                    message: 'Agotaste tu límite de análisis, actualiza tu plan'
                },
                timestamp: new Date().toISOString()
            });
        }

        // Check roast credits to include in response
        const roastCheck = await checkUserCredits(userId, userPlan.plan);

        // Consume 1 analysis credit (Issue #326)
        await recordAnalysisUsage(userId, {
            endpoint: 'preview',
            platform,
            hasStyleProfile: !!styleProfile && Object.keys(styleProfile).length > 0,
            hasPersona: !!persona,
            tone,
            intensity,
            humorType
        });

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

        // Prepare enhanced roast generation config (Issue #326)
        const roastConfig = {
            plan: userPlan.plan,
            tone,
            humor_type: humorType,
            intensity_level: intensity,
            preview_mode: true,
            userId: userId,
            styleProfile: styleProfile,
            persona: persona,
            platform: platform,
            language: 'es' // Default to Spanish
        };

        // Generate roast with enhanced configuration
        const generationResult = await roastGenerator.generateRoast(
            text,
            contentAnalysis.toxicityScore,
            tone,
            roastConfig
        );

        const processingTime = Date.now() - startTime;
        const tokensUsed = generationResult.tokensUsed || roastGenerator.estimateTokens(text + generationResult.roast);

        // Calculate remaining credits after consumption
        const analysisRemaining = Math.max(0, analysisCheck.remaining - 1);

        // Log successful preview generation (Issue #326)
        logger.info('Enhanced roast preview generated', {
            userId,
            plan: userPlan.plan,
            platform,
            hasStyleProfile: !!styleProfile && Object.keys(styleProfile).length > 0,
            hasPersona: !!persona,
            tone,
            intensity,
            humorType,
            tokensUsed,
            analysisRemaining,
            roastsRemaining: roastCheck.remaining,
            toxicityScore: contentAnalysis.toxicityScore,
            processingTimeMs: processingTime,
            roastLength: generationResult.roast?.length || 0
        });

        // Get model info for metadata
        const selectedModel = await getModelForPlan(userPlan.plan);

        // Return Issue #326 compliant response
        res.json({
            success: true,
            roast: generationResult.roast,
            tokensUsed: tokensUsed,
            analysisCountRemaining: analysisRemaining,
            roastsRemaining: roastCheck.remaining,
            metadata: {
                platform,
                styleProfile: styleProfile,
                persona: persona,
                tone,
                intensity,
                humorType,
                toxicityScore: contentAnalysis.toxicityScore,
                safe: contentAnalysis.safe,
                plan: userPlan.plan,
                processingTimeMs: processingTime,
                generatedAt: new Date().toISOString(),
                model: selectedModel
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        logger.error('Enhanced roast preview generation failed', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack,
            processingTimeMs: processingTime
        });

        // Fallback to mock on OpenAI API failure (Issue #326)
        if (error.message.includes('OpenAI') || error.message.includes('API')) {
            logger.warn('OpenAI API failed, falling back to mock mode', {
                userId: req.user?.id,
                error: error.message
            });
            
            try {
                const mockGenerator = new (require('../services/roastGeneratorMock'))();
                const mockRoast = await mockGenerator.generateRoast(req.body.text || 'Error processing request', 0.5, req.body.tone || 'sarcastic');
                
                res.json({
                    success: true,
                    roast: mockRoast + ' (Modo de prueba)',
                    tokensUsed: 50,
                    analysisCountRemaining: 999,
                    roastsRemaining: 99,
                    metadata: {
                        fallbackMode: true,
                        error: 'OpenAI API unavailable',
                        generatedAt: new Date().toISOString()
                    },
                    timestamp: new Date().toISOString()
                });
                return;
            } catch (mockError) {
                logger.error('Mock fallback also failed:', mockError);
            }
        }

        res.status(500).json({
            success: false,
            error: 'Failed to generate roast preview',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Servicio temporalmente no disponible',
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

        // Analyze content with Perspective API first (before consuming credits)
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

        // Prepare metadata for credit consumption
        const usageMetadata = {
            tone,
            intensity,
            humorType,
            toxicityScore: contentAnalysis.toxicityScore
        };

        // Atomically consume credits (check and record in single operation)
        const creditResult = await consumeRoastCredits(userId, userPlan.plan, usageMetadata);

        if (!creditResult.success) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient credits',
                details: {
                    remaining: creditResult.remaining,
                    limit: creditResult.limit,
                    used: creditResult.used,
                    plan: userPlan.plan,
                    error: creditResult.error
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

        // Update metadata with roast length (credits already consumed)
        usageMetadata.roastLength = generationResult.roast?.length || 0;

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
            creditsRemaining: creditResult.remaining
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
                    remaining: creditResult.remaining,
                    limit: creditResult.limit,
                    used: creditResult.used,
                    unlimited: creditResult.unlimited
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

/**
 * POST /api/roast/engine
 * Advanced roast generation using the new Roast Engine (SPEC 7 - Issue #363)
 * Supports 1-2 versions, voice styles, auto-approve logic with transparency validation
 * Requires authentication
 */
router.post('/engine', authenticateToken, roastRateLimit, async (req, res) => {
    const startTime = Date.now();
    
    try {
        // Check if roast engine is available
        if (!roastEngine) {
            return res.status(503).json({
                success: false,
                error: 'Roast Engine not available',
                fallback: 'Use /api/roast/generate endpoint instead',
                timestamp: new Date().toISOString()
            });
        }

        // Validate request
        const validationErrors = validateRoastEngineRequest(req);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validationErrors,
                timestamp: new Date().toISOString()
            });
        }

        const { 
            comment, 
            style = 'balanceado', 
            language = 'es',
            autoApprove = false,
            platform = 'twitter',
            commentId = null
        } = req.body;
        
        const userId = req.user.id;

        // Get user plan info
        const userPlan = await getUserPlanInfo(userId);

        // Analyze content with Perspective API first
        const contentAnalysis = await analyzeContent(comment);

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

        // Atomically consume credits before generation (prevents race conditions)
        const creditResult = await consumeRoastCredits(userId, userPlan.plan, {
            method: 'roast_engine',
            style: style,
            language: language,
            autoApprove: autoApprove,
            platform: platform,
            toxicityScore: contentAnalysis.toxicityScore
        });
        
        if (!creditResult.success) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient credits',
                details: {
                    remaining: creditResult.remaining,
                    limit: creditResult.limit,
                    used: creditResult.used,
                    plan: userPlan.plan,
                    error: creditResult.error
                },
                timestamp: new Date().toISOString()
            });
        }

        // Prepare input for roast engine
        const input = {
            comment: comment,
            toxicityScore: contentAnalysis.toxicityScore,
            commentId: commentId
        };

        // Validate orgId for multi-tenant safety
        const orgId = req.user.orgId || null;
        if (orgId && typeof orgId !== 'string') {
            logger.warn('Invalid orgId format detected', {
                userId: userId,
                orgId: orgId,
                orgIdType: typeof orgId
            });
        }

        const options = {
            userId: userId,
            orgId: orgId,
            style: normalizeStyle(style) || VALIDATION_CONSTANTS.DEFAULTS.STYLE,
            language: normalizeLanguage(language),
            autoApprove: autoApprove,
            platform: normalizePlatform(platform),
            plan: userPlan.plan
        };

        // Generate roast using the advanced engine
        const result = await roastEngine.generateRoast(input, options);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error,
                details: result.details,
                retries: result.retries,
                timestamp: new Date().toISOString()
            });
        }

        // Credits already consumed atomically before generation
        // Update usage metadata can be done asynchronously if needed

        const processingTime = Date.now() - startTime;

        // Log successful generation
        logger.info('🔥 Roast Engine generation completed', {
            userId,
            plan: userPlan.plan,
            style,
            language,
            autoApprove,
            versionsGenerated: result.metadata.versionsGenerated,
            status: result.status,
            processingTimeMs: processingTime
        });

        // Validate transparency for auto-approved roasts (critical guard)
        if (autoApprove && result.status === 'auto_approved' && !result?.transparency?.applied) {
            logger.error('❌ Critical: Auto-approved roast without transparency', {
                userId,
                roastId: result.metadata?.id,
                status: result.status
            });
            
            return res.status(500).json({
                success: false,
                error: 'Transparency validation failed',
                details: 'Auto-approved roast must have transparency disclaimer',
                timestamp: new Date().toISOString()
            });
        }

        // Return successful response
        res.json({
            success: true,
            data: {
                roast: result.roast,
                versions: result.versions,
                style: result.style,
                language: result.language,
                status: result.status,
                transparency: result.transparency,
                metadata: {
                    ...result.metadata,
                    plan: userPlan.plan,
                    toxicityScore: contentAnalysis.toxicityScore,
                    safe: contentAnalysis.safe,
                    processingTimeMs: processingTime
                },
                credits: {
                    remaining: creditResult.remaining,
                    limit: creditResult.limit,
                    used: creditResult.used,
                    unlimited: creditResult.unlimited
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        logger.error('Roast Engine generation failed', {
            userId: req.user?.id,
            error: error.message,
            stack: error.stack,
            processingTimeMs: processingTime
        });

        res.status(500).json({
            success: false,
            error: 'Failed to generate roast with engine',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Validate roast engine request parameters with improved normalization
 */
function validateRoastEngineRequest(req) {
    const { comment, style, language, autoApprove, platform, orgId } = req.body;
    const errors = [];

    // Validate comment (enhanced for CodeRabbit Round 5)
    if (!comment || typeof comment !== 'string') {
        errors.push('Comment is required and must be a string');
    } else if (comment.trim().length === 0) {
        errors.push('Comment cannot be empty or whitespace only');
    } else if (comment.length > VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH) {
        errors.push(`Comment must be less than ${VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH} characters`);
    }

    // Normalize and validate style (enhanced normalization)
    const normalizedLanguage = normalizeLanguage(language);
    const normalizedStyle = normalizeStyle(style);
    
    if (style && !isValidStyle(normalizedStyle, normalizedLanguage)) {
        const validStyles = getValidStylesForLanguage(normalizedLanguage);
        errors.push(`Style must be one of: ${validStyles.join(', ')} for language '${normalizedLanguage}'`);
    }

    // Validate language (enhanced with BCP-47 support)
    if (language && !isValidLanguage(language)) {
        errors.push(`Language must be one of: ${VALIDATION_CONSTANTS.VALID_LANGUAGES.join(', ')} (BCP-47 codes like 'en-US' are normalized)`);
    }

    // Validate autoApprove
    if (autoApprove !== undefined && typeof autoApprove !== 'boolean') {
        errors.push('autoApprove must be a boolean');
    }

    // Validate platform (enhanced with alias support)
    const normalizedPlatform = normalizePlatform(platform);
    if (platform && !isValidPlatform(platform)) {
        errors.push(`Platform must be one of: ${VALIDATION_CONSTANTS.VALID_PLATFORMS.join(', ')} (aliases like 'X' → 'twitter' are supported)`);
    }

    // Enhanced orgId validation for multi-tenant security (CodeRabbit Round 5)
    if (orgId !== undefined) {
        if (orgId !== null && typeof orgId !== 'string') {
            errors.push('orgId must be a string or null');
        } else if (typeof orgId === 'string' && orgId.trim().length === 0) {
            errors.push('orgId cannot be empty string (use null for no organization)');
        } else if (typeof orgId === 'string' && !/^[a-zA-Z0-9-_]+$/.test(orgId)) {
            errors.push('orgId must contain only alphanumeric characters, hyphens, and underscores');
        }
    }

    return errors;
}

/**
 * GET /api/roast/styles
 * Get available voice styles for a language
 * Public endpoint for UI integration with rate limiting
 */
router.get('/styles', publicRateLimit, optionalAuth, async (req, res) => {
    try {
        // Enhanced language normalization (CodeRabbit Round 5)
        const rawLanguage = req.query.language || 'es';
        const language = normalizeLanguage(rawLanguage);
        
        if (!roastEngine) {
            // Graceful fallback when roast engine is disabled (CodeRabbit Round 5)
            return res.status(503).json({
                success: false,
                error: 'Roast Engine temporarily unavailable',
                fallback: {
                    message: 'Use validation constants for style information',
                    availableLanguages: VALIDATION_CONSTANTS.VALID_LANGUAGES,
                    validationEndpoint: '/api/roast/validation'
                },
                timestamp: new Date().toISOString()
            });
        }

        const styles = roastEngine.getAvailableStyles(language);
        
        // Enhanced caching headers with language-aware caching (CodeRabbit Round 5)
        res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.set('Vary', 'Accept-Language'); // Enable language-aware caching
        
        res.json({
            success: true,
            data: {
                language: language,
                originalLanguage: rawLanguage, // Show normalization result
                styles: styles,
                normalized: rawLanguage !== language ? true : undefined
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to get roast styles', {
            error: error.message
        });

        res.status(500).json({
            success: false,
            error: 'Failed to get roast styles',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
