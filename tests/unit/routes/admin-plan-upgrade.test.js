const request = require('supertest');
const express = require('express');

// Mock logger first  
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
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

describe('Admin Plan Upgrade/Downgrade API', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        
        // Reset all mocks
        jest.clearAllMocks();
    });

    describe('POST /api/auth/admin/users/update-plan', () => {
        it('should successfully upgrade user plan from free to pro', async () => {
            // Mock successful plan update
            mockAuthService.updateUserPlan.mockResolvedValue({
                message: 'User plan updated successfully',
                user: { id: 'user-123', email: 'user@test.com', plan: 'pro', name: 'Test User' },
                oldPlan: 'free',
                newPlan: 'pro',
                limitsApplied: true,
                auditLogged: true
            });

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'user-123',
                    newPlan: 'pro'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.newPlan).toBe('pro');
            expect(response.body.data.oldPlan).toBe('free');
            expect(response.body.data.limitsApplied).toBe(true);
            expect(response.body.data.auditLogged).toBe(true);
            
            // Verify service was called with correct parameters
            expect(mockAuthService.updateUserPlan).toHaveBeenCalledWith('user-123', 'pro', 'admin-id-123');
        });

        it('should successfully downgrade user plan from pro to free', async () => {
            // Mock successful plan downgrade
            mockAuthService.updateUserPlan.mockResolvedValue({
                message: 'User plan updated successfully',
                user: { id: 'user-123', email: 'user@test.com', plan: 'free', name: 'Test User' },
                oldPlan: 'pro',
                newPlan: 'free',
                limitsApplied: true,
                auditLogged: true
            });

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'user-123',
                    newPlan: 'free'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.newPlan).toBe('free');
            expect(response.body.data.oldPlan).toBe('pro');
            
            // Verify service was called with correct parameters
            expect(mockAuthService.updateUserPlan).toHaveBeenCalledWith('user-123', 'free', 'admin-id-123');
        });

        it('should return unchanged when plan is already the same', async () => {
            // Mock unchanged plan response
            mockAuthService.updateUserPlan.mockResolvedValue({
                message: 'Plan is already set to pro',
                user: { id: 'user-123', email: 'user@test.com', plan: 'pro', name: 'Test User' },
                newPlan: 'pro',
                unchanged: true
            });

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'user-123',
                    newPlan: 'pro'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.unchanged).toBe(true);
            expect(response.body.data.message).toBe('Plan is already set to pro');
        });

        it('should reject plan change when validation fails', async () => {
            // Mock validation failure
            mockAuthService.updateUserPlan.mockRejectedValue(new Error('Plan change not allowed: Usage exceeds free plan limits. Warnings: You have 150 roasts this month, free plan allows only 10'));

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'user-123',
                    newPlan: 'free'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Plan change not allowed: Usage exceeds free plan limits');
            expect(response.body.error).toContain('You have 150 roasts this month');
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'user-123'
                    // Missing newPlan
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User ID and new plan are required');
        });

        it('should validate plan values', async () => {
            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'user-123',
                    newPlan: 'invalid_plan'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid plan. Valid plans are: free, starter, pro, plus, creator_plus, custom');
        });

        it('should handle user not found error', async () => {
            // Mock user not found error
            mockAuthService.updateUserPlan.mockRejectedValue(new Error('User not found'));

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'nonexistent-user',
                    newPlan: 'pro'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User not found');
        });

        it('should handle database update errors gracefully', async () => {
            // Mock database update failure
            mockAuthService.updateUserPlan.mockRejectedValue(new Error('Failed to update user plan: Database connection failed'));

            const response = await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'user-123',
                    newPlan: 'pro'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to update user plan: Database connection failed');
        });

        it('should verify admin ID is passed to service', async () => {
            // Mock successful plan update
            mockAuthService.updateUserPlan.mockResolvedValue({
                message: 'User plan updated successfully',
                user: { id: 'user-123', email: 'user@test.com', plan: 'pro', name: 'Test User' },
                oldPlan: 'free',
                newPlan: 'pro',
                limitsApplied: true,
                auditLogged: true
            });

            await request(app)
                .post('/api/auth/admin/users/update-plan')
                .send({
                    userId: 'user-123',
                    newPlan: 'pro'
                });

            // Verify that the admin ID from the authenticated user is passed to the service
            expect(mockAuthService.updateUserPlan).toHaveBeenCalledWith('user-123', 'pro', 'admin-id-123');
        });
    });
});