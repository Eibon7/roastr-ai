/**
 * Style Profile Service
 * 
 * Extracts and analyzes user writing style from their original comments
 * for Pro/Plus users to enhance roast personalization.
 * 
 * Features:
 * - Fetches 50-100 recent user comments
 * - Excludes Roastr-generated content
 * - Generates style embeddings/descriptors
 * - AES-256 encryption for data security
 * - Automatic refresh every 90 days or 500 new comments
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');
const { flags } = require('../config/flags');

class StyleProfileService {
    constructor() {
        this.ALGORITHM = 'aes-256-gcm';
        this.ENCRYPTION_KEY = process.env.STYLE_PROFILE_ENCRYPTION_KEY || crypto.randomBytes(32);
        this.COMMENTS_TO_FETCH = 100;
        this.MIN_COMMENTS_REQUIRED = 50;
        this.REFRESH_DAYS = 90;
        this.REFRESH_COMMENT_COUNT = 500;
    }

    /**
     * Extract style profile for a user from a specific platform
     * @param {string} userId - User ID
     * @param {string} platform - Social media platform
     * @param {string} accountRef - Platform account reference
     * @returns {Promise<Object>} Style profile result
     */
    async extractStyleProfile(userId, platform, accountRef) {
        try {
            logger.info('Extracting style profile', { userId, platform });

            // Check if user is Pro or Plus
            const userPlan = await this.getUserPlan(userId);
            if (!['pro', 'plus'].includes(userPlan)) {
                throw new Error('Style profile feature is only available for Pro and Plus users');
            }

            // Fetch recent comments
            const comments = await this.fetchRecentComments(platform, accountRef);
            
            if (comments.length < this.MIN_COMMENTS_REQUIRED) {
                throw new Error(`Insufficient comments for style analysis. Found: ${comments.length}, Required: ${this.MIN_COMMENTS_REQUIRED}`);
            }

            // Generate style embedding
            const styleEmbedding = await this.generateStyleEmbedding(comments);

            // Encrypt and store
            const encryptedProfile = await this.encryptStyleProfile(styleEmbedding);
            await this.storeStyleProfile(userId, platform, encryptedProfile);

            // Log metadata only
            logger.info('Style profile created', {
                userId,
                platform,
                commentCount: comments.length,
                profileHash: crypto.createHash('sha256').update(JSON.stringify(styleEmbedding)).digest('hex').substring(0, 8)
            });

            return {
                success: true,
                commentCount: comments.length,
                profileCreated: true
            };

        } catch (error) {
            logger.error('Style profile extraction failed', {
                error: error.message,
                userId,
                platform
            });
            throw error;
        }
    }

    /**
     * Fetch recent comments from platform, excluding Roastr-generated content
     * @param {string} platform - Social media platform
     * @param {string} accountRef - Platform account reference
     * @returns {Promise<Array>} Array of user comments
     */
    async fetchRecentComments(platform, accountRef) {
        // TODO: Implement platform-specific comment fetching
        // This will integrate with existing platform services
        return [];
    }

    /**
     * Generate style embedding from user comments
     * @param {Array} comments - Array of user comments
     * @returns {Promise<Object>} Style embedding/descriptor
     */
    async generateStyleEmbedding(comments) {
        // Analyze comment characteristics
        const analysis = {
            avgLength: this.calculateAverageLength(comments),
            tone: await this.analyzeTone(comments),
            emojiUsage: this.analyzeEmojiUsage(comments),
            structures: this.analyzeStructures(comments),
            timestamp: new Date().toISOString()
        };

        return analysis;
    }

    /**
     * Calculate average comment length
     * @param {Array} comments - Array of comments
     * @returns {number} Average length
     */
    calculateAverageLength(comments) {
        if (!comments.length) return 0;
        const totalLength = comments.reduce((sum, comment) => sum + comment.text.length, 0);
        return Math.round(totalLength / comments.length);
    }

    /**
     * Analyze tone patterns in comments
     * @param {Array} comments - Array of comments
     * @returns {Promise<Object>} Tone analysis
     */
    async analyzeTone(comments) {
        // TODO: Implement tone analysis using OpenAI or similar
        return {
            positive: 0.3,
            neutral: 0.4,
            aggressive: 0.2,
            ironic: 0.1
        };
    }

    /**
     * Analyze emoji usage patterns
     * @param {Array} comments - Array of comments
     * @returns {Object} Emoji usage statistics
     */
    analyzeEmojiUsage(comments) {
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        let totalEmojis = 0;
        let commentsWithEmojis = 0;

        comments.forEach(comment => {
            const emojis = comment.text.match(emojiRegex) || [];
            if (emojis.length > 0) {
                totalEmojis += emojis.length;
                commentsWithEmojis++;
            }
        });

        return {
            averagePerComment: comments.length > 0 ? totalEmojis / comments.length : 0,
            percentageWithEmojis: comments.length > 0 ? (commentsWithEmojis / comments.length) * 100 : 0
        };
    }

    /**
     * Analyze comment structures (questions, exclamations, etc.)
     * @param {Array} comments - Array of comments
     * @returns {Object} Structure analysis
     */
    analyzeStructures(comments) {
        const structures = {
            questions: 0,
            exclamations: 0,
            sarcasm: 0,
            capsLock: 0
        };

        comments.forEach(comment => {
            const text = comment.text;
            if (text.includes('?')) structures.questions++;
            if (text.includes('!')) structures.exclamations++;
            if (text === text.toUpperCase() && text.length > 10) structures.capsLock++;
            // TODO: Add sarcasm detection logic
        });

        return {
            questionRate: comments.length > 0 ? structures.questions / comments.length : 0,
            exclamationRate: comments.length > 0 ? structures.exclamations / comments.length : 0,
            capsLockRate: comments.length > 0 ? structures.capsLock / comments.length : 0
        };
    }

    /**
     * Encrypt style profile using AES-256-GCM
     * @param {Object} styleProfile - Style profile to encrypt
     * @returns {Promise<Object>} Encrypted profile with IV and auth tag
     */
    async encryptStyleProfile(styleProfile) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, iv);
        
        const profileString = JSON.stringify(styleProfile);
        let encrypted = cipher.update(profileString, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();

        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt style profile
     * @param {Object} encryptedData - Encrypted profile data
     * @returns {Promise<Object>} Decrypted style profile
     */
    async decryptStyleProfile(encryptedData) {
        const decipher = crypto.createDecipheriv(
            this.ALGORITHM,
            this.ENCRYPTION_KEY,
            Buffer.from(encryptedData.iv, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    /**
     * Store encrypted style profile in database
     * @param {string} userId - User ID
     * @param {string} platform - Platform name
     * @param {Object} encryptedProfile - Encrypted profile data
     */
    async storeStyleProfile(userId, platform, encryptedProfile) {
        const { error } = await supabaseServiceClient
            .from('user_style_profile')
            .upsert({
                user_id: userId,
                platform: platform,
                encrypted_profile: encryptedProfile.encrypted,
                iv: encryptedProfile.iv,
                auth_tag: encryptedProfile.authTag,
                last_refresh: new Date().toISOString(),
                comment_count_since_refresh: 0
            }, {
                onConflict: 'user_id,platform'
            });

        if (error) {
            throw new Error(`Failed to store style profile: ${error.message}`);
        }
    }

    /**
     * Check if style profile needs refresh
     * @param {string} userId - User ID
     * @param {string} platform - Platform name
     * @returns {Promise<boolean>} True if refresh needed
     */
    async needsRefresh(userId, platform) {
        const { data, error } = await supabaseServiceClient
            .from('user_style_profile')
            .select('last_refresh, comment_count_since_refresh')
            .eq('user_id', userId)
            .eq('platform', platform)
            .single();

        if (error || !data) {
            return true; // No profile exists, needs creation
        }

        // Check time-based refresh
        const daysSinceRefresh = (Date.now() - new Date(data.last_refresh).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRefresh >= this.REFRESH_DAYS) {
            return true;
        }

        // Check comment count based refresh
        if (data.comment_count_since_refresh >= this.REFRESH_COMMENT_COUNT) {
            return true;
        }

        return false;
    }

    /**
     * Get user plan from database
     * @param {string} userId - User ID
     * @returns {Promise<string>} User plan
     */
    async getUserPlan(userId) {
        const { data, error } = await supabaseServiceClient
            .from('users')
            .select('plan')
            .eq('id', userId)
            .single();

        if (error || !data) {
            return 'free';
        }

        return data.plan;
    }

    /**
     * Get profile metadata without decrypting
     * @param {string} userId - User ID
     * @param {string} platform - Platform name
     * @returns {Promise<Object|null>} Profile metadata or null
     */
    async getProfileMetadata(userId, platform) {
        const { data, error } = await supabaseServiceClient
            .from('user_style_profile')
            .select('last_refresh, comment_count_since_refresh, created_at, updated_at')
            .eq('user_id', userId)
            .eq('platform', platform)
            .single();

        if (error || !data) {
            return null;
        }

        return data;
    }
}

module.exports = new StyleProfileService();