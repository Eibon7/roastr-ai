/**
 * Google Perspective API service for content moderation
 * Analyzes text toxicity and provides safety scores
 */

const crypto = require('crypto');
const { google } = require('googleapis');
const { logger } = require('../utils/logger');
const { isFlagEnabled } = require('../utils/featureFlags');

class PerspectiveService {
    constructor() {
        this.apiKey = process.env.PERSPECTIVE_API_KEY;
        this.enabled = isFlagEnabled('ENABLE_PERSPECTIVE_API') && !!this.apiKey;

        if (!this.enabled) {
            logger.warn('Perspective API disabled or API key not configured');
            return;
        }

        try {
            // Check if google.commentanalyzer is available (Issue #618 - Jest compatibility)
            if (!google || typeof google.commentanalyzer !== 'function') {
                logger.warn('Google Perspective API client not available (likely test environment)');
                this.enabled = false;
                return;
            }

            this.client = google.commentanalyzer({
                version: 'v1alpha1',
                auth: this.apiKey
            });

            logger.info('✅ Perspective API service initialized');
        } catch (error) {
            logger.warn('⚠️ Failed to initialize Perspective API:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Analyze text for toxicity and other attributes
     */
    async analyzeText(text, options = {}) {
        if (!this.enabled) {
            return this.getMockAnalysis(text);
        }

        try {
            const request = {
                comment: { text },
                requestedAttributes: {
                    TOXICITY: {},
                    SEVERE_TOXICITY: {},
                    IDENTITY_ATTACK: {},
                    INSULT: {},
                    PROFANITY: {},
                    THREAT: {},
                    ...options.attributes
                },
                languages: options.languages || ['en', 'es'],
                doNotStore: options.doNotStore !== false, // Default to true for privacy
                clientToken: options.clientToken || `roastr-${Date.now()}`
            };

            const response = await this.client.comments.analyze({
                resource: request
            });

            return this.parseResponse(response.data);

        } catch (error) {
            // Create non-reversible hash for debugging without exposing user data (GDPR compliance)
            const textHash = crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);

            logger.error('Perspective API analysis failed:', {
                error: error.message,
                textLength: text.length,
                textHash // Non-reversible hash instead of textPreview
            });

            // Return safe defaults on error
            return this.getMockAnalysis(text, true);
        }
    }

    /**
     * Normalize attribute name from snake_case to camelCase
     * @param {string} attribute - Attribute name (e.g., 'SEVERE_TOXICITY')
     * @returns {string} Normalized camelCase name (e.g., 'severeToxicity')
     */
    normalizeAttributeName(attribute) {
        if (!attribute || typeof attribute !== 'string') {
            return '';
        }

        // Split on underscores and convert to camelCase
        const parts = attribute.toLowerCase().split('_');

        // First part stays lowercase, subsequent parts get capitalized
        return parts.reduce((result, part, index) => {
            if (index === 0) {
                return part;
            }
            return result + part.charAt(0).toUpperCase() + part.slice(1);
        }, '');
    }

    /**
     * Parse Perspective API response
     */
    parseResponse(data) {
        const scores = data.attributeScores || {};
        const analysis = {};
        const categories = [];

        // Extract scores for each attribute
        for (const [attribute, attributeData] of Object.entries(scores)) {
            const score = attributeData.summaryScore?.value || 0;
            const key = this.normalizeAttributeName(attribute);

            analysis[key] = score;

            // Flag categories that exceed threshold
            if (score > 0.5) {
                categories.push(key);
            }
        }

        // Primary toxicity score
        const toxicity = analysis.toxicity || 0;

        return {
            toxicity,
            severeToxicity: analysis.severeToxicity || 0,
            identityAttack: analysis.identityAttack || 0,
            insult: analysis.insult || 0,
            profanity: analysis.profanity || 0,
            threat: analysis.threat || 0,
            categories,
            safe: toxicity < 0.7, // Configurable threshold
            analysis,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get mock analysis when API is disabled or fails
     */
    getMockAnalysis(text, isError = false) {
        // Simple heuristic-based analysis for fallback
        const lowerText = text.toLowerCase();

        // Basic profanity detection
        const profanityWords = ['fuck', 'shit', 'damn', 'hell', 'ass', 'bitch'];
        const hasProfanity = profanityWords.some(word => lowerText.includes(word));

        // Basic toxicity indicators
        const toxicIndicators = ['hate', 'kill', 'die', 'stupid', 'idiot', 'moron'];
        const hasToxicContent = toxicIndicators.some(word => lowerText.includes(word));

        // Calculate mock scores
        let toxicity = 0.1;
        if (hasProfanity) toxicity += 0.3;
        if (hasToxicContent) toxicity += 0.2;
        if (text.includes('!'.repeat(3))) toxicity += 0.1; // Multiple exclamations
        if (text.toUpperCase() === text && text.length > 10) toxicity += 0.1; // ALL CAPS

        toxicity = Math.min(toxicity, 0.9);

        const categories = [];
        if (hasProfanity) categories.push('profanity');
        if (hasToxicContent) categories.push('insult');

        return {
            toxicity,
            severeToxicity: toxicity * 0.3,
            identityAttack: toxicity * 0.2,
            insult: hasToxicContent ? toxicity * 0.8 : toxicity * 0.3,
            profanity: hasProfanity ? toxicity * 0.9 : toxicity * 0.1,
            threat: toxicity * 0.1,
            categories,
            safe: toxicity < 0.7,
            analysis: {
                toxicity,
                mock: true,
                error: isError
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Batch analyze multiple texts
     */
    async analyzeTexts(texts, options = {}) {
        if (!Array.isArray(texts)) {
            throw new Error('Texts must be an array');
        }

        const results = [];
        const batchSize = options.batchSize || 10;

        // Process in batches to avoid rate limits
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchPromises = batch.map(text => this.analyzeText(text, options));

            // Use Promise.allSettled to preserve successful results when some fail
            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    logger.warn('Individual analysis failed in batch:', {
                        batchIndex: i,
                        itemIndex: index,
                        error: result.reason?.message
                    });
                    // Add mock result for failed item only
                    results.push(this.getMockAnalysis(batch[index], true));
                }
            });

            // Add delay between batches to respect rate limits
            if (i + batchSize < texts.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return results;
    }

    /**
     * Check if text is safe for processing
     */
    async isSafe(text, threshold = 0.7) {
        const analysis = await this.analyzeText(text);
        return analysis.toxicity < threshold;
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            enabled: this.enabled,
            hasApiKey: !!this.apiKey,
            flagEnabled: isFlagEnabled('ENABLE_PERSPECTIVE_API'),
            ready: this.enabled && !!this.client
        };
    }
}

module.exports = PerspectiveService;
