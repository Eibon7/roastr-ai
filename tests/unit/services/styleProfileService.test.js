const styleProfileService = require('../../../src/services/styleProfileService');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn()
    }
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

describe('StyleProfileService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('extractStyleProfile', () => {
        it('should successfully extract style profile for Pro user', async () => {
            // Mock user plan check
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: { plan: 'pro' },
                error: null
            });

            // Mock fetchRecentComments to return test comments
            jest.spyOn(styleProfileService, 'fetchRecentComments').mockResolvedValue([
                { text: 'This is a test comment! 😄' },
                { text: 'Another comment with a question?' },
                { text: 'CAPS LOCK COMMENT FOR TESTING' },
                ...Array(50).fill({ text: 'Regular comment' })
            ]);

            // Mock store operation
            supabaseServiceClient.upsert.mockResolvedValueOnce({ error: null });

            const result = await styleProfileService.extractStyleProfile('user123', 'twitter', 'account123');

            expect(result).toEqual({
                success: true,
                commentCount: 53,
                profileCreated: true
            });

            expect(styleProfileService.fetchRecentComments).toHaveBeenCalledWith('twitter', 'account123');
            expect(supabaseServiceClient.upsert).toHaveBeenCalled();
        });

        it('should throw error for free plan users', async () => {
            // Mock user plan check
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: { plan: 'free' },
                error: null
            });

            await expect(
                styleProfileService.extractStyleProfile('user123', 'twitter', 'account123')
            ).rejects.toThrow('Style profile feature is only available for Pro and Plus users');
        });

        it('should throw error when insufficient comments', async () => {
            // Mock user plan check
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: { plan: 'plus' },
                error: null
            });

            // Mock insufficient comments
            jest.spyOn(styleProfileService, 'fetchRecentComments').mockResolvedValue([
                { text: 'Only one comment' }
            ]);

            await expect(
                styleProfileService.extractStyleProfile('user123', 'twitter', 'account123')
            ).rejects.toThrow('Insufficient comments for style analysis. Found: 1, Required: 50');
        });
    });

    describe('generateStyleEmbedding', () => {
        it('should generate correct style embedding from comments', async () => {
            const testComments = [
                { text: 'This is a test comment! 😄' },
                { text: 'Another comment with a question?' },
                { text: 'CAPS LOCK COMMENT' },
                { text: 'Regular comment without special chars' },
                { text: 'Multiple emojis here 😄😎🔥' }
            ];

            const embedding = await styleProfileService.generateStyleEmbedding(testComments);

            expect(embedding).toHaveProperty('avgLength');
            expect(embedding).toHaveProperty('tone');
            expect(embedding).toHaveProperty('emojiUsage');
            expect(embedding).toHaveProperty('structures');
            expect(embedding).toHaveProperty('timestamp');

            // Check average length calculation
            const expectedAvgLength = Math.round(
                testComments.reduce((sum, c) => sum + c.text.length, 0) / testComments.length
            );
            expect(embedding.avgLength).toBe(expectedAvgLength);

            // Check emoji usage
            expect(embedding.emojiUsage.averagePerComment).toBeGreaterThan(0);
            expect(embedding.emojiUsage.percentageWithEmojis).toBe(40); // 2 out of 5 comments

            // Check structures
            expect(embedding.structures.questionRate).toBe(0.2); // 1 out of 5
            expect(embedding.structures.exclamationRate).toBe(0.2); // 1 out of 5
            expect(embedding.structures.capsLockRate).toBe(0.2); // 1 out of 5
        });

        it('should handle empty comments array', async () => {
            const embedding = await styleProfileService.generateStyleEmbedding([]);

            expect(embedding.avgLength).toBe(0);
            expect(embedding.emojiUsage.averagePerComment).toBe(0);
            expect(embedding.emojiUsage.percentageWithEmojis).toBe(0);
            expect(embedding.structures.questionRate).toBe(0);
        });
    });

    describe('encryption/decryption', () => {
        it('should encrypt and decrypt style profile correctly', async () => {
            const originalProfile = {
                avgLength: 42,
                tone: { positive: 0.5, neutral: 0.3, aggressive: 0.2 },
                emojiUsage: { averagePerComment: 0.8, percentageWithEmojis: 60 },
                structures: { questionRate: 0.3, exclamationRate: 0.2 }
            };

            const encrypted = await styleProfileService.encryptStyleProfile(originalProfile);

            expect(encrypted).toHaveProperty('encrypted');
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted).toHaveProperty('authTag');
            expect(typeof encrypted.encrypted).toBe('string');
            expect(encrypted.iv.length).toBe(32); // 16 bytes in hex
            expect(encrypted.authTag.length).toBe(32); // 16 bytes in hex

            // Decrypt and verify
            const decrypted = await styleProfileService.decryptStyleProfile(encrypted);
            expect(decrypted).toEqual(originalProfile);
        });

        it('should produce different encrypted outputs for same input', async () => {
            const profile = { test: 'data' };

            const encrypted1 = await styleProfileService.encryptStyleProfile(profile);
            const encrypted2 = await styleProfileService.encryptStyleProfile(profile);

            // Different IVs should produce different ciphertexts
            expect(encrypted1.iv).not.toBe(encrypted2.iv);
            expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
        });
    });

    describe('needsRefresh', () => {
        it('should return true when no profile exists', async () => {
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Not found' }
            });

            const needsRefresh = await styleProfileService.needsRefresh('user123', 'twitter');
            expect(needsRefresh).toBe(true);
        });

        it('should return true when 90 days have passed', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 91);

            supabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    last_refresh: oldDate.toISOString(),
                    comment_count_since_refresh: 100
                },
                error: null
            });

            const needsRefresh = await styleProfileService.needsRefresh('user123', 'twitter');
            expect(needsRefresh).toBe(true);
        });

        it('should return true when 500 comments threshold reached', async () => {
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    last_refresh: new Date().toISOString(),
                    comment_count_since_refresh: 500
                },
                error: null
            });

            const needsRefresh = await styleProfileService.needsRefresh('user123', 'twitter');
            expect(needsRefresh).toBe(true);
        });

        it('should return false when no refresh needed', async () => {
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: {
                    last_refresh: new Date().toISOString(),
                    comment_count_since_refresh: 100
                },
                error: null
            });

            const needsRefresh = await styleProfileService.needsRefresh('user123', 'twitter');
            expect(needsRefresh).toBe(false);
        });
    });

    describe('analyzeEmojiUsage', () => {
        it('should correctly count emojis in comments', () => {
            const comments = [
                { text: 'Hello 😄 world 🌍' },
                { text: 'No emojis here' },
                { text: '🔥🔥🔥 Fire!' },
                { text: 'Mixed 😎 content 💪' }
            ];

            const usage = styleProfileService.analyzeEmojiUsage(comments);

            expect(usage.averagePerComment).toBe(1.75); // 7 emojis / 4 comments
            expect(usage.percentageWithEmojis).toBe(75); // 3 out of 4 comments
        });

        it('should handle comments without emojis', () => {
            const comments = [
                { text: 'Plain text' },
                { text: 'Another plain text' }
            ];

            const usage = styleProfileService.analyzeEmojiUsage(comments);

            expect(usage.averagePerComment).toBe(0);
            expect(usage.percentageWithEmojis).toBe(0);
        });
    });

    describe('analyzeStructures', () => {
        it('should detect question marks and exclamations', () => {
            const comments = [
                { text: 'Is this a question?' },
                { text: 'This is exciting!' },
                { text: 'Normal statement.' },
                { text: 'Another question? Really?' },
                { text: 'THIS IS ALL CAPS AND LONG ENOUGH' }
            ];

            const structures = styleProfileService.analyzeStructures(comments);

            expect(structures.questionRate).toBe(0.4); // 2 out of 5
            expect(structures.exclamationRate).toBe(0.2); // 1 out of 5
            expect(structures.capsLockRate).toBe(0.2); // 1 out of 5
        });

        it('should not count short caps lock text', () => {
            const comments = [
                { text: 'HELLO' }, // Too short
                { text: 'THIS IS A LONGER CAPS LOCK MESSAGE' } // Long enough
            ];

            const structures = styleProfileService.analyzeStructures(comments);

            expect(structures.capsLockRate).toBe(0.5); // 1 out of 2
        });
    });
});