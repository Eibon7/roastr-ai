/**
 * Enhanced Integration Routes Tests
 * Comprehensive tests for integrations-new.js with proper mocking and isolation
 */

const request = require('supertest');
const express = require('express');

// Mock the auth middleware before requiring the route
jest.mock('../../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user-123' };
        next();
    }
}));

// Mock the flags
jest.mock('../../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn(() => true)
    }
}));

const { router } = require('../../../src/routes/integrations-new');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/integrations', router);

describe('Enhanced Integration Routes Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/integrations/platforms', () => {
        it('should return all supported platforms', async () => {
            const response = await request(app)
                .get('/api/integrations/platforms')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.platforms).toBeInstanceOf(Array);
            expect(response.body.data.count).toBe(7);

            // Verify required platforms are included
            const platformNames = response.body.data.platforms.map(p => p.name);
            expect(platformNames).toEqual(
                expect.arrayContaining(['twitter', 'instagram', 'youtube', 'tiktok', 'linkedin', 'facebook', 'bluesky'])
            );
        });

        it('should return platforms with correct structure', async () => {
            const response = await request(app)
                .get('/api/integrations/platforms')
                .expect(200);

            const platforms = response.body.data.platforms;
            platforms.forEach(platform => {
                expect(platform).toHaveProperty('name');
                expect(platform).toHaveProperty('displayName');
                expect(platform).toHaveProperty('icon');
                expect(platform).toHaveProperty('description');
                expect(platform).toHaveProperty('maxImportLimit');
                expect(platform).toHaveProperty('importDelay');
                expect(platform).toHaveProperty('languages');
                expect(platform.maxImportLimit).toBe(300);
                expect(Array.isArray(platform.languages)).toBe(true);
            });
        });

        it('should handle errors gracefully', async () => {
            // Mock an error in the SUPPORTED_PLATFORMS access
            const originalValues = Object.values;
            Object.values = jest.fn(() => {
                throw new Error('Test error');
            });

            const response = await request(app)
                .get('/api/integrations/platforms')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Could not get supported platforms');

            // Restore original function
            Object.values = originalValues;
        });
    });

    describe('GET /api/integrations/status', () => {
        it('should return empty status for new user', async () => {
            const response = await request(app)
                .get('/api/integrations/status')
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.integrations).toBeInstanceOf(Array);
            expect(response.body.data.connectedCount).toBe(0);
            expect(response.body.data.totalPlatforms).toBe(7);

            // All platforms should show disconnected status
            response.body.data.integrations.forEach(integration => {
                expect(integration.status).toBe('disconnected');
                expect(integration.importedCount).toBe(0);
                expect(integration.connectedAt).toBeNull();
                expect(integration.lastImport).toBeNull();
            });
        });

        it('should handle errors gracefully', async () => {
            // Mock an error by making the route fail
            const originalMap = global.Map;
            global.Map = function() {
                throw new Error('Map error');
            };

            const response = await request(app)
                .get('/api/integrations/status')
                .set('Authorization', 'Bearer test-token')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Could not get integration status');

            // Restore original Map
            global.Map = originalMap;
        });
    });

    describe('POST /api/integrations/connect', () => {
        it('should require platform parameter', async () => {
            const response = await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform is required');
        });

        it('should reject non-string platform parameter', async () => {
            const response = await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 123 })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform is required');
        });

        it('should reject unsupported platform', async () => {
            const response = await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'unsupported_platform' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unsupported platform');
            expect(response.body.supportedPlatforms).toBeInstanceOf(Array);
            expect(response.body.supportedPlatforms).toEqual(
                expect.arrayContaining(['twitter', 'instagram', 'youtube'])
            );
        });

        it('should successfully connect to Twitter', async () => {
            const response = await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.platform).toBe('twitter');
            expect(response.body.data.status).toBe('connected');
            expect(response.body.data.connectedAt).toBeDefined();
        });

        it('should successfully connect to all supported platforms', async () => {
            const platforms = ['twitter', 'instagram', 'youtube', 'tiktok', 'linkedin', 'facebook', 'bluesky'];
            
            for (const platform of platforms) {
                const response = await request(app)
                    .post('/api/integrations/connect')
                    .set('Authorization', 'Bearer test-token')
                    .send({ platform })
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.platform).toBe(platform);
                expect(response.body.data.status).toBe('connected');
            }
        });

        it('should handle already connected platform', async () => {
            // First connection
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' })
                .expect(200);

            // Second connection attempt
            const response = await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('connected');
            expect(response.body.message).toContain('already connected');
        });
    });

    describe('POST /api/integrations/import', () => {
        beforeEach(async () => {
            // Connect twitter first for import tests
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' });
        });

        it('should require platform parameter', async () => {
            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform is required');
        });

        it('should reject unsupported platform', async () => {
            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'unsupported' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unsupported platform');
        });

        it('should require platform to be connected first', async () => {
            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'instagram' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform not connected. Please connect first.');
        });

        it('should successfully start import from connected platform', async () => {
            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.platform).toBe('twitter');
            expect(response.body.data.status).toBe('importing');
            expect(response.body.data.importedCount).toBeGreaterThan(0);
        });

        it('should respect maximum import limit', async () => {
            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter', count: 500 })
                .expect(200);

            expect(response.body.data.importedCount).toBeLessThanOrEqual(300);
        });

        it('should use default count when not specified', async () => {
            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' })
                .expect(200);

            expect(response.body.data.importedCount).toBeGreaterThan(0);
            expect(response.body.data.importedCount).toBeLessThanOrEqual(300);
        });
    });

    describe('GET /api/integrations/import/status/:platform', () => {
        beforeEach(async () => {
            // Connect and import for status tests
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' });

            await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'twitter' });
        });

        it('should reject unsupported platform', async () => {
            const response = await request(app)
                .get('/api/integrations/import/status/unsupported')
                .set('Authorization', 'Bearer test-token')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unsupported platform');
        });

        it('should return import status for connected platform', async () => {
            const response = await request(app)
                .get('/api/integrations/import/status/twitter')
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.platform).toBe('twitter');
            expect(response.body.data.status).toBe('connected');
            expect(response.body.data.importedCount).toBeGreaterThan(0);
        });

        it('should return status for disconnected platform', async () => {
            const response = await request(app)
                .get('/api/integrations/import/status/instagram')
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.platform).toBe('instagram');
            expect(response.body.data.status).toBe('disconnected');
            expect(response.body.data.importedCount).toBe(0);
        });
    });

    describe('POST /api/integrations/disconnect', () => {
        beforeEach(async () => {
            // Connect platform first for disconnect tests
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'instagram' });
        });

        it('should require platform parameter', async () => {
            const response = await request(app)
                .post('/api/integrations/disconnect')
                .set('Authorization', 'Bearer test-token')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform is required');
        });

        it('should reject unsupported platform', async () => {
            const response = await request(app)
                .post('/api/integrations/disconnect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'unsupported' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unsupported platform');
        });

        it('should fail for not connected platform', async () => {
            const response = await request(app)
                .post('/api/integrations/disconnect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'linkedin' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Platform not connected');
        });

        it('should successfully disconnect from platform', async () => {
            const response = await request(app)
                .post('/api/integrations/disconnect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'instagram' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.platform).toBe('instagram');
            expect(response.body.data.status).toBe('disconnected');
        });

        it('should clear import data when disconnecting', async () => {
            // Import some data first
            await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'instagram' });

            // Then disconnect
            await request(app)
                .post('/api/integrations/disconnect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'instagram' });

            // Check status is cleared
            const statusResponse = await request(app)
                .get('/api/integrations/import/status/instagram')
                .set('Authorization', 'Bearer test-token');

            expect(statusResponse.body.data.importedCount).toBe(0);
        });
    });

    describe('Integration flow testing', () => {
        it('should handle complete connect-import-disconnect flow', async () => {
            const platform = 'youtube';

            // 1. Connect
            const connectResponse = await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform })
                .expect(200);

            expect(connectResponse.body.data.status).toBe('connected');

            // 2. Import
            const importResponse = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform })
                .expect(200);

            expect(importResponse.body.data.status).toBe('importing');
            expect(importResponse.body.data.importedCount).toBeGreaterThan(0);

            // 3. Check status
            const statusResponse = await request(app)
                .get(`/api/integrations/import/status/${platform}`)
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            expect(statusResponse.body.data.platform).toBe(platform);
            expect(statusResponse.body.data.status).toBe('connected');

            // 4. Disconnect
            const disconnectResponse = await request(app)
                .post('/api/integrations/disconnect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform })
                .expect(200);

            expect(disconnectResponse.body.data.status).toBe('disconnected');

            // 5. Verify disconnection
            const finalStatusResponse = await request(app)
                .get(`/api/integrations/import/status/${platform}`)
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            expect(finalStatusResponse.body.data.status).toBe('disconnected');
            expect(finalStatusResponse.body.data.importedCount).toBe(0);
        });

        it('should handle multiple platforms simultaneously', async () => {
            const platforms = ['twitter', 'instagram', 'youtube'];

            // Connect all platforms
            for (const platform of platforms) {
                await request(app)
                    .post('/api/integrations/connect')
                    .set('Authorization', 'Bearer test-token')
                    .send({ platform })
                    .expect(200);
            }

            // Check overall status
            const statusResponse = await request(app)
                .get('/api/integrations/status')
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            expect(statusResponse.body.data.connectedCount).toBe(3);

            // Disconnect all
            for (const platform of platforms) {
                await request(app)
                    .post('/api/integrations/disconnect')
                    .set('Authorization', 'Bearer test-token')
                    .send({ platform })
                    .expect(200);
            }

            // Verify all disconnected
            const finalStatusResponse = await request(app)
                .get('/api/integrations/status')
                .set('Authorization', 'Bearer test-token')
                .expect(200);

            expect(finalStatusResponse.body.data.connectedCount).toBe(0);
        });
    });

    describe('Helper function coverage', () => {
        it('should test generateMockContent indirectly via import', async () => {
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'tiktok' });

            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'tiktok', count: 50 })
                .expect(200);

            expect(response.body.data.importedCount).toBe(50);
            expect(response.body.data.languageHints).toBeInstanceOf(Array);
        });

        it('should test detectLanguageHints with various scenarios', async () => {
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'facebook' });

            // Import enough content to trigger language detection
            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'facebook', count: 200 })
                .expect(200);

            expect(response.body.data.languageHints).toBeInstanceOf(Array);
            expect(response.body.data.languageHints.length).toBeGreaterThan(0);
        });
    });

    describe('Error handling', () => {
        it('should handle various error scenarios in connect', async () => {
            // Test with null platform
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: null })
                .expect(400);

            // Test with empty string platform
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: '' })
                .expect(400);
        });

        it('should handle edge cases in import', async () => {
            // Connect first
            await request(app)
                .post('/api/integrations/connect')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'bluesky' });

            // Test with negative count
            const response = await request(app)
                .post('/api/integrations/import')
                .set('Authorization', 'Bearer test-token')
                .send({ platform: 'bluesky', count: -10 })
                .expect(200);

            // Should default to reasonable count
            expect(response.body.data.importedCount).toBeGreaterThan(0);
        });
    });
});