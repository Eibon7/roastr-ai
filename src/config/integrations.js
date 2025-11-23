require('dotenv').config();
const { PLATFORM_LIMITS } = require('./constants');

module.exports = {
  // Control global de integraciones
  enabled: process.env.INTEGRATIONS_ENABLED?.split(',') || ['twitter'],
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT_INTEGRATIONS) || 3,
  debugMode: process.env.INTEGRATION_DEBUG_MODE === 'true',

  // Configuración global de Roastr modes
  roastrMode: process.env.ROASTR_MODE || 'normal', // 'normal' or 'shield'

  // Shield mode configuration
  shield: {
    enabled: process.env.ROASTR_SHIELD_ENABLED === 'true',
    autoActions: process.env.SHIELD_AUTO_ACTIONS === 'true',
    reincidenceThreshold: parseInt(process.env.SHIELD_REINCIDENCE_THRESHOLD) || 3,
    severityLevels: {
      low: { action: 'warn', threshold: 1 },
      medium: { action: 'mute', threshold: 2 },
      high: { action: 'block', threshold: 3 },
      critical: { action: 'report', threshold: 1 }
    }
  },

  // Configuración de Twitter (existente)
  twitter: {
    enabled: process.env.TWITTER_ENABLED === 'true',
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
    maxTweetsPerHour: parseInt(process.env.MAX_TWEETS_PER_HOUR) || 10,
    minDelayBetweenTweets: parseInt(process.env.MIN_DELAY_BETWEEN_TWEETS) || 5000,

    // Configuración personalizada por integración
    tone: process.env.TWITTER_TONE || 'sarcastic', // sarcastic, ironic, absurd
    // Issue #868: Removed humorType (deprecated - tone is now sole selector)
    responseFrequency: parseFloat(process.env.TWITTER_RESPONSE_FREQUENCY) || 1.0, // 0.33 = 1 de cada 3
    triggerWords: process.env.TWITTER_TRIGGER_WORDS?.split(',') || ['roast', 'burn', 'insult'],

    // Shield mode específico
    shieldActions: {
      enabled: process.env.TWITTER_SHIELD_ENABLED === 'true',
      muteEnabled: process.env.TWITTER_SHIELD_MUTE === 'true',
      blockEnabled: process.env.TWITTER_SHIELD_BLOCK === 'true',
      reportEnabled: process.env.TWITTER_SHIELD_REPORT === 'true'
    }
  },

  // Configuración de YouTube
  youtube: {
    enabled: process.env.YOUTUBE_ENABLED === 'true',
    apiKey: process.env.YOUTUBE_API_KEY,
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
    channelId: process.env.YOUTUBE_CHANNEL_ID,
    monitoredVideos: process.env.YOUTUBE_MONITORED_VIDEOS?.split(',') || [],
    pollingInterval: parseInt(process.env.YOUTUBE_POLLING_INTERVAL) || 300000, // 5 minutes
    triggerWords: process.env.YOUTUBE_TRIGGER_WORDS?.split(',') || [
      'roast',
      'burn',
      'insult',
      'comeback'
    ],
    maxResponsesPerHour: parseInt(process.env.YOUTUBE_MAX_RESPONSES_PER_HOUR) || 5,

    // Configuración personalizada por integración
    tone: process.env.YOUTUBE_TONE || 'ironic', // sarcastic, ironic, absurd
    // Issue #868: Removed humorType (deprecated - tone is now sole selector)
    responseFrequency: parseFloat(process.env.YOUTUBE_RESPONSE_FREQUENCY) || 0.5, // 50% chance

    // Shield mode específico
    shieldActions: {
      enabled: process.env.YOUTUBE_SHIELD_ENABLED === 'true',
      removeComments: process.env.YOUTUBE_SHIELD_REMOVE === 'true',
      reportUsers: process.env.YOUTUBE_SHIELD_REPORT === 'true',
      blockUsers: process.env.YOUTUBE_SHIELD_BLOCK === 'true'
    }
  },

  // Configuración de Bluesky
  bluesky: {
    enabled: process.env.BLUESKY_ENABLED === 'true',
    handle: process.env.BLUESKY_HANDLE,
    password: process.env.BLUESKY_PASSWORD,
    serviceUrl: process.env.BLUESKY_SERVICE_URL || 'https://bsky.social',
    firehoseUrl:
      process.env.BLUESKY_FIREHOSE_URL || 'wss://bsky.social/xrpc/com.atproto.sync.subscribeRepos',
    maxResponsesPerHour: parseInt(process.env.BLUESKY_MAX_RESPONSES_PER_HOUR) || 20,
    reconnectDelay: parseInt(process.env.BLUESKY_RECONNECT_DELAY) || 5000
  },

  // Configuración de Instagram
  instagram: {
    enabled: process.env.INSTAGRAM_ENABLED === 'true',
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    userId: process.env.INSTAGRAM_USER_ID,
    username: process.env.INSTAGRAM_USERNAME,
    webhookVerifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
    pollingInterval: parseInt(process.env.INSTAGRAM_POLLING_INTERVAL) || 600000, // 10 minutes
    triggerWords: process.env.INSTAGRAM_TRIGGER_WORDS?.split(',') || [
      'roast',
      'burn',
      'savage',
      'comeback'
    ],
    maxResponsesPerHour: parseInt(process.env.INSTAGRAM_MAX_RESPONSES_PER_HOUR) || 3, // Very conservative
    requireManualApproval: process.env.INSTAGRAM_REQUIRE_MANUAL_APPROVAL !== 'false'
  },

  // Configuración global de filtros
  globalFilters: {
    minCommentLength: parseInt(process.env.GLOBAL_MIN_COMMENT_LENGTH) || 5,
    maxCommentLength:
      parseInt(process.env.GLOBAL_MAX_COMMENT_LENGTH) || PLATFORM_LIMITS.twitter.maxLength,
    bannedWords: process.env.GLOBAL_BANNED_WORDS?.split(',') || ['spam', 'bot', 'fake'],
    toxicityThreshold: parseFloat(process.env.GLOBAL_TOXICITY_THRESHOLD) || 0.7
  },

  // Configuración global de rate limiting
  globalRateLimits: {
    maxResponsesPerHour: parseInt(process.env.GLOBAL_MAX_RESPONSES_PER_HOUR) || 50,
    minDelayBetweenResponses: parseInt(process.env.GLOBAL_MIN_DELAY_BETWEEN_RESPONSES) || 30000, // 30 seconds
    maxConcurrentProcessing: parseInt(process.env.GLOBAL_MAX_CONCURRENT_PROCESSING) || 5
  },

  // Configuración de roast generation
  roastGeneration: {
    defaultTone: process.env.DEFAULT_ROAST_TONE || 'sarcastic',
    availableTones: ['sarcastic', 'subtle', 'direct'],
    maxRetries: parseInt(process.env.ROAST_GENERATION_MAX_RETRIES) || 2,
    timeout: parseInt(process.env.ROAST_GENERATION_TIMEOUT) || 15000 // 15 seconds
  },

  // Configuración de Perspective API
  perspectiveAPI: {
    enabled: process.env.PERSPECTIVE_API_ENABLED === 'true',
    apiKey: process.env.PERSPECTIVE_API_KEY,
    attributes: process.env.PERSPECTIVE_ATTRIBUTES?.split(',') || [
      'TOXICITY',
      'SEVERE_TOXICITY',
      'INSULT'
    ],
    threshold: parseFloat(process.env.PERSPECTIVE_THRESHOLD) || 0.7
  },

  // Configuración de logging y métricas
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 300000 // 5 minutes
  },

  // Configuración de alertas
  alerts: {
    enabled: process.env.ALERTS_ENABLED === 'true',
    webhookUrl: process.env.ALERTS_WEBHOOK_URL,
    rateLimitThreshold: parseFloat(process.env.ALERT_RATE_LIMIT_THRESHOLD) || 0.8, // 80% of rate limit
    errorThreshold: parseInt(process.env.ALERT_ERROR_THRESHOLD) || 5 // 5 consecutive errors
  },

  // Configuración de bases de datos/persistencia
  storage: {
    type: process.env.STORAGE_TYPE || 'file', // 'file', 'redis', 'database'
    connectionString: process.env.STORAGE_CONNECTION_STRING,
    cacheExpiry: parseInt(process.env.STORAGE_CACHE_EXPIRY) || 300000 // 5 minutes
  },

  // Configuración de desarrollo y testing
  development: {
    mockAPIs: process.env.MOCK_APIS === 'true',
    testMode: process.env.TEST_MODE === 'true',
    dryRun: process.env.DRY_RUN === 'true' // Generate responses but don't post them
  }
};
