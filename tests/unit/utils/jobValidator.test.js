/**
 * Job Validator Tests
 *
 * Tests for the centralized job validation system to ensure
 * robust validation across all worker types.
 */

const { JobValidator, ValidationError } = require('../../../src/utils/jobValidator');

describe('JobValidator', () => {
  describe('validateGenerateReplyJob', () => {
    test('should validate valid job', () => {
      const validJob = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'This is a test comment',
          toxicity_score: 0.7
        }
      };

      expect(() => JobValidator.validateGenerateReplyJob(validJob)).not.toThrow();
    });

    test('should reject job without payload', () => {
      const invalidJob = {
        comment_id: 'comment-123'
      };

      expect(() => JobValidator.validateGenerateReplyJob(invalidJob)).toThrow(ValidationError);
    });

    test('should reject job with missing required fields', () => {
      const invalidJob = {
        payload: {
          comment_id: 'comment-123'
          // Missing organization_id, platform, original_text
        }
      };

      expect(() => JobValidator.validateGenerateReplyJob(invalidJob)).toThrow(
        'Missing required fields: organization_id, platform, original_text'
      );
    });

    test('should reject job with invalid platform', () => {
      const invalidJob = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'invalid_platform',
          original_text: 'Test comment'
        }
      };

      expect(() => JobValidator.validateGenerateReplyJob(invalidJob)).toThrow('Invalid platform');
    });

    test('should reject job with invalid toxicity score', () => {
      const invalidJob = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment',
          toxicity_score: 1.5 // Invalid: > 1
        }
      };

      expect(() => JobValidator.validateGenerateReplyJob(invalidJob)).toThrow(
        'toxicity_score must be a number between 0 and 1'
      );
    });

    test('should reject job with empty text', () => {
      const invalidJob = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: ''
        }
      };

      expect(() => JobValidator.validateGenerateReplyJob(invalidJob)).toThrow(
        'original_text cannot be empty'
      );
    });

    test('should reject job with text too long', () => {
      const invalidJob = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'a'.repeat(10001) // Too long
        }
      };

      expect(() => JobValidator.validateGenerateReplyJob(invalidJob)).toThrow(
        'original_text cannot exceed 10,000 characters'
      );
    });
  });

  describe('validateShieldActionJob', () => {
    test('should validate valid shield job', () => {
      const validJob = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        action: 'reply_warning',
        shield_mode: true
      };

      expect(() => JobValidator.validateShieldActionJob(validJob)).not.toThrow();
    });

    test('should reject job without shield_mode', () => {
      const invalidJob = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        action: 'reply_warning'
        // Missing shield_mode: true
      };

      expect(() => JobValidator.validateShieldActionJob(invalidJob)).toThrow(
        'Shield action job must be in Shield mode'
      );
    });

    test('should reject job with invalid action', () => {
      const invalidJob = {
        comment_id: 'comment-123',
        organization_id: 'org-123',
        platform: 'twitter',
        platform_user_id: 'user-456',
        action: 'invalid_action',
        shield_mode: true
      };

      expect(() => JobValidator.validateShieldActionJob(invalidJob)).toThrow('Invalid action');
    });
  });

  describe('sanitizeJob', () => {
    test('should remove script tags', () => {
      const maliciousJob = {
        payload: {
          comment_id: '<script>alert("xss")</script>comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test <script>alert("hack")</script> comment'
        }
      };

      const sanitized = JobValidator.sanitizeJob(maliciousJob);

      expect(sanitized.payload.comment_id).toBe('comment-123');
      expect(sanitized.payload.original_text).toBe('Test  comment');
    });

    test('should remove SQL injection patterns', () => {
      const maliciousJob = {
        payload: {
          comment_id: "comment'; DROP TABLE users; --",
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      const sanitized = JobValidator.sanitizeJob(maliciousJob);

      expect(sanitized.payload.comment_id).toBe('comment DROP TABLE users');
    });

    test('should handle nested objects', () => {
      const job = {
        payload: {
          comment_id: 'comment-123',
          metadata: {
            user: '<script>alert("xss")</script>user-456',
            tags: ['tag1', 'tag2<script>']
          }
        }
      };

      const sanitized = JobValidator.sanitizeJob(job);

      expect(sanitized.payload.metadata.user).toBe('user-456');
      expect(sanitized.payload.metadata.tags[1]).toBe('tag2');
    });
  });

  describe('validateJob', () => {
    test('should validate based on worker type', () => {
      const replyJob = {
        payload: {
          comment_id: 'comment-123',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      expect(() => JobValidator.validateJob('generate_roast', replyJob)).not.toThrow();
    });

    test('should reject unknown worker type', () => {
      const job = { payload: {} };

      expect(() => JobValidator.validateJob('unknown_worker', job)).toThrow(
        'Unknown worker type: unknown_worker'
      );
    });
  });

  describe('createErrorResponse', () => {
    test('should create standardized error response', () => {
      const error = new ValidationError('Test error', 'test_field');
      const response = JobValidator.createErrorResponse(error, 'job-123');

      expect(response).toEqual({
        success: false,
        error: 'Test error',
        field: 'test_field',
        jobId: 'job-123',
        timestamp: expect.any(String),
        type: 'ValidationError'
      });
    });

    test('should handle errors without field', () => {
      const error = new Error('Generic error');
      const response = JobValidator.createErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Generic error',
        field: null,
        jobId: null,
        timestamp: expect.any(String),
        type: 'Error'
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle null job', () => {
      expect(() => JobValidator.validateGenerateReplyJob(null)).toThrow('Job is required');
    });

    test('should handle undefined job', () => {
      expect(() => JobValidator.validateGenerateReplyJob(undefined)).toThrow('Job is required');
    });

    test('should handle job with null payload', () => {
      expect(() => JobValidator.validateGenerateReplyJob({ payload: null })).toThrow(
        'Job payload is required'
      );
    });

    test('should handle very long field values', () => {
      const job = {
        payload: {
          comment_id: 'a'.repeat(1000),
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment'
        }
      };

      // Should not throw for long IDs (within reason)
      expect(() => JobValidator.validateGenerateReplyJob(job)).not.toThrow();
    });

    test('should handle unicode characters', () => {
      const job = {
        payload: {
          comment_id: 'comment-测试-🔥',
          organization_id: 'org-123',
          platform: 'twitter',
          original_text: 'Test comment with émojis 🚀 and unicode 测试'
        }
      };

      expect(() => JobValidator.validateGenerateReplyJob(job)).not.toThrow();
    });

    test('should handle all valid platforms', () => {
      const platforms = [
        'twitter',
        'instagram',
        'facebook',
        'youtube',
        'discord',
        'twitch',
        'reddit',
        'tiktok',
        'bluesky'
      ];

      platforms.forEach((platform) => {
        const job = {
          payload: {
            comment_id: 'comment-123',
            organization_id: 'org-123',
            platform,
            original_text: 'Test comment'
          }
        };

        expect(() => JobValidator.validateGenerateReplyJob(job)).not.toThrow();
      });
    });
  });
});
