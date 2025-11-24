/**
 * Fixtures Loader - Load test data for comprehensive testing
 * Issue #403 - Testing MVP
 */

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

/**
 * Deep clone function to prevent fixture mutations between tests
 * Handles objects, arrays, dates, and primitive values
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item));
  }

  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Comment fixtures for different testing scenarios
 */
const COMMENT_FIXTURES = {
  spanish: {
    roastable: [
      {
        text: 'Esta aplicación es horrible, no funciona nada',
        category: 'criticism',
        toxicity_score: 0.4,
        expected_action: 'roast'
      },
      {
        text: 'Qué mal diseño tiene esta interfaz',
        category: 'criticism',
        toxicity_score: 0.3,
        expected_action: 'roast'
      },
      {
        text: 'No entiendo por qué alguien usaría esto',
        category: 'dismissive',
        toxicity_score: 0.5,
        expected_action: 'roast'
      }
    ],
    shield: [
      {
        text: 'Eres un idiota por hacer esto',
        category: 'personal_attack',
        toxicity_score: 0.8,
        expected_action: 'shield'
      },
      {
        text: 'Deberías morirte por crear esta basura',
        category: 'threat',
        toxicity_score: 0.9,
        expected_action: 'shield'
      }
    ],
    block: [
      {
        text: 'Espero que te maten por esto',
        category: 'death_threat',
        toxicity_score: 0.95,
        expected_action: 'block'
      }
    ],
    neutral: [
      {
        text: '¿Cómo funciona esta feature?',
        category: 'question',
        toxicity_score: 0.1,
        expected_action: 'ignore'
      },
      {
        text: 'Gracias por crear esta aplicación',
        category: 'positive',
        toxicity_score: 0.05,
        expected_action: 'ignore'
      }
    ]
  },

  english: {
    roastable: [
      {
        text: 'This app is terrible, nothing works',
        category: 'criticism',
        toxicity_score: 0.4,
        expected_action: 'roast'
      },
      {
        text: 'What a poorly designed interface',
        category: 'criticism',
        toxicity_score: 0.35,
        expected_action: 'roast'
      },
      {
        text: "I don't understand why anyone would use this",
        category: 'dismissive',
        toxicity_score: 0.5,
        expected_action: 'roast'
      }
    ],
    shield: [
      {
        text: 'You are an idiot for making this',
        category: 'personal_attack',
        toxicity_score: 0.8,
        expected_action: 'shield'
      },
      {
        text: 'You should die for creating this garbage',
        category: 'threat',
        toxicity_score: 0.9,
        expected_action: 'shield'
      }
    ],
    block: [
      {
        text: 'I hope you get killed for this',
        category: 'death_threat',
        toxicity_score: 0.95,
        expected_action: 'block'
      }
    ],
    neutral: [
      {
        text: 'How does this feature work?',
        category: 'question',
        toxicity_score: 0.1,
        expected_action: 'ignore'
      },
      {
        text: 'Thanks for creating this app',
        category: 'positive',
        toxicity_score: 0.05,
        expected_action: 'ignore'
      }
    ]
  }
};

/**
 * User fixtures for multi-tenant testing
 */
const USER_FIXTURES = {
  organizations: [
    {
      id: 'test-org-1',
      name: 'Test Organization 1',
      plan: 'free',
      settings: {
        auto_approval: false,
        shield_enabled: true,
        default_tone: 'balanced'
      }
    },
    {
      id: 'test-org-2',
      name: 'Test Organization 2',
      plan: 'pro',
      settings: {
        auto_approval: true,
        shield_enabled: true,
        default_tone: 'witty'
      }
    }
  ],

  users: [
    {
      id: 'test-user-1',
      email: 'admin1@test.com',
      organization_id: 'test-org-1',
      role: 'admin'
    },
    {
      id: 'test-user-2',
      email: 'user1@test.com',
      organization_id: 'test-org-1',
      role: 'user'
    },
    {
      id: 'test-user-3',
      email: 'admin2@test.com',
      organization_id: 'test-org-2',
      role: 'admin'
    }
  ]
};

/**
 * Load fixtures by category
 * Returns deep cloned data to prevent test mutations
 */
async function loadFixtures(category, language = 'spanish') {
  switch (category) {
    case 'comments':
      return deepClone(COMMENT_FIXTURES[language] || COMMENT_FIXTURES.spanish);

    case 'users':
      return deepClone(USER_FIXTURES);

    case 'all':
      return deepClone({
        comments: COMMENT_FIXTURES,
        users: USER_FIXTURES
      });

    default:
      throw new Error(`Unknown fixture category: ${category}`);
  }
}

/**
 * Generate test comments from fixtures
 * Returns cloned data to prevent mutations
 */
function generateTestComments(orgId, language = 'spanish', count = 10) {
  const fixtures = deepClone(COMMENT_FIXTURES[language] || COMMENT_FIXTURES.spanish);
  const comments = [];

  // Get all comment types
  const allComments = [
    ...fixtures.roastable,
    ...fixtures.shield,
    ...fixtures.block,
    ...fixtures.neutral
  ];

  // Generate requested number of comments
  for (let i = 0; i < count; i++) {
    const fixture = allComments[i % allComments.length];
    const uuid = randomUUID();
    comments.push({
      id: `test-comment-${uuid}`,
      organization_id: orgId,
      platform: 'twitter',
      external_id: `ext-${uuid}`,
      text: fixture.text,
      category: fixture.category,
      toxicity_score: fixture.toxicity_score,
      expected_action: fixture.expected_action,
      author_username: `testuser${i + 1}`,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  }

  return comments;
}

/**
 * Create complete test scenario
 */
function createTestScenario(name, options = {}) {
  const { orgCount = 2, commentsPerOrg = 10, language = 'spanish', includeUsers = true } = options;

  const scenario = {
    name,
    organizations: [],
    users: [],
    comments: []
  };

  // Create organizations
  for (let i = 1; i <= orgCount; i++) {
    const orgUuid = randomUUID();
    const orgId = `test-org-${orgUuid}`;
    scenario.organizations.push({
      id: orgId,
      name: `Test Org ${i} for ${name}`,
      plan: i === 1 ? 'free' : 'pro',
      settings: {
        auto_approval: i > 1,
        shield_enabled: true,
        default_tone: i === 1 ? 'balanced' : 'witty'
      },
      created_at: new Date().toISOString()
    });

    // Create users for each org
    if (includeUsers) {
      const userUuid = randomUUID();
      scenario.users.push({
        id: `test-user-${userUuid}`,
        email: `admin${userUuid}@${name}.test`,
        organization_id: orgId,
        role: 'admin',
        created_at: new Date().toISOString()
      });
    }

    // Create comments for each org
    const comments = generateTestComments(orgId, language, commentsPerOrg);
    scenario.comments.push(...comments);
  }

  return deepClone(scenario);
}

/**
 * Save fixtures to file for debugging
 */
async function saveFixturesToFile(fixtures, filename) {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  await fs.mkdir(fixturesDir, { recursive: true });

  const filepath = path.join(fixturesDir, `${filename}.json`);
  await fs.writeFile(filepath, JSON.stringify(fixtures, null, 2));

  console.log(`Fixtures saved to ${filepath}`);
}

module.exports = {
  COMMENT_FIXTURES,
  USER_FIXTURES,
  loadFixtures,
  generateTestComments,
  createTestScenario,
  saveFixturesToFile
};
