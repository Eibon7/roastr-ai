/**
 * Integration tests for Shop API endpoints
 * Issue #260: Settings → Shop functionality
 */

const request = require('supertest');
const { app } = require('../../src/index');
const { createUserClient, supabaseServiceClient } = require('../../src/config/supabase');
const stripeWrapper = require('../../src/services/stripeWrapper');

// Mock dependencies
jest.mock('../../src/config/supabase', () => {
    const createStableBuilder = () => {
        const stableBuilder = {
            select: jest.fn(),
            eq: jest.fn(),
            single: jest.fn(),
            order: jest.fn(),
            limit: jest.fn(),
            insert: jest.fn(),
            upsert: jest.fn(),
            mockResolvedValue: jest.fn(),
            mockResolvedValueOnce: jest.fn()
        };

        // Make methods return the same builder or appropriate sub-builder
        stableBuilder.select.mockReturnValue(stableBuilder);
        stableBuilder.eq.mockReturnValue(stableBuilder);
        stableBuilder.order.mockReturnValue(stableBuilder);
        stableBuilder.limit.mockReturnValue(stableBuilder);
        stableBuilder.insert.mockReturnValue(stableBuilder);
        stableBuilder.upsert.mockReturnValue(stableBuilder);
        stableBuilder.single.mockReturnValue(stableBuilder);

        return stableBuilder;
    };

    const mockServiceClient = {
        from: jest.fn(() => createStableBuilder()),
        rpc: jest.fn()
    };

    const mockUserClient = {
        from: jest.fn(() => createStableBuilder()),
        rpc: jest.fn()
    };

    return {
        supabaseServiceClient: mockServiceClient,
        createUserClient: jest.fn(() => mockUserClient)
    };
});
jest.mock('../../src/services/stripeWrapper');

// Mock auth middleware to return test user (hoisted)
jest.mock('../../src/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user-123', email: 'test@example.com' };
        next();
    },
    requireAdmin: (req, res, next) => {
        next();
    },
    optionalAuth: (req, res, next) => {
        req.user = { id: 'test-user-123', email: 'test@example.com' };
        next();
    }
}));

// Mock requirePlan middleware
jest.mock('../../src/middleware/requirePlan', () => ({
    requirePlan: (plans) => (req, res, next) => {
        next();
    }
}));

describe('Shop API Integration Tests', () => {
    let mockUserClient, mockServiceClient;
    const testUserId = 'test-user-123';
    const authToken = 'Bearer valid-token';

    beforeEach(() => {
        jest.clearAllMocks();

        // Set required environment variables
        process.env.FRONTEND_URL = 'https://test.example.com';

        // Get references to the mocked clients
        const { supabaseServiceClient, createUserClient } = require('../../src/config/supabase');
        mockServiceClient = supabaseServiceClient;
        mockUserClient = createUserClient();

        // Mock Stripe wrapper
        stripeWrapper.customers = {
            retrieve: jest.fn(),
            create: jest.fn()
        };
        stripeWrapper.checkout = {
            sessions: {
                create: jest.fn()
            }
        };
    });

    describe('GET /api/shop/addons', () => {
        it('should return available shop addons grouped by category', async () => {
            const mockAddons = [
                {
                    id: 'addon-1',
                    addon_key: 'roasts_100',
                    name: 'Roasts Pack 100',
                    description: 'Pack de 100 roasts extra',
                    category: 'roasts',
                    price_cents: 499,
                    currency: 'USD',
                    addon_type: 'credits',
                    credit_amount: 100,
                    feature_key: null
                },
                {
                    id: 'addon-2',
                    addon_key: 'rqc_monthly',
                    name: 'RQC (Roastr Quality Check)',
                    description: 'Filtro de calidad automático',
                    category: 'features',
                    price_cents: 1499,
                    currency: 'USD',
                    addon_type: 'feature',
                    credit_amount: 0,
                    feature_key: 'rqc_enabled'
                }
            ];

            // Mock the addons query
            const mockAddonsBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: mockAddons,
                    error: null
                })
            };

            mockServiceClient.from.mockReturnValueOnce(mockAddonsBuilder);

            const response = await request(app)
                .get('/api/shop/addons')
                .set('Authorization', authToken);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.addons).toHaveProperty('roasts');
            expect(response.body.data.addons).toHaveProperty('features');
            expect(response.body.data.addons.roasts).toHaveLength(1);
            expect(response.body.data.addons.features).toHaveLength(1);
            
            // Check addon structure
            const roastAddon = response.body.data.addons.roasts[0];
            expect(roastAddon).toMatchObject({
                key: 'roasts_100',
                name: 'Roasts Pack 100',
                price: {
                    cents: 499,
                    currency: 'USD',
                    formatted: '$4.99'
                },
                type: 'credits',
                creditAmount: 100
            });
        });

        it('should handle database errors gracefully', async () => {
            // Mock the addons query with error
            const mockErrorBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' }
                })
            };

            mockServiceClient.from.mockReturnValueOnce(mockErrorBuilder);

            const response = await request(app)
                .get('/api/shop/addons')
                .set('Authorization', authToken);

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to fetch addons');
        });
    });

    describe('GET /api/shop/user/addons', () => {
        it('should return user addon status and credits', async () => {
            // Mock RPC calls for credits and features
            mockServiceClient.rpc
                .mockResolvedValueOnce({ data: 50, error: null }) // roast credits
                .mockResolvedValueOnce({ data: 1000, error: null }) // analysis credits
                .mockResolvedValueOnce({ data: true, error: null }); // rqc enabled

            // Mock purchase history - need to mock the from() call to return a builder with the right data
            const mockPurchaseBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [
                        {
                            addon_key: 'roasts_100',
                            amount_cents: 499,
                            status: 'completed',
                            completed_at: '2024-01-15T10:00:00Z',
                            created_at: '2024-01-15T09:55:00Z'
                        }
                    ],
                    error: null
                })
            };

            mockServiceClient.from.mockReturnValueOnce(mockPurchaseBuilder);

            const response = await request(app)
                .get('/api/shop/user/addons')
                .set('Authorization', authToken);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toMatchObject({
                credits: {
                    roasts: 50,
                    analysis: 1000
                },
                features: {
                    rqc_enabled: true
                },
                recentPurchases: expect.arrayContaining([
                    expect.objectContaining({
                        addon_key: 'roasts_100',
                        amount_cents: 499,
                        status: 'completed'
                    })
                ])
            });

            // Verify RPC calls
            expect(mockServiceClient.rpc).toHaveBeenCalledWith('get_user_addon_credits', {
                p_user_id: testUserId,
                p_addon_category: 'roasts'
            });
            expect(mockServiceClient.rpc).toHaveBeenCalledWith('get_user_addon_credits', {
                p_user_id: testUserId,
                p_addon_category: 'analysis'
            });
            expect(mockServiceClient.rpc).toHaveBeenCalledWith('user_has_feature_addon', {
                p_user_id: testUserId,
                p_feature_key: 'rqc_enabled'
            });
        });
    });

    describe('POST /api/shop/checkout', () => {
        it('should create Stripe checkout session for valid addon', async () => {
            const mockAddon = {
                addon_key: 'roasts_100',
                name: 'Roasts Pack 100',
                description: 'Pack de 100 roasts extra',
                price_cents: 499,
                currency: 'USD',
                addon_type: 'credits',
                credit_amount: 100
            };

            const mockCustomer = { id: 'cus_test123' };
            const mockSession = {
                id: 'cs_test123',
                url: 'https://checkout.stripe.com/pay/cs_test123'
            };

            // Mock addon lookup (first call)
            const mockAddonBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: mockAddon,
                    error: null
                })
            };

            // Mock user subscription lookup (second call)
            const mockUserSubBuilder = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { stripe_customer_id: 'cus_test123' },
                    error: null
                })
            };

            // Mock purchase history insert (third call)
            const mockInsertBuilder = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'mock-purchase-id' },
                    error: null
                })
            };

            mockServiceClient.from
                .mockReturnValueOnce(mockAddonBuilder)
                .mockReturnValueOnce(mockUserSubBuilder)
                .mockReturnValueOnce(mockInsertBuilder);

            // Mock Stripe calls
            stripeWrapper.customers = {
                retrieve: jest.fn().mockResolvedValue(mockCustomer),
                create: jest.fn().mockResolvedValue(mockCustomer)
            };
            stripeWrapper.checkout = {
                sessions: {
                    create: jest.fn().mockResolvedValue(mockSession)
                }
            };



            const response = await request(app)
                .post('/api/shop/checkout')
                .set('Authorization', authToken)
                .send({ addonKey: 'roasts_100' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toMatchObject({
                sessionId: 'cs_test123',
                url: 'https://checkout.stripe.com/pay/cs_test123'
            });

            // Verify Stripe checkout session creation
            expect(stripeWrapper.checkout.sessions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customer: 'cus_test123',
                    mode: 'payment',
                    payment_method_types: ['card'],
                    line_items: expect.arrayContaining([
                        expect.objectContaining({
                            price_data: expect.objectContaining({
                                currency: 'usd',
                                unit_amount: 499,
                                product_data: expect.objectContaining({
                                    name: 'Roasts Pack 100',
                                    description: 'Pack de 100 roasts extra'
                                })
                            }),
                            quantity: 1
                        })
                    ]),
                    success_url: expect.stringContaining('https://test.example.com/settings?tab=shop&success=true'),
                    cancel_url: expect.stringContaining('https://test.example.com/settings?tab=shop&canceled=true'),
                    metadata: expect.objectContaining({
                        user_id: testUserId,
                        addon_key: 'roasts_100',
                        addon_type: 'credits',
                        credit_amount: '100',
                        feature_key: ''
                    })
                }),
                expect.objectContaining({
                    idempotencyKey: expect.any(String)
                })
            );
        });

        it('should return 400 when addon key is missing', async () => {
            const response = await request(app)
                .post('/api/shop/checkout')
                .set('Authorization', authToken)
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Addon key is required');
        });

        it('should return 404 when addon is not found', async () => {
            mockServiceClient.from().select().eq().single.mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
            });

            const response = await request(app)
                .post('/api/shop/checkout')
                .set('Authorization', authToken)
                .send({ addonKey: 'invalid_addon' });

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Addon not found');
        });

        it('should create new Stripe customer when none exists', async () => {
            const mockAddon = {
                addon_key: 'roasts_100',
                name: 'Roasts Pack 100',
                price_cents: 499,
                currency: 'USD',
                addon_type: 'credits',
                credit_amount: 100
            };

            const mockCustomer = { id: 'cus_new123' };
            const mockSession = {
                id: 'cs_test123',
                url: 'https://checkout.stripe.com/pay/cs_test123'
            };

            // Mock addon lookup (first call)
            const mockAddonBuilder2 = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: mockAddon,
                    error: null
                })
            };

            // Mock no existing customer (second call)
            const mockUserSubBuilder2 = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                })
            };

            // Mock customer upsert (third call)
            const mockUpsertBuilder = {
                upsert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                })
            };

            // Mock purchase history insert (fourth call)
            const mockInsertBuilder2 = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'mock-purchase-id' },
                    error: null
                })
            };

            mockServiceClient.from
                .mockReturnValueOnce(mockAddonBuilder2)
                .mockReturnValueOnce(mockUserSubBuilder2)
                .mockReturnValueOnce(mockUpsertBuilder)
                .mockReturnValueOnce(mockInsertBuilder2);

            // Mock Stripe customer creation
            stripeWrapper.customers = {
                create: jest.fn().mockResolvedValue(mockCustomer)
            };
            stripeWrapper.checkout = {
                sessions: {
                    create: jest.fn().mockResolvedValue(mockSession)
                }
            };



            const response = await request(app)
                .post('/api/shop/checkout')
                .set('Authorization', authToken)
                .send({ addonKey: 'roasts_100' });

            expect(response.status).toBe(200);
            expect(stripeWrapper.customers.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                metadata: { user_id: testUserId }
            });
        });
    });
});
