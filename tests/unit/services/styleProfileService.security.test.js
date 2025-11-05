/**
 * StyleProfileService Security Tests
 * Critical Security Fixes - Phase 1
 * 
 * Tests the security fixes implemented for:
 * - Encryption key validation (no fallbacks)
 * - Additional Authenticated Data (AAD) implementation
 * - Database constraint validation
 */

const crypto = require('crypto');

// Mock environment variable
const originalEnv = process.env;

// Create a test-safe instance by directly requiring the class
let StyleProfileServiceClass;

describe('StyleProfileService Security Fixes', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        
        // Mock Supabase
        jest.mock('../../../src/config/supabase', () => ({
            supabaseServiceClient: {
                from: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                upsert: jest.fn().mockResolvedValue({ error: null }),
                single: jest.fn().mockResolvedValue({ data: null, error: null })
            }
        }));

        // Mock logger
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

        // Mock flags
        jest.mock('../../../src/config/flags', () => ({
            flags: {}
        }));
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Encryption Key Validation', () => {
        it('should throw error when STYLE_PROFILE_ENCRYPTION_KEY is missing', () => {
            delete process.env.STYLE_PROFILE_ENCRYPTION_KEY;
            
            expect(() => {
                require('../../../src/services/styleProfileService');
            }).toThrow('STYLE_PROFILE_ENCRYPTION_KEY environment variable is required');
        });

        it('should throw error when encryption key has wrong length', () => {
            process.env.STYLE_PROFILE_ENCRYPTION_KEY = 'short';
            
            expect(() => {
                require('../../../src/services/styleProfileService');
            }).toThrow('STYLE_PROFILE_ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
        });

        it('should throw error when encryption key is not hexadecimal', () => {
            process.env.STYLE_PROFILE_ENCRYPTION_KEY = 'g'.repeat(64); // Invalid hex
            
            expect(() => {
                require('../../../src/services/styleProfileService');
            }).toThrow('STYLE_PROFILE_ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
        });

        it('should accept valid 64-character hex key', () => {
            process.env.STYLE_PROFILE_ENCRYPTION_KEY = 'a'.repeat(64);
            
            expect(() => {
                require('../../../src/services/styleProfileService');
            }).not.toThrow();
        });
    });

    describe('AAD Implementation', () => {
        let service;
        
        beforeEach(() => {
            process.env.STYLE_PROFILE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
            StyleProfileServiceClass = require('../../../src/services/styleProfileService');
            service = StyleProfileServiceClass;
        });

        it('should require userId and platform for encryption', async () => {
            const styleProfile = { test: 'data' };
            
            await expect(service.encryptStyleProfile(styleProfile, null, 'twitter'))
                .rejects.toThrow('userId and platform are required for secure encryption');
            
            await expect(service.encryptStyleProfile(styleProfile, 'user123', null))
                .rejects.toThrow('userId and platform are required for secure encryption');
        });

        it('should require userId and platform for decryption', async () => {
            const encryptedData = {
                encrypted: 'encrypted-data',
                iv: 'a'.repeat(32),
                authTag: 'b'.repeat(32)
            };
            
            await expect(service.decryptStyleProfile(encryptedData, null, 'twitter'))
                .rejects.toThrow('userId and platform are required for secure decryption');
            
            await expect(service.decryptStyleProfile(encryptedData, 'user123', null))
                .rejects.toThrow('userId and platform are required for secure decryption');
        });

        it('should encrypt and decrypt with AAD successfully', async () => {
            const styleProfile = { 
                avgLength: 50,
                tone: { positive: 0.3, negative: 0.2 },
                timestamp: new Date().toISOString()
            };
            const userId = 'user123';
            const platform = 'twitter';

            // Encrypt
            const encrypted = await service.encryptStyleProfile(styleProfile, userId, platform);
            
            expect(encrypted).toHaveProperty('encrypted');
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted).toHaveProperty('authTag');
            expect(encrypted).toHaveProperty('aad');
            
            // Decrypt
            const decrypted = await service.decryptStyleProfile(encrypted, userId, platform);
            
            expect(decrypted).toEqual(styleProfile);
        });

        it('should fail decryption with wrong userId/platform (AAD mismatch)', async () => {
            const styleProfile = { test: 'data' };
            const userId = 'user123';
            const platform = 'twitter';

            // Encrypt with correct AAD
            const encrypted = await service.encryptStyleProfile(styleProfile, userId, platform);
            
            // Try to decrypt with wrong userId
            await expect(service.decryptStyleProfile(encrypted, 'wrong-user', platform))
                .rejects.toThrow('Failed to decrypt style profile: data may be corrupted or tampered with');
            
            // Try to decrypt with wrong platform
            await expect(service.decryptStyleProfile(encrypted, userId, 'wrong-platform'))
                .rejects.toThrow('Failed to decrypt style profile: data may be corrupted or tampered with');
        });

        it('should handle legacy data without AAD field', async () => {
            const legacyEncryptedData = {
                encrypted: 'some-encrypted-data',
                iv: 'a'.repeat(32),
                authTag: 'b'.repeat(32)
                // No 'aad' field - simulating legacy data
            };

            // This should use reconstructed AAD and log a warning
            try {
                await service.decryptStyleProfile(legacyEncryptedData, 'user123', 'twitter');
            } catch (error) {
                // Expected to fail since we don't have real encrypted data, but should use legacy path
                expect(error.message).toContain('Failed to decrypt style profile');
            }
        });
    });

    describe('Input Validation', () => {
        let service;
        
        beforeEach(() => {
            process.env.STYLE_PROFILE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
            StyleProfileServiceClass = require('../../../src/services/styleProfileService');
            service = StyleProfileServiceClass;
        });

        it('should validate encrypted data structure for decryption', async () => {
            const incompleteData = {
                encrypted: 'data',
                iv: 'a'.repeat(32)
                // Missing authTag
            };
            
            await expect(service.decryptStyleProfile(incompleteData, 'user123', 'twitter'))
                .rejects.toThrow('Invalid encrypted data: missing required fields');
        });

        it('should validate encrypted profile structure for storage', async () => {
            const incompleteProfile = {
                encrypted: 'data',
                iv: 'a'.repeat(32)
                // Missing authTag
            };
            
            await expect(service.storeStyleProfile('user123', 'twitter', incompleteProfile))
                .rejects.toThrow('Invalid encrypted profile: missing required fields');
        });
    });
});