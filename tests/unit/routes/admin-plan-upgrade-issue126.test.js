const request = require('supertest');
const express = require('express');

// Mock logger first
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

// Mock the auth service
const mockAuthService = {
    updateUserPlan: jest.fn()
};

jest.mock('../../../src/services/authService', () => mockAuthService);

// Mock the middleware
jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'admin-id-123', email: 'admin@test.com', is_admin: true };
        next();
    },
    requireAdmin: (req, res, next) => {
        next();
    }
}));

// Import after mocks
const authRoutes = require('../../../src/routes/auth');

describe('Admin Plan Update API - Issue #126 Fixes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        
        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('POST /api/auth/admin/users/:id/update-plan (Path Parameter Route)', () => {
        it('should successfully update user plan using path parameter', async () => {
            // Mock successful plan update
            mockAuthService.updateUserPlan.mockResolvedValue({
                message: 'User plan updated successfully',
                user: { 
                    id: 'user-123', 
                    email: 'user@test.com', 
                    plan: 'pro' 
                },
                oldPlan: 'free',
                newPlan: 'pro',
                limitsApplied: true,
                auditLogged: true,
                planDurationDays: 30,
                warnings: []
            });

            const response = await request(app)
                .post('/api/auth/admin/users/user-123/update-plan')
                .send({ newPlan: 'pro' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toBe('User plan updated successfully');
            expect(mockAuthService.updateUserPlan).toHaveBeenCalledWith('user-123', 'pro', 'admin-id-123');
        });

        it('should validate required fields for path parameter route', async () => {
            const response = await request(app)
                .post('/api/auth/admin/users/user-123/update-plan')
                .send({}); // Missing newPlan

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User ID and new plan are required');
        });

        it('should validate plan values for path parameter route', async () => {
            const response = await request(app)
                .post('/api/auth/admin/users/user-123/update-plan')
                .send({ newPlan: 'invalid_plan' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid plan. Valid plans are: free, starter, pro, plus, creator_plus, custom');
        });

        it('should handle missing user ID in path', async () => {
            const response = await request(app)
                .post('/api/auth/admin/users//update-plan')
                .send({ newPlan: 'pro' });

            expect(response.status).toBe(404); // Express will return 404 for malformed path
        });
    });

    describe('Improved Error Handling (Issue #126)', () => {
        it('should return warnings for partial subscription update failures', async () => {
            // Mock partial failure - subscription update failed but user plan updated
            mockAuthService.updateUserPlan.mockResolvedValue({
                message: 'User plan updated with warnings (subscription update failed)',
                user: { 
                    id: 'user-123', 
                    email: 'user@test.com', 
                    plan: 'pro' 
                },
                oldPlan: 'free',
                newPlan: 'pro',
                limitsApplied: true,
                auditLogged: true,
                planDurationDays: 30,
                warnings: [{
                    type: 'subscription_update_failed',
                    message: 'Failed to update subscription table',
                    details: 'Connection timeout error'
                }]
            });

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({ 
                    userId: 'user-123', 
                    newPlan: 'pro' 
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('with warnings');
            expect(response.body.data.warnings).toHaveLength(1);
            expect(response.body.data.warnings[0].type).toBe('subscription_update_failed');
        });

        it('should handle rollback scenarios gracefully', async () => {
            // Mock rollback scenario
            mockAuthService.updateUserPlan.mockRejectedValue(
                new Error('Plan change failed during limits application and was rolled back: Database connection failed')
            );

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({ 
                    userId: 'user-123', 
                    newPlan: 'pro' 
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('rolled back');
        });

        it('should provide detailed error context for admin debugging', async () => {
            // Mock a service error
            mockAuthService.updateUserPlan.mockRejectedValue(
                new Error('User not found')
            );

            const response = await request(app)
                .post('/api/auth/admin/users/user-123/update-plan')
                .send({ newPlan: 'pro' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('Admin ID Handling (Issue #126 Fix)', () => {
        it('should correctly pass admin ID from authenticated user to both routes', async () => {
            mockAuthService.updateUserPlan.mockResolvedValue({
                message: 'User plan updated successfully',
                user: { id: 'user-123', plan: 'pro' },
                oldPlan: 'free',
                newPlan: 'pro',
                warnings: []
            });

            // Test body-based route
            await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({ userId: 'user-123', newPlan: 'pro' });

            expect(mockAuthService.updateUserPlan).toHaveBeenLastCalledWith('user-123', 'pro', 'admin-id-123');

            // Test path-based route
            await request(app)
                .post('/api/auth/admin/users/user-123/update-plan')
                .send({ newPlan: 'starter' });

            expect(mockAuthService.updateUserPlan).toHaveBeenLastCalledWith('user-123', 'starter', 'admin-id-123');
        });
    });

    describe('Plan Duration Configuration Support (Issue #126)', () => {
        it('should handle variable plan durations correctly', async () => {
            // Mock response with custom plan duration
            mockAuthService.updateUserPlan.mockResolvedValue({
                message: 'User plan updated successfully',
                user: { id: 'user-123', plan: 'custom' },
                oldPlan: 'free',
                newPlan: 'custom',
                limitsApplied: true,
                auditLogged: true,
                planDurationDays: 90, // Custom plan has 90-day duration
                warnings: []
            });

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({ 
                    userId: 'user-123', 
                    newPlan: 'custom' 
                });

            expect(response.status).toBe(200);
            expect(response.body.data.planDurationDays).toBe(90);
        });

        it('should support all valid plan types with their durations', async () => {
            const validPlans = ['free', 'starter', 'pro', 'plus', 'creator_plus', 'custom'];
            
            for (const plan of validPlans) {
                mockAuthService.updateUserPlan.mockResolvedValue({
                    message: 'User plan updated successfully',
                    user: { id: 'user-123', plan },
                    oldPlan: 'free',
                    newPlan: plan,
                    warnings: []
                });

                const response = await request(app)
                    .post('/api/auth/admin/users/update-plan')
                    .send({ 
                        userId: 'user-123', 
                        newPlan: plan
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            }
        });
    });
});