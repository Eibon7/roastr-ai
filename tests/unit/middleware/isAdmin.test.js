const { isAdminMiddleware, optionalAdminMiddleware } = require('../../../src/middleware/isAdmin');

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn()
                }))
            }))
        }))
    },
    getUserFromToken: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

const { supabaseServiceClient, getUserFromToken } = require('../../../src/config/supabase');
const { logger } = require('../../../src/utils/logger');

describe('isAdmin Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
            user: null,
            accessToken: null
        };
        res = {
            status: jest.fn(() => res),
            json: jest.fn(() => res)
        };
        next = jest.fn();

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('isAdminMiddleware', () => {
        test('should reject request without Authorization header', async () => {
            await isAdminMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Authentication required',
                message: 'Se requiere autenticación para acceder al panel de administración'
            });
            expect(next).not.toHaveBeenCalled();
        });

        test('should reject request with invalid token format', async () => {
            req.headers.authorization = 'InvalidToken';

            await isAdminMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Authentication required',
                message: 'Se requiere autenticación para acceder al panel de administración'
            });
        });

        test('should reject request with invalid/expired token', async () => {
            req.headers.authorization = 'Bearer invalid-token';
            getUserFromToken.mockResolvedValue(null);

            await isAdminMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid or expired token',
                message: 'Token inválido o expirado'
            });
        });

        test('should reject request when user profile fetch fails', async () => {
            req.headers.authorization = 'Bearer valid-token';
            getUserFromToken.mockResolvedValue({ id: 'user-123' });

            const mockQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: null,
                            error: { message: 'Database error' }
                        }))
                    }))
                }))
            };
            supabaseServiceClient.from.mockReturnValue(mockQuery);

            await isAdminMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Access denied',
                message: 'No se pudo verificar el estado de administrador'
            });
        });

        test('should reject non-admin user', async () => {
            req.headers.authorization = 'Bearer valid-token';
            getUserFromToken.mockResolvedValue({ id: 'user-123' });

            const mockQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: {
                                id: 'user-123',
                                email: 'user@test.com',
                                is_admin: false,
                                active: true
                            },
                            error: null
                        }))
                    }))
                }))
            };
            supabaseServiceClient.from.mockReturnValue(mockQuery);

            await isAdminMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Admin access required',
                message: 'Se requieren permisos de administrador para acceder a esta sección'
            });
            expect(logger.warn).toHaveBeenCalledWith(
                'Non-admin user attempted to access admin panel:',
                { userId: 'user-123', email: 'user@test.com' }
            );
        });

        test('should reject inactive admin user', async () => {
            req.headers.authorization = 'Bearer valid-token';
            getUserFromToken.mockResolvedValue({ id: 'admin-123' });

            const mockQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: {
                                id: 'admin-123',
                                email: 'admin@test.com',
                                is_admin: true,
                                active: false
                            },
                            error: null
                        }))
                    }))
                }))
            };
            supabaseServiceClient.from.mockReturnValue(mockQuery);

            await isAdminMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Account inactive',
                message: 'Cuenta de administrador inactiva'
            });
        });

        test('should allow active admin user', async () => {
            req.headers.authorization = 'Bearer valid-token';
            getUserFromToken.mockResolvedValue({ id: 'admin-123' });

            const mockQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: {
                                id: 'admin-123',
                                email: 'admin@test.com',
                                name: 'Admin User',
                                is_admin: true,
                                active: true
                            },
                            error: null
                        }))
                    }))
                }))
            };
            supabaseServiceClient.from.mockReturnValue(mockQuery);

            await isAdminMiddleware(req, res, next);

            expect(req.user).toEqual({
                id: 'admin-123',
                email: 'admin@test.com',
                name: 'Admin User',
                is_admin: true,
                active: true
            });
            expect(req.accessToken).toBe('valid-token');
            expect(next).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                'Admin access granted:',
                { userId: 'admin-123', email: 'admin@test.com' }
            );
        });

        test('should handle unexpected errors gracefully', async () => {
            req.headers.authorization = 'Bearer valid-token';
            getUserFromToken.mockRejectedValue(new Error('Unexpected error'));

            await isAdminMiddleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Internal server error',
                message: 'Error interno del servidor'
            });
            expect(logger.error).toHaveBeenCalledWith('Admin middleware error:', 'Unexpected error');
        });
    });

    describe('optionalAdminMiddleware', () => {
        test('should continue without authentication when no token provided', async () => {
            await optionalAdminMiddleware(req, res, next);

            expect(req.user).toBeNull();
            expect(req.accessToken).toBeNull();
            expect(next).toHaveBeenCalled();
        });

        test('should set user info when valid token provided', async () => {
            req.headers.authorization = 'Bearer valid-token';
            getUserFromToken.mockResolvedValue({ id: 'admin-123' });

            const mockQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({
                            data: {
                                id: 'admin-123',
                                email: 'admin@test.com',
                                is_admin: true,
                                active: true
                            },
                            error: null
                        }))
                    }))
                }))
            };
            supabaseServiceClient.from.mockReturnValue(mockQuery);

            await optionalAdminMiddleware(req, res, next);

            expect(req.user).toEqual({
                id: 'admin-123',
                email: 'admin@test.com',
                is_admin: true,
                active: true
            });
            expect(req.isAdmin).toBe(true);
            expect(next).toHaveBeenCalled();
        });

        test('should continue gracefully when authentication fails', async () => {
            req.headers.authorization = 'Bearer invalid-token';
            getUserFromToken.mockRejectedValue(new Error('Token error'));

            await optionalAdminMiddleware(req, res, next);

            expect(req.user).toBeNull();
            expect(next).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith('Optional admin middleware error:', 'Token error');
        });
    });
});