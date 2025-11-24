/**
 * Triage Test Fixtures - Representative comments for testing
 *
 * Organized by expected triage decision to ensure deterministic testing
 * Each comment includes toxicity score and expected routing behavior
 *
 * Categories:
 * - publish: Clean content, low toxicity (< roast threshold)
 * - roast: Moderate toxicity (>= roast threshold, < block threshold)
 * - block: High toxicity (>= block threshold)
 * - boundary: Edge cases at exact thresholds
 * - edge_cases: Special content types and edge conditions
 */

const TriageFixtures = {
  /**
   * PUBLISH CATEGORY
   * Content that should be published directly
   * Toxicity: 0.0 - 0.19 (below all plan thresholds)
   */
  publish: [
    {
      id: 'publish_001',
      content: '¡Excelente trabajo en esta nueva funcionalidad! Me encanta el diseño.',
      toxicity: 0.05,
      categories: [],
      platform: 'twitter',
      language: 'es',
      description: 'Positive feedback - should publish for all plans',
      expected_action: 'publish',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'publish_002',
      content: 'Great work on the latest update! Very smooth and intuitive.',
      toxicity: 0.08,
      categories: [],
      platform: 'youtube',
      language: 'en',
      description: 'Praise comment - should publish for all plans',
      expected_action: 'publish',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'publish_003',
      content: '¿Cómo puedo configurar esta opción? Necesito ayuda con los ajustes.',
      toxicity: 0.12,
      categories: [],
      platform: 'instagram',
      language: 'es',
      description: 'Help request - should publish for all plans',
      expected_action: 'publish',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'publish_004',
      content: 'Looking forward to the next release. Keep up the good work!',
      toxicity: 0.15,
      categories: [],
      platform: 'facebook',
      language: 'en',
      description: 'Encouraging comment - should publish for all plans',
      expected_action: 'publish',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    }
  ],

  /**
   * ROAST CATEGORY
   * Content suitable for roasting based on plan thresholds
   * Free/Starter: 0.30+, Pro: 0.25+, Plus: 0.20+
   */
  roast: [
    {
      id: 'roast_001',
      content: 'Esta aplicación es bastante mediocre, esperaba mucho más.',
      toxicity: 0.35,
      categories: ['TOXICITY'],
      platform: 'twitter',
      language: 'es',
      description: 'Mild criticism - roastable for all plans',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'roast_002',
      content: 'The UI design is pretty ugly and needs serious work.',
      toxicity: 0.45,
      categories: ['TOXICITY'],
      platform: 'youtube',
      language: 'en',
      description: 'Design criticism - roastable for all plans',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'roast_003',
      content: 'Qué aburrido es esto, no me gusta nada para nada.',
      toxicity: 0.55,
      categories: ['TOXICITY'],
      platform: 'instagram',
      language: 'es',
      description: 'Strong negative opinion - roastable for all plans',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'roast_004',
      content: 'This feature is completely useless and poorly implemented.',
      toxicity: 0.65,
      categories: ['TOXICITY'],
      platform: 'facebook',
      language: 'en',
      description: 'Feature criticism - roastable for all plans',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'roast_005',
      content: 'No me gusta este diseño tan feo y confuso.',
      toxicity: 0.28,
      categories: ['TOXICITY'],
      platform: 'twitter',
      language: 'es',
      description: 'Mild design criticism - roastable for pro/plus only',
      expected_action: {
        free: 'publish',
        starter: 'publish',
        pro: 'roast',
        plus: 'roast',
        creator_plus: 'roast'
      }
    },
    {
      id: 'roast_006',
      content: 'This app is kind of disappointing honestly.',
      toxicity: 0.22,
      categories: ['TOXICITY'],
      platform: 'youtube',
      language: 'en',
      description: 'Disappointment - roastable for plus only',
      expected_action: {
        free: 'publish',
        starter: 'publish',
        pro: 'publish',
        plus: 'roast',
        creator_plus: 'roast'
      }
    }
  ],

  /**
   * BLOCK CATEGORY
   * High toxicity content that should be blocked
   * Toxicity: 0.85+ (above block threshold)
   */
  block: [
    {
      id: 'block_001',
      content: 'Eres un idiota completo, ojalá te mueras pronto.',
      toxicity: 0.88,
      categories: ['TOXICITY', 'THREAT'],
      platform: 'twitter',
      language: 'es',
      description: 'Death threat - should be blocked for all plans',
      expected_action: 'block',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus'],
      shield_expected: true
    },
    {
      id: 'block_002',
      content: 'F*ck you and your stupid f*cking app, piece of sh*t.',
      toxicity: 0.92,
      categories: ['TOXICITY', 'PROFANITY'],
      platform: 'youtube',
      language: 'en',
      description: 'Severe profanity - should be blocked for all plans',
      expected_action: 'block',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus'],
      shield_expected: true
    },
    {
      id: 'block_003',
      content: 'Deberían violarte por hacer esta basura asquerosa.',
      toxicity: 0.95,
      categories: ['TOXICITY', 'THREAT', 'SEXUALLY_EXPLICIT'],
      platform: 'instagram',
      language: 'es',
      description: 'Sexual threat - should be blocked with Shield escalation',
      expected_action: 'block',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus'],
      shield_expected: true,
      shield_priority: 1
    },
    {
      id: 'block_004',
      content: 'Kill yourself you worthless developer scum.',
      toxicity: 0.98,
      categories: ['TOXICITY', 'THREAT'],
      platform: 'facebook',
      language: 'en',
      description: 'Suicide encouragement - critical Shield action',
      expected_action: 'block',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus'],
      shield_expected: true,
      shield_priority: 1
    }
  ],

  /**
   * BOUNDARY CASES
   * Comments at exact threshold boundaries for testing precision
   */
  boundary: [
    {
      id: 'boundary_001',
      content: 'No me gusta nada, es bastante malo realmente.',
      toxicity: 0.199,
      categories: ['TOXICITY'],
      platform: 'twitter',
      language: 'es',
      description: 'Just below plus threshold (0.20) - should publish for plus',
      expected_action: {
        free: 'publish',
        starter: 'publish',
        pro: 'publish',
        plus: 'publish',
        creator_plus: 'publish'
      }
    },
    {
      id: 'boundary_002',
      content: 'This is really disappointing and frustrating.',
      toxicity: 0.201,
      categories: ['TOXICITY'],
      platform: 'youtube',
      language: 'en',
      description: 'Just above plus threshold (0.20) - should roast for plus',
      expected_action: {
        free: 'publish',
        starter: 'publish',
        pro: 'publish',
        plus: 'roast',
        creator_plus: 'roast'
      }
    },
    {
      id: 'boundary_003',
      content: 'Esta aplicación es realmente mala y molesta.',
      toxicity: 0.249,
      categories: ['TOXICITY'],
      platform: 'instagram',
      language: 'es',
      description: 'Just below pro threshold (0.25) - should publish for pro',
      expected_action: {
        free: 'publish',
        starter: 'publish',
        pro: 'publish',
        plus: 'roast',
        creator_plus: 'roast'
      }
    },
    {
      id: 'boundary_004',
      content: 'This app is annoying and poorly designed.',
      toxicity: 0.251,
      categories: ['TOXICITY'],
      platform: 'facebook',
      language: 'en',
      description: 'Just above pro threshold (0.25) - should roast for pro+',
      expected_action: {
        free: 'publish',
        starter: 'publish',
        pro: 'roast',
        plus: 'roast',
        creator_plus: 'roast'
      }
    },
    {
      id: 'boundary_005',
      content: 'No me gusta esto, es bastante horrible.',
      toxicity: 0.299,
      categories: ['TOXICITY'],
      platform: 'twitter',
      language: 'es',
      description: 'Just below free threshold (0.30) - should publish for free',
      expected_action: {
        free: 'publish',
        starter: 'publish',
        pro: 'roast',
        plus: 'roast',
        creator_plus: 'roast'
      }
    },
    {
      id: 'boundary_006',
      content: 'This is really disappointing and terrible.',
      toxicity: 0.301,
      categories: ['TOXICITY'],
      platform: 'youtube',
      language: 'en',
      description: 'Just above free threshold (0.30) - should roast for all',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'boundary_007',
      content: 'Esto es una verdadera porquería de aplicación.',
      toxicity: 0.849,
      categories: ['TOXICITY'],
      platform: 'instagram',
      language: 'es',
      description: 'Just below block threshold (0.85) - should roast',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'boundary_008',
      content: 'You are absolutely stupid for creating this garbage.',
      toxicity: 0.851,
      categories: ['TOXICITY', 'INSULT'],
      platform: 'facebook',
      language: 'en',
      description: 'Just above block threshold (0.85) - should block',
      expected_action: 'block',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus'],
      shield_expected: true
    }
  ],

  /**
   * EDGE CASES
   * Special content types and unusual conditions
   */
  edge_cases: [
    {
      id: 'edge_001',
      content: '',
      toxicity: 0.0,
      categories: [],
      platform: 'twitter',
      language: 'en',
      description: 'Empty content - should skip with validation error',
      expected_action: 'skip',
      expected_reasoning: 'validation_failed'
    },
    {
      id: 'edge_002',
      content: '这个应用程序真的很糟糕，我讨厌它',
      toxicity: 0.55,
      categories: ['TOXICITY'],
      platform: 'twitter',
      language: 'zh',
      description: 'Chinese negative comment - should roast',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'edge_003',
      content: '😡😡😡 Worst app ever!!! 🤬🤬🤬',
      toxicity: 0.75,
      categories: ['TOXICITY'],
      platform: 'instagram',
      language: 'en',
      description: 'Emojis and special characters - should roast',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'edge_004',
      content: 'a'.repeat(10001), // Very long content
      toxicity: 0.1,
      categories: [],
      platform: 'youtube',
      language: 'en',
      description: 'Content too long - should skip with validation error',
      expected_action: 'skip',
      expected_reasoning: 'validation_failed'
    },
    {
      id: 'edge_005',
      content: 'This app is {{malicious}} and has ${injection} attempts',
      toxicity: 0.3,
      categories: ['TOXICITY'],
      platform: 'facebook',
      language: 'en',
      description: 'Security pattern detected - should skip',
      expected_action: 'skip',
      expected_reasoning: 'validation_failed'
    },
    {
      id: 'edge_006',
      content: 'Это приложение ужасно, ненавижу его',
      toxicity: 0.65,
      categories: ['TOXICITY'],
      platform: 'twitter',
      language: 'ru',
      description: 'Russian negative comment - should roast',
      expected_action: 'roast',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    },
    {
      id: 'edge_007',
      content: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      toxicity: 0.05,
      categories: [],
      platform: 'youtube',
      language: 'en',
      description: 'Repetitive content - should publish',
      expected_action: 'publish',
      expected_plans: ['free', 'starter', 'pro', 'plus', 'creator_plus']
    }
  ],

  /**
   * PLAN-SPECIFIC TEST CASES
   * Cases designed to test plan-specific behavior
   */
  plan_specific: [
    {
      id: 'plan_001',
      content: 'Esta app es un poco molesta y confusa.',
      toxicity: 0.22,
      categories: ['TOXICITY'],
      platform: 'twitter',
      language: 'es',
      description: 'Between plus and pro thresholds',
      expected_actions: {
        free: 'publish', // 0.22 < 0.30
        starter: 'publish', // 0.22 < 0.30
        pro: 'publish', // 0.22 < 0.25
        plus: 'roast', // 0.22 >= 0.20
        creator_plus: 'roast' // 0.22 >= 0.20
      }
    },
    {
      id: 'plan_002',
      content: 'This design is quite disappointing.',
      toxicity: 0.27,
      categories: ['TOXICITY'],
      platform: 'youtube',
      language: 'en',
      description: 'Between pro and free thresholds',
      expected_actions: {
        free: 'publish', // 0.27 < 0.30
        starter: 'publish', // 0.27 < 0.30
        pro: 'roast', // 0.27 >= 0.25
        plus: 'roast', // 0.27 >= 0.20
        creator_plus: 'roast' // 0.27 >= 0.20
      }
    }
  ]
};

/**
 * Helper functions for testing
 */
TriageFixtures.getCommentsByAction = function (action) {
  const comments = [];
  for (const category of Object.keys(this)) {
    if (category === 'getCommentsByAction' || category === 'getCommentsByPlan') continue;
    comments.push(...this[category].filter((c) => c.expected_action === action));
  }
  return comments;
};

TriageFixtures.getCommentsByPlan = function (plan) {
  // Validate plan parameter
  const validPlans = ['free', 'starter', 'pro', 'plus', 'creator_plus'];
  if (!plan || typeof plan !== 'string' || !validPlans.includes(plan)) {
    console.warn(`Invalid plan specified: ${plan}. Expected one of: ${validPlans.join(', ')}`);
    return [];
  }

  const comments = [];
  for (const category of Object.keys(this)) {
    if (category === 'getCommentsByAction' || category === 'getCommentsByPlan') continue;

    // Only include comments that are relevant to the specified plan
    const filteredComments = this[category].filter((c) => {
      // If comment explicitly lists plans it applies to
      if (Array.isArray(c.expected_plans)) {
        return c.expected_plans.includes(plan);
      }

      // If comment has plan-specific expected actions
      if (typeof c.expected_action === 'object' && c.expected_action !== null) {
        return c.expected_action.hasOwnProperty(plan);
      }

      // If comment has plan-specific expected actions (alternative property)
      if (typeof c.expected_actions === 'object' && c.expected_actions !== null) {
        return c.expected_actions.hasOwnProperty(plan);
      }

      // Only include comments with simple expected actions for valid plans
      if (typeof c.expected_action === 'string') {
        return true; // Simple actions apply to all valid plans
      }

      return false; // Exclude if no clear plan applicability
    });

    comments.push(...filteredComments);
  }

  return comments;
};

module.exports = TriageFixtures;
