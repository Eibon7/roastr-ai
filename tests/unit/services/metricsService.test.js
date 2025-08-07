const metricsService = require('../../../src/services/metricsService');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
    }
}));

// Mock supabase
jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(),
                    limit: jest.fn(() => ({
                        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                })),
                gte: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({ data: [], error: null }))
                })),
                order: jest.fn(() => Promise.resolve({ data: [], error: null })),
                limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
        }))
    }
}));

describe('MetricsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getDashboardMetrics', () => {
        it('should return comprehensive dashboard metrics', async () => {
            const result = await metricsService.getDashboardMetrics();
            
            expect(result).toHaveProperty('users');
            expect(result).toHaveProperty('roasts');
            expect(result).toHaveProperty('topUsers');
            expect(result).toHaveProperty('integrations');
            
            expect(result.users).toHaveProperty('total');
            expect(result.users).toHaveProperty('suspended');
            expect(result.users).toHaveProperty('new_this_week');
            
            expect(result.roasts).toHaveProperty('total');
            expect(result.roasts).toHaveProperty('today');
            expect(result.roasts).toHaveProperty('this_week');
            expect(result.roasts).toHaveProperty('this_month');
        });

        it('should handle database errors gracefully', async () => {
            // Mock database error
            const { supabaseServiceClient } = require('../../../src/config/supabase');
            supabaseServiceClient.from.mockReturnValue({
                select: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({ 
                        data: null, 
                        error: { message: 'Database error' } 
                    }))
                }))
            });

            const result = await metricsService.getDashboardMetrics();
            
            // Should return fallback data
            expect(result.users.total).toBe(0);
            expect(result.roasts.total).toBe(0);
        });
    });

    describe('getUserMetrics', () => {
        it('should return user metrics with fallback data', async () => {
            const result = await metricsService.getUserMetrics();
            
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('suspended');
            expect(result).toHaveProperty('new_this_week');
            expect(typeof result.total).toBe('number');
            expect(typeof result.suspended).toBe('number');
            expect(typeof result.new_this_week).toBe('number');
        });
    });

    describe('getRoastMetrics', () => {
        it('should return roast metrics with fallback data', async () => {
            const result = await metricsService.getRoastMetrics();
            
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('today');
            expect(result).toHaveProperty('this_week');
            expect(result).toHaveProperty('this_month');
            expect(typeof result.total).toBe('number');
            expect(typeof result.today).toBe('number');
        });
    });

    describe('getTopUsers', () => {
        it('should return top 5 users by activity', async () => {
            const result = await metricsService.getTopUsers();
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeLessThanOrEqual(5);
            
            if (result.length > 0) {
                expect(result[0]).toHaveProperty('name');
                expect(result[0]).toHaveProperty('email');
                expect(result[0]).toHaveProperty('total_roasts');
                expect(result[0]).toHaveProperty('monthly_roasts');
            }
        });
    });

    describe('getIntegrationsStatus', () => {
        it('should return integration status with statistics', async () => {
            const result = await metricsService.getIntegrationsStatus();
            
            expect(result).toHaveProperty('integrations');
            expect(result).toHaveProperty('stats');
            expect(Array.isArray(result.integrations)).toBe(true);
            
            expect(result.stats).toHaveProperty('total');
            expect(result.stats).toHaveProperty('active');
            expect(result.stats).toHaveProperty('configured');
            expect(result.stats).toHaveProperty('enabled');
        });

        it('should include standard integration platforms', async () => {
            const result = await metricsService.getIntegrationsStatus();
            
            const platformNames = result.integrations.map(i => i.name);
            expect(platformNames).toContain('Twitter');
            expect(platformNames).toContain('YouTube');
            expect(platformNames).toContain('Instagram');
        });
    });
});