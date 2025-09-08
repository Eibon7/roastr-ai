/**
 * Job Validator - Centralized validation for worker jobs
 * 
 * Provides consistent validation across all worker types to prevent
 * malformed jobs from causing system failures.
 */

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

class JobValidator {
  /**
   * Validate GenerateReplyWorker job structure
   */
  static validateGenerateReplyJob(job) {
    if (!job) {
      throw new ValidationError('Job is required');
    }

    if (!job.payload) {
      throw new ValidationError('Job payload is required');
    }

    const { payload } = job;
    const required = [
      'comment_id',
      'organization_id', 
      'platform',
      'original_text'
    ];

    const missing = required.filter(field => !payload[field]);
    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate field types
    if (typeof payload.comment_id !== 'string') {
      throw new ValidationError('comment_id must be a string', 'comment_id');
    }

    if (typeof payload.organization_id !== 'string') {
      throw new ValidationError('organization_id must be a string', 'organization_id');
    }

    if (typeof payload.platform !== 'string') {
      throw new ValidationError('platform must be a string', 'platform');
    }

    if (typeof payload.original_text !== 'string') {
      throw new ValidationError('original_text must be a string', 'original_text');
    }

    // Validate optional fields
    if (payload.toxicity_score !== undefined && 
        (typeof payload.toxicity_score !== 'number' || 
         payload.toxicity_score < 0 || 
         payload.toxicity_score > 1)) {
      throw new ValidationError('toxicity_score must be a number between 0 and 1', 'toxicity_score');
    }

    // Validate platform
    const validPlatforms = ['twitter', 'instagram', 'facebook', 'youtube', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'];
    if (!validPlatforms.includes(payload.platform)) {
      throw new ValidationError(`Invalid platform. Must be one of: ${validPlatforms.join(', ')}`, 'platform');
    }

    // Validate text length
    if (payload.original_text.length === 0) {
      throw new ValidationError('original_text cannot be empty', 'original_text');
    }

    if (payload.original_text.length > 10000) {
      throw new ValidationError('original_text cannot exceed 10,000 characters', 'original_text');
    }

    return true;
  }

  /**
   * Validate AnalyzeToxicityWorker job structure
   */
  static validateAnalyzeToxicityJob(job) {
    if (!job || !job.payload) {
      throw new ValidationError('Job and payload are required');
    }

    const { payload } = job;
    const required = ['comment_id', 'organization_id', 'platform', 'text'];

    const missing = required.filter(field => !payload[field]);
    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate text content
    if (typeof payload.text !== 'string' || payload.text.trim().length === 0) {
      throw new ValidationError('text must be a non-empty string', 'text');
    }

    return true;
  }

  /**
   * Validate FetchCommentsWorker job structure
   */
  static validateFetchCommentsJob(job) {
    if (!job || !job.payload) {
      throw new ValidationError('Job and payload are required');
    }

    const { payload } = job;
    const required = ['organization_id', 'platform', 'integration_config_id'];

    const missing = required.filter(field => !payload[field]);
    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Validate ShieldActionWorker job structure
   */
  static validateShieldActionJob(job) {
    if (!job) {
      throw new ValidationError('Job is required');
    }

    const required = [
      'comment_id',
      'organization_id',
      'platform',
      'platform_user_id',
      'action',
      'shield_mode'
    ];

    const missing = required.filter(field => job[field] === undefined);
    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate shield_mode
    if (job.shield_mode !== true) {
      throw new ValidationError('Shield action job must be in Shield mode', 'shield_mode');
    }

    // Validate action type
    const validActions = [
      'reply_warning',
      'mute_user', 
      'block_user',
      'remove_content',
      'ban_user',
      'remove_comment'
    ];

    if (!validActions.includes(job.action)) {
      throw new ValidationError(`Invalid action. Must be one of: ${validActions.join(', ')}`, 'action');
    }

    return true;
  }

  /**
   * Normalize job shape to ensure consistent structure
   */
  static normalizeJob(job) {
    if (!job) return job;
    
    // If job already has a payload, return as-is
    if (job.payload) {
      return job;
    }
    
    // If job looks like it IS the payload, wrap it
    const possiblePayloadKeys = [
      'comment_id', 'organization_id', 'platform', 'original_text',
      'text', 'integration_config_id', 'toxicity_score', 'severity_level'
    ];
    
    const hasPayloadKeys = possiblePayloadKeys.some(key => job[key] !== undefined);
    
    if (hasPayloadKeys) {
      return {
        payload: job,
        id: job.id || null,
        type: job.type || null
      };
    }
    
    return job;
  }

  /**
   * Sanitize job data to prevent injection attacks
   */
  static sanitizeJob(job) {
    if (!job) return job;

    const sanitized = JSON.parse(JSON.stringify(job));

    // Recursively sanitize string fields
    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Remove potential script tags and SQL injection patterns
          obj[key] = obj[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/['";]|--|\*\/|\*\*|\/\*/g, '')
            .trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Validate job based on worker type
   */
  static validateJob(workerType, job) {
    // Normalize job shape first, then sanitize
    const normalizedJob = this.normalizeJob(job);
    const sanitizedJob = this.sanitizeJob(normalizedJob);

    switch (workerType) {
      case 'generate_reply':
        return this.validateGenerateReplyJob(sanitizedJob);
      case 'analyze_toxicity':
        return this.validateAnalyzeToxicityJob(sanitizedJob);
      case 'fetch_comments':
        return this.validateFetchCommentsJob(sanitizedJob);
      case 'shield_action':
        return this.validateShieldActionJob(sanitizedJob);
      default:
        throw new ValidationError(`Unknown worker type: ${workerType}`);
    }
  }

  /**
   * Create a standardized error response
   */
  static createErrorResponse(error, jobId = null) {
    return {
      success: false,
      error: error.message,
      field: error.field || null,
      jobId,
      timestamp: new Date().toISOString(),
      type: error.name || 'ValidationError'
    };
  }
}

module.exports = {
  JobValidator,
  ValidationError
};
