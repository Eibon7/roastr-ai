/**
 * Environment Configuration for API Integration Testing - Issue #90
 * 
 * Provides staging/development environment setup for real API testing
 * without requiring production credentials.
 */

const environments = {
  test: {
    name: 'Test Environment',
    description: 'Unit and integration testing with mocks',
    apiEndpoints: {
      twitter: 'https://api.twitter.com',
      youtube: 'https://www.googleapis.com/youtube/v3',
      instagram: 'https://graph.instagram.com',
      facebook: 'https://graph.facebook.com'
    },
    features: {
      realApiCalls: false,
      webhookValidation: true,
      rateLimitTesting: true,
      errorSimulation: true
    },
    credentials: {
      required: false,
      mockDefaults: true
    }
  },

  staging: {
    name: 'Staging Environment', 
    description: 'Pre-production testing with development API apps',
    apiEndpoints: {
      twitter: 'https://api.twitter.com',
      youtube: 'https://www.googleapis.com/youtube/v3',
      instagram: 'https://graph.instagram.com',
      facebook: 'https://graph.facebook.com'
    },
    features: {
      realApiCalls: true,
      webhookValidation: true,
      rateLimitTesting: true,
      errorSimulation: false
    },
    credentials: {
      required: true,
      mockDefaults: false,
      validation: {
        twitter: {
          required: ['TWITTER_BEARER_TOKEN', 'TWITTER_APP_KEY', 'TWITTER_APP_SECRET'],
          optional: ['TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET']
        },
        youtube: {
          required: ['YOUTUBE_API_KEY'],
          optional: []
        },
        instagram: {
          required: ['INSTAGRAM_ACCESS_TOKEN'],
          optional: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET']
        },
        facebook: {
          required: ['FACEBOOK_ACCESS_TOKEN'],
          optional: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']
        }
      }
    },
    limits: {
      requestsPerMinute: 60,
      dailyRequests: 10000,
      webhookRetries: 3
    }
  },

  development: {
    name: 'Development Environment',
    description: 'Local development with optional real API integration',
    apiEndpoints: {
      twitter: 'https://api.twitter.com',
      youtube: 'https://www.googleapis.com/youtube/v3', 
      instagram: 'https://graph.instagram.com',
      facebook: 'https://graph.facebook.com'
    },
    get features() {
      return {
        realApiCalls: process.env.REAL_API_TEST === 'true',
        webhookValidation: true,
        rateLimitTesting: false,
        errorSimulation: true
      };
    },
    get credentials() {
      return {
        required: process.env.REAL_API_TEST === 'true',
        mockDefaults: process.env.REAL_API_TEST !== 'true'
      };
    },
    limits: {
      requestsPerMinute: 30,
      dailyRequests: 1000,
      webhookRetries: 2
    }
  },

  production: {
    name: 'Production Environment',
    description: 'Live production environment with full API integration',
    apiEndpoints: {
      twitter: 'https://api.twitter.com',
      youtube: 'https://www.googleapis.com/youtube/v3',
      instagram: 'https://graph.instagram.com', 
      facebook: 'https://graph.facebook.com'
    },
    features: {
      realApiCalls: true,
      webhookValidation: true,
      rateLimitTesting: false,
      errorSimulation: false
    },
    credentials: {
      required: true,
      mockDefaults: false,
      validation: {
        twitter: {
          required: ['TWITTER_BEARER_TOKEN', 'TWITTER_APP_KEY', 'TWITTER_APP_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET'],
          optional: []
        },
        youtube: {
          required: ['YOUTUBE_API_KEY'],
          optional: []
        },
        instagram: {
          required: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
          optional: []
        },
        facebook: {
          required: ['FACEBOOK_ACCESS_TOKEN', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
          optional: []
        }
      }
    },
    limits: {
      requestsPerMinute: 300,
      dailyRequests: 100000,
      webhookRetries: 5
    }
  }
};

/**
 * Get current environment configuration
 */
function getCurrentEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  return environments[env] || environments.development;
}

/**
 * Validate environment credentials
 */
function validateCredentials(environment = getCurrentEnvironment()) {
  const validation = {
    valid: true,
    missing: [],
    warnings: []
  };

  if (!environment.credentials.required) {
    validation.warnings.push('Environment does not require real credentials - using mocks');
    return validation;
  }

  const credentialValidation = environment.credentials.validation;
  if (!credentialValidation) {
    validation.warnings.push('No credential validation rules defined for this environment');
    return validation;
  }

  Object.keys(credentialValidation).forEach(platform => {
    const platformRules = credentialValidation[platform];
    
    // Check required credentials
    platformRules.required.forEach(key => {
      if (!process.env[key]) {
        validation.missing.push(`${platform.toUpperCase()}: ${key}`);
        validation.valid = false;
      }
    });

    // Check optional credentials
    platformRules.optional.forEach(key => {
      if (!process.env[key]) {
        validation.warnings.push(`${platform.toUpperCase()}: ${key} (optional)`);
      }
    });
  });

  return validation;
}

/**
 * Setup environment for testing
 */
function setupTestEnvironment(platform, options = {}) {
  const env = getCurrentEnvironment();
  const config = {
    platform,
    environment: env.name,
    baseUrl: env.apiEndpoints[platform],
    features: env.features,
    limits: env.limits || {},
    ...options
  };

  // Add mock credentials if needed
  if (env.credentials.mockDefaults) {
    config.credentials = getMockCredentials(platform);
  }

  return config;
}

/**
 * Get mock credentials for testing
 */
function getMockCredentials(platform) {
  const mockCredentials = {
    twitter: {
      bearerToken: 'mock_twitter_bearer_token_12345',
      appKey: 'mock_twitter_app_key',
      appSecret: 'mock_twitter_app_secret',
      accessToken: 'mock_twitter_access_token',
      accessSecret: 'mock_twitter_access_secret'
    },
    youtube: {
      apiKey: 'mock_youtube_api_key_67890'
    },
    instagram: {
      accessToken: 'mock_instagram_access_token_abcde',
      clientId: 'mock_instagram_client_id',
      clientSecret: 'mock_instagram_client_secret'
    },
    facebook: {
      accessToken: 'mock_facebook_access_token_fghij',
      appId: 'mock_facebook_app_id',
      appSecret: 'mock_facebook_app_secret'
    }
  };

  return mockCredentials[platform] || {};
}

/**
 * Check if real API calls are enabled
 */
function isRealApiEnabled(platform = null) {
  const env = getCurrentEnvironment();
  const realApiEnabled = env.features.realApiCalls;

  if (!realApiEnabled) return false;

  // If platform specified, also check credentials
  if (platform) {
    const validation = validateCredentials(env);
    if (!validation.valid) {
      console.warn(`Real API disabled for ${platform}: missing credentials`);
      return false;
    }
  }

  return true;
}

/**
 * Get webhook configuration for environment
 */
function getWebhookConfig() {
  const env = getCurrentEnvironment();
  
  return {
    enabled: env.features.webhookValidation,
    baseUrl: process.env.WEBHOOK_BASE_URL || 'https://your-staging-domain.com',
    endpoints: {
      twitter: '/api/webhooks/twitter',
      youtube: '/api/webhooks/youtube',
      instagram: '/api/webhooks/instagram',
      facebook: '/api/webhooks/facebook'
    },
    security: {
      signatureValidation: true,
      timeWindowSeconds: 300,
      maxRetries: env.limits?.webhookRetries || 3
    }
  };
}

module.exports = {
  environments,
  getCurrentEnvironment,
  validateCredentials,
  setupTestEnvironment,
  getMockCredentials,
  isRealApiEnabled,
  getWebhookConfig
};