// Test utilities for moderation and shield testing
const { v4: uuidv4 } = require('uuid');
const { PLATFORM_LIMITS } = require('../../src/config/constants');

/**
 * Creates a mock moderation input for testing
 */
function createMockModerationInput(overrides = {}) {
  return {
    commentId: uuidv4(),
    originalComment: 'This is a toxic comment you idiot',
    platform: 'twitter',
    authorId: 'user123',
    authorUsername: 'toxicuser',
    postId: 'post456',
    toxicityScore: 0.8,
    toxicityCategories: ['TOXICITY', 'INSULT'],
    organizationId: 'org123',
    userId: 'user789',
    ...overrides
  };
}

/**
 * Simulates a toxic comment with configurable toxicity
 */
function simulateToxicComment(options = {}) {
  const {
    toxicityLevel = 'high', // 'low', 'medium', 'high', 'extreme'
    categories = ['TOXICITY'],
    platform = 'twitter',
    language = 'es'
  } = options;

  const toxicityScores = {
    low: 0.3,
    medium: 0.6,
    high: 0.8,
    extreme: 0.95
  };

  const comments = {
    es: {
      low: 'Este servicio no es muy bueno',
      medium: 'Este servicio es una basura',
      high: 'Eres un idiota y tu servicio es horrible',
      extreme: 'Vete al infierno, imbécil de mierda'
    },
    en: {
      low: 'This service is not very good',
      medium: 'This service is trash',
      high: "You're an idiot and your service is horrible",
      extreme: 'Go to hell, you piece of shit'
    }
  };

  return {
    comment: comments[language][toxicityLevel],
    toxicityScore: toxicityScores[toxicityLevel],
    categories,
    platform,
    language
  };
}

/**
 * Creates a mock Shield response
 */
function mockShieldResponse(action = 'mute', reason = 'High toxicity detected') {
  return {
    shouldTakeAction: true,
    action,
    reason,
    severity: action === 'report' ? 'extreme' : action === 'block' ? 'high' : 'medium',
    confidence: 0.9,
    metadata: {
      analyzedAt: new Date().toISOString(),
      version: '1.0.0',
      rules: ['toxicity_threshold', 'user_history']
    }
  };
}

/**
 * Sets up a test user with Roastr Persona
 */
function setupTestUserWithPersona(overrides = {}) {
  const defaultPersona = {
    id: uuidv4(),
    userId: 'testuser123',
    organizationId: 'testorg456',
    personaConfig: {
      tone: 'sarcastic',
      humor_type: 'witty',
      intensity_level: 3,
      topics_to_avoid: ['politics', 'religion'],
      custom_style_prompt: 'Be clever but not mean',
      language_preference: 'es',
      platform_styles: {
        twitter: { use_hashtags: true, max_length: PLATFORM_LIMITS.twitter.maxLength },
        youtube: { use_emojis: true }
      }
    },
    toleranceSettings: {
      no_tolero: ['insultos', 'racismo'],
      lo_que_me_da_igual: ['opiniones', 'criticas'],
      auto_block_enabled: true,
      severity_threshold: 0.7
    },
    semanticEnrichment: {
      enabled: true,
      embedding_model: 'text-embedding-ada-002',
      last_enriched_at: new Date().toISOString()
    },
    ...overrides
  };

  return {
    user: {
      id: defaultPersona.userId,
      email: 'test@example.com',
      organizationId: defaultPersona.organizationId,
      plan: 'pro'
    },
    persona: defaultPersona
  };
}

/**
 * Creates a mock API error response
 */
function createMockAPIError(service, errorType = 'rate_limit') {
  const errors = {
    rate_limit: {
      status: 429,
      message: 'Rate limit exceeded',
      retryAfter: 60
    },
    auth_failed: {
      status: 401,
      message: 'Authentication failed'
    },
    service_error: {
      status: 503,
      message: 'Service temporarily unavailable'
    },
    invalid_input: {
      status: 400,
      message: 'Invalid input provided'
    }
  };

  const error = new Error(errors[errorType].message);
  error.status = errors[errorType].status;
  error.service = service;
  error.type = errorType;
  if (errors[errorType].retryAfter) {
    error.retryAfter = errors[errorType].retryAfter;
  }

  return error;
}

/**
 * Waits for a condition to be true with timeout
 */
async function waitForCondition(conditionFn, timeout = 5000, interval = 100) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Creates mock queue job data
 */
function createMockQueueJob(type, data = {}, options = {}) {
  const jobTypes = {
    fetch_comments: {
      platform: 'twitter',
      organizationId: 'org123',
      since: new Date(Date.now() - 3600000).toISOString()
    },
    analyze_toxicity: {
      commentId: uuidv4(),
      comment: 'Test comment',
      platform: 'twitter'
    },
    generate_roast: {
      commentId: uuidv4(),
      toxicityData: { score: 0.8, categories: ['TOXICITY'] }
    },
    shield_action: {
      commentId: uuidv4(),
      action: 'mute',
      reason: 'High toxicity'
    }
  };

  return {
    id: uuidv4(),
    type,
    data: { ...jobTypes[type], ...data },
    priority: options.priority || (type === 'shield_action' ? 1 : 5),
    attempts: 0,
    createdAt: new Date().toISOString(),
    ...options
  };
}

module.exports = {
  createMockModerationInput,
  simulateToxicComment,
  mockShieldResponse,
  setupTestUserWithPersona,
  createMockAPIError,
  waitForCondition,
  createMockQueueJob
};
