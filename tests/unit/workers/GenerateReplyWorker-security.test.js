/**
 * GenerateReplyWorker Security Tests
 * Issue #405 - CodeRabbit Round 2 Security Fixes
 * 
 * Tests critical security validations for content validation:
 * - Atomic content validation with checksums
 * - Race condition prevention
 * - Transparency validation enforcement
 * - Content mismatch detection
 */

const { createSupabaseMock } = require('../../helpers/supabaseMockFactory');

// ============================================================================
// STEP 1: Create mocks BEFORE jest.mock() calls (Issue #892 - Fix Supabase Mock Pattern)
// ============================================================================

// Create Supabase mock with defaults for all tables that might be used
const mockSupabase = createSupabaseMock({
    comments: [],
    responses: [],
    plan_limits: [],
    organizations: [],
    roast_approvals: []
});

// Mock dependencies
jest.mock('../../../src/config/supabase', () => ({
  supabaseServiceClient: mockSupabase
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock BaseWorker
jest.mock('../../../src/workers/BaseWorker', () => {
  return class MockBaseWorker {
    constructor(workerType, options = {}) {
      this.workerType = workerType;
      this.workerName = `${workerType}-worker-test`;
      this.config = { maxRetries: 3, ...options };
      this.supabase = mockSupabase;
      this.queueService = {
        addJob: jest.fn(),
        initialize: jest.fn(),
        shutdown: jest.fn()
      };
      this.redis = null;
      this.log = jest.fn();
      this.start = jest.fn();
      this.stop = jest.fn();
      this.initializeConnections = jest.fn();
      this.setupGracefulShutdown = jest.fn();
    }
  };
});

// Mock Cost Control service
const mockCostControlService = {
  canPerformOperation: jest.fn().mockResolvedValue({ allowed: true }),
  recordUsage: jest.fn(),
  initialize: jest.fn()
};

jest.mock('../../../src/services/costControl', () => {
  return jest.fn().mockImplementation(() => mockCostControlService);
});

// Mock RoastPromptTemplate
jest.mock('../../../src/services/roastPromptTemplate', () => {
  return jest.fn().mockImplementation(() => ({
    generatePrompt: jest.fn(),
    validatePrompt: jest.fn()
  }));
});

// Mock transparencyService
jest.mock('../../../src/services/transparencyService', () => ({
  applyTransparency: jest.fn(),
  validateTransparency: jest.fn()
}));

// Mock OpenAI client
const mockOpenAIClient = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

// Mock mockMode
jest.mock('../../../src/config/mockMode', () => ({
  mockMode: {
    isMockMode: true,
    generateMockSupabaseClient: jest.fn(() => mockSupabase),
    generateMockOpenAI: jest.fn(() => mockOpenAIClient)
  }
}));

// Mock killSwitch
jest.mock('../../../src/middleware/killSwitch', () => ({
  shouldBlockAutopost: jest.fn().mockReturnValue(false)
}));

// Mock constants
jest.mock('../../../src/config/constants', () => ({
  PLATFORM_LIMITS: {}
}));

// Mock advancedLogger
jest.mock('../../../src/utils/advancedLogger', () => ({
  logWorkerEvent: jest.fn(),
  logError: jest.fn(),
  queueLogger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../../src/services/autoApprovalService', () => {
  return jest.fn().mockImplementation(() => ({
    shouldAutoApprove: jest.fn()
  }));
});

// ============================================================================
// STEP 3: Require modules AFTER mocks are configured
// ============================================================================

const GenerateReplyWorker = require('../../../src/workers/GenerateReplyWorker');
const { supabaseServiceClient } = require('../../../src/config/supabase');
const { logger } = require('../../../src/utils/logger');

describe('GenerateReplyWorker - Security Validations', () => {
  let worker;
  let mockAutoApprovalService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Supabase mock to defaults
    mockSupabase._reset();
    
    // Configure mockSupabase.from to return a chainable mock
    const mockTableBuilder = {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            update: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      })),
      update: jest.fn(() => Promise.resolve({ data: null, error: null }))
    };
    mockSupabase.from.mockReturnValue(mockTableBuilder);
    
    worker = new GenerateReplyWorker();
    mockAutoApprovalService = worker.autoApprovalService;
  });

  describe('validateContentAtomically - Multi-Layer Security', () => {
    const mockContext = {
      commentId: 'comment-123',
      organizationId: 'org-123',
      timestamp: new Date().toISOString()
    };

    describe('Layer 1: Exact string comparison', () => {
      test('should pass when stored and approved content are identical', async () => {
        const storedResponse = { content: 'This is a test roast' };
        const approvedVariant = { content: 'This is a test roast' };
        const originalResponse = { content: 'This is a test roast' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(true);
        expect(result.layer).toBe('string_comparison');
      });

      test('should fail when content text differs', async () => {
        const storedResponse = { content: 'Original roast content' };
        const approvedVariant = { content: 'Modified roast content' };
        const originalResponse = { content: 'Original roast content' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('content_text_mismatch');
        expect(result.details).toMatchObject({
          storedLength: 20,
          approvedLength: 21,
          differenceDetected: true
        });
      });

      test('should handle null/undefined content gracefully', async () => {
        const storedResponse = { content: null };
        const approvedVariant = { content: 'Some content' };
        const originalResponse = { content: 'Original' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('content_text_mismatch');
        expect(logger.warn).toHaveBeenCalledWith(
          'Content validation failed at string comparison layer',
          expect.objectContaining({
            reason: 'content_text_mismatch'
          })
        );
      });
    });

    describe('Layer 2: Enhanced checksum validation', () => {
      test('should generate consistent checksums for identical content', () => {
        const content1 = 'This is test content';
        const content2 = 'This is test content';
        
        const checksum1 = worker.calculateContentChecksum(content1);
        const checksum2 = worker.calculateContentChecksum(content2);
        
        expect(checksum1).toBe(checksum2);
        expect(checksum1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
      });

      test('should generate different checksums for different content', () => {
        const content1 = 'Original content';
        const content2 = 'Modified content';
        
        const checksum1 = worker.calculateContentChecksum(content1);
        const checksum2 = worker.calculateContentChecksum(content2);
        
        expect(checksum1).not.toBe(checksum2);
      });

      test('should detect checksum mismatch even with identical text length', async () => {
        const storedResponse = { content: 'Original roast content here' };
        const approvedVariant = { content: 'Modified roast content here' }; // Same length
        const originalResponse = { content: 'Original roast content here' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('content_text_mismatch');
        
        // Even though lengths are same, checksums should be different
        const storedChecksum = worker.calculateContentChecksum(storedResponse.content);
        const approvedChecksum = worker.calculateContentChecksum(approvedVariant.content);
        expect(storedChecksum).not.toBe(approvedChecksum);
      });

      test('should handle special characters and unicode in checksums', () => {
        const content1 = 'Roast with émojis 🔥 and special chars: áéíóú';
        const content2 = 'Roast with emojis 🔥 and special chars: aeiou'; // Different
        
        const checksum1 = worker.calculateContentChecksum(content1);
        const checksum2 = worker.calculateContentChecksum(content2);
        
        expect(checksum1).not.toBe(checksum2);
        expect(checksum1).toMatch(/^[a-f0-9]{64}$/);
        expect(checksum2).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    describe('Layer 3: Metadata validation', () => {
      test('should validate critical metadata fields match', async () => {
        const storedResponse = { 
          content: 'Test content',
          platform: 'twitter',
          organizationId: 'org-123',
          transparency: 'signature'
        };
        const approvedVariant = { 
          content: 'Test content',
          platform: 'twitter',
          organizationId: 'org-123', 
          transparency: 'signature'
        };
        const originalResponse = { content: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(true);
        expect(result.validationLayers).toContain('metadata');
      });

      test('should fail when critical metadata differs', async () => {
        const storedResponse = { 
          content: 'Test content',
          organizationId: 'org-123',
          transparency: 'signature'
        };
        const approvedVariant = { 
          content: 'Test content',
          organizationId: 'org-456', // Different org
          transparency: 'disclaimer'  // Different transparency
        };
        const originalResponse = { content: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('metadata_mismatch');
        expect(result.details.metadataDifferences).toEqual([
          'organizationId',
          'transparency'
        ]);
      });

      test('should ignore non-critical metadata differences', async () => {
        const storedResponse = { 
          content: 'Test content',
          organizationId: 'org-123',
          timestamp: '2025-01-26T10:00:00Z',
          processingTime: 1500
        };
        const approvedVariant = { 
          content: 'Test content',
          organizationId: 'org-123',
          timestamp: '2025-01-26T10:01:00Z', // Different timestamp - should be ignored
          processingTime: 1600 // Different processing time - should be ignored
        };
        const originalResponse = { content: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(true);
        expect(result.details.ignoredFields).toContain('timestamp');
        expect(result.details.ignoredFields).toContain('processingTime');
      });
    });

    describe('Layer 4: Temporal validation (race condition detection)', () => {
      test('should detect potential race conditions from timing analysis', async () => {
        const storedResponse = { 
          content: 'Test content',
          timestamp: '2025-01-26T10:00:00Z'
        };
        const approvedVariant = { 
          content: 'Test content',
          approvalTimestamp: '2025-01-26T09:59:30Z' // Approved before stored
        };
        const originalResponse = { content: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('temporal_validation_failed');
        expect(result.details.raceConditionDetected).toBe(true);
        expect(logger.error).toHaveBeenCalledWith(
          'Potential race condition detected in content validation',
          expect.objectContaining({
            storedTimestamp: '2025-01-26T10:00:00Z',
            approvalTimestamp: '2025-01-26T09:59:30Z',
            timeDifference: expect.any(Number)
          })
        );
      });

      test('should pass temporal validation for normal timing', async () => {
        const storedResponse = { 
          content: 'Test content',
          timestamp: '2025-01-26T10:00:00Z'
        };
        const approvedVariant = { 
          content: 'Test content',
          approvalTimestamp: '2025-01-26T10:00:30Z' // Approved after stored
        };
        const originalResponse = { content: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(true);
        expect(result.details.raceConditionDetected).toBe(false);
      });

      test('should handle missing timestamps gracefully', async () => {
        const storedResponse = { content: 'Test content' }; // No timestamp
        const approvedVariant = { content: 'Test content' }; // No approval timestamp
        const originalResponse = { content: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        expect(result.valid).toBe(true);
        expect(result.details.temporalValidationSkipped).toBe(true);
        expect(logger.debug).toHaveBeenCalledWith(
          'Temporal validation skipped - timestamps not available',
          expect.any(Object)
        );
      });
    });

    describe('Performance and security optimization', () => {
      test('should complete validation within performance threshold', async () => {
        const storedResponse = { content: 'Performance test content' };
        const approvedVariant = { content: 'Performance test content' };
        const originalResponse = { content: 'Performance test content' };

        const startTime = Date.now();
        const result = await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );
        const duration = Date.now() - startTime;

        expect(result.valid).toBe(true);
        expect(duration).toBeLessThan(100); // Should complete in <100ms
        expect(result.performance).toMatchObject({
          validationDuration: expect.any(Number),
          layersValidated: 4
        });
      });

      test('should sanitize sensitive information from logs', async () => {
        const storedResponse = { 
          content: 'Test content with API_KEY=secret123',
          apiKey: 'secret123' 
        };
        const approvedVariant = { 
          content: 'Modified content with API_KEY=secret456',
          apiKey: 'secret456'
        };
        const originalResponse = { content: 'Original content' };

        await worker.validateContentAtomically(
          storedResponse, 
          approvedVariant, 
          originalResponse, 
          mockContext
        );

        // Check that sensitive info is not logged in plain text
        const logCalls = logger.warn.mock.calls.flat();
        const loggedContent = logCalls.join(' ');
        
        expect(loggedContent).not.toContain('secret123');
        expect(loggedContent).not.toContain('secret456');
        expect(loggedContent).not.toContain('API_KEY=secret');
      });
    });
  });

  describe('Transparency Validation Integration', () => {
    test('should enforce transparency validation for auto-published content', async () => {
      const mockJob = {
        data: {
          commentId: 'comment-123',
          autoPublish: true,
          content: 'Test roast without transparency'
        }
      };

      // Mock auto-approval service to approve
      mockAutoApprovalService.shouldAutoApprove.mockResolvedValue({
        approved: true,
        transparencyRequired: true
      });

      // Mock Supabase to return content without transparency
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { 
            content: 'Test roast without transparency',
            transparency_applied: false 
          },
          error: null
        })
      };
      supabaseServiceClient.from.mockReturnValue(mockQuery);

      const result = await worker.processJob(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transparency validation failed');
      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL: Auto-published content failed transparency validation',
        expect.objectContaining({
          commentId: 'comment-123',
          transparencyRequired: true,
          transparencyApplied: false
        })
      );
    });

    test('should allow auto-publishing when transparency is properly applied', async () => {
      const mockJob = {
        data: {
          commentId: 'comment-123',
          autoPublish: true,
          content: 'Test roast with proper transparency disclaimer'
        }
      };

      // Mock auto-approval service to approve with transparency
      mockAutoApprovalService.shouldAutoApprove.mockResolvedValue({
        approved: true,
        transparencyRequired: true
      });

      // Mock Supabase to return content WITH transparency
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { 
            content: 'Test roast with proper transparency disclaimer',
            transparency_applied: true,
            transparency_type: 'disclaimer'
          },
          error: null
        }),
        update: jest.fn().mockReturnThis()
      };
      supabaseServiceClient.from.mockReturnValue(mockQuery);

      const result = await worker.processJob(mockJob);

      expect(result.success).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Auto-publish validation passed - transparency properly applied',
        expect.objectContaining({
          commentId: 'comment-123',
          transparencyType: 'disclaimer'
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle database errors gracefully in content validation', async () => {
      const storedResponse = { content: 'Test content' };
      const approvedVariant = { content: 'Test content' };
      const originalResponse = { content: 'Test content' };

      // Mock database error during validation
      jest.spyOn(worker, 'calculateContentChecksum').mockImplementation(() => {
        throw new Error('Checksum calculation failed');
      });

      const result = await worker.validateContentAtomically(
        storedResponse, 
        approvedVariant, 
        originalResponse, 
        mockContext
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('validation_system_error');
      expect(logger.error).toHaveBeenCalledWith(
        'Content validation system error - failing closed for security',
        expect.objectContaining({
          error: 'Checksum calculation failed'
        })
      );
    });

    test('should handle extremely large content gracefully', async () => {
      const largeContent = 'A'.repeat(100000); // 100KB content
      const storedResponse = { content: largeContent };
      const approvedVariant = { content: largeContent };
      const originalResponse = { content: largeContent };

      const result = await worker.validateContentAtomically(
        storedResponse, 
        approvedVariant, 
        originalResponse, 
        mockContext
      );

      expect(result.valid).toBe(true);
      expect(result.performance.validationDuration).toBeLessThan(500); // Should handle large content efficiently
    });

    test('should prevent content injection attacks through validation', async () => {
      const maliciousContent = 'Normal content <script>alert("xss")</script> with injection';
      const storedResponse = { content: 'Normal content' };
      const approvedVariant = { content: maliciousContent }; // Injected content
      const originalResponse = { content: 'Normal content' };

      const result = await worker.validateContentAtomically(
        storedResponse, 
        approvedVariant, 
        originalResponse, 
        mockContext
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('content_text_mismatch');
      expect(logger.warn).toHaveBeenCalledWith(
        'Content validation failed at string comparison layer',
        expect.objectContaining({
          reason: 'content_text_mismatch'
        })
      );
    });
  });
});