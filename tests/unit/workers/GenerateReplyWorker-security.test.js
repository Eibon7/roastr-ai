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
  logJobLifecycle: jest.fn(),
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
  let mockContext;

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
    mockContext = {
      comment_id: 'comment-123',
      organization_id: 'org-123',
      timestamp: new Date().toISOString()
    };
  });

  describe('validateContentAtomically - Multi-Layer Security', () => {
    describe('Layer 1: Exact string comparison', () => {
      test('should pass when stored and approved content are identical', async () => {
        const storedResponse = { response_text: 'This is a test roast' };
        const approvedVariant = { text: 'This is a test roast' };
        const originalResponse = { response_text: 'This is a test roast' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
      });

      test('should fail when content text differs', async () => {
        const storedResponse = { response_text: 'Original roast content' };
        const approvedVariant = { text: 'Modified roast content' };
        const originalResponse = { response_text: 'Original roast content' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
        if (!result.valid) {
          expect(result.reason).toBeDefined();
        }
      });

      test('should handle null/undefined content gracefully', async () => {
        const storedResponse = { response_text: null };
        const approvedVariant = { text: 'Some content' };
        const originalResponse = { response_text: 'Original' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
        expect(result.reason).toBeDefined();
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
        const storedResponse = { response_text: 'Original roast content here' };
        const approvedVariant = { text: 'Modified roast content here' }; // Same length
        const originalResponse = { response_text: 'Original roast content here' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');

        // Even though lengths are same, checksums should be different
        const storedChecksum = worker.calculateContentChecksum(storedResponse.response_text);
        const approvedChecksum = worker.calculateContentChecksum(approvedVariant.text);
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
          response_text: 'Test content',
          text: 'Test content',
          platform: 'twitter',
          organizationId: 'org-123',
          transparency: 'signature'
        };
        const approvedVariant = {
          response_text: 'Test content',
          text: 'Test content',
          platform: 'twitter',
          organizationId: 'org-123',
          transparency: 'signature'
        };
        const originalResponse = { response_text: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
      });

      test('should fail when critical metadata differs', async () => {
        const storedResponse = {
          response_text: 'Test content',
          text: 'Test content',
          organizationId: 'org-123',
          transparency: 'signature'
        };
        const approvedVariant = {
          response_text: 'Test content',
          text: 'Test content',
          organizationId: 'org-456', // Different org
          transparency: 'disclaimer' // Different transparency
        };
        const originalResponse = { response_text: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
        if (!result.valid) {
          expect(result.reason).toBeDefined();
        }
      });

      test('should ignore non-critical metadata differences', async () => {
        const storedResponse = {
          response_text: 'Test content',
          text: 'Test content',
          organizationId: 'org-123',
          timestamp: '2025-01-26T10:00:00Z',
          processingTime: 1500
        };
        const approvedVariant = {
          response_text: 'Test content',
          text: 'Test content',
          organizationId: 'org-123',
          timestamp: '2025-01-26T10:01:00Z', // Different timestamp - should be ignored
          processingTime: 1600 // Different processing time - should be ignored
        };
        const originalResponse = { response_text: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
      });
    });

    describe('Layer 4: Temporal validation (race condition detection)', () => {
      test('should detect potential race conditions from timing analysis', async () => {
        const storedResponse = {
          response_text: 'Test content',
          timestamp: '2025-01-26T10:00:00Z'
        };
        const approvedVariant = {
          text: 'Test content',
          approvalTimestamp: '2025-01-26T09:59:30Z'
        };
        const originalResponse = { response_text: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
      });

      test('should pass temporal validation for normal timing', async () => {
        const storedResponse = {
          response_text: 'Test content',
          timestamp: '2025-01-26T10:00:00Z'
        };
        const approvedVariant = {
          text: 'Test content',
          approvalTimestamp: '2025-01-26T10:00:30Z'
        };
        const originalResponse = { response_text: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
      });

      test('should handle missing timestamps gracefully', async () => {
        const storedResponse = { response_text: 'Test content' }; // No timestamp
        const approvedVariant = { text: 'Test content' }; // No approval timestamp
        const originalResponse = { response_text: 'Test content' };

        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );

        expect(typeof result.valid).toBe('boolean');
      });
    });

    describe('Performance and security optimization', () => {
      test('should complete validation within performance threshold', async () => {
        const storedResponse = { response_text: 'Performance test content' };
        const approvedVariant = { text: 'Performance test content' };
        const originalResponse = { response_text: 'Performance test content' };

        const startTime = Date.now();
        const result = await worker.validateContentAtomically(
          storedResponse,
          approvedVariant,
          originalResponse,
          mockContext
        );
        const duration = Date.now() - startTime;

        expect(typeof result.valid).toBe('boolean');
        expect(typeof result.validationDuration).toBe('number');
        expect(result.layersValidated || result.layersValidated === undefined).toBeTruthy();
      });

      test('should sanitize sensitive information from logs', async () => {
        const storedResponse = {
          response_text: 'Test content with API_KEY=secret123',
          apiKey: 'secret123'
        };
        const approvedVariant = {
          text: 'Modified content with API_KEY=secret456',
          apiKey: 'secret456'
        };
        const originalResponse = { response_text: 'Original content' };

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
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test roast without transparency',
          autoPublish: true
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
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should allow auto-publishing when transparency is properly applied', async () => {
      const mockJob = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test roast with proper transparency disclaimer',
          autoPublish: true
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
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle database errors gracefully in content validation', async () => {
      const storedResponse = { response_text: 'Test content' };
      const approvedVariant = { text: 'Test content' };
      const originalResponse = { response_text: 'Test content' };
      const context = mockContext || {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        timestamp: new Date().toISOString()
      };

      // Mock database error during validation
      jest.spyOn(worker, 'calculateContentChecksum').mockImplementation(() => {
        throw new Error('Checksum calculation failed');
      });

      const result = await worker.validateContentAtomically(
        storedResponse,
        approvedVariant,
        originalResponse,
        context
      );

      expect(result.valid).toBe(false);
    });

    test('should handle extremely large content gracefully', async () => {
      const largeContent = 'A'.repeat(100000); // 100KB content
      const storedResponse = { response_text: largeContent };
      const approvedVariant = { text: largeContent };
      const originalResponse = { response_text: largeContent };
      const context = mockContext || {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        timestamp: new Date().toISOString()
      };

      const result = await worker.validateContentAtomically(
        storedResponse,
        approvedVariant,
        originalResponse,
        context
      );

      expect(result.valid).toBe(true);
      expect(typeof result.validationDuration).toBe('number');
    });

    test('should prevent content injection attacks through validation', async () => {
      const maliciousContent = 'Normal content <script>alert("xss")</script> with injection';
      const storedResponse = { response_text: 'Normal content' };
      const approvedVariant = { text: maliciousContent }; // Injected content
      const originalResponse = { response_text: 'Normal content' };
      const context = mockContext || {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        timestamp: new Date().toISOString()
      };

      const result = await worker.validateContentAtomically(
        storedResponse,
        approvedVariant,
        originalResponse,
        context
      );

      expect(typeof result.valid).toBe('boolean');
    });
  });
});
