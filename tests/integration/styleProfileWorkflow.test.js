const request = require('supertest');
const { app } = require('../../src/index');
const styleProfileService = require('../../src/services/styleProfileService');
const queueService = require('../../src/services/queueService');
const { supabaseServiceClient } = require('../../src/config/supabase');

// Mock dependencies
jest.mock('../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn()
    }
}));

jest.mock('../../src/services/queueService', () => ({
    addJob: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock('../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn().mockReturnValue(true)
    }
}));

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user-123', plan: 'pro' };
        next();
    }
}));

describe('Style Profile Workflow Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/style-profile/extract', () => {
        it('should queue style profile extraction for Pro user', async () => {
            // Mock plan check
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: { plan: 'pro' },
                error: null
            });

            // Mock queue service
            queueService.addJob.mockResolvedValueOnce({
                id: 'job-123',
                data: { userId: 'test-user-123', platform: 'twitter' }
            });

            const response = await request(app)
                .post('/api/style-profile/extract')
                .set('Authorization', 'Bearer test-token')
                .send({
                    platform: 'twitter',
                    accountRef: '@testuser'
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                message: 'Style profile extraction queued',
                jobId: 'job-123'
            });

            expect(queueService.addJob).toHaveBeenCalledWith(
                'style_profile',
                {
                    userId: 'test-user-123',
                    platform: 'twitter',
                    accountRef: '@testuser',
                    isRefresh: false
                },
                { priority: 2 }
            );
        });

        it('should reject request with missing parameters', async () => {
            const response = await request(app)
                .post('/api/style-profile/extract')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' }); // Missing accountRef

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: false,
                error: 'Platform and accountRef are required'
            });
        });

        it('should reject Free plan users', async () => {
            // Mock plan check for requirePlan middleware
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: { plan: 'free' },
                error: null
            });

            const response = await request(app)
                .post('/api/style-profile/extract')
                .set('Authorization', 'Bearer test-token')
                .send({
                    platform: 'twitter',
                    accountRef: '@testuser'
                });

            expect(response.status).toBe(403);
        });
    });

    describe('GET /api/style-profile/status', () => {
        it('should return profile status for existing profile', async () => {
            // Mock profile metadata
            jest.spyOn(styleProfileService, 'getProfileMetadata').mockResolvedValueOnce({
                last_refresh: '2024-01-01T00:00:00Z',
                comment_count_since_refresh: 150,
                created_at: '2023-12-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            });

            // Mock needsRefresh
            jest.spyOn(styleProfileService, 'needsRefresh').mockResolvedValueOnce(false);

            const response = await request(app)
                .get('/api/style-profile/status')
                .set('Authorization', 'Bearer test-token')
                .query({ platform: 'twitter' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                profile: {
                    exists: true,
                    needsRefresh: false,
                    lastRefresh: '2024-01-01T00:00:00Z',
                    commentsSinceRefresh: 150
                }
            });
        });

        it('should return status for non-existent profile', async () => {
            jest.spyOn(styleProfileService, 'getProfileMetadata').mockResolvedValueOnce(null);
            jest.spyOn(styleProfileService, 'needsRefresh').mockResolvedValueOnce(true);

            const response = await request(app)
                .get('/api/style-profile/status')
                .set('Authorization', 'Bearer test-token')
                .query({ platform: 'instagram' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                profile: {
                    exists: false,
                    needsRefresh: true,
                    lastRefresh: null,
                    commentsSinceRefresh: 0
                }
            });
        });

        it('should require platform parameter', async () => {
            const response = await request(app)
                .get('/api/style-profile/status')
                .set('Authorization', 'Bearer test-token');

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: false,
                error: 'Platform parameter is required'
            });
        });
    });

    describe('POST /api/style-profile/refresh', () => {
        it('should queue manual refresh with high priority', async () => {
            // Mock plan check
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: { plan: 'plus' },
                error: null
            });

            queueService.addJob.mockResolvedValueOnce({
                id: 'job-456',
                data: { userId: 'test-user-123', platform: 'youtube' }
            });

            const response = await request(app)
                .post('/api/style-profile/refresh')
                .set('Authorization', 'Bearer test-token')
                .send({
                    platform: 'youtube',
                    accountRef: 'channel123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                message: 'Style profile refresh queued',
                jobId: 'job-456'
            });

            expect(queueService.addJob).toHaveBeenCalledWith(
                'style_profile',
                {
                    userId: 'test-user-123',
                    platform: 'youtube',
                    accountRef: 'channel123',
                    isRefresh: true
                },
                { priority: 1 } // High priority for manual refresh
            );
        });
    });

    describe('End-to-end style profile flow', () => {
        it('should complete full extraction workflow', async () => {
            // 1. User connects platform
            // This would trigger style profile extraction automatically
            
            // 2. Check status - profile doesn't exist yet
            jest.spyOn(styleProfileService, 'getProfileMetadata').mockResolvedValueOnce(null);
            jest.spyOn(styleProfileService, 'needsRefresh').mockResolvedValueOnce(true);

            const statusBefore = await request(app)
                .get('/api/style-profile/status')
                .set('Authorization', 'Bearer test-token')
                .query({ platform: 'twitter' });

            expect(statusBefore.body.profile.exists).toBe(false);
            expect(statusBefore.body.profile.needsRefresh).toBe(true);

            // 3. Queue extraction
            queueService.addJob.mockResolvedValueOnce({
                id: 'job-789',
                data: { userId: 'test-user-123', platform: 'twitter' }
            });

            const extractResponse = await request(app)
                .post('/api/style-profile/extract')
                .set('Authorization', 'Bearer test-token')
                .send({
                    platform: 'twitter',
                    accountRef: '@testuser'
                });

            expect(extractResponse.status).toBe(200);
            expect(extractResponse.body.jobId).toBe('job-789');

            // 4. After processing (simulated) - check status again
            jest.spyOn(styleProfileService, 'getProfileMetadata').mockResolvedValueOnce({
                last_refresh: new Date().toISOString(),
                comment_count_since_refresh: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            jest.spyOn(styleProfileService, 'needsRefresh').mockResolvedValueOnce(false);

            const statusAfter = await request(app)
                .get('/api/style-profile/status')
                .set('Authorization', 'Bearer test-token')
                .query({ platform: 'twitter' });

            expect(statusAfter.body.profile.exists).toBe(true);
            expect(statusAfter.body.profile.needsRefresh).toBe(false);
            expect(statusAfter.body.profile.commentsSinceRefresh).toBe(0);
        });
    });
});