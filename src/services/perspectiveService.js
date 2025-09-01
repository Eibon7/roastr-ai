/**
 * Google Perspective API service for content moderation
 * Analyzes text toxicity and provides safety scores
 */

const { google } = require('googleapis');
const { logger } = require('../utils/logger');
const flags = require('../config/flags');

class PerspectiveService {
    constructor() {
        this.apiKey = process.env.PERSPECTIVE_API_KEY;
        this.enabled = flags.isEnabled('ENABLE_PERSPECTIVE_API') && !!this.apiKey;
        
        if (!this.enabled) {
            logger.warn('Perspective API disabled or API key not configured');
            return;
        }

        try {
            this.client = google.commentanalyzer({
                version: 'v1alpha1',
                auth: this.apiKey
            });
            
            logger.info('✅ Perspective API service initialized');
        } catch (error) {
            logger.error('Failed to initialize Perspective API:', error);
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
            logger.error('Perspective API analysis failed:', {
                error: error.message,
                textLength: text.length,
                textPreview: text.substring(0, 100)
            });

            // Return safe defaults on error
            return this.getMockAnalysis(text, true);
        }
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
            const key = attribute.toLowerCase().replace('_', '');
            
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
            severeToxicity: analysis.severetoxicity || 0,
            identityAttack: analysis.identityattack || 0,
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
            
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            } catch (error) {
                logger.error('Batch analysis failed:', error);
                // Add mock results for failed batch
                const mockResults = batch.map(text => this.getMockAnalysis(text, true));
                results.push(...mockResults);
            }

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
            flagEnabled: flags.isEnabled('ENABLE_PERSPECTIVE_API'),
            ready: this.enabled && !!this.client
        };
    }
}

module.exports = PerspectiveService;
