const request = require('supertest');
const express = require('express');

// Mock logger first
jest.mock('../../src/utils/logger', () => ({
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
jest.mock('../../src/services/authService', () => ({
    signUp: jest.fn(),
    signIn: jest.fn(),
    signInWithMagicLink: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    signInWithGoogle: jest.fn(),
    verifyEmail: jest.fn()
}));

// Mock the middleware
jest.mock('../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'mock-user-id', email: 'test@example.com' };
        req.accessToken = 'mock-token';
        next();
    },
    requireAdmin: (req, res, next) => next()
}));

const authRoutes = require('../../src/routes/auth');
const authService = require('../../src/services/authService');

describe('Auth Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        
        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const mockUser = {
                user: { id: '123', email: 'test@example.com' },
                session: { access_token: 'token123' }
            };
            
            authService.signUp.mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Registration successful');
            expect(authService.signUp).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            });
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com'
                    // missing password
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Email and password are required');
        });

        it('should validate password length', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: '123' // too short
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Password must be at least 6 characters long');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login user successfully', async () => {
            const mockLoginResult = {
                user: { id: '123', email: 'test@example.com' },
                session: { access_token: 'token123', refresh_token: 'refresh123', expires_at: 1234567890 },
                profile: { is_admin: false, name: 'Test User', plan: 'basic' }
            };
            
            authService.signIn.mockResolvedValue(mockLoginResult);

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Login successful');
            expect(response.body.data.user.email).toBe('test@example.com');
        });

        it('should return generic error for invalid credentials', async () => {
            authService.signIn.mockRejectedValue(new Error('Invalid credentials'));

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Wrong email or password');
        });
    });

    describe('POST /api/auth/magic-link', () => {
        it('should send magic link successfully', async () => {
            const mockResult = {
                message: 'Magic link sent to your email',
                email: 'test@example.com'
            };
            
            authService.signInWithMagicLink.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/api/auth/magic-link')
                .send({
                    email: 'test@example.com'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Magic link sent');
        });

        it('should always return success to prevent email enumeration', async () => {
            authService.signInWithMagicLink.mockRejectedValue(new Error('User not found'));

            const response = await request(app)
                .post('/api/auth/magic-link')
                .send({
                    email: 'nonexistent@example.com'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('If an account with this email exists');
        });
    });

    describe('POST /api/auth/reset-password', () => {
        it('should send password reset email', async () => {
            const mockResult = {
                message: 'Password reset email sent',
                email: 'test@example.com'
            };
            
            authService.resetPassword.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    email: 'test@example.com'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('If an account with this email exists');
        });
    });

    describe('POST /api/auth/update-password', () => {
        it('should update password successfully', async () => {
            const mockResult = {
                message: 'Password updated successfully'
            };
            
            authService.updatePassword.mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/api/auth/update-password')
                .send({
                    access_token: 'valid-token',
                    password: 'newpassword123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Password updated successfully');
        });

        it('should validate password length', async () => {
            const response = await request(app)
                .post('/api/auth/update-password')
                .send({
                    access_token: 'valid-token',
                    password: '123' // too short
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Password must be at least 6 characters long');
        });
    });

    describe('GET /api/auth/google', () => {
        it('should redirect to Google OAuth URL', async () => {
            const mockResult = {
                url: 'https://accounts.google.com/oauth/authorize?...',
                message: 'Redirecting to Google authentication...'
            };
            
            authService.signInWithGoogle.mockResolvedValue(mockResult);

            const response = await request(app)
                .get('/api/auth/google');

            expect(response.status).toBe(302);
            expect(response.header.location).toBe(mockResult.url);
        });
    });
});