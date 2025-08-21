/**
 * Tests for configurable plan duration feature (Issue #125)
 * Tests the enhanced plan service with duration configuration
 */

const {
  getPlanFeatures,
  getPlanDuration,
  calculatePlanEndDate,
  supportsCustomDuration,
  getPlanTrialDays,
  PLAN_FEATURES
} = require('../../../src/services/planService');

describe('Plan Duration Configuration (Issue #125)', () => {
  describe('Plan Duration Retrieval', () => {
    test('should return duration configuration for free plan', () => {
      const duration = getPlanDuration('free');
      
      expect(duration).toMatchObject({
        days: 30,
        type: 'rolling',
        renewalType: 'automatic'
      });
    });

    test('should return duration configuration for pro plan with trial', () => {
      const duration = getPlanDuration('pro');
      
      expect(duration).toMatchObject({
        days: 30,
        type: 'rolling',
        renewalType: 'automatic',
        trialDays: 7
      });
    });

    test('should return duration configuration for creator_plus plan with trial and grace period', () => {
      const duration = getPlanDuration('creator_plus');
      
      expect(duration).toMatchObject({
        days: 30,
        type: 'rolling',
        renewalType: 'automatic',
        trialDays: 14,
        gracePeriod: 7
      });
    });

    test('should return duration configuration for custom plan', () => {
      const duration = getPlanDuration('custom');
      
      expect(duration).toMatchObject({
        days: 90,
        type: 'fixed',
        renewalType: 'manual',
        customizable: true
      });
    });

    test('should return null for non-existent plan', () => {
      const duration = getPlanDuration('non-existent');
      
      expect(duration).toBeNull();
    });
  });

  describe('Plan End Date Calculation', () => {
    const fixedStartDate = new Date('2024-01-01T00:00:00.000Z');

    test('should calculate end date for free plan (30 days)', () => {
      const endDate = calculatePlanEndDate('free', fixedStartDate);
      const expectedEndDate = new Date('2024-01-31T00:00:00.000Z');
      
      expect(endDate).toEqual(expectedEndDate);
    });

    test('should calculate end date for pro plan (30 days)', () => {
      const endDate = calculatePlanEndDate('pro', fixedStartDate);
      const expectedEndDate = new Date('2024-01-31T00:00:00.000Z');
      
      expect(endDate).toEqual(expectedEndDate);
    });

    test('should calculate end date for creator_plus plan with grace period', () => {
      const endDate = calculatePlanEndDate('creator_plus', fixedStartDate);
      // 30 days + 7 days grace period = 37 days
      const expectedEndDate = new Date('2024-02-07T00:00:00.000Z');
      
      expect(endDate).toEqual(expectedEndDate);
    });

    test('should calculate end date for custom plan (90 days)', () => {
      const endDate = calculatePlanEndDate('custom', fixedStartDate);
      const expectedEndDate = new Date('2024-03-31T00:00:00.000Z');
      
      expect(endDate).toEqual(expectedEndDate);
    });

    test('should use current date as default start date', () => {
      const now = new Date();
      const endDate = calculatePlanEndDate('free');
      
      // Should be approximately 30 days from now
      const daysDiff = Math.round((endDate - now) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(30);
    });

    test('should handle invalid plan by defaulting to 30 days', () => {
      const endDate = calculatePlanEndDate('invalid-plan', fixedStartDate);
      const expectedEndDate = new Date('2024-01-31T00:00:00.000Z');
      
      expect(endDate).toEqual(expectedEndDate);
    });

    test('should handle leap year correctly', () => {
      const leapYearStart = new Date('2024-02-01T00:00:00.000Z'); // 2024 is a leap year
      const endDate = calculatePlanEndDate('free', leapYearStart);
      const expectedEndDate = new Date('2024-03-02T00:00:00.000Z'); // February has 29 days in 2024
      
      expect(endDate).toEqual(expectedEndDate);
    });
  });

  describe('Custom Duration Support', () => {
    test('should return true for custom plan', () => {
      const hasCustomDuration = supportsCustomDuration('custom');
      
      expect(hasCustomDuration).toBe(true);
    });

    test('should return false for standard plans', () => {
      expect(supportsCustomDuration('free')).toBe(false);
      expect(supportsCustomDuration('pro')).toBe(false);
      expect(supportsCustomDuration('creator_plus')).toBe(false);
    });

    test('should return false for non-existent plan', () => {
      const hasCustomDuration = supportsCustomDuration('non-existent');
      
      expect(hasCustomDuration).toBe(false);
    });
  });

  describe('Trial Duration Retrieval', () => {
    test('should return null for free plan (no trial)', () => {
      const trialDays = getPlanTrialDays('free');
      
      expect(trialDays).toBeNull();
    });

    test('should return 7 days for pro plan', () => {
      const trialDays = getPlanTrialDays('pro');
      
      expect(trialDays).toBe(7);
    });

    test('should return 14 days for creator_plus plan', () => {
      const trialDays = getPlanTrialDays('creator_plus');
      
      expect(trialDays).toBe(14);
    });

    test('should return null for custom plan (no standard trial)', () => {
      const trialDays = getPlanTrialDays('custom');
      
      expect(trialDays).toBeNull();
    });

    test('should return null for non-existent plan', () => {
      const trialDays = getPlanTrialDays('non-existent');
      
      expect(trialDays).toBeNull();
    });
  });

  describe('Plan Features Integration', () => {
    test('should maintain backward compatibility with existing features', () => {
      const freePlan = getPlanFeatures('free');
      
      expect(freePlan).toMatchObject({
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'eur',
        limits: {
          roastsPerMonth: 100,
          commentsPerMonth: 500,
          platformIntegrations: 1
        },
        features: {
          basicSupport: true,
          prioritySupport: false,
          advancedAnalytics: false,
          teamCollaboration: false,
          customTones: false,
          apiAccess: false,
          shield: false,
          styleProfile: false
        },
        duration: expect.any(Object)
      });
    });

    test('should include duration in all plan definitions', () => {
      const allPlans = ['free', 'pro', 'creator_plus', 'custom'];
      
      allPlans.forEach(planId => {
        const plan = getPlanFeatures(planId);
        expect(plan.duration).toBeDefined();
        expect(plan.duration.days).toBeGreaterThan(0);
        expect(['rolling', 'fixed']).toContain(plan.duration.type);
        expect(['automatic', 'manual']).toContain(plan.duration.renewalType);
      });
    });

    test('should have consistent plan structure', () => {
      const requiredFields = ['id', 'name', 'price', 'currency', 'duration', 'limits', 'features'];
      
      Object.values(PLAN_FEATURES).forEach(plan => {
        requiredFields.forEach(field => {
          expect(plan[field]).toBeDefined();
        });
      });
    });
  });

  describe('Edge Cases and Validation', () => {
    test('should handle date edge cases around month boundaries', () => {
      const monthEndDate = new Date('2024-01-31T00:00:00.000Z');
      const endDate = calculatePlanEndDate('free', monthEndDate);
      
      // Should correctly add 30 days to January 31st
      const expectedEndDate = new Date('2024-03-01T00:00:00.000Z'); // March 1st (Feb has 29 days in 2024)
      expect(endDate).toEqual(expectedEndDate);
    });

    test('should handle very long custom duration', () => {
      // Temporarily modify the plan features for testing
      const originalCustomPlan = PLAN_FEATURES.custom;
      PLAN_FEATURES.custom = {
        ...originalCustomPlan,
        duration: { ...originalCustomPlan.duration, days: 365 }
      };

      const startDate = new Date('2024-01-01T00:00:00.000Z');
      const endDate = calculatePlanEndDate('custom', startDate);
      // 365 days from January 1, 2024 = December 31, 2024 (2024 is a leap year)
      const expectedEndDate = new Date('2024-12-31T00:00:00.000Z');
      
      expect(endDate).toEqual(expectedEndDate);

      // Restore original plan
      PLAN_FEATURES.custom = originalCustomPlan;
    });

    test('should handle zero duration gracefully', () => {
      const originalCustomPlan = PLAN_FEATURES.custom;
      PLAN_FEATURES.custom = {
        ...originalCustomPlan,
        duration: { ...originalCustomPlan.duration, days: 0 }
      };

      const startDate = new Date('2024-01-01T00:00:00.000Z');
      const endDate = calculatePlanEndDate('custom', startDate);
      
      // Should be same as start date for zero duration
      expect(endDate).toEqual(startDate);

      // Restore original plan
      PLAN_FEATURES.custom = originalCustomPlan;
    });

    test('should handle negative grace period gracefully', () => {
      const originalCreatorPlan = PLAN_FEATURES.creator_plus;
      PLAN_FEATURES.creator_plus = {
        ...originalCreatorPlan,
        duration: { ...originalCreatorPlan.duration, gracePeriod: -5 }
      };

      const startDate = new Date('2024-01-01T00:00:00.000Z');
      const endDate = calculatePlanEndDate('creator_plus', startDate);
      
      // Should subtract 5 days instead of adding
      const expectedEndDate = new Date('2024-01-26T00:00:00.000Z'); // 30 - 5 = 25 days
      expect(endDate).toEqual(expectedEndDate);

      // Restore original plan
      PLAN_FEATURES.creator_plus = originalCreatorPlan;
    });
  });

  describe('Real-world Scenarios', () => {
    test('should calculate correct billing cycles', () => {
      const subscriptionStart = new Date('2024-01-15T10:30:00.000Z');
      
      // Pro plan with 30-day cycle
      const proCycleEnd = calculatePlanEndDate('pro', subscriptionStart);
      const proExpectedEnd = new Date('2024-02-14T10:30:00.000Z');
      expect(proCycleEnd).toEqual(proExpectedEnd);

      // Custom plan with 90-day cycle (January 15 + 90 days = April 14)
      const customCycleEnd = calculatePlanEndDate('custom', subscriptionStart);
      const customExpectedEnd = new Date('2024-04-14T10:30:00.000Z');
      expect(customCycleEnd).toEqual(customExpectedEnd);
    });

    test('should handle timezone-independent calculations', () => {
      const utcDate = new Date('2024-01-01T00:00:00.000Z');
      const localDate = new Date('2024-01-01T00:00:00'); // Local time
      
      const utcEndDate = calculatePlanEndDate('free', utcDate);
      const localEndDate = calculatePlanEndDate('free', localDate);
      
      // Both should result in dates 30 days later
      const utcDaysDiff = (utcEndDate - utcDate) / (1000 * 60 * 60 * 24);
      const localDaysDiff = (localEndDate - localDate) / (1000 * 60 * 60 * 24);
      
      expect(utcDaysDiff).toBe(30);
      expect(localDaysDiff).toBe(30);
    });
  });
});