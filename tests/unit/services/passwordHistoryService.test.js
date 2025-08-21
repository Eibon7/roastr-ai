/**
 * Tests for Password History Service (Issue #133)
 */

// Create bcrypt mock without requiring the real module
const mockBcrypt = {
    hash: jest.fn(),
    compare: jest.fn()
};

// Mock bcrypt module
jest.doMock('bcrypt', () => mockBcrypt);

// Mock logger first
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock Supabase
const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn()
};

jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabaseServiceClient
}));

// Mock flags
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn((flag) => {
            if (flag === 'ENABLE_PASSWORD_HISTORY') return true;
            return false;
        })
    }
}));

describe('PasswordHistoryService', () => {
    let passwordHistoryService;
    const { logger } = require('../../../src/utils/logger');
    const { flags } = require('../../../src/config/flags');

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Reset mock implementations
        mockSupabaseServiceClient.from.mockReturnThis();
        mockSupabaseServiceClient.select.mockReturnThis();
        mockSupabaseServiceClient.insert.mockReturnThis();
        mockSupabaseServiceClient.delete.mockReturnThis();
        mockSupabaseServiceClient.eq.mockReturnThis();
        mockSupabaseServiceClient.order.mockReturnThis();
        mockSupabaseServiceClient.limit.mockReturnThis();
        mockSupabaseServiceClient.in.mockReturnThis();
        
        // Re-require service to get fresh instance
        delete require.cache[require.resolve('../../../src/services/passwordHistoryService')];
        passwordHistoryService = require('../../../src/services/passwordHistoryService');
    });

    describe('isPasswordRecentlyUsed', () => {
        it('should return false when password history is disabled', async () => {
            flags.isEnabled.mockReturnValue(false);
            
            const result = await passwordHistoryService.isPasswordRecentlyUsed('user-123', 'testPassword123');
            
            expect(result).toBe(false);
            expect(mockSupabaseServiceClient.from).not.toHaveBeenCalled();
        });

        it('should return false when user has no password history', async () => {
            flags.isEnabled.mockReturnValue(true);
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: [],
                error: null
            });
            
            const result = await passwordHistoryService.isPasswordRecentlyUsed('user-123', 'testPassword123');
            
            expect(result).toBe(false);
            expect(mockSupabaseServiceClient.from).toHaveBeenCalledWith('password_history');
        });

        it('should return true when password matches recent history', async () => {
            flags.isEnabled.mockReturnValue(true);
            
            const testPassword = 'testPassword123';
            
            // Mock bcrypt.compare to return true for the first password and false for the second
            mockBcrypt.compare.mockImplementation((password, hash) => {
                if (hash === 'matching_hash') return Promise.resolve(true);
                return Promise.resolve(false);
            });
            
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: [
                    { password_hash: 'matching_hash' },
                    { password_hash: 'different_hash' }
                ],
                error: null
            });
            
            const result = await passwordHistoryService.isPasswordRecentlyUsed('user-123', testPassword);
            
            expect(result).toBe(true);
            expect(logger.info).toHaveBeenCalledWith('Password reuse detected', { 
                userId: 'user-123', 
                historyCount: 2 
            });
        });

        it('should return false when password does not match any in history', async () => {
            flags.isEnabled.mockReturnValue(true);
            
            // Mock bcrypt.compare to always return false (no matches)
            mockBcrypt.compare.mockResolvedValue(false);
            
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: [
                    { password_hash: 'old_hash_1' },
                    { password_hash: 'old_hash_2' }
                ],
                error: null
            });
            
            const result = await passwordHistoryService.isPasswordRecentlyUsed('user-123', 'newUniquePassword');
            
            expect(result).toBe(false);
        });

        it('should handle database errors gracefully', async () => {
            flags.isEnabled.mockReturnValue(true);
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });
            
            const result = await passwordHistoryService.isPasswordRecentlyUsed('user-123', 'testPassword123');
            
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('Error checking password history:', { message: 'Database error' });
        });

        it('should handle unexpected errors gracefully', async () => {
            flags.isEnabled.mockReturnValue(true);
            
            // Mock the chain to reject at the select level
            mockSupabaseServiceClient.from.mockReturnThis();
            mockSupabaseServiceClient.select.mockReturnThis();
            mockSupabaseServiceClient.eq.mockReturnThis();
            mockSupabaseServiceClient.order.mockReturnThis();
            mockSupabaseServiceClient.limit.mockRejectedValue(new Error('Network error'));
            
            const result = await passwordHistoryService.isPasswordRecentlyUsed('user-123', 'testPassword123');
            
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('Error in isPasswordRecentlyUsed:', expect.any(Error));
        });
    });

    describe('addToPasswordHistory', () => {
        it('should return true when password history is disabled', async () => {
            flags.isEnabled.mockReturnValue(false);
            
            const result = await passwordHistoryService.addToPasswordHistory('user-123', 'testPassword123');
            
            expect(result).toBe(true);
            expect(mockSupabaseServiceClient.from).not.toHaveBeenCalled();
        });

        it('should successfully add password to history', async () => {
            flags.isEnabled.mockReturnValue(true);
            mockBcrypt.hash.mockResolvedValue('hashed_password_123');
            
            mockSupabaseServiceClient.insert.mockResolvedValue({
                error: null
            });

            // Mock the cleanup method to avoid issues
            jest.spyOn(passwordHistoryService, 'cleanupOldPasswords').mockResolvedValue();
            
            const result = await passwordHistoryService.addToPasswordHistory('user-123', 'testPassword123');
            
            expect(result).toBe(true);
            expect(mockBcrypt.hash).toHaveBeenCalledWith('testPassword123', 12);
            expect(mockSupabaseServiceClient.from).toHaveBeenCalledWith('password_history');
            expect(mockSupabaseServiceClient.insert).toHaveBeenCalledWith({
                user_id: 'user-123',
                password_hash: 'hashed_password_123'
            });
            expect(passwordHistoryService.cleanupOldPasswords).toHaveBeenCalledWith('user-123');
            expect(logger.info).toHaveBeenCalledWith('Password added to history', { userId: 'user-123' });
        });

        it('should handle database insertion errors', async () => {
            flags.isEnabled.mockReturnValue(true);
            mockSupabaseServiceClient.insert.mockResolvedValue({
                error: { message: 'Insertion failed' }
            });
            
            const result = await passwordHistoryService.addToPasswordHistory('user-123', 'testPassword123');
            
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('Error adding password to history:', { message: 'Insertion failed' });
        });

        it('should handle unexpected errors', async () => {
            flags.isEnabled.mockReturnValue(true);
            mockSupabaseServiceClient.insert.mockRejectedValue(new Error('Network error'));
            
            const result = await passwordHistoryService.addToPasswordHistory('user-123', 'testPassword123');
            
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('Error in addToPasswordHistory:', expect.any(Error));
        });
    });

    describe('cleanupOldPasswords', () => {
        it('should not delete anything when within limit', async () => {
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: [
                    { id: '1', created_at: '2023-01-03' },
                    { id: '2', created_at: '2023-01-02' },
                    { id: '3', created_at: '2023-01-01' }
                ],
                error: null
            });
            
            await passwordHistoryService.cleanupOldPasswords('user-123');
            
            expect(mockSupabaseServiceClient.delete).not.toHaveBeenCalled();
        });

        it('should delete oldest passwords when over limit', async () => {
            // Create 7 passwords (more than the 5 limit)
            const passwords = Array.from({ length: 7 }, (_, i) => ({
                id: `id-${i}`,
                created_at: `2023-01-${String(10 - i).padStart(2, '0')}`
            }));
            
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: passwords,
                error: null
            });
            
            mockSupabaseServiceClient.delete.mockResolvedValue({
                error: null
            });
            
            await passwordHistoryService.cleanupOldPasswords('user-123');
            
            expect(mockSupabaseServiceClient.delete).toHaveBeenCalled();
            expect(mockSupabaseServiceClient.in).toHaveBeenCalledWith('id', ['id-5', 'id-6']);
            expect(logger.info).toHaveBeenCalledWith('Cleaned up old password history', {
                userId: 'user-123',
                deletedCount: 2
            });
        });

        it('should handle cleanup errors gracefully', async () => {
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: null,
                error: { message: 'Fetch error' }
            });
            
            await passwordHistoryService.cleanupOldPasswords('user-123');
            
            expect(logger.error).toHaveBeenCalledWith('Error fetching passwords for cleanup:', { message: 'Fetch error' });
        });
    });

    describe('clearPasswordHistory', () => {
        it('should successfully clear all password history', async () => {
            mockSupabaseServiceClient.delete.mockResolvedValue({
                error: null
            });
            
            const result = await passwordHistoryService.clearPasswordHistory('user-123');
            
            expect(result).toBe(true);
            expect(mockSupabaseServiceClient.from).toHaveBeenCalledWith('password_history');
            expect(mockSupabaseServiceClient.delete).toHaveBeenCalled();
            expect(mockSupabaseServiceClient.eq).toHaveBeenCalledWith('user_id', 'user-123');
            expect(logger.info).toHaveBeenCalledWith('Cleared password history for user', { userId: 'user-123' });
        });

        it('should handle deletion errors', async () => {
            mockSupabaseServiceClient.delete.mockResolvedValue({
                error: { message: 'Deletion failed' }
            });
            
            const result = await passwordHistoryService.clearPasswordHistory('user-123');
            
            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('Error clearing password history:', { message: 'Deletion failed' });
        });
    });

    describe('getPasswordHistoryStats', () => {
        it('should return correct stats for user with history', async () => {
            const historyData = [
                { id: '1', created_at: '2023-01-03T10:00:00Z' },
                { id: '2', created_at: '2023-01-02T10:00:00Z' },
                { id: '3', created_at: '2023-01-01T10:00:00Z' }
            ];
            
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: historyData,
                error: null
            });
            
            const result = await passwordHistoryService.getPasswordHistoryStats('user-123');
            
            expect(result).toEqual({
                count: 3,
                oldestPasswordDate: '2023-01-01T10:00:00Z',
                newestPasswordDate: '2023-01-03T10:00:00Z',
                historyLimit: 5
            });
        });

        it('should return empty stats for user with no history', async () => {
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: [],
                error: null
            });
            
            const result = await passwordHistoryService.getPasswordHistoryStats('user-123');
            
            expect(result).toEqual({
                count: 0,
                oldestPasswordDate: null,
                newestPasswordDate: null,
                historyLimit: 5
            });
        });

        it('should handle database errors gracefully', async () => {
            mockSupabaseServiceClient.select.mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });
            
            const result = await passwordHistoryService.getPasswordHistoryStats('user-123');
            
            expect(result).toEqual({
                count: 0,
                oldestPasswordDate: null,
                newestPasswordDate: null
            });
            expect(logger.error).toHaveBeenCalledWith('Error getting password history stats:', { message: 'Database error' });
        });
    });

    describe('Legacy compatibility functions', () => {
        it('should provide backward-compatible API', async () => {
            flags.isEnabled.mockReturnValue(true);
            
            // Test legacy function names
            expect(typeof passwordHistoryService.isPasswordReused).toBe('function');
            expect(typeof passwordHistoryService.addPasswordToHistory).toBe('function');
            expect(typeof passwordHistoryService.isPasswordHistoryEnabled).toBe('function');
            
            // Test that legacy functions work
            expect(passwordHistoryService.isPasswordHistoryEnabled()).toBe(true);
            
            const config = passwordHistoryService.getConfig();
            expect(config).toHaveProperty('historyLimit');
            expect(config).toHaveProperty('enabled');
        });
    });
});