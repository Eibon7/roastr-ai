/**
 * Tests for Password Enhancement Features (Issue #133)
 * Tests the integration of rate limiting and password history in auth routes
 */

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

// Mock password history service
const mockPasswordHistoryService = {
    isPasswordRecentlyUsed: jest.fn(),
    addToPasswordHistory: jest.fn()
};
jest.mock('../../../src/services/passwordHistoryService', () => mockPasswordHistoryService);

// Mock the auth service
const mockAuthService = {
    updatePasswordWithVerification: jest.fn()
};
jest.mock('../../../src/services/authService', () => mockAuthService);

// Mock the middleware
jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'user-123', email: 'test@example.com' };
        req.accessToken = 'mock-token';
        next();
    },
    requireAdmin: (req, res, next) => {
        req.user = { id: 'admin-123', email: 'admin@example.com', is_admin: true };
        next();
    }
}));

// Mock rate limiter
const mockPasswordChangeRateLimiter = jest.fn((req, res, next) => next());
jest.mock('../../../src/middleware/rateLimiter', () => ({
    loginRateLimiter: jest.fn((req, res, next) => next()),
    passwordChangeRateLimiter: mockPasswordChangeRateLimiter,
    getRateLimitMetrics: jest.fn(),
    resetRateLimit: jest.fn()
}));

// Mock password validator
jest.mock('../../../src/utils/passwordValidator', () => ({
    validatePassword: jest.fn((password) => {
        if (password && password.length >= 8) {
            return { isValid: true, errors: [] };
        }
        return { isValid: false, errors: ['Password must be at least 8 characters long'] };
    })
}));

const authRoutes = require('../../../src/routes/auth');

describe('Password Enhancement Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        
        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('POST /api/auth/change-password with enhancements', () => {
        it('should apply rate limiting middleware', async () => {
            mockAuthService.updatePasswordWithVerification.mockResolvedValue({
                message: 'Password updated successfully',
                user: { id: 'user-123', email: 'test@example.com' }
            });

            await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'NewPassword123!'
                });

            expect(mockPasswordChangeRateLimiter).toHaveBeenCalled();
        });

        it('should successfully change password with all enhancements', async () => {
            mockAuthService.updatePasswordWithVerification.mockResolvedValue({
                message: 'Password updated successfully',
                user: { id: 'user-123', email: 'test@example.com' }
            });

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'NewPassword123!'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Password changed successfully');
            expect(mockAuthService.updatePasswordWithVerification).toHaveBeenCalledWith(
                'mock-token',
                'currentPass123',
                'NewPassword123!'
            );
        });

        it('should reject password reuse when history service detects it', async () => {
            mockAuthService.updatePasswordWithVerification.mockRejectedValue(
                new Error('This password was recently used. Please choose a different password.')
            );

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'OldReusedPass123!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('recently used');
        });

        it('should handle rate limiting blocks', async () => {
            // Mock rate limiter to block the request
            mockPasswordChangeRateLimiter.mockImplementation((req, res, next) => {
                return res.status(429).json({
                    success: false,
                    error: 'Too many password change attempts. Please try again later.',
                    code: 'PASSWORD_CHANGE_RATE_LIMITED',
                    retryAfter: 60,
                    message: 'For security reasons, password changes are limited. Please wait 60 minutes before trying again.'
                });
            });

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'NewPassword123!'
                });

            expect(response.status).toBe(429);
            expect(response.body.code).toBe('PASSWORD_CHANGE_RATE_LIMITED');
            expect(response.body.retryAfter).toBe(60);
            expect(mockAuthService.updatePasswordWithVerification).not.toHaveBeenCalled();
        });

        it('should validate password strength', async () => {
            const { validatePassword } = require('../../../src/utils/passwordValidator');
            validatePassword.mockReturnValue({
                isValid: false,
                errors: ['Password must be at least 8 characters long']
            });

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'weak' // Too short
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Password must be at least 8 characters long');
            expect(mockAuthService.updatePasswordWithVerification).not.toHaveBeenCalled();
        });

        it('should reject when passwords are the same', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'samePassword123',
                    newPassword: 'samePassword123' // Same as current
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('New password must be different from current password');
            expect(mockAuthService.updatePasswordWithVerification).not.toHaveBeenCalled();
        });

        it('should require all password fields', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123'
                    // Missing newPassword
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Current password and new password are required');
            expect(mockAuthService.updatePasswordWithVerification).not.toHaveBeenCalled();
        });

        it('should handle current password verification failure', async () => {
            mockAuthService.updatePasswordWithVerification.mockRejectedValue(
                new Error('Current password is incorrect')
            );

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'wrongCurrentPass',
                    newPassword: 'NewPassword123!'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Current password is incorrect');
        });

        it('should handle authentication failures', async () => {
            mockAuthService.updatePasswordWithVerification.mockRejectedValue(
                new Error('Authentication failed. Please log in again.')
            );

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'NewPassword123!'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Authentication failed. Please log in again.');
        });

        it('should handle user not found errors', async () => {
            mockAuthService.updatePasswordWithVerification.mockRejectedValue(
                new Error('User not found')
            );

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'NewPassword123!'
                });

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('User not found');
        });

        it('should handle generic service errors', async () => {
            mockAuthService.updatePasswordWithVerification.mockRejectedValue(
                new Error('Database connection failed')
            );

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'NewPassword123!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Database connection failed');
        });
    });

    describe('Security Headers and Middleware Order', () => {
        it('should apply middlewares in correct order', async () => {
            const middlewareCallOrder = [];
            
            // Track middleware execution order
            mockPasswordChangeRateLimiter.mockImplementation((req, res, next) => {
                middlewareCallOrder.push('rateLimiter');
                next();
            });

            mockAuthService.updatePasswordWithVerification.mockImplementation(() => {
                middlewareCallOrder.push('authService');
                return Promise.resolve({
                    message: 'Password updated successfully',
                    user: { id: 'user-123', email: 'test@example.com' }
                });
            });

            await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer mock-token')
                .send({
                    currentPassword: 'currentPass123',
                    newPassword: 'NewPassword123!'
                });

            // Rate limiter should be called before auth service
            expect(middlewareCallOrder).toEqual(['rateLimiter', 'authService']);
        });
    });
});