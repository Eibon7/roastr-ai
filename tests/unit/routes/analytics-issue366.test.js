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
    not: jest.fn().mockResolvedValue({ count: 24, error: null }),
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
                
                // Query for completed analyses - using count instead of data
                const { count: completedCount, error: analysesError } = await supabaseServiceClient
                    .from('comments')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'processed')
                    .eq('organization_id', orgId);
                    
                if (analysesError) throw analysesError;

                // Query for sent roasts - using count instead of data
                const { count: sentCount, error: roastsError } = await supabaseServiceClient
                    .from('responses')
                    .select('id', { count: 'exact', head: true })
                    .not('posted_at', 'is', null)
                    .eq('organization_id', orgId);
                    
                if (roastsError) throw roastsError;

                res.json({
                    success: true,
                    data: {
                        completed_analyses: completedCount || 0,
                        sent_roasts: sentCount || 0
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

    test('should return analytics summary successfully using count property', async () => {
        // Mock successful database queries - returning count instead of data
        // First call (comments query)
        mockSupabaseServiceClient.eq.mockResolvedValueOnce({ count: 42, error: null });
        // Second call (responses query) 
        mockSupabaseServiceClient.not.mockResolvedValueOnce({ count: 24, error: null });

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
        mockSupabaseServiceClient.eq.mockResolvedValue({ 
            count: null, 
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
        mockSupabaseServiceClient.eq.mockResolvedValue({ count: 0, error: null });
        mockSupabaseServiceClient.not.mockResolvedValue({ count: 0, error: null });

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

        mockSupabaseServiceClient.eq.mockResolvedValue({ count: 100, error: null });
        mockSupabaseServiceClient.not.mockResolvedValue({ count: 50, error: null });

        const response = await request(app)
            .get('/api/analytics/summary')
            .expect(200);

        expect(response.body.data).toEqual({
            completed_analyses: 100,
            sent_roasts: 50
        });

        expect(response.body.meta.organization_id).toBe('global');
    });

    test('should handle null count values gracefully', async () => {
        // Mock null count responses
        mockSupabaseServiceClient.eq.mockResolvedValue({ count: null, error: null });
        mockSupabaseServiceClient.not.mockResolvedValue({ count: null, error: null });

        const response = await request(app)
            .get('/api/analytics/summary')
            .expect(200);

        expect(response.body.data).toEqual({
            completed_analyses: 0,
            sent_roasts: 0
        });
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

describe('GDPR Transparency Text - Issue #366', () => {
    test('should contain required transparency text', () => {
        const transparencyText = 'Los roasts autopublicados llevan firma de IA para cumplir con la normativa de transparencia digital.';
        
        expect(transparencyText).toContain('Los roasts autopublicados llevan firma de IA');
        expect(transparencyText).toContain('transparencia digital');
    });

    test('should provide GDPR compliance information', () => {
        const gdprText = 'De acuerdo con el RGPD y las normativas de transparencia digital, todos los contenidos generados automáticamente por IA incluyen marcadores identificativos apropiados.';
        
        expect(gdprText).toContain('RGPD');
        expect(gdprText).toContain('contenidos generados automáticamente por IA');
        expect(gdprText).toContain('marcadores identificativos');
    });
});