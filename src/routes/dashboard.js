/**
 * Dashboard API Routes - Mock-first implementation
 * 
 * Provides mock data for dashboard widgets when external services are unavailable
 */

const express = require('express');
const router = express.Router();
const { flags } = require('../config/flags');

/**
 * GET /api/health - System health status
 */
router.get('/health', (req, res) => {
  try {
    const services = {
      api: 'ok',
      billing: flags.isEnabled('ENABLE_BILLING') ? 'ok' : 'degraded',
      ai: flags.isEnabled('ENABLE_REAL_OPENAI') ? 'ok' : 'degraded', 
      db: flags.isEnabled('ENABLE_SUPABASE') ? 'ok' : 'degraded'
    };

    const flagsStatus = {
      rqc: flags.isEnabled('ENABLE_RQC'),
      shield: flags.isEnabled('ENABLE_SHIELD'),
      customPrompt: flags.isEnabled('ENABLE_CUSTOM_PROMPT'),
      mockMode: flags.isEnabled('MOCK_MODE'),
      verboseLogs: flags.isEnabled('VERBOSE_LOGS')
    };

    res.json({
      services,
      flags: flagsStatus,
      timestamp: new Date().toISOString(),
      status: 'operational'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * GET /api/user - Current user info (mock)
 */
router.get('/user', (req, res) => {
  // Mock user data
  const mockUser = {
    id: 'u_mock_user',
    name: 'Roastr User',
    email: 'user@roastr.ai',
    plan: flags.isEnabled('MOCK_MODE') ? 'pro' : 'free',
    rqcEnabled: flags.isEnabled('ENABLE_RQC'),
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RoastrUser',
    joinedAt: '2024-01-15T10:00:00Z',
    lastActive: new Date().toISOString()
  };

  res.json(mockUser);
});

/**
 * GET /api/integrations - Platform integrations status
 */
router.get('/integrations', (req, res) => {
  const platforms = [
    { 
      name: 'twitter', 
      displayName: 'Twitter/X',
      status: flags.isEnabled('ENABLE_REAL_TWITTER') ? 'connected' : 'disconnected',
      icon: '𝕏',
      lastSync: flags.isEnabled('ENABLE_REAL_TWITTER') ? new Date(Date.now() - 3600000).toISOString() : null
    },
    { 
      name: 'youtube', 
      displayName: 'YouTube',
      status: flags.isEnabled('ENABLE_REAL_YOUTUBE') ? 'connected' : 'disconnected',
      icon: '▶️',
      lastSync: null
    },
    { 
      name: 'instagram', 
      displayName: 'Instagram',
      status: 'disconnected',
      icon: '📷',
      lastSync: null
    },
    { 
      name: 'discord', 
      displayName: 'Discord',
      status: 'disconnected',
      icon: '💬',
      lastSync: null
    },
    { 
      name: 'twitch', 
      displayName: 'Twitch',
      status: 'disconnected',
      icon: '🟣',
      lastSync: null
    },
    { 
      name: 'reddit', 
      displayName: 'Reddit',
      status: 'disconnected',
      icon: '🔶',
      lastSync: null
    },
    { 
      name: 'bluesky', 
      displayName: 'Bluesky',
      status: flags.isEnabled('ENABLE_REAL_BLUESKY') ? 'connected' : 'disconnected',
      icon: '🦋',
      lastSync: null
    }
  ];

  res.json(platforms);
});

/**
 * GET /api/logs - Application logs (mock)
 */
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const level = req.query.level || 'all';
  
  const mockLogs = Array.from({ length: Math.min(limit, 100) }, (_, i) => {
    const levels = ['info', 'warn', 'error'];
    const logLevel = level === 'all' ? levels[Math.floor(Math.random() * levels.length)] : level;
    
    const messages = {
      info: [
        'Roast generated successfully for user',
        'Integration sync completed',
        'User logged in',
        'API health check passed',
        'Cache refreshed'
      ],
      warn: [
        'Rate limit approaching for OpenAI API',
        'Integration connection unstable',
        'Mock mode active - some features limited',
        'Failed to sync with platform (retrying)'
      ],
      error: [
        'Failed to generate roast - using fallback',
        'Database connection timeout',
        'Integration authentication failed',
        'Webhook validation error'
      ]
    };

    return {
      id: `log_${Date.now()}_${i}`,
      level: logLevel,
      message: messages[logLevel][Math.floor(Math.random() * messages[logLevel].length)],
      timestamp: new Date(Date.now() - (i * 60000 + Math.random() * 60000)).toISOString(),
      service: ['api', 'worker', 'integration', 'billing'][Math.floor(Math.random() * 4)],
      metadata: {
        userId: `user_${Math.floor(Math.random() * 1000)}`,
        platform: ['twitter', 'youtube', 'instagram'][Math.floor(Math.random() * 3)]
      }
    };
  });

  res.json(mockLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

/**
 * GET /api/usage - Usage statistics (mock)
 */
router.get('/usage', (req, res) => {
  const mockUsage = {
    tokens: Math.floor(Math.random() * 50000) + 10000,
    aiCalls: Math.floor(Math.random() * 500) + 50,
    rqcCalls: flags.isEnabled('ENABLE_RQC') ? Math.floor(Math.random() * 100) : 0,
    costCents: Math.floor(Math.random() * 500) + 50,
    period: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    },
    breakdown: {
      roastGeneration: Math.floor(Math.random() * 300) + 200,
      toxicityAnalysis: Math.floor(Math.random() * 200) + 100,
      rqcReviews: flags.isEnabled('ENABLE_RQC') ? Math.floor(Math.random() * 50) : 0,
      platformSync: Math.floor(Math.random() * 100) + 25
    },
    limits: {
      tokensLimit: 100000,
      aiCallsLimit: 1000,
      rqcCallsLimit: flags.isEnabled('ENABLE_RQC') ? 500 : 0
    }
  };

  res.json(mockUsage);
});

/**
 * POST /api/billing/portal - Customer portal (mock)
 */
router.post('/billing/portal', (req, res) => {
  if (flags.isEnabled('MOCK_MODE')) {
    // Return mock portal URL
    res.json({
      url: '#mock-portal',
      message: 'Mock billing portal - no real redirect in development mode'
    });
  } else {
    // TODO: Real Stripe portal integration
    res.status(503).json({
      error: 'billing_unavailable',
      message: 'Billing service not configured'
    });
  }
});

/**
 * POST /api/roast/preview - Preview roast generation (mock)
 */
router.post('/roast/preview', (req, res) => {
  const { text, platform = 'twitter', intensity = 3 } = req.body;

  if (!text) {
    return res.status(400).json({
      error: 'missing_text',
      message: 'Text is required for roast preview'
    });
  }

  // Detect language and generate appropriate roast
  const detectLanguage = (text) => {
    // Simple language detection based on common words/characters
    const spanishWords = /\b(que|es|el|la|de|en|un|una|con|por|para|su|me|te|se|no|si|pero|como|más|muy|todo|todos|este|esta|año|día|vida|mundo|casa|tiempo|parte|mucho|otro|otra|bien|gran|cada|solo|también|donde|cuando|porque|hasta|hacer|ser|tener|estar|ir|ver|dar|saber|poder|decir|ahora|mismo|aquí|así|todo|nada|algo|alguien|nadie|siempre|nunca|antes|después|entonces|ahora)\b/gi;
    const frenchWords = /\b(que|est|le|la|de|en|un|une|avec|par|pour|sur|dans|du|des|ce|cette|être|avoir|faire|aller|voir|savoir|pouvoir|dire|venir|devoir|vouloir|bien|tout|tous|toute|toutes|aussi|très|plus|moins|encore|déjà|maintenant|aujourd|hier|demain|toujours|jamais|parfois|souvent)\b/gi;
    const portugueseWords = /\b(que|é|o|a|de|em|um|uma|com|por|para|se|não|mais|como|mas|todo|toda|todos|todas|este|esta|isso|aqui|ali|quando|onde|porque|então|já|ainda|sempre|nunca|ser|ter|estar|fazer|ir|ver|dar|saber|poder|dizer|vir|dever|querer|bem|muito|pouco|outro|outra)\b/gi;
    
    const spanishMatches = (text.match(spanishWords) || []).length;
    const frenchMatches = (text.match(frenchWords) || []).length;
    const portugueseMatches = (text.match(portugueseWords) || []).length;
    
    if (spanishMatches > frenchMatches && spanishMatches > portugueseMatches && spanishMatches > 0) {
      return 'es';
    } else if (frenchMatches > spanishMatches && frenchMatches > portugueseMatches && frenchMatches > 0) {
      return 'fr';
    } else if (portugueseMatches > spanishMatches && portugueseMatches > frenchMatches && portugueseMatches > 0) {
      return 'pt';
    }
    return 'en';
  };

  const language = detectLanguage(text);

  // Mock roast responses based on intensity and language
  const mockRoasts = {
    en: {
      1: [
        "That's... an interesting perspective 🤔",
        "Well, everyone's entitled to their opinion!",
        "Bold take, friend!"
      ],
      2: [
        "That comment aged like milk in the sun ☀️",
        "Sir, this is a Wendy's... but make it more coherent",
        "Did you think before typing, or was that just muscle memory?"
      ],
      3: [
        "Your comment just called - it wants its logic back 📞",
        "That take is so cold, penguins are using it for air conditioning ❄️", 
        "Congratulations! You just won the 'Most Creative Way to Miss the Point' award 🏆"
      ]
    },
    es: {
      1: [
        "Esa es... una perspectiva interesante 🤔",
        "Bueno, todos tienen derecho a su opinión!",
        "¡Qué comentario tan audaz, amigo!"
      ],
      2: [
        "Ese comentario envejeció como leche al sol ☀️",
        "Señor, esto es un McDonald's... pero con más coherencia",
        "¿Pensaste antes de escribir, o fue puro instinto?"
      ],
      3: [
        "Tu comentario acaba de llamar - quiere recuperar su lógica 📞",
        "Esa opinión está tan fría que los pingüinos la usan de aire acondicionado ❄️",
        "¡Felicidades! Acabas de ganar el premio a 'La Forma Más Creativa de Errar el Punto' 🏆"
      ]
    },
    fr: {
      1: [
        "C'est... une perspective intéressante 🤔",
        "Eh bien, chacun a droit à son opinion!",
        "Commentaire audacieux, mon ami!"
      ],
      2: [
        "Ce commentaire a vieilli comme du lait au soleil ☀️",
        "Monsieur, ici c'est un McDo... mais en plus cohérent",
        "Tu as réfléchi avant d'écrire, ou c'était juste de l'instinct?"
      ],
      3: [
        "Ton commentaire vient d'appeler - il veut récupérer sa logique 📞",
        "Cette opinion est si froide que les pingouins l'utilisent comme climatisation ❄️",
        "Félicitations! Tu viens de gagner le prix de 'La Façon la Plus Créative de Rater le Point' 🏆"
      ]
    },
    pt: {
      1: [
        "Essa é... uma perspectiva interessante 🤔",
        "Bem, todos têm direito à sua opinião!",
        "Comentário ousado, amigo!"
      ],
      2: [
        "Esse comentário envelheceu como leite no sol ☀️",
        "Senhor, isto é um McDonald's... mas com mais coerência",
        "Você pensou antes de escrever, ou foi puro instinto?"
      ],
      3: [
        "Seu comentário acabou de ligar - quer a lógica de volta 📞",
        "Essa opinião está tão fria que os pinguins a usam como ar condicionado ❄️",
        "Parabéns! Você acabou de ganhar o prêmio 'Forma Mais Criativa de Errar o Ponto' 🏆"
      ]
    }
  };

  const languageRoasts = mockRoasts[language] || mockRoasts.en;
  const roastOptions = languageRoasts[Math.min(intensity, 3)] || languageRoasts[3];
  const selectedRoast = roastOptions[Math.floor(Math.random() * roastOptions.length)];

  const response = {
    roast: selectedRoast,
    intensity,
    platform,
    language,
    confidence: 0.85 + Math.random() * 0.1,
    processingTime: Math.floor(Math.random() * 2000) + 500,
    tokens: Math.floor(Math.random() * 100) + 50,
    isMock: flags.isEnabled('MOCK_MODE')
  };

  // Simulate processing delay
  setTimeout(() => {
    res.json(response);
  }, Math.floor(Math.random() * 1000) + 200);
});

module.exports = router;