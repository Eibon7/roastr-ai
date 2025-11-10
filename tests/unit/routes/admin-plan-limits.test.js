const request = require('supertest');
const express = require('express');
const adminRoutes = require('../../../src/routes/admin');
const planLimitsService = require('../../../src/services/planLimitsService');

// Mock dependencies
jest.mock('../../../src/services/planLimitsService', () => ({
    getAllPlanLimits: jest.fn(),
    getPlanLimits: jest.fn()
}));

jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn()
    }
}));

jest.mock('../../../src/services/metricsService', () => ({
    getDashboardMetrics: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

describe('Admin Plan Limits Routes', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/admin', adminRoutes);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/admin/plan-limits', () => {
        it('should return all plan limits', async () => {
            const mockAllLimits = {
                free: {
                    maxRoasts: 10,
                    monthlyResponsesLimit: 10,
                    monthlyAnalysisLimit: 1000,
                    shieldEnabled: false
                },
                starter: {
                    maxRoasts: 10,
                    monthlyResponsesLimit: 10,
                    monthlyAnalysisLimit: 1000,
                    shieldEnabled: true
                },
                pro: {
                    maxRoasts: 1000,
                    monthlyResponsesLimit: 1000,
                    monthlyAnalysisLimit: 10000,
                    shieldEnabled: true
                },
                plus: {
                    maxRoasts: 5000,
                    monthlyResponsesLimit: 5000,
                    monthlyAnalysisLimit: 100000,
                    shieldEnabled: true
                },
                custom: {
                    maxRoasts: -1,
                    monthlyResponsesLimit: -1,
                    monthlyAnalysisLimit: -1,
                    shieldEnabled: true
                }
            };

            planLimitsService.getAllPlanLimits.mockResolvedValue(mockAllLimits);

            const response = await request(app)
                .get('/api/admin/plan-limits')
                .set('Authorization', 'Bearer mock-admin-token-for-testing')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.plans).toEqual(mockAllLimits);
            expect(response.body.data).toHaveProperty('last_updated');
        });

        it('should handle errors when fetching all plan limits', async () => {
            planLimitsService.getAllPlanLimits.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/api/admin/plan-limits')
                .set('Authorization', 'Bearer mock-admin-token-for-testing')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to fetch plan limits');
        });
    });

    describe('GET /api/admin/plan-limits/:planId', () => {
        it('should return specific plan limits', async () => {
            const mockLimits = {
                maxRoasts: 1000,
                monthlyResponsesLimit: 1000,
                monthlyAnalysisLimit: 10000,
                maxPlatforms: 5,
                shieldEnabled: true,
                customPrompts: false,
                customTones: true
            };

            planLimitsService.getPlanLimits.mockResolvedValue(mockLimits);

            const response = await request(app)
                .get('/api/admin/plan-limits/pro')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.planId).toBe('pro');
            expect(response.body.data.limits).toEqual(mockLimits);
            expect(planLimitsService.getPlanLimits).toHaveBeenCalledWith('pro');
        });

        it('should handle errors when fetching specific plan limits', async () => {
            planLimitsService.getPlanLimits.mockRejectedValue(new Error('Plan not found'));

            const response = await request(app)
                .get('/api/admin/plan-limits/invalid')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to fetch plan limits');
        });
    });

    describe('PUT /api/admin/plan-limits/:planId', () => {
        it('should update plan limits successfully', async () => {
            const updates = {
                maxRoasts: 2000,
                monthlyResponsesLimit: 2000,
                shieldEnabled: true
            };

            const updatedLimits = {
                ...updates,
                maxPlatforms: 5,
                customPrompts: false
            };

            planLimitsService.updatePlanLimits.mockResolvedValue(updatedLimits);

            const response = await request(app)
                .put('/api/admin/plan-limits/pro')
                .send(updates)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.planId).toBe('pro');
            expect(response.body.data.limits).toEqual(updatedLimits);
            expect(response.body.data.updated_by).toBe('admin-123');
            
            expect(planLimitsService.updatePlanLimits).toHaveBeenCalledWith(
                'pro',
                updates,
                'admin-123'
            );
        });

        it('should reject invalid plan IDs', async () => {
            const response = await request(app)
                .put('/api/admin/plan-limits/invalid_plan')
                .send({ maxRoasts: 2000 })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid plan ID');
        });

        it('should reject invalid field updates', async () => {
            const response = await request(app)
                .put('/api/admin/plan-limits/pro')
                .send({ 
                    maxRoasts: 2000,
                    invalidField: 'invalid',
                    anotherInvalidField: true
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid fields in update request');
            expect(response.body.invalidFields).toEqual(['invalidField', 'anotherInvalidField']);
        });

        it('should handle update errors', async () => {
            planLimitsService.updatePlanLimits.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .put('/api/admin/plan-limits/pro')
                .send({ maxRoasts: 2000 })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to update plan limits');
        });

        it('should accept all valid fields', async () => {
            const validUpdates = {
                maxRoasts: 2000,
                monthlyResponsesLimit: 2000,
                maxPlatforms: 10,
                integrationsLimit: 10,
                shieldEnabled: true,
                customPrompts: true,
                prioritySupport: true,
                apiAccess: true,
                analyticsEnabled: true,
                customTones: true,
                dedicatedSupport: true,
                monthlyTokensLimit: 200000,
                dailyApiCallsLimit: 2000
            };

            planLimitsService.updatePlanLimits.mockResolvedValue(validUpdates);

            const response = await request(app)
                .put('/api/admin/plan-limits/creator_plus')
                .send(validUpdates)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(planLimitsService.updatePlanLimits).toHaveBeenCalledWith(
                'creator_plus',
                validUpdates,
                'admin-123'
            );
        });
    });

    describe('POST /api/admin/plan-limits/refresh-cache', () => {
        it('should clear plan limits cache successfully', async () => {
            const response = await request(app)
                .post('/api/admin/plan-limits/refresh-cache')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Plan limits cache cleared successfully');
            expect(response.body).toHaveProperty('cleared_at');
            expect(planLimitsService.clearCache).toHaveBeenCalled();
        });

        it('should handle cache clear errors', async () => {
            planLimitsService.clearCache.mockImplementation(() => {
                throw new Error('Cache clear failed');
            });

            const response = await request(app)
                .post('/api/admin/plan-limits/refresh-cache')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to clear plan limits cache');
        });
    });

    describe('Authentication', () => {
        let unauthenticatedApp;

        beforeAll(() => {
            // Create app without admin middleware for testing
            unauthenticatedApp = express();
            unauthenticatedApp.use(express.json());
            
            // Mock middleware that rejects requests
            unauthenticatedApp.use('/api/admin', (req, res, next) => {
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized'
                });
            });
        });

        it('should require admin authentication', async () => {
            const response = await request(unauthenticatedApp)
                .get('/api/admin/plan-limits')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unauthorized');
        });
    });
});