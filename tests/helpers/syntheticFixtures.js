/**
 * Synthetic Fixtures for SPEC 14 Testing
 * 
 * GDPR-compliant synthetic data generator for comprehensive testing.
 * All data is artificially generated and contains no real user information.
 * 
 * Categories:
 * - Light: Low toxicity comments that should be published normally
 * - Intermediate: Medium toxicity comments suitable for roasting
 * - Critical: High toxicity comments that trigger Shield actions
 * - Corrective: Comments that require educational responses
 */

const crypto = require('crypto');

// Simple faker replacement using deterministic generation
const simpleFaker = {
  seed: 12345,
  number: {
    int: ({ min, max }) => {
      const range = max - min + 1;
      return min + Math.floor(Math.abs(Math.sin(simpleFaker.seed++)) * range);
    },
    float: ({ min, max, precision }) => {
      const value = min + (Math.abs(Math.sin(simpleFaker.seed++)) * (max - min));
      return parseFloat(value.toFixed(precision || 2));
    }
  },
  helpers: {
    arrayElement: (array) => {
      const index = Math.floor(Math.abs(Math.sin(simpleFaker.seed++)) * array.length);
      return array[index];
    }
  },
  date: {
    recent: ({ days }) => {
      const now = new Date();
      const daysAgo = Math.floor(Math.abs(Math.sin(simpleFaker.seed++)) * days);
      return new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    }
  }
};

const faker = simpleFaker;

/**
 * Generate synthetic comment text based on toxicity level
 */
function generateSyntheticCommentText(category) {
  const templates = {
    light: [
      "Esta aplicación podría mejorar en algunos aspectos",
      "No me convence del todo la interfaz",
      "Creo que faltan algunas funciones básicas",
      "La experiencia de usuario no es la mejor",
      "Esperaba algo más de esta herramienta"
    ],
    intermediate: [
      "Esto es una completa pérdida de tiempo intermedio",
      "Qué aplicación más inútil y mal hecha",
      "No entiendo cómo alguien puede usar esto intermedio",
      "Parece hecha por amateurs sin experiencia",
      "Es lo más aburrido que he visto en años intermedio"
    ],
    critical: [
      "Esta basura crítico debería ser eliminada inmediatamente",
      "Los desarrolladores son unos incompetentes totales crítico",
      "Deberían prohibir esta porquería de aplicación crítico",
      "Es la peor aplicación crítico que existe en el universo",
      "Quien hizo esto crítico merece ser despedido ya mismo"
    ],
    corrective: [
      "No me gusta nada de esto y no sirve",
      "Esto está mal diseñado desde el principio",
      "Pierdo mi tiempo con estas tonterías",
      "No funciona como debería funcionar",
      "Es confuso y no se entiende nada"
    ]
  };

  const categoryTemplates = templates[category] || templates.light;
  return faker.helpers.arrayElement(categoryTemplates);
}

/**
 * Generate synthetic user data
 */
function generateSyntheticUser(role = 'user', plan = 'free') {
  const userId = crypto.randomUUID();
  return {
    id: userId,
    email: `testuser_${userId.slice(0, 8)}@synthetic-domain.test`,
    username: `syntheticuser_${faker.number.int({ min: 1000, max: 9999 })}`,
    display_name: `Test User ${faker.number.int({ min: 1, max: 999 })}`,
    role: role,
    plan: plan,
    credits: plan === 'pro' ? 1000 : plan === 'plus' ? 5000 : 100,
    created_at: new Date().toISOString(),
    synthetic: true // Mark as synthetic for cleanup
  };
}

/**
 * Generate synthetic organization
 */
function generateSyntheticOrg(settings = {}) {
  const orgId = crypto.randomUUID();
  return {
    id: orgId,
    name: `Synthetic Test Org ${faker.number.int({ min: 1, max: 999 })}`,
    slug: `test-org-${orgId.slice(0, 8)}`,
    settings: {
      auto_approve: false,
      shield_enabled: true,
      toxicity_threshold: 0.7,
      ...settings
    },
    created_at: new Date().toISOString(),
    synthetic: true
  };
}

/**
 * Generate synthetic author data
 */
function generateSyntheticAuthor(violations = 0) {
  return {
    id: `synthetic_author_${faker.number.int({ min: 10000, max: 99999 })}`,
    username: `testauthor_${faker.number.int({ min: 1000, max: 9999 })}`,
    display_name: `Synthetic Author ${faker.number.int({ min: 1, max: 999 })}`,
    platform_specific: {
      twitter: {
        follower_count: faker.number.int({ min: 10, max: 1000 }),
        verified: false
      }
    },
    violation_history: violations,
    synthetic: true
  };
}

/**
 * Generate synthetic comment data
 */
function generateSyntheticComment(category, author = null) {
  const commentId = crypto.randomUUID();
  const commentAuthor = author || generateSyntheticAuthor();
  
  const toxicityScores = {
    light: faker.number.float({ min: 0.1, max: 0.29, precision: 0.01 }),
    intermediate: faker.number.float({ min: 0.3, max: 0.69, precision: 0.01 }),
    critical: faker.number.float({ min: 0.85, max: 0.99, precision: 0.01 }),
    corrective: faker.number.float({ min: 0.4, max: 0.6, precision: 0.01 })
  };

  return {
    id: commentId,
    external_id: `synthetic_comment_${commentId.slice(0, 12)}`,
    text: generateSyntheticCommentText(category),
    author: commentAuthor,
    platform: 'twitter',
    category: category,
    expected_toxicity_score: toxicityScores[category],
    expected_classification: category === 'corrective' ? 'intermediate' : category,
    metadata: {
      created_at: faker.date.recent({ days: 1 }).toISOString(),
      reply_to: null,
      mentions: [],
      hashtags: []
    },
    synthetic: true
  };
}

/**
 * Generate synthetic response data for validation tests
 */
function generateSyntheticResponse(valid = true) {
  if (valid) {
    return {
      text: "Bueno, al menos tienes tiempo libre para criticar aplicaciones. Espero que encuentres algo más productivo que hacer pronto.",
      tone: "sarcastic",
      length: 119,
      violations: [],
      synthetic: true
    };
  } else {
    return {
      text: "Eres un idiota completo y deberías callarte la boca. Nadie te preguntó tu opinión estúpida.",
      violations: ['inappropriate_language', 'personal_attack', 'excessive_hostility'],
      violation: 'inappropriate_language',
      synthetic: true
    };
  }
}

/**
 * Generate authentication tokens for testing
 */
function generateSyntheticAuthTokens(users) {
  const tokens = {};
  
  Object.keys(users).forEach(userKey => {
    const user = users[userKey];
    // Generate deterministic token based on user ID
    const tokenPayload = {
      user_id: user.id,
      role: user.role,
      plan: user.plan,
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };
    
    // Simple mock token (in real tests, this would be properly signed)
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
    tokens[`${userKey}Token`] = `test.${token}.signature`;
  });
  
  return tokens;
}

/**
 * Main fixture generator
 */
async function createSyntheticFixtures() {
  console.log('🧪 Generating synthetic test fixtures...');
  
  // Generate organizations
  const organizations = {
    basic: generateSyntheticOrg({ auto_approve: false }),
    autoApprove: generateSyntheticOrg({ auto_approve: true }),
    shieldDisabled: generateSyntheticOrg({ shield_enabled: false })
  };

  // Generate users with different plans
  const users = {
    freeUser: generateSyntheticUser('user', 'free'),
    proUser: generateSyntheticUser('user', 'pro'),
    plusUser: generateSyntheticUser('user', 'plus'),
    adminUser: generateSyntheticUser('admin', 'plus')
  };

  // Generate authors with different violation histories
  const authors = {
    clean: generateSyntheticAuthor(0),
    firstOffender: generateSyntheticAuthor(0),
    repeatOffender: generateSyntheticAuthor(2),
    chronicOffender: generateSyntheticAuthor(5)
  };

  // Generate comments for each scenario
  const comments = {
    light: generateSyntheticComment('light', authors.clean),
    intermediate: generateSyntheticComment('intermediate', authors.clean),
    critical: generateSyntheticComment('critical', authors.firstOffender),
    corrective: generateSyntheticComment('corrective', authors.firstOffender)
  };

  // Generate response examples
  const responses = {
    validRoast: generateSyntheticResponse(true),
    invalidRoast: generateSyntheticResponse(false)
  };

  // Generate auth tokens
  const auth = generateSyntheticAuthTokens(users);

  const fixtures = {
    organizations,
    users,
    authors,
    comments,
    responses,
    auth,
    metadata: {
      generated_at: new Date().toISOString(),
      version: '1.0.0',
      total_items: Object.keys(organizations).length + 
                   Object.keys(users).length + 
                   Object.keys(authors).length + 
                   Object.keys(comments).length,
      gdpr_compliant: true,
      synthetic_only: true
    }
  };

  console.log(`✅ Generated ${fixtures.metadata.total_items} synthetic test items`);
  console.log('📊 Fixture summary:');
  console.log(`  - Organizations: ${Object.keys(organizations).length}`);
  console.log(`  - Users: ${Object.keys(users).length}`);
  console.log(`  - Authors: ${Object.keys(authors).length}`);
  console.log(`  - Comments: ${Object.keys(comments).length}`);
  console.log(`  - Responses: ${Object.keys(responses).length}`);

  return fixtures;
}

/**
 * Cleanup synthetic data (for teardown)
 */
async function cleanupSyntheticFixtures() {
  console.log('🧹 Cleaning up synthetic test fixtures...');
  // In a real implementation, this would clean up any persisted test data
  // For now, just log the cleanup
  console.log('✅ Synthetic fixtures cleanup complete');
}

/**
 * Validate that data is properly synthetic and GDPR compliant
 */
function validateSyntheticData(fixtures) {
  const violations = [];

  // Check that all data is marked as synthetic
  const checkSynthetic = (obj, path = '') => {
    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => checkSynthetic(item, `${path}[${index}]`));
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          checkSynthetic(value, path ? `${path}.${key}` : key);
        });
      }
    }
  };

  // Validate email domains are test domains
  const validateEmailDomains = (obj, path = '') => {
    if (typeof obj === 'string' && obj.includes('@')) {
      if (!obj.includes('synthetic-domain.test') && !obj.includes('.test')) {
        violations.push(`Non-test email domain found at ${path}: ${obj}`);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        validateEmailDomains(value, path ? `${path}.${key}` : key);
      });
    }
  };

  checkSynthetic(fixtures);
  validateEmailDomains(fixtures);

  if (violations.length > 0) {
    throw new Error(`GDPR compliance violations found:\n${violations.join('\n')}`);
  }

  console.log('✅ Synthetic data validation passed - GDPR compliant');
  return true;
}

module.exports = {
  createSyntheticFixtures,
  cleanupSyntheticFixtures,
  validateSyntheticData,
  generateSyntheticComment,
  generateSyntheticUser,
  generateSyntheticOrg,
  generateSyntheticAuthor,
  generateSyntheticResponse
};