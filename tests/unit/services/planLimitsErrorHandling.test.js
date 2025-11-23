/**
 * Tests for enhanced plan limits application with error handling (Issue #125)
 * Tests the applyPlanLimits function with new error handling options
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with defaults
const mockSupabase = createSupabaseMock({
    user_subscriptions: [],
    plan_limits: []
});

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));
jest.mock('../../../src/services/planService');
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

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const { applyPlanLimits } = require('../../../src/services/subscriptionService');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { getPlanFeatures } = require('../../../src/services/planService');
const { logger } = require('../../../src/utils/logger');

describe('Plan Limits Error Handling (Issue #125)', () => {
  const mockUserId = 'test-user-123';
  const mockOrgId = 'org-456';
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Supabase mock to defaults
    mockSupabase._reset();
    
    // Mock plan features
    getPlanFeatures.mockImplementation((planId) => ({
      free: {
        limits: { roastsPerMonth: 100, commentsPerMonth: 500, platformIntegrations: 1 }
      },
      pro: {
        limits: { roastsPerMonth: 1000, commentsPerMonth: 5000, platformIntegrations: 5 }
      },
      creator_plus: {
        limits: { roastsPerMonth: -1, commentsPerMonth: -1, platformIntegrations: 9 }
      }
    }[planId]));

    // Mock successful database operations by default
    mockSupabase.from.mockReturnValue({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: {}, error: null })
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn().mockResolvedValue({ 
            data: { id: mockOrgId, name: 'Test Org' }, 
            error: null 
          })
        }))
      }))
    });
  });

  describe('Successful Operations', () => {
    test('should apply plan limits successfully with operation tracking', async () => {
      const result = await applyPlanLimits(mockUserId, 'pro', 'active');
      
      expect(result).toMatchObject({
        userId: mockUserId,
        plan: 'pro',
        status: 'active',
        operationsCompleted: {
          userUpdate: true,
          organizationUpdate: true
        },
        success: true
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        'Plan limits applied successfully',
        expect.objectContaining({ success: true })
      );
    });

    test('should handle user without organization gracefully', async () => {
      // Mock no organization found
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: {}, error: null })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      const result = await applyPlanLimits(mockUserId, 'pro', 'active');
      
      expect(result.operationsCompleted).toEqual({
        userUpdate: true,
        organizationUpdate: false
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        'No organization found for user, skipping organization limit update:',
        { userId: mockUserId }
      );
    });
  });

  describe('Input Validation', () => {
    test('should throw error for missing userId', async () => {
      await expect(applyPlanLimits(null, 'pro', 'active'))
        .rejects.toThrow('Invalid parameters: userId, plan, and status are required');
    });

    test('should throw error for missing plan', async () => {
      await expect(applyPlanLimits(mockUserId, null, 'active'))
        .rejects.toThrow('Invalid parameters: userId, plan, and status are required');
    });

    test('should throw error for missing status', async () => {
      await expect(applyPlanLimits(mockUserId, 'pro', null))
        .rejects.toThrow('Invalid parameters: userId, plan, and status are required');
    });

    test('should throw error for invalid plan', async () => {
      getPlanFeatures.mockReturnValue(null);
      
      const error = await applyPlanLimits(mockUserId, 'invalid-plan', 'active')
        .catch(e => e);
      
      expect(error.message).toBe('Invalid plan: invalid-plan');
      expect(error.code).toBe('INVALID_PLAN');
    });
  });

  describe('Error Handling Options', () => {
    test('should fail silently when configured', async () => {
      // Make user update fail
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'User update failed' } })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      });

      const result = await applyPlanLimits(mockUserId, 'pro', 'active', { failSilently: true });
      
      expect(result).toMatchObject({
        success: false,
        error: 'Failed to update user plan limits: User update failed',
        operationsCompleted: {
          userUpdate: false,
          organizationUpdate: false
        }
      });
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Plan limits application failed but configured to fail silently:',
        expect.any(Object)
      );
    });

    test('should allow partial failures when configured', async () => {
      // Make organization update fail but allow partial failure
      mockSupabase.from.mockReturnValue({
        update: jest.fn((table) => ({
          eq: jest.fn(() => {
            if (table === 'users') {
              return Promise.resolve({ data: {}, error: null });
            } else {
              return Promise.resolve({ data: null, error: { message: 'Org update failed' } });
            }
          })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { id: mockOrgId, name: 'Test Org' }, 
              error: null 
            })
          }))
        }))
      }));

      const result = await applyPlanLimits(mockUserId, 'pro', 'active', { 
        partialFailureAllowed: true 
      });
      
      expect(result.operationsCompleted).toEqual({
        userUpdate: true,
        organizationUpdate: false
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        'Organization update failed but continuing due to partialFailureAllowed:',
        expect.stringContaining('Org update failed')
      );
    });

    test('should detect inconsistent state when user succeeds but org fails', async () => {
      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => {
            callCount++;
            if (callCount === 1) {
              // User update succeeds
              return Promise.resolve({ data: {}, error: null });
            } else {
              // Organization update fails
              return Promise.resolve({ data: null, error: { message: 'Org update failed' } });
            }
          })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { id: mockOrgId, name: 'Test Org' }, 
              error: null 
            })
          }))
        }))
      }));

      const error = await applyPlanLimits(mockUserId, 'pro', 'active')
        .catch(e => e);
      
      expect(error.inconsistentState).toBe(true);
      expect(error.operationsCompleted).toEqual({
        userUpdate: true,
        organizationUpdate: false
      });
      
      expect(logger.error).toHaveBeenCalledWith(
        'Inconsistent state detected: user updated but organization update failed',
        expect.objectContaining({
          userId: mockUserId,
          plan: 'pro'
        })
      );
    });
  });

  describe('Error Context and Codes', () => {
    test('should provide detailed error context for user update failure', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Database connection lost' } 
          })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      }));

      const error = await applyPlanLimits(mockUserId, 'pro', 'active')
        .catch(e => e);
      
      expect(error.code).toBe('USER_UPDATE_FAILED');
      expect(error.context).toMatchObject({
        userId: mockUserId,
        plan: 'pro',
        status: 'active',
        operationsCompleted: {
          userUpdate: false,
          organizationUpdate: false
        }
      });
    });

    test('should provide detailed error context for organization fetch failure', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: {}, error: null })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Organization query failed' }
            })
          }))
        }))
      }));

      const error = await applyPlanLimits(mockUserId, 'pro', 'active')
        .catch(e => e);
      
      expect(error.code).toBe('ORGANIZATION_FETCH_FAILED');
      expect(error.originalError.message).toBe('Organization query failed');
    });

    test('should provide organization ID in error for update failures', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn((table) => ({
          eq: jest.fn(() => {
            if (table === 'users') {
              return Promise.resolve({ data: {}, error: null });
            } else {
              return Promise.resolve({ data: null, error: { message: 'Org constraint violation' } });
            }
          })
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { id: mockOrgId, name: 'Test Org' }, 
              error: null 
            })
          }))
        }))
      }));

      const error = await applyPlanLimits(mockUserId, 'pro', 'active')
        .catch(e => e);
      
      expect(error.code).toBe('ORGANIZATION_UPDATE_FAILED');
      expect(error.organizationId).toBe(mockOrgId);
    });
  });

  describe('Plan-specific Behavior', () => {
    test('should handle unlimited plan limits correctly', async () => {
      const result = await applyPlanLimits(mockUserId, 'creator_plus', 'active');
      
      expect(result.limits).toMatchObject({
        roastsPerMonth: -1,
        commentsPerMonth: -1,
        platformIntegrations: 9
      });

      // Verify organization was updated with unlimited limit (999999)
      // Issue #618 - Add defensive check for mock.calls array (checking second call [1])
      expect(supabaseServiceClient.from().update.mock.calls.length).toBeGreaterThan(1);
      const updateCall = supabaseServiceClient.from().update.mock.calls[1][0];
      expect(updateCall.monthly_responses_limit).toBe(999999);
    });

    test('should apply free plan limits for inactive subscriptions', async () => {
      const result = await applyPlanLimits(mockUserId, 'pro', 'inactive');
      
      // Should use free plan limits despite pro plan being specified
      expect(result.limits).toMatchObject({
        roastsPerMonth: 100,
        commentsPerMonth: 500,
        platformIntegrations: 1
      });
    });

    test('should handle edge case with zero limits', async () => {
      getPlanFeatures.mockReturnValue({
        limits: { roastsPerMonth: 0, commentsPerMonth: 0, platformIntegrations: 0 }
      });

      const result = await applyPlanLimits(mockUserId, 'test-plan', 'active');

      // Issue #618 - Add defensive check for mock.calls array (checking second call [1])
      expect(supabaseServiceClient.from().update.mock.calls.length).toBeGreaterThan(1);
      const updateCall = supabaseServiceClient.from().update.mock.calls[1][0];
      expect(updateCall.monthly_responses_limit).toBe(0);
    });
  });
});