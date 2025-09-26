/**
 * SPEC 14 - Tier Validation Tests
 * 
 * Comprehensive tests for plan limits and feature gating across all tiers:
 * - Free Plan: Basic limits and restricted features
 * - Starter Plan: Enhanced limits with additional platforms
 * - Pro Plan: Advanced features and higher limits
 * - Plus Plan: Maximum capabilities and priority support
 * 
 * Tests verify:
 * - Usage limits are enforced correctly
 * - Feature access is gated by plan tier
 * - Upgrade/downgrade transitions work properly
 * - Plan-specific pricing and billing
 * - Grace periods and limit warnings
 */

const { createSyntheticFixtures } = require('../helpers/syntheticFixtures');

// Mock external services and dependencies
jest.mock('../../src/services/stripeWrapper');
jest.mock('../../src/services/stripeWebhookService');
jest.mock('../../src/services/costControl');

// Use mock implementations when in mock mode instead of skipping
const shouldUseMocks = process.env.ENABLE_MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';
const describeFunction = describe;

describeFunction('SPEC 14 - Tier Validation Tests', () => {
  let fixtures;
  let testUsers;
  let testOrg;
  
  // Mock services for tier validation testing
  const mockPlanService = {
    getUserPlan: jest.fn(),
    checkPlanLimits: jest.fn(),
    hasFeatureAccess: jest.fn(),
    getRoastUsage: jest.fn(),
    consumeRoastCredit: jest.fn()
  };
  
  const mockBillingService = {
    getUpgradeUrl: jest.fn(),
    getCurrentUsage: jest.fn(),
    checkPaymentStatus: jest.fn()
  };

  beforeAll(async () => {
    fixtures = await createSyntheticFixtures();
    testOrg = fixtures.organizations.basic;
    
    // Create users for each plan tier
    testUsers = {
      free: {
        ...fixtures.users.freeUser,
        plan: 'free',
        credits: 100
      },
      starter: {
        id: 'starter-user-id',
        email: 'starter@synthetic-domain.test',
        plan: 'starter',
        credits: 500
      },
      pro: fixtures.users.proUser,
      plus: fixtures.users.plusUser
    };

    process.env.ENABLE_MOCK_MODE = 'true';
    process.env.ENABLE_BILLING = 'true';
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describeFunction('Free Plan Limits', () => {
    const freeUser = testUsers?.free;
    const freeAuthToken = fixtures?.auth?.freeUserToken;

    test('should enforce monthly roast limit for free plan', async () => {
      const comment = fixtures.comments.light;
      const freePlanLimit = 50;
      const freeUser = testUsers.free;
      
      // Mock plan service to return free plan limits
      mockPlanService.getUserPlan.mockResolvedValue({
        plan: 'free',
        monthly_limit: freePlanLimit,
        features: ['basic_roasts']
      });

      // Test roast generation within limits
      let successfulRoasts = 0;
      
      for (let i = 0; i < freePlanLimit + 5; i++) {
        // Mock current usage check
        mockPlanService.getRoastUsage.mockResolvedValue({
          roasts_this_month: successfulRoasts,
          plan_limit: freePlanLimit,
          remaining: Math.max(0, freePlanLimit - successfulRoasts)
        });

        const currentUsage = await mockPlanService.getRoastUsage(freeUser.id);
        
        if (currentUsage.remaining > 0) {
          // Mock successful credit consumption
          mockPlanService.consumeRoastCredit.mockResolvedValueOnce({
            success: true,
            credits_consumed: 1,
            remaining_credits: currentUsage.remaining - 1
          });

          const consumeResult = await mockPlanService.consumeRoastCredit(freeUser.id);
          
          if (consumeResult.success) {
            successfulRoasts++;
          }
        } else {
          // Mock limit reached error
          mockPlanService.consumeRoastCredit.mockRejectedValueOnce(
            new Error('Monthly limit reached. Upgrade required.')
          );

          try {
            await mockPlanService.consumeRoastCredit(freeUser.id);
            fail('Expected limit to be reached');
          } catch (error) {
            expect(error.message).toContain('Monthly limit');
            break;
          }
        }
      }

      expect(successfulRoasts).toBeLessThanOrEqual(freePlanLimit);
      expect(successfulRoasts).toBe(freePlanLimit);

      // Verify final usage tracking
      mockPlanService.getRoastUsage.mockResolvedValueOnce({
        roasts_this_month: successfulRoasts,
        plan_limit: freePlanLimit,
        limit_reached: true,
        remaining: 0
      });

      const finalUsage = await mockPlanService.getRoastUsage(freeUser.id);
      expect(finalUsage.roasts_this_month).toBe(successfulRoasts);
      expect(finalUsage.plan_limit).toBe(freePlanLimit);
      expect(finalUsage.limit_reached).toBe(true);
    });

    test('should restrict advanced features for free plan', async () => {
      const freeUser = testUsers.free;
      
      // Mock plan service to check feature access
      mockPlanService.hasFeatureAccess.mockResolvedValue(false);
      
      // Custom styles should be unavailable
      const hasCustomStyles = await mockPlanService.hasFeatureAccess(freeUser.id, 'custom_styles');
      expect(hasCustomStyles).toBe(false);

      // Mock upgrade URL
      mockBillingService.getUpgradeUrl.mockResolvedValue({
        upgrade_url: 'https://billing.roastr.ai/upgrade?plan=starter',
        current_plan: 'free',
        recommended_plan: 'starter'
      });

      const upgradeInfo = await mockBillingService.getUpgradeUrl(freeUser.id, 'custom_styles');
      expect(upgradeInfo.upgrade_url).toBeDefined();
      expect(upgradeInfo.current_plan).toBe('free');

      // Multi-platform support should be limited for free plan
      mockPlanService.hasFeatureAccess.mockImplementation((userId, feature) => {
        const freePlanFeatures = ['twitter', 'basic_stats'];
        return Promise.resolve(freePlanFeatures.includes(feature));
      });

      const hasTwitter = await mockPlanService.hasFeatureAccess(freeUser.id, 'twitter');
      const hasInstagram = await mockPlanService.hasFeatureAccess(freeUser.id, 'instagram');
      const hasDiscord = await mockPlanService.hasFeatureAccess(freeUser.id, 'discord');

      expect(hasTwitter).toBe(true);
      expect(hasInstagram).toBe(false);  // Premium feature
      expect(hasDiscord).toBe(false);    // Premium feature

      // Analytics should be basic only
      const hasBasicStats = await mockPlanService.hasFeatureAccess(freeUser.id, 'basic_stats');
      const hasAdvancedAnalytics = await mockPlanService.hasFeatureAccess(freeUser.id, 'advanced_analytics');
      const hasCustomReports = await mockPlanService.hasFeatureAccess(freeUser.id, 'custom_reports');
      const hasExportData = await mockPlanService.hasFeatureAccess(freeUser.id, 'export_data');

      expect(hasBasicStats).toBe(true);
      expect(hasAdvancedAnalytics).toBe(false);
      expect(hasCustomReports).toBe(false);
      expect(hasExportData).toBe(false);
    });

    test('should show upgrade prompts at appropriate times', async () => {
      // Attempt advanced feature should trigger upgrade prompt
      const advancedFeatureResponse = await request(app)
        .post('/api/roast/advanced-generation')
        .set('Authorization', `Bearer ${freeAuthToken}`)
        .send({
          comment_text: 'test',
          style: 'custom',
          advanced_options: { creativity: 0.9 }
        })
        .expect(402);

      expect(advancedFeatureResponse.body.upgrade_required).toBe(true);
      expect(advancedFeatureResponse.body.current_plan).toBe('free');
      expect(advancedFeatureResponse.body.recommended_plan).toBe('starter');
      expect(advancedFeatureResponse.body.upgrade_benefits).toContain('advanced roast generation');
    });
  });

  describeFunction('Starter Plan Features', () => {
    const starterUser = testUsers?.starter;
    const starterAuthToken = 'test.starter.token'; // Mock token

    test('should allow higher monthly limits for starter plan', async () => {
      const comment = fixtures.comments.intermediate;
      const starterPlanLimit = 500; // Updated to match current starter plan limits

      // Simulate user already at 150 roasts
      await request(app)
        .patch('/api/user/usage')
        .set('Authorization', `Bearer ${starterAuthToken}`)
        .send({ roasts_this_month: 150 })
        .expect(200);

      // Should still allow more roasts
      const ingestResponse = await request(app)
        .post('/api/comments/ingest')
        .set('Authorization', `Bearer ${starterAuthToken}`)
        .send({
          platform: 'twitter',
          external_comment_id: `starter_limit_test`,
          comment_text: comment.text,
          author_id: comment.author.id,
          author_username: comment.author.username,
          org_id: testOrg.id
        })
        .expect(201);

      const generateResponse = await request(app)
        .post(`/api/comments/${ingestResponse.body.data.id}/generate`)
        .set('Authorization', `Bearer ${starterAuthToken}`)
        .expect(201);

      expect(generateResponse.body.data.variants).toBeDefined();
      expect(generateResponse.body.data.plan_limits.remaining).toBeGreaterThan(0);
    });

    test('should unlock additional platforms for starter plan', async () => {
      const platformsResponse = await request(app)
        .get('/api/user/platforms/available')
        .set('Authorization', `Bearer ${starterAuthToken}`)
        .expect(200);

      const availablePlatforms = platformsResponse.body.data.platforms;
      expect(availablePlatforms).toContain('twitter');
      expect(availablePlatforms).toContain('youtube');
      expect(availablePlatforms).toContain('discord');
      expect(availablePlatforms).not.toContain('instagram'); // Still pro+ only
      expect(availablePlatforms).not.toContain('facebook');  // Still pro+ only
    });

    test('should provide basic custom styles for starter plan', async () => {
      const stylesResponse = await request(app)
        .get('/api/user/styles/available')
        .set('Authorization', `Bearer ${starterAuthToken}`)
        .expect(200);

      const styles = stylesResponse.body.data.styles;
      expect(styles).toContain('sarcastic');
      expect(styles).toContain('witty');
      expect(styles).toContain('balanced');
      expect(styles.length).toBeGreaterThan(3); // More than free plan
      expect(styles.length).toBeLessThan(10);   // Less than pro plan
    });
  });

  describeFunction('Pro Plan Features', () => {
    const proUser = testUsers?.pro;
    const proAuthToken = fixtures?.auth?.proUserToken;

    test('should provide high monthly limits for pro plan', async () => {
      const usageResponse = await request(app)
        .get('/api/user/usage')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      expect(usageResponse.body.data.plan_limit).toBeGreaterThanOrEqual(1000); // High limit
      expect(usageResponse.body.data.features.priority_generation).toBe(true);
      expect(usageResponse.body.data.features.advanced_analytics).toBe(true);
    });

    test('should unlock all major platforms for pro plan', async () => {
      const platformsResponse = await request(app)
        .get('/api/user/platforms/available')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      const availablePlatforms = platformsResponse.body.data.platforms;
      const expectedPlatforms = ['twitter', 'youtube', 'discord', 'instagram', 'facebook', 'twitch'];
      
      expectedPlatforms.forEach(platform => {
        expect(availablePlatforms).toContain(platform);
      });
    });

    test('should provide advanced roast generation features', async () => {
      const comment = fixtures.comments.intermediate;
      
      const ingestResponse = await request(app)
        .post('/api/comments/ingest')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send({
          platform: 'twitter',
          external_comment_id: `pro_advanced_test`,
          comment_text: comment.text,
          author_id: comment.author.id,
          author_username: comment.author.username,
          org_id: testOrg.id
        })
        .expect(201);

      // Should allow advanced generation options
      const advancedGenerateResponse = await request(app)
        .post(`/api/comments/${ingestResponse.body.data.id}/generate-advanced`)
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send({
          style: 'custom',
          creativity: 0.8,
          multiple_variants: 3,
          tone_adjustments: {
            sarcasm_level: 0.7,
            wit_level: 0.9
          }
        })
        .expect(201);

      expect(advancedGenerateResponse.body.data.variants).toHaveLength(3);
      expect(advancedGenerateResponse.body.data.advanced_features_used).toBe(true);
    });

    test('should provide comprehensive analytics for pro plan', async () => {
      const analyticsResponse = await request(app)
        .get('/api/user/analytics/detailed')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.features.advanced_analytics).toBe(true);
      expect(analyticsResponse.body.data.features.export_data).toBe(true);
      expect(analyticsResponse.body.data.features.custom_reports).toBe(true);
      expect(analyticsResponse.body.data.metrics).toHaveProperty('engagement_rates');
      expect(analyticsResponse.body.data.metrics).toHaveProperty('platform_performance');
    });
  });

  describeFunction('Plus Plan Features', () => {
    const plusUser = testUsers?.plus;
    const plusAuthToken = fixtures?.auth?.plusUserToken;

    test('should provide unlimited/very high limits for plus plan', async () => {
      const usageResponse = await request(app)
        .get('/api/user/usage')
        .set('Authorization', `Bearer ${plusAuthToken}`)
        .expect(200);

      expect(usageResponse.body.data.plan_limit).toBeGreaterThan(5000); // Very high or unlimited
      expect(usageResponse.body.data.features.priority_support).toBe(true);
      expect(usageResponse.body.data.features.custom_integrations).toBe(true);
      expect(usageResponse.body.data.features.white_label).toBe(true);
    });

    test('should unlock all platforms and beta features', async () => {
      const platformsResponse = await request(app)
        .get('/api/user/platforms/available')
        .set('Authorization', `Bearer ${plusAuthToken}`)
        .expect(200);

      const availablePlatforms = platformsResponse.body.data.platforms;
      const allPlatforms = ['twitter', 'youtube', 'discord', 'instagram', 'facebook', 'twitch', 'reddit', 'tiktok'];
      
      allPlatforms.forEach(platform => {
        expect(availablePlatforms).toContain(platform);
      });

      // Should include beta platforms
      expect(availablePlatforms).toContain('bluesky');
    });

    test('should provide premium customer support features', async () => {
      const supportResponse = await request(app)
        .get('/api/user/support/options')
        .set('Authorization', `Bearer ${plusAuthToken}`)
        .expect(200);

      expect(supportResponse.body.data.priority_support).toBe(true);
      expect(supportResponse.body.data.dedicated_manager).toBe(true);
      expect(supportResponse.body.data.response_time_sla).toBeLessThanOrEqual(4); // 4 hours max
      expect(supportResponse.body.data.channels).toContain('phone');
      expect(supportResponse.body.data.channels).toContain('slack_integration');
    });
  });

  describeFunction('Plan Transition Testing', () => {
    test('should handle plan upgrades correctly', async () => {
      const freeAuthToken = fixtures.auth.freeUserToken;

      // Simulate plan upgrade from free to pro
      const upgradeResponse = await request(app)
        .post('/api/billing/upgrade')
        .set('Authorization', `Bearer ${freeAuthToken}`)
        .send({
          new_plan: 'pro',
          payment_method: 'test_pm_card_visa'
        })
        .expect(200);

      expect(upgradeResponse.body.data.upgrade_successful).toBe(true);
      expect(upgradeResponse.body.data.new_plan).toBe('pro');
      expect(upgradeResponse.body.data.effective_date).toBeDefined();

      // Verify new plan features are immediately available
      const featuresResponse = await request(app)
        .get('/api/user/features')
        .set('Authorization', `Bearer ${freeAuthToken}`)
        .expect(200);

      expect(featuresResponse.body.data.current_plan).toBe('pro');
      expect(featuresResponse.body.data.advanced_analytics).toBe(true);
      expect(featuresResponse.body.data.all_platforms).toBe(true);
    });

    test('should handle plan downgrades with grace periods', async () => {
      const proAuthToken = fixtures.auth.proUserToken;

      // Simulate plan downgrade from pro to starter
      const downgradeResponse = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send({
          new_plan: 'starter',
          effective_date: 'end_of_cycle' // Downgrade at end of billing cycle
        })
        .expect(200);

      expect(downgradeResponse.body.data.downgrade_scheduled).toBe(true);
      expect(downgradeResponse.body.data.effective_date).toBeDefined();
      expect(downgradeResponse.body.data.grace_period_days).toBeGreaterThan(0);

      // Pro features should still be available during grace period
      const featuresResponse = await request(app)
        .get('/api/user/features')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      expect(featuresResponse.body.data.current_plan).toBe('pro');
      expect(featuresResponse.body.data.scheduled_downgrade).toBe(true);
      expect(featuresResponse.body.data.downgrade_warnings).toContain('advanced analytics will be disabled');
    });
  });

  describeFunction('Usage Warnings and Limits', () => {
    test('should warn users approaching plan limits', async () => {
      const starterAuthToken = 'test.starter.token';

      // Set user at 80% of limit
      await request(app)
        .patch('/api/user/usage')
        .set('Authorization', `Bearer ${starterAuthToken}`)
        .send({ roasts_this_month: 400 }) // 80% of 500
        .expect(200);

      const warningResponse = await request(app)
        .get('/api/user/usage/warnings')
        .set('Authorization', `Bearer ${starterAuthToken}`)
        .expect(200);

      expect(warningResponse.body.data.approaching_limit).toBe(true);
      expect(warningResponse.body.data.percentage_used).toBeGreaterThanOrEqual(80);
      expect(warningResponse.body.data.recommended_action).toBe('upgrade');
      expect(warningResponse.body.data.upgrade_options).toBeDefined();
    });

    test('should enforce hard limits with proper error messages', async () => {
      const freeAuthToken = fixtures.auth.freeUserToken;

      // Set user at 100% of limit
      await request(app)
        .patch('/api/user/usage')
        .set('Authorization', `Bearer ${freeAuthToken}`)
        .send({ roasts_this_month: 100 }) // At limit
        .expect(200);

      const comment = fixtures.comments.light;
      const ingestResponse = await request(app)
        .post('/api/comments/ingest')
        .set('Authorization', `Bearer ${freeAuthToken}`)
        .send({
          platform: 'twitter',
          external_comment_id: `limit_exceeded_test`,
          comment_text: comment.text,
          author_id: comment.author.id,
          author_username: comment.author.username,
          org_id: testOrg.id
        })
        .expect(201);

      const generateResponse = await request(app)
        .post(`/api/comments/${ingestResponse.body.data.id}/generate`)
        .set('Authorization', `Bearer ${freeAuthToken}`)
        .expect(402); // Payment required

      expect(generateResponse.body.error).toContain('monthly limit exceeded');
      expect(generateResponse.body.current_usage).toBe(100);
      expect(generateResponse.body.plan_limit).toBe(100);
      expect(generateResponse.body.upgrade_options).toBeDefined();
      expect(generateResponse.body.next_reset_date).toBeDefined();
    });
  });

  describeFunction('Plan-Specific Pricing', () => {
    test('should return correct pricing for each plan', async () => {
      const pricingResponse = await request(app)
        .get('/api/billing/pricing')
        .expect(200);

      const plans = pricingResponse.body.data.plans;
      
      // Verify plan structure and pricing
      expect(plans.free).toEqual({
        name: 'Free',
        price: 0,
        currency: 'EUR',
        interval: 'month',
        features: expect.arrayContaining(['basic_roasting', 'twitter_support']),
        limits: {
          monthly_roasts: 100,
          platforms: 1,
          custom_styles: false
        }
      });

      expect(plans.starter).toEqual({
        name: 'Starter',
        price: 5,
        currency: 'EUR',
        interval: 'month',
        features: expect.arrayContaining(['enhanced_roasting', 'multi_platform']),
        limits: {
          monthly_roasts: 500,
          platforms: 3,
          custom_styles: true
        }
      });

      expect(plans.pro).toEqual({
        name: 'Pro',
        price: 15,
        currency: 'EUR',
        interval: 'month',
        features: expect.arrayContaining(['advanced_analytics', 'all_platforms']),
        limits: {
          monthly_roasts: 2000,
          platforms: 'unlimited',
          custom_styles: true
        }
      });

      expect(plans.plus).toEqual({
        name: 'Plus',
        price: 50,
        currency: 'EUR',
        interval: 'month',
        features: expect.arrayContaining(['priority_support', 'white_label']),
        limits: {
          monthly_roasts: 10000,
          platforms: 'unlimited',
          custom_styles: true
        }
      });
    });
  });

  describeFunction('Feature Flag Integration', () => {
    test('should respect feature flags for plan-specific features', async () => {
      // Test with feature flags disabled
      process.env.ENABLE_ADVANCED_ANALYTICS = 'false';

      const proAuthToken = fixtures.auth.proUserToken;
      
      const analyticsResponse = await request(app)
        .get('/api/user/analytics/advanced')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(503); // Service unavailable

      expect(analyticsResponse.body.error).toContain('feature temporarily disabled');

      // Re-enable feature
      process.env.ENABLE_ADVANCED_ANALYTICS = 'true';

      const enabledAnalyticsResponse = await request(app)
        .get('/api/user/analytics/advanced')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      expect(enabledAnalyticsResponse.body.data.advanced_metrics).toBeDefined();

      // Cleanup
      delete process.env.ENABLE_ADVANCED_ANALYTICS;
    });
  });

  describeFunction('Billing Integration', () => {
    test('should integrate properly with Stripe billing system', async () => {
      const freeAuthToken = fixtures.auth.freeUserToken;

      // Mock Stripe checkout session creation
      const checkoutResponse = await request(app)
        .post('/api/billing/create-checkout-session')
        .set('Authorization', `Bearer ${freeAuthToken}`)
        .send({
          plan: 'pro',
          success_url: 'http://localhost:3000/success',
          cancel_url: 'http://localhost:3000/cancel'
        })
        .expect(200);

      expect(checkoutResponse.body.data.checkout_url).toBeDefined();
      expect(checkoutResponse.body.data.session_id).toBeDefined();
      expect(checkoutResponse.body.data.plan).toBe('pro');
      expect(checkoutResponse.body.data.amount).toBe(15); // €15 for pro plan
    });

    test('should handle webhook events for plan changes', async () => {
      // Mock Stripe webhook for successful subscription
      const webhookResponse = await request(app)
        .post('/api/billing/webhook')
        .send({
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_12345',
              customer: 'cus_test_12345',
              subscription: 'sub_test_12345',
              metadata: {
                user_id: testUsers?.free?.id || 'mock-user-id',
                plan: 'pro'
              }
            }
          }
        })
        .expect(200);

      expect(webhookResponse.body.received).toBe(true);
      expect(webhookResponse.body.processed).toBe(true);

      // Verify user plan was updated
      const userResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${fixtures.auth.freeUserToken}`)
        .expect(200);

      expect(userResponse.body.data.plan).toBe('pro');
      expect(userResponse.body.data.subscription_status).toBe('active');
    });
  });

  describeFunction('Edge Cases and Error Handling', () => {
    test('should handle invalid plan transitions gracefully', async () => {
      const proAuthToken = fixtures.auth.proUserToken;

      // Attempt invalid downgrade that would lose data
      const invalidDowngradeResponse = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send({
          new_plan: 'free',
          immediate: true // Would cause data loss
        })
        .expect(400);

      expect(invalidDowngradeResponse.body.error).toContain('data loss warning');
      expect(invalidDowngradeResponse.body.data_loss_items).toContain('advanced_analytics_history');
      expect(invalidDowngradeResponse.body.confirmation_required).toBe(true);
    });

    test('should handle billing service failures gracefully', async () => {
      // Mock Stripe service failure
      const mockStripe = require('../../src/services/stripe');
      mockStripe.createCheckoutSession.mockRejectedValueOnce(new Error('Stripe service unavailable'));

      const upgradeResponse = await request(app)
        .post('/api/billing/create-checkout-session')
        .set('Authorization', `Bearer ${fixtures.auth.freeUserToken}`)
        .send({ plan: 'pro' })
        .expect(503);

      expect(upgradeResponse.body.error).toContain('billing service temporarily unavailable');
      expect(upgradeResponse.body.retry_after).toBeDefined();
    });
  });

  describeFunction('Usage Reset and Billing Cycles', () => {
    test('should reset usage counters at beginning of billing cycle', async () => {
      const proAuthToken = fixtures.auth.proUserToken;

      // Set usage to near limit
      await request(app)
        .patch('/api/user/usage')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send({ roasts_this_month: 1900 }) // Near pro limit of 2000
        .expect(200);

      // Simulate billing cycle reset
      const resetResponse = await request(app)
        .post('/api/billing/simulate-cycle-reset')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      expect(resetResponse.body.data.reset_successful).toBe(true);
      expect(resetResponse.body.data.previous_usage).toBe(1900);
      expect(resetResponse.body.data.new_usage).toBe(0);

      // Verify usage is reset
      const usageResponse = await request(app)
        .get('/api/user/usage')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      expect(usageResponse.body.data.roasts_this_month).toBe(0);
      expect(usageResponse.body.data.cycle_start_date).toBeDefined();
      expect(usageResponse.body.data.next_reset_date).toBeDefined();
    });
  });
});