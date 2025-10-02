/**
 * Integration tests for Entitlements Flow - Issue #168
 * Tests complete flow from Stripe subscription to usage enforcement
 */

const request = require('supertest');
const express = require('express');
const EntitlementsService = require('../../src/services/entitlementsService');
const { UsageEnforcementMiddleware } = require('../../src/middleware/usageEnforcement');
const { supabaseServiceClient } = require('../../src/config/supabase');
const StripeWrapper = require('../../src/services/stripeWrapper');

// Mock external dependencies
jest.mock('../../src/config/supabase', () => ({
    supabaseServiceClient: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        upsert: jest.fn(),
        rpc: jest.fn()
    }
}));

jest.mock('../../src/services/stripeWrapper');
jest.mock('../../src/config/flags', () => ({
    flags: {
        isEnabled: jest.fn().mockReturnValue(true)
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('Entitlements Integration Flow', () => {
    let app;
    let entitlementsService;
    let mockStripeWrapper;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Stripe wrapper
        mockStripeWrapper = {
            prices: {
                retrieve: jest.fn()
            }
        };
        StripeWrapper.mockImplementation(() => mockStripeWrapper);

        entitlementsService = new EntitlementsService();

        // Setup Express app with test routes
        app = express();
        app.use(express.json());

        // Mock authentication middleware
        app.use((req, res, next) => {
            req.user = { id: 'test-user-123', email: 'test@example.com' };
            next();
        });

        // Initialize usage enforcement
        app.locals.entitlementsService = entitlementsService;

        // Test routes
        app.post('/api/analysis', 
            ...UsageEnforcementMiddleware.forAnalysis(1),
            (req, res) => {
                res.json({ success: true, result: 'analysis complete' });
            }
        );

        app.post('/api/roast',
            ...UsageEnforcementMiddleware.forRoasts(1),
            (req, res) => {
                res.json({ success: true, result: 'roast generated' });
            }
        );

        app.get('/api/shield-feature',
            UsageEnforcementMiddleware.requireShield(),
            (req, res) => {
                res.json({ success: true, message: 'Shield feature accessed' });
            }
        );

        app.get('/api/premium-feature',
            UsageEnforcementMiddleware.requirePremiumRQC(),
            (req, res) => {
                res.json({ success: true, message: 'Premium feature accessed' });
            }
        );

        app.get('/api/usage-summary', 
            new UsageEnforcementMiddleware().attachUsageSummary(),
            (req, res) => {
                res.json({ 
                    success: true, 
                    usage: req.usageSummary || null 
                });
            }
        );
    });

    describe('Starter Plan Flow', () => {
        const starterPrice = {
            id: 'price_starter123',
            lookup_key: 'starter_monthly',
            metadata: {
                analysis_limit_monthly: '1000',
                roast_limit_monthly: '10',
                model: 'gpt-3.5-turbo',
                shield_enabled: 'false',
                rqc_mode: 'basic',
                plan_name: 'starter'
            },
            product: {
                id: 'prod_starter123',
                name: 'Starter Plan',
                metadata: {}
            }
        };

        beforeEach(async () => {
            // Setup Starter plan entitlements
            mockStripeWrapper.prices.retrieve.mockResolvedValue(starterPrice);
            
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: {
                            account_id: 'test-user-123',
                            analysis_limit_monthly: 1000,
                            roast_limit_monthly: 10,
                            model: 'gpt-3.5-turbo',
                            shield_enabled: false,
                            rqc_mode: 'basic',
                            plan_name: 'starter'
                        }
                    })
                })
            });

            // Set entitlements from Stripe Price
            await entitlementsService.setEntitlementsFromStripePrice('test-user-123', 'price_starter123');
        });

        it('should allow analysis requests under limit', async () => {
            // Mock usage check - under limit
            supabaseServiceClient.rpc.mockResolvedValue({ data: true, error: null });
            
            // Mock current entitlements and usage for detailed response
            supabaseServiceClient.single
                .mockResolvedValueOnce({
                    data: {
                        analysis_limit_monthly: 1000,
                        roast_limit_monthly: 10,
                        shield_enabled: false
                    },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: {
                        analysis_used: 50,
                        roasts_used: 25,
                        period_start: '2024-01-01',
                        period_end: '2024-01-31'
                    },
                    error: null
                });

            const response = await request(app)
                .post('/api/analysis')
                .send({ text: 'Test analysis request' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.result).toBe('analysis complete');
        });

        it('should block analysis requests when limit reached', async () => {
            // Mock usage check - limit reached
            supabaseServiceClient.rpc.mockResolvedValue({ data: false, error: null });
            
            supabaseServiceClient.single
                .mockResolvedValueOnce({
                    data: {
                        analysis_limit_monthly: 1000,
                        shield_enabled: false
                    },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: {
                        analysis_used: 500,
                        period_start: '2024-01-01',
                        period_end: '2024-01-31'
                    },
                    error: null
                });

            const response = await request(app)
                .post('/api/analysis')
                .send({ text: 'Test analysis request' });

            expect(response.status).toBe(429);
            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('LIMIT_REACHED');
            expect(response.body.details.action_type).toBe('analysis');
            expect(response.body.details.used).toBe(500);
            expect(response.body.details.limit).toBe(500);
        });

        it('should deny access to Shield feature', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: {
                    shield_enabled: false,
                    plan_name: 'starter'
                },
                error: null
            });

            const response = await request(app)
                .get('/api/shield-feature');

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('FEATURE_NOT_AVAILABLE');
            expect(response.body.details.feature).toBe('shield_enabled');
            expect(response.body.details.current_plan).toBe('starter');
        });
    });

    describe('Pro Plan Flow', () => {
        const proPrice = {
            id: 'price_pro123',
            lookup_key: 'pro_monthly',
            metadata: {
                analysis_limit_monthly: '10000',
                roast_limit_monthly: '1000',
                model: 'gpt-4',
                shield_enabled: 'true',
                rqc_mode: 'advanced',
                plan_name: 'pro'
            },
            product: {
                id: 'prod_pro123',
                name: 'Pro Plan',
                metadata: {}
            }
        };

        beforeEach(async () => {
            mockStripeWrapper.prices.retrieve.mockResolvedValue(proPrice);
            
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: {
                            account_id: 'test-user-123',
                            analysis_limit_monthly: 10000,
                            roast_limit_monthly: 1000,
                            model: 'gpt-4',
                            shield_enabled: true,
                            rqc_mode: 'advanced',
                            plan_name: 'pro'
                        }
                    })
                })
            });

            await entitlementsService.setEntitlementsFromStripePrice('test-user-123', 'price_pro123');
        });

        it('should allow higher usage limits', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({ data: true, error: null });
            
            supabaseServiceClient.single
                .mockResolvedValueOnce({
                    data: {
                        analysis_limit_monthly: 10000,
                        shield_enabled: true
                    },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: {
                        analysis_used: 1500, // High usage but still under Pro limit
                        period_start: '2024-01-01',
                        period_end: '2024-01-31'
                    },
                    error: null
                });

            const response = await request(app)
                .post('/api/analysis')
                .send({ text: 'Pro plan analysis' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should allow access to Shield feature', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: {
                    shield_enabled: true,
                    plan_name: 'pro'
                },
                error: null
            });

            const response = await request(app)
                .get('/api/shield-feature');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Shield feature accessed');
        });

        it('should deny access to premium-only features', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: {
                    rqc_mode: 'advanced', // Not premium
                    plan_name: 'pro'
                },
                error: null
            });

            const response = await request(app)
                .get('/api/premium-feature');

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('FEATURE_NOT_AVAILABLE');
            expect(response.body.details.actual_value).toBe('advanced');
        });
    });

    describe('Plus Plan Flow', () => {
        const creatorPrice = {
            id: 'price_creator123',
            lookup_key: 'plus_monthly',
            metadata: {
                analysis_limit_monthly: '100000',
                roast_limit_monthly: '5000',
                model: 'gpt-4',
                shield_enabled: 'true',
                rqc_mode: 'premium',
                plan_name: 'plus'
            },
            product: {
                id: 'prod_creator123',
                name: 'Plus Plan',
                metadata: {}
            }
        };

        beforeEach(async () => {
            mockStripeWrapper.prices.retrieve.mockResolvedValue(creatorPrice);
            
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: {
                            account_id: 'test-user-123',
                            analysis_limit_monthly: -1,
                            roast_limit_monthly: -1,
                            model: 'gpt-4',
                            shield_enabled: true,
                            rqc_mode: 'premium',
                            plan_name: 'plus'
                        }
                    })
                })
            });

            await entitlementsService.setEntitlementsFromStripePrice('test-user-123', 'price_creator123');
        });

        it('should allow unlimited usage', async () => {
            // Always allow for unlimited plans
            supabaseServiceClient.rpc.mockResolvedValue({ data: true, error: null });
            
            supabaseServiceClient.single
                .mockResolvedValueOnce({
                    data: {
                        analysis_limit_monthly: -1, // Unlimited
                        shield_enabled: true
                    },
                    error: null
                })
                .mockResolvedValueOnce({
                    data: {
                        analysis_used: 10000, // Very high usage
                        period_start: '2024-01-01',
                        period_end: '2024-01-31'
                    },
                    error: null
                });

            const response = await request(app)
                .post('/api/analysis')
                .send({ text: 'Creator plus analysis' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should allow access to all premium features', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: {
                    shield_enabled: true,
                    rqc_mode: 'premium',
                    plan_name: 'plus'
                },
                error: null
            });

            const shieldResponse = await request(app)
                .get('/api/shield-feature');
            
            expect(shieldResponse.status).toBe(200);

            const premiumResponse = await request(app)
                .get('/api/premium-feature');
            
            expect(premiumResponse.status).toBe(200);
            expect(premiumResponse.body.message).toBe('Premium feature accessed');
        });
    });

    describe('Free Plan Flow (Default)', () => {
        beforeEach(() => {
            // Mock default free plan entitlements
            supabaseServiceClient.single.mockImplementation(({ from }) => {
                if (from === 'account_entitlements') {
                    return Promise.resolve({
                        data: null,
                        error: { code: 'PGRST116' } // No rows found
                    });
                }
                return Promise.resolve({ data: null, error: null });
            });
        });

        it('should apply free plan limits by default', async () => {
            // Mock usage check - near free plan limit
            supabaseServiceClient.rpc.mockResolvedValue({ data: false, error: null });
            
            supabaseServiceClient.single
                .mockResolvedValueOnce({
                    data: null,
                    error: { code: 'PGRST116' }
                })
                .mockResolvedValueOnce({
                    data: {
                        analysis_used: 100, // At free limit
                        period_start: '2024-01-01',
                        period_end: '2024-01-31'
                    },
                    error: null
                });

            const response = await request(app)
                .post('/api/analysis')
                .send({ text: 'Free plan analysis' });

            expect(response.status).toBe(429);
            expect(response.body.code).toBe('LIMIT_REACHED');
        });

        it('should deny access to premium features', async () => {
            supabaseServiceClient.single.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
            });

            const response = await request(app)
                .get('/api/shield-feature');

            expect(response.status).toBe(403);
        });
    });

    describe('Usage Summary Integration', () => {
        it('should provide comprehensive usage information', async () => {
            const mockEntitlements = {
                analysis_limit_monthly: 10000,
                roast_limit_monthly: 1000,
                plan_name: 'pro'
            };

            const mockUsage = {
                analysis_used: 250,
                roasts_used: 125,
                period_start: '2024-01-01',
                period_end: '2024-01-31'
            };

            supabaseServiceClient.single
                .mockResolvedValueOnce({ data: mockEntitlements, error: null })
                .mockResolvedValueOnce({ data: mockUsage, error: null });

            const response = await request(app)
                .get('/api/usage-summary');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.usage.entitlements).toEqual(mockEntitlements);
            expect(response.body.usage.usage).toEqual(mockUsage);
            expect(response.body.usage.utilization.analysis.percentage).toBe(25); // 250/1000 * 100
            expect(response.body.usage.utilization.roasts.percentage).toBe(25); // 125/500 * 100
        });

        it('should handle missing usage data gracefully', async () => {
            supabaseServiceClient.single.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/api/usage-summary');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.usage).toBeNull();
        });
    });

    describe('Error Handling', () => {
        it('should handle Stripe API failures gracefully', async () => {
            mockStripeWrapper.prices.retrieve.mockRejectedValue(new Error('Stripe API error'));
            
            // Should fall back to free plan
            const result = await entitlementsService.setEntitlementsFromStripePrice('test-user-123', 'invalid_price');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Stripe API error');
        });

        it('should handle database errors in usage checks', async () => {
            supabaseServiceClient.rpc.mockResolvedValue({
                data: null,
                error: new Error('Database connection failed')
            });

            const response = await request(app)
                .post('/api/analysis')
                .send({ text: 'Test request' });

            expect(response.status).toBe(500);
            expect(response.body.code).toBe('USAGE_CHECK_FAILED');
        });

        it('should handle unauthenticated requests', async () => {
            // Create app without auth middleware
            const unauthApp = express();
            unauthApp.use(express.json());

            unauthApp.post('/api/analysis', 
                ...UsageEnforcementMiddleware.forAnalysis(1),
                (req, res) => res.json({ success: true })
            );

            const response = await request(unauthApp)
                .post('/api/analysis')
                .send({ text: 'Unauthenticated request' });

            expect(response.status).toBe(401);
            expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
        });
    });

    describe('Plan Transition Scenarios', () => {
        it('should handle upgrade from free to pro plan', async () => {
            // Start with free plan (no entitlements record)
            supabaseServiceClient.single.mockResolvedValueOnce({
                data: null,
                error: { code: 'PGRST116' }
            });

            // Upgrade to Pro
            const proPrice = {
                id: 'price_pro123',
                metadata: {
                    analysis_limit_monthly: '10000',
                    roast_limit_monthly: '1000',
                    shield_enabled: 'true',
                    plan_name: 'pro'
                },
                product: { id: 'prod_pro', name: 'Pro', metadata: {} }
            };

            mockStripeWrapper.prices.retrieve.mockResolvedValue(proPrice);
            
            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: {
                            account_id: 'test-user-123',
                            analysis_limit_monthly: 10000,
                            shield_enabled: true,
                            plan_name: 'pro'
                        }
                    })
                })
            });

            const result = await entitlementsService.setEntitlementsFromStripePrice('test-user-123', 'price_pro123');

            expect(result.success).toBe(true);
            expect(result.entitlements.analysis_limit_monthly).toBe(10000);
            expect(result.entitlements.shield_enabled).toBe(true);
        });

        it('should handle downgrade from pro to free plan', async () => {
            const freeEntitlements = {
                analysis_limit_monthly: 100,
                roast_limit_monthly: 10,
                model: 'gpt-3.5-turbo',
                shield_enabled: false,
                rqc_mode: 'basic',
                stripe_price_id: null,
                stripe_product_id: null,
                plan_name: 'free'
            };

            supabaseServiceClient.upsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                        data: freeEntitlements
                    })
                })
            });

            const result = await entitlementsService.setEntitlements('test-user-123', freeEntitlements);

            expect(result.success).toBe(true);
            expect(result.entitlements.plan_name).toBe('free');
            expect(result.entitlements.analysis_limit_monthly).toBe(100);
            expect(result.entitlements.shield_enabled).toBe(false);
        });
    });
});