/**
 * Utilidades compartidas para tests de Roastr.ai
 */

/**
 * Shared plan limits constants to ensure consistency across all test utilities
 */
const PLAN_LIMITS = {
  free: { roasts: 10, monthlyResponsesLimit: 10, platforms: 1, integrationsLimit: 2, features: ['basic'], shieldEnabled: false },
  plus: { roasts: 250, monthlyResponsesLimit: 250, platforms: 2, integrationsLimit: 4, features: ['basic', 'advanced'], shieldEnabled: true },
  pro: { roasts: 1000, monthlyResponsesLimit: 1000, platforms: 3, integrationsLimit: 6, features: ['basic', 'advanced'], shieldEnabled: true },
  agency: { roasts: 5000, monthlyResponsesLimit: 5000, platforms: 10, integrationsLimit: 20, features: ['basic', 'advanced', 'agency'], shieldEnabled: true },
  enterprise: { roasts: 10000, monthlyResponsesLimit: 10000, platforms: 9, integrationsLimit: 18, features: ['basic', 'advanced', 'custom'], shieldEnabled: true }
};

/**
 * Mock response para OpenAI API
 */
const createMockOpenAIResponse = (text) => ({
  choices: [{
    message: {
      content: text
    }
  }]
});

/**
 * Mock para diferentes tonos de roast
 */
const getMockRoastByTone = (tone, originalMessage) => {
  const mockRoasts = {
    sarcastic: `Vaya, "${originalMessage}" - qué original, nunca habíamos escuchado eso antes 🙄`,
    subtle: `Interesante perspectiva la tuya sobre "${originalMessage}", aunque quizás merezca una reflexión más profunda 🤔`,
    direct: `"${originalMessage}" - directo al grano: no tiene sentido 💀`
  };
  
  return mockRoasts[tone] || mockRoasts.sarcastic;
};

/**
 * Mock para Twitter API responses
 */
const createMockTwitterUser = (id = '123456789', username = 'testuser') => ({
  data: {
    id,
    username,
    name: 'Test User'
  }
});

const createMockTweet = (id = '987654321', text = 'Test tweet', authorId = '123456789') => ({
  id,
  text,
  author_id: authorId,
  created_at: new Date().toISOString()
});

const createMockMentionsResponse = (tweets = []) => ({
  data: tweets,
  includes: {
    users: [createMockTwitterUser().data]
  }
});

/**
 * Datos de muestra para CSV
 */
const getMockCsvData = () => [
  {
    comment: 'Este comentario es muy aburrido',
    roast: '¿Aburrido? Tu comentario tiene menos chispa que una bombilla fundida 💡'
  },
  {
    comment: 'No me gusta esta película',
    roast: 'Tu crítica cinematográfica tiene la profundidad de un charco después de la lluvia 🎬'
  },
  {
    comment: 'Esta comida está mala',
    roast: 'Tu paladar es más exigente que un crítico michelin con problemas digestivos 🍽️'
  }
];

/**
 * Crear datos de test válidos para diferentes endpoints
 */
const getValidTestData = () => ({
  roast: {
    valid: {
      message: 'Este es un comentario de prueba',
      tone: 'sarcastic'
    },
    validWithoutTone: {
      message: 'Comentario sin tono especificado'
    },
    invalid: {
      noMessage: {},
      emptyMessage: { message: '' },
      invalidType: { message: 123 }
    }
  },
  csvRoast: {
    valid: {
      message: 'Este comentario es muy aburrido'
    },
    invalid: {
      noMessage: {},
      emptyMessage: { message: '' },
      invalidType: { message: null }
    }
  }
});

/**
 * Crear instancia mock del servidor Express para tests
 */
const createMockApp = () => {
  const express = require('express');
  const bodyParser = require('body-parser');
  
  const app = express();
  app.use(bodyParser.json());
  
  return app;
};

/**
 * Delay utility para tests asíncronos
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generar ID único para tests
 */
const generateTestId = () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Verificar estructura de respuesta de API
 */
const validateApiResponse = (response, expectedFields = []) => {
  const errors = [];
  
  expectedFields.forEach(field => {
    if (!(field in response)) {
      errors.push(`Missing field: ${field}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Mock para variables de entorno
 */
const setMockEnvVars = () => {
  process.env.OPENAI_API_KEY = 'mock-openai-key-for-testing';
  process.env.TWITTER_BEARER_TOKEN = 'mock-twitter-bearer-token';
  process.env.TWITTER_APP_KEY = 'mock-twitter-app-key';
  process.env.TWITTER_APP_SECRET = 'mock-twitter-app-secret';
  process.env.TWITTER_ACCESS_TOKEN = 'mock-twitter-access-token';
  process.env.TWITTER_ACCESS_SECRET = 'mock-twitter-access-secret';
  process.env.DEBUG = 'false'; // Disable debug logs in tests
  process.env.NODE_ENV = 'test';
};

/**
 * Multi-tenant test scenarios (Issue #277, #281)
 *
 * Options support configurable limits, entitlements, roles, and account states,
 * plus quota edge-case simulations (near/over limit).
 */
const createMultiTenantTestScenario = (scenarioType = 'simple', options = {}) => {
  const {
    planType = 'free',
    userRole = 'user',
    platforms = ['twitter'],
    orgId = generateTestId(),
    userId = generateTestId(),
    // Account state
    isActive = true,
    suspended = false,
    suspendedReason = null,
    // Entitlements / limits (overrides)
    entitlements = {},
    // Usage overrides and edge simulation
    usage: usageOverrides = {},
    quotaScenario = null // 'near' | 'over' | null
  } = options;

  // Derive effective plan from scenarioType if it indicates a specific plan
  let effectivePlan = planType;
  if (['enterprise', 'agency', 'plus', 'pro', 'freeTier'].includes(scenarioType)) {
    effectivePlan = scenarioType === 'freeTier' ? 'free' : scenarioType;
  }

  // Validate effectivePlan against PLAN_LIMITS
  if (!Object.prototype.hasOwnProperty.call(PLAN_LIMITS, effectivePlan)) {
    console.warn(`Invalid plan type '${effectivePlan}' detected, falling back to 'free' plan`);
    effectivePlan = 'free';
  }

  // Use shared plan limits for consistency
  const defaults = PLAN_LIMITS[effectivePlan];

  // Build base entitlements and usage
  const finalEntitlements = {
    plan_name: entitlements.plan_name || effectivePlan,
    monthlyResponsesLimit: defaults.monthlyResponsesLimit,
    integrationsLimit: entitlements.integrationsLimit ?? defaults.integrationsLimit ?? defaults.platforms,
    shieldEnabled: defaults.shieldEnabled,
    ...entitlements
  };

  // Compute usage per quotaScenario
  const limit = finalEntitlements.monthlyResponsesLimit;
  let roastsThisMonth = usageOverrides.roastsThisMonth ?? (effectivePlan === 'free' ? 8 : 45);
  if (quotaScenario === 'near') roastsThisMonth = Math.max(0, limit - 1);
  if (quotaScenario === 'over') roastsThisMonth = limit + 5;

  const baseScenario = {
    organizationId: orgId,
    user: {
      id: userId,
      email: `test-${userId}@example.com`,
      role: userRole,
      plan: effectivePlan,
      createdAt: new Date().toISOString(),
      isActive: isActive && !suspended
    },
    organization: {
      id: orgId,
      name: `Test Org ${orgId}`,
      plan: effectivePlan,
      createdAt: new Date().toISOString(),
      status: suspended ? 'suspended' : 'active',
      suspendedReason: suspended ? (suspendedReason || 'Suspended by scenario') : null,
      settings: {
        enabledPlatforms: platforms,
        moderationLevel: 'standard',
        autoResponse: true
      },
      entitlements: finalEntitlements
    },
    platforms: platforms.map(platform => ({
      platform,
      isConnected: true,
      credentials: `mock-${platform}-credentials`,
      settings: {
        autoModerate: true,
        responseEnabled: effectivePlan !== 'free'
      }
    })),
    usage: {
      roastsThisMonth,
      limit,
      currentSpend: usageOverrides.currentSpend ?? 0,
      tokensUsed: usageOverrides.tokensUsed ?? 0
    }
  };

  // Extend based on scenario type
  switch (scenarioType) {
    case 'enterprise':
      return {
        ...baseScenario,
        user: { ...baseScenario.user, role: 'admin', plan: 'enterprise' },
        organization: {
          ...baseScenario.organization,
          plan: 'enterprise',
          settings: {
            ...baseScenario.organization.settings,
            enabledPlatforms: ['twitter', 'youtube', 'instagram', 'facebook', 'discord', 'twitch', 'reddit', 'tiktok', 'bluesky'],
            moderationLevel: 'strict',
            customBranding: true,
            apiAccess: true,
            bulkOperations: true
          }
        },
        usage: {
          roastsThisMonth: baseScenario.usage.roastsThisMonth,
          limit: finalEntitlements.monthlyResponsesLimit,
          costControl: {
            enabled: true,
            monthlyBudget: 500,
            currentSpend: 75.50
          }
        }
      };
      
    case 'agency':
      return {
        ...baseScenario,
        user: { ...baseScenario.user, role: 'admin', plan: 'agency' },
        organization: {
          ...baseScenario.organization,
          plan: 'agency',
          settings: {
            ...baseScenario.organization.settings,
            enabledPlatforms: platforms.length > 6 ? platforms.slice(0, 6) : platforms,
            moderationLevel: 'enhanced',
            teamSeats: 25
          }
        },
        usage: {
          roastsThisMonth: baseScenario.usage.roastsThisMonth,
          limit: PLAN_LIMITS.agency.monthlyResponsesLimit,
          costControl: {
            enabled: true,
            monthlyBudget: 250,
            currentSpend: 40
          }
        }
      };

    case 'plus':
      return {
        ...baseScenario,
        user: { ...baseScenario.user, plan: 'plus' },
        organization: {
          ...baseScenario.organization,
          plan: 'plus',
          settings: {
            ...baseScenario.organization.settings,
            enabledPlatforms: platforms.length > 2 ? platforms.slice(0, 2) : platforms,
            moderationLevel: 'standard'
          }
        },
        usage: {
          roastsThisMonth: baseScenario.usage.roastsThisMonth,
          limit: PLAN_LIMITS.plus.monthlyResponsesLimit
        }
      };

    case 'pro':
      return {
        ...baseScenario,
        user: { ...baseScenario.user, plan: 'pro' },
        organization: {
          ...baseScenario.organization,
          plan: 'pro',
          settings: {
            ...baseScenario.organization.settings,
            enabledPlatforms: platforms.length > 3 ? platforms.slice(0, 3) : platforms,
            moderationLevel: 'enhanced'
          }
        },
        usage: {
          roastsThisMonth: baseScenario.usage.roastsThisMonth,
          limit: PLAN_LIMITS.pro.monthlyResponsesLimit,
          costControl: {
            enabled: true,
            monthlyBudget: 50,
            currentSpend: 12.75
          }
        }
      };
      
    case 'freeTier':
      return {
        ...baseScenario,
        organization: {
          ...baseScenario.organization,
          settings: {
            ...baseScenario.organization.settings,
            enabledPlatforms: ['twitter'], // Free tier limited to 1 platform
            moderationLevel: 'basic',
            autoResponse: false // Limited features
          }
        },
        usage: {
          roastsThisMonth: baseScenario.usage.roastsThisMonth,
          limit: PLAN_LIMITS.free.monthlyResponsesLimit,
          costControl: {
            enabled: false
          }
        }
      };
      
    case 'multiUser':
      const additionalUsers = Array.from({ length: 3 }, (_, i) => ({
        id: generateTestId(),
        email: `user${i}@${orgId}.example.com`,
        role: i === 0 ? 'admin' : 'user',
        plan: effectivePlan,
        createdAt: new Date().toISOString(),
        isActive: true
      }));
      
      return {
        ...baseScenario,
        users: [baseScenario.user, ...additionalUsers],
        organization: {
          ...baseScenario.organization,
          settings: {
            ...baseScenario.organization.settings,
            userLimit: effectivePlan === 'enterprise' ? 100 : effectivePlan === 'pro' ? 10 : 1,
            roleBasedAccess: true
          }
        }
      };
      
    case 'suspended':
      return {
        ...baseScenario,
        user: { ...baseScenario.user, isActive: false, suspendedAt: new Date().toISOString() },
        organization: {
          ...baseScenario.organization,
          status: 'suspended',
          suspendedReason: suspendedReason || 'Payment failed'
        }
      };
      
    case 'simple':
    default:
      return baseScenario;
  }
};

/**
 * Mock multi-tenant database queries
 */
const createMultiTenantMocks = (scenario) => {
  const mockDatabase = {
    // User queries
    getUserById: jest.fn().mockResolvedValue(scenario.user),
    getUsersByOrg: jest.fn().mockResolvedValue(scenario.users || [scenario.user]),
    
    // Organization queries  
    getOrganizationById: jest.fn().mockResolvedValue(scenario.organization),
    getOrgSettings: jest.fn().mockResolvedValue(scenario.organization.settings),
    
    // Platform queries
    getPlatformsByOrg: jest.fn().mockResolvedValue(scenario.platforms),
    
    // Usage queries
    getUsageStats: jest.fn().mockResolvedValue({
      roastsThisMonth: scenario.usage?.roastsThisMonth ?? 0,
      limit: scenario.usage?.limit ?? 0,
      currentSpend: scenario.usage?.currentSpend ?? 0,
      tokensUsed: scenario.usage?.tokensUsed ?? 0,
      isNearLimit: typeof scenario.usage?.limit === 'number' && typeof scenario.usage?.roastsThisMonth === 'number'
        ? (scenario.usage.roastsThisMonth >= Math.max(0, scenario.usage.limit - 1) && scenario.usage.roastsThisMonth <= scenario.usage.limit)
        : false,
      isOverLimit: typeof scenario.usage?.limit === 'number' && typeof scenario.usage?.roastsThisMonth === 'number'
        ? (scenario.usage.roastsThisMonth > scenario.usage.limit)
        : false
    }),
    
    // RLS (Row Level Security) helpers
    setCurrentUser: jest.fn().mockImplementation((userId) => {
      // Mock setting RLS context
      return Promise.resolve({ userId, orgId: scenario.organizationId });
    })
  };
  
  return mockDatabase;
};

/**
 * Platform-specific mock data generators
 */
const createPlatformMockData = (platform, options = {}) => {
  const { count = 5, toxicityLevel = 'moderate' } = options;
  
  const platformGenerators = {
    twitter: () => Array.from({ length: count }, (_, i) => ({
      id: `tweet_${generateTestId()}`,
      text: `Mock Twitter comment ${i + 1} - ${toxicityLevel} toxicity`,
      author_id: `user_${generateTestId()}`,
      created_at: new Date().toISOString(),
      platform: 'twitter',
      toxicity_score: toxicityLevel === 'high' ? 0.8 : toxicityLevel === 'low' ? 0.2 : 0.5
    })),
    
    youtube: () => Array.from({ length: count }, (_, i) => ({
      id: `comment_${generateTestId()}`,
      snippet: {
        textDisplay: `Mock YouTube comment ${i + 1} - ${toxicityLevel} toxicity`,
        authorDisplayName: `TestUser${i + 1}`,
        publishedAt: new Date().toISOString()
      },
      platform: 'youtube',
      toxicity_score: toxicityLevel === 'high' ? 0.8 : toxicityLevel === 'low' ? 0.2 : 0.5
    })),
    
    instagram: () => Array.from({ length: count }, (_, i) => ({
      id: `ig_comment_${generateTestId()}`,
      text: `Mock Instagram comment ${i + 1} - ${toxicityLevel} toxicity`,
      username: `testuser${i + 1}`,
      timestamp: new Date().toISOString(),
      platform: 'instagram',
      toxicity_score: toxicityLevel === 'high' ? 0.8 : toxicityLevel === 'low' ? 0.2 : 0.5
    }))
  };
  
  return platformGenerators[platform] ? platformGenerators[platform]() : [];
};

/**
 * Mock service responses for different plans
 */
const createPlanBasedMockResponse = (planType, service, method) => {
  // Use shared plan limits for consistency
  const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.free;
  
  return {
    success: true,
    data: {
      planType,
      limits,
      service,
      method,
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * Limpiar mocks después de los tests
 */
const cleanupMocks = () => {
  jest.clearAllMocks();
  jest.resetModules();
};

module.exports = {
  createMockOpenAIResponse,
  getMockRoastByTone,
  createMockTwitterUser,
  createMockTweet,
  createMockMentionsResponse,
  getMockCsvData,
  getValidTestData,
  createMockApp,
  delay,
  generateTestId,
  validateApiResponse,
  setMockEnvVars,
  cleanupMocks,
  // New multi-tenant utilities (Issue #277)
  createMultiTenantTestScenario,
  createMultiTenantMocks,
  createPlatformMockData,
  createPlanBasedMockResponse
};
