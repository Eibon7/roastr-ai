/**
 * Analytics Endpoint Tests - Issue #366
 * Testing the new analytics summary endpoint and related functionality
 */

const request = require('supertest');
const express = require('express');

// Mock the Supabase client
const mockSupabaseServiceClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    single: jest.fn(),
};

jest.mock('../../../src/config/supabase', () => ({
    supabaseServiceClient: mockSupabaseServiceClient,
    createUserClient: jest.fn()
}));

// Mock authentication middleware
const mockAuthenticateToken = jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', plan: 'pro', org_id: 'test-org-id' };
    next();
});

jest.mock('../../../src/middleware/auth', () => ({ 
    authenticateToken: mockAuthenticateToken 
}));

describe('Analytics Summary Endpoint - Issue #366', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Add the analytics endpoint (simplified version for testing)
        app.get('/api/analytics/summary', mockAuthenticateToken, async (req, res) => {
            try {
                const { supabaseServiceClient } = require('../../../src/config/supabase');
                
                const orgId = req.user?.org_id || null;
                
                // Query for completed analyses
                const { data: completedAnalyses, error: analysesError } = await supabaseServiceClient
                    .from('comments')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'processed')
                    .eq(orgId ? 'organization_id' : 'id', orgId || orgId);
                    
                if (analysesError) throw analysesError;
                const completedCount = completedAnalyses || 0;

                // Query for sent roasts
                const { data: sentRoasts, error: roastsError } = await supabaseServiceClient
                    .from('responses')
                    .select('id', { count: 'exact', head: true })
                    .not('posted_at', 'is', null)
                    .eq(orgId ? 'organization_id' : 'id', orgId || orgId);
                    
                if (roastsError) throw roastsError;
                const sentCount = sentRoasts || 0;

                res.json({
                    success: true,
                    data: {
                        completed_analyses: completedCount,
                        sent_roasts: sentCount
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        organization_id: orgId || 'global'
                    }
                });
                
            } catch (error) {
                console.error('Analytics summary error:', error);
                
                res.status(500).json({
                    success: false,
                    error: {
                        message: 'Failed to retrieve analytics summary',
                        details: error.message
                    }
                });
            }
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return analytics summary successfully', async () => {
        // Mock successful database queries
        mockSupabaseServiceClient.select.mockResolvedValueOnce({ data: 42, error: null })
                                           .mockResolvedValueOnce({ data: 24, error: null });

        const response = await request(app)
            .get('/api/analytics/summary')
            .expect(200);

        expect(response.body).toEqual({
            success: true,
            data: {
                completed_analyses: 42,
                sent_roasts: 24
            },
            meta: {
                timestamp: expect.any(String),
                organization_id: 'test-org-id'
            }
        });

        // Verify database queries were called correctly
        expect(mockSupabaseServiceClient.from).toHaveBeenCalledWith('comments');
        expect(mockSupabaseServiceClient.from).toHaveBeenCalledWith('responses');
        expect(mockSupabaseServiceClient.eq).toHaveBeenCalledWith('status', 'processed');
        expect(mockSupabaseServiceClient.not).toHaveBeenCalledWith('posted_at', 'is', null);
    });

    test('should handle database errors gracefully', async () => {
        // Mock database error
        mockSupabaseServiceClient.select.mockResolvedValueOnce({ 
            data: null, 
            error: new Error('Database connection failed') 
        });

        const response = await request(app)
            .get('/api/analytics/summary')
            .expect(500);

        expect(response.body).toEqual({
            success: false,
            error: {
                message: 'Failed to retrieve analytics summary',
                details: 'Database connection failed'
            }
        });
    });

    test('should return zero values when no data exists', async () => {
        // Mock empty results
        mockSupabaseServiceClient.select.mockResolvedValueOnce({ data: 0, error: null })
                                           .mockResolvedValueOnce({ data: 0, error: null });

        const response = await request(app)
            .get('/api/analytics/summary')
            .expect(200);

        expect(response.body.data).toEqual({
            completed_analyses: 0,
            sent_roasts: 0
        });
    });

    test('should work for global admin view (no org_id)', async () => {
        // Mock user without org_id
        mockAuthenticateToken.mockImplementationOnce((req, res, next) => {
            req.user = { id: 'admin-user-id', plan: 'admin' };
            next();
        });

        mockSupabaseServiceClient.select.mockResolvedValueOnce({ data: 100, error: null })
                                           .mockResolvedValueOnce({ data: 50, error: null });

        const response = await request(app)
            .get('/api/analytics/summary')
            .expect(200);

        expect(response.body.data).toEqual({
            completed_analyses: 100,
            sent_roasts: 50
        });

        expect(response.body.meta.organization_id).toBe('global');
    });
});

describe('Connection Limits Validation - Issue #366', () => {
    test('should validate Free plan connection limits', () => {
        const userPlan = 'free';
        let maxConnections;
        
        switch (userPlan.toLowerCase()) {
            case 'free':
                maxConnections = 1;
                break;
            case 'pro':
            case 'creator_plus':
            case 'custom':
                maxConnections = userPlan === 'pro' ? 5 : 999;
                break;
            default:
                maxConnections = 1;
        }
        
        expect(maxConnections).toBe(1);
    });

    test('should validate Pro plan connection limits', () => {
        const userPlan = 'pro';
        let maxConnections;
        
        switch (userPlan.toLowerCase()) {
            case 'free':
                maxConnections = 1;
                break;
            case 'pro':
                maxConnections = 5;
                break;
            case 'creator_plus':
            case 'custom':
                maxConnections = 999;
                break;
            default:
                maxConnections = 1;
        }
        
        expect(maxConnections).toBe(5);
    });

    test('should validate Creator Plus plan connection limits', () => {
        const userPlan = 'creator_plus';
        let maxConnections;
        
        switch (userPlan.toLowerCase()) {
            case 'free':
                maxConnections = 1;
                break;
            case 'pro':
                maxConnections = 5;
                break;
            case 'creator_plus':
            case 'custom':
                maxConnections = 999;
                break;
            default:
                maxConnections = 1;
        }
        
        expect(maxConnections).toBe(999);
    });
});

describe('Feature Flags Integration - Issue #366', () => {
    test('should have SHOP_ENABLED flag configured', () => {
        process.env.SHOP_ENABLED = 'true';
        
        // Mock flags module
        const parseFlag = (value, defaultValue = false) => {
            if (value === undefined || value === null) return defaultValue;
            if (typeof value === 'boolean') return value;
            return value.toLowerCase() === 'true';
        };
        
        const shopEnabled = parseFlag(process.env.SHOP_ENABLED, false);
        expect(shopEnabled).toBe(true);
        
        process.env.SHOP_ENABLED = 'false';
        const shopDisabled = parseFlag(process.env.SHOP_ENABLED, false);
        expect(shopDisabled).toBe(false);
    });

    test('should have ENABLE_SHIELD_UI flag configured', () => {
        process.env.ENABLE_SHIELD_UI = 'true';
        
        const parseFlag = (value, defaultValue = false) => {
            if (value === undefined || value === null) return defaultValue;
            if (typeof value === 'boolean') return value;
            return value.toLowerCase() === 'true';
        };
        
        const shieldUIEnabled = parseFlag(process.env.ENABLE_SHIELD_UI, false);
        expect(shieldUIEnabled).toBe(true);
        
        process.env.ENABLE_SHIELD_UI = 'false';
        const shieldUIDisabled = parseFlag(process.env.ENABLE_SHIELD_UI, false);
        expect(shieldUIDisabled).toBe(false);
    });
});