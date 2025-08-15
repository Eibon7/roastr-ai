const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { flags } = require('../config/flags');

// Mock data storage for user integrations
const userIntegrations = new Map(); // userId -> { platform: { status, data, importedCount, etc. } }
const importHistory = new Map(); // userId -> { platform: [imported items] }

// Supported platforms with mock OAuth and import capabilities
const SUPPORTED_PLATFORMS = {
  twitter: {
    name: 'twitter',
    displayName: 'Twitter/X',
    icon: '𝕏',
    description: 'Connect your Twitter account to analyze tweets and replies',
    maxImportLimit: 300,
    importDelay: 2000,
    languages: ['es', 'en']
  },
  instagram: {
    name: 'instagram',
    displayName: 'Instagram',
    icon: '📷',
    description: 'Connect Instagram to analyze posts and comments',
    maxImportLimit: 300,
    importDelay: 3000,
    languages: ['es', 'en']
  },
  youtube: {
    name: 'youtube',
    displayName: 'YouTube',
    icon: '📺',
    description: 'Connect YouTube to analyze video comments',
    maxImportLimit: 300,
    importDelay: 4000,
    languages: ['es', 'en']
  },
  tiktok: {
    name: 'tiktok',
    displayName: 'TikTok',
    icon: '🎵',
    description: 'Connect TikTok to analyze video comments',
    maxImportLimit: 300,
    importDelay: 2500,
    languages: ['es', 'en', 'pt']
  },
  linkedin: {
    name: 'linkedin',
    displayName: 'LinkedIn',
    icon: '💼',
    description: 'Connect LinkedIn for professional content analysis',
    maxImportLimit: 300,
    importDelay: 3500,
    languages: ['en', 'es']
  },
  facebook: {
    name: 'facebook',
    displayName: 'Facebook',
    icon: '👤',
    description: 'Connect Facebook to analyze posts and comments',
    maxImportLimit: 300,
    importDelay: 3000,
    languages: ['es', 'en', 'pt']
  },
  bluesky: {
    name: 'bluesky',
    displayName: 'Bluesky',
    icon: '🦋',
    description: 'Connect Bluesky for decentralized social media analysis',
    maxImportLimit: 300,
    importDelay: 1500,
    languages: ['en', 'es']
  }
};

/**
 * Helper function to generate mock social media content
 */
function generateMockContent(platform, count, languages) {
  const mockContent = [];
  const sampleTexts = {
    es: [
      'Este es un comentario en español muy interesante',
      'No me parece correcto lo que dices ahí',
      'Excelente punto, completamente de acuerdo',
      'Qué opináis sobre esto? Me parece curioso',
      'Totalmente en desacuerdo, creo que...',
      'Me encanta este contenido, muy útil!'
    ],
    en: [
      'This is a really interesting point you make',
      'I totally disagree with this approach',
      'Great content, thanks for sharing!',
      'What do you think about this topic?',
      'This doesn\'t make sense to me',
      'Love this, very helpful information'
    ],
    pt: [
      'Isso é muito interessante, obrigado!',
      'Não concordo com essa opinião',
      'Ótimo conteúdo, muito útil',
      'O que vocês acham disso?'
    ]
  };

  for (let i = 0; i < count; i++) {
    // Random language selection based on platform supported languages
    const availableLangs = languages.filter(lang => sampleTexts[lang]);
    const randomLang = availableLangs[Math.floor(Math.random() * availableLangs.length)];
    const texts = sampleTexts[randomLang];
    const randomText = texts[Math.floor(Math.random() * texts.length)];

    mockContent.push({
      id: `${platform}_${Date.now()}_${i}`,
      text: randomText,
      lang: randomLang,
      platform: platform,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random date within last 30 days
      metrics: {
        likes: Math.floor(Math.random() * 100),
        replies: Math.floor(Math.random() * 20),
        shares: Math.floor(Math.random() * 10)
      }
    });
  }

  return mockContent;
}

/**
 * Helper function to detect language hints from content
 */
function detectLanguageHints(content) {
  const langCount = {};
  
  content.forEach(item => {
    if (langCount[item.lang]) {
      langCount[item.lang]++;
    } else {
      langCount[item.lang] = 1;
    }
  });

  // Return languages that have at least 25% presence and minimum 50 items
  const totalCount = content.length;
  const languageHints = [];

  Object.entries(langCount).forEach(([lang, count]) => {
    const percentage = count / totalCount;
    if (percentage >= 0.25 && count >= 50) {
      languageHints.push(lang);
    } else if (count >= totalCount * 0.75) {
      // If one language dominates, always include it
      languageHints.push(lang);
    }
  });

  return languageHints.length > 0 ? languageHints : ['es']; // Default to Spanish if no clear hints
}

/**
 * GET /api/integrations/platforms
 * Get all supported platforms
 */
router.get('/platforms', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        platforms: Object.values(SUPPORTED_PLATFORMS),
        count: Object.keys(SUPPORTED_PLATFORMS).length
      }
    });
  } catch (error) {
    console.error('❌ Error getting platforms:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get supported platforms'
    });
  }
});

/**
 * GET /api/integrations/status
 * Get user's integration status for all platforms
 */
router.get('/status', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const userConnections = userIntegrations.get(userId) || {};
    
    const status = Object.keys(SUPPORTED_PLATFORMS).map(platform => {
      const connection = userConnections[platform];
      return {
        platform,
        ...SUPPORTED_PLATFORMS[platform],
        status: connection ? connection.status : 'disconnected',
        connectedAt: connection ? connection.connectedAt : null,
        importedCount: connection ? connection.importedCount : 0,
        lastImport: connection ? connection.lastImport : null
      };
    });

    res.json({
      success: true,
      data: {
        integrations: status,
        connectedCount: status.filter(s => s.status === 'connected').length,
        totalPlatforms: status.length
      }
    });
  } catch (error) {
    console.error('❌ Error getting integration status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get integration status'
    });
  }
});

/**
 * POST /api/integrations/connect
 * Connect to a social media platform (mock OAuth)
 */
router.post('/connect', authenticateToken, (req, res) => {
  try {
    const { platform } = req.body;
    const userId = req.user.id;

    if (!platform || typeof platform !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Platform is required'
      });
    }

    if (!SUPPORTED_PLATFORMS[platform]) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported platform',
        supportedPlatforms: Object.keys(SUPPORTED_PLATFORMS)
      });
    }

    // Mock OAuth success (in production, this would involve real OAuth flow)
    let userConnections = userIntegrations.get(userId) || {};
    
    // Simulate occasional connection failures (5% chance)
    if (Math.random() < 0.05) {
      return res.status(400).json({
        success: false,
        error: 'Connection failed. Please try again.',
        details: 'Mock OAuth simulation failure'
      });
    }

    userConnections[platform] = {
      status: 'connected',
      connectedAt: new Date().toISOString(),
      importedCount: 0,
      lastImport: null,
      username: `mock_user_${platform}`,
      userId: `${platform}_user_${Math.floor(Math.random() * 10000)}`
    };

    userIntegrations.set(userId, userConnections);

    console.log(`🔗 User ${userId} connected to ${platform}`);

    res.json({
      success: true,
      data: {
        platform,
        status: 'connected',
        message: `Successfully connected to ${SUPPORTED_PLATFORMS[platform].displayName}`,
        connectedAt: userConnections[platform].connectedAt
      }
    });
  } catch (error) {
    console.error('❌ Error connecting platform:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not connect to platform'
    });
  }
});

/**
 * POST /api/integrations/import
 * Import recent content from connected platform
 */
router.post('/import', authenticateToken, (req, res) => {
  try {
    const { platform, limit = 300 } = req.body;
    const userId = req.user.id;

    if (!platform || typeof platform !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Platform is required'
      });
    }

    if (!SUPPORTED_PLATFORMS[platform]) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported platform'
      });
    }

    const userConnections = userIntegrations.get(userId) || {};
    const connection = userConnections[platform];

    if (!connection || connection.status !== 'connected') {
      return res.status(400).json({
        success: false,
        error: `Please connect to ${platform} first`
      });
    }

    const platformConfig = SUPPORTED_PLATFORMS[platform];
    const actualLimit = Math.min(limit, platformConfig.maxImportLimit);

    // In test mode, import synchronously
    if (process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCK_MODE === 'true') {
      try {
        // Generate mock content
        const importedContent = generateMockContent(
          platform, 
          actualLimit, 
          platformConfig.languages
        );

        // Store imported content
        let userHistory = importHistory.get(userId) || {};
        if (!userHistory[platform]) {
          userHistory[platform] = [];
        }
        userHistory[platform] = [...userHistory[platform], ...importedContent];
        importHistory.set(userId, userHistory);

        // Update connection status
        connection.importedCount = (connection.importedCount || 0) + importedContent.length;
        connection.lastImport = new Date().toISOString();
        userConnections[platform] = connection;
        userIntegrations.set(userId, userConnections);

        console.log(`📥 User ${userId} imported ${importedContent.length} items from ${platform} (sync mode)`);
        
        return res.json({
          success: true,
          data: {
            platform,
            imported: importedContent.length,
            languageHints: platformConfig.languages,
            status: 'completed',
            totalItems: userHistory[platform].length,
            message: `Successfully imported ${importedContent.length} items from ${platformConfig.displayName}`
          }
        });
      } catch (error) {
        console.error('❌ Error in sync import:', error.message);
        return res.status(500).json({
          success: false,
          error: 'Import failed'
        });
      }
    }

    // Simulate import process with delay
    setTimeout(() => {
      try {
        // Generate mock content
        const importedContent = generateMockContent(
          platform, 
          actualLimit, 
          platformConfig.languages
        );

        // Store imported content
        let userHistory = importHistory.get(userId) || {};
        if (!userHistory[platform]) {
          userHistory[platform] = [];
        }
        userHistory[platform] = [...userHistory[platform], ...importedContent];
        importHistory.set(userId, userHistory);

        // Update connection status
        connection.importedCount += importedContent.length;
        connection.lastImport = new Date().toISOString();
        userIntegrations.set(userId, userConnections);

        console.log(`📥 User ${userId} imported ${importedContent.length} items from ${platform}`);
      } catch (error) {
        console.error('❌ Error in async import:', error.message);
      }
    }, platformConfig.importDelay);

    // Immediate response
    const languageHints = platformConfig.languages;
    
    res.json({
      success: true,
      data: {
        platform,
        imported: actualLimit,
        languageHints,
        status: 'importing',
        estimatedTime: `${platformConfig.importDelay / 1000}s`,
        message: `Started importing from ${platformConfig.displayName}`
      }
    });
  } catch (error) {
    console.error('❌ Error importing from platform:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not import from platform'
    });
  }
});

/**
 * GET /api/integrations/import/status/:platform
 * Get import status for a specific platform
 */
router.get('/import/status/:platform', authenticateToken, (req, res) => {
  try {
    const { platform } = req.params;
    const userId = req.user.id;

    if (!SUPPORTED_PLATFORMS[platform]) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported platform'
      });
    }

    const userConnections = userIntegrations.get(userId) || {};
    const connection = userConnections[platform];

    if (!connection) {
      return res.status(400).json({
        success: false,
        error: 'Platform not connected'
      });
    }

    const userHistory = importHistory.get(userId) || {};
    const platformHistory = userHistory[platform] || [];
    const languageHints = detectLanguageHints(platformHistory);

    res.json({
      success: true,
      data: {
        platform,
        status: connection.status,
        importedCount: connection.importedCount,
        lastImport: connection.lastImport,
        languageHints,
        totalItems: platformHistory.length
      }
    });
  } catch (error) {
    console.error('❌ Error getting import status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get import status'
    });
  }
});

/**
 * POST /api/integrations/disconnect
 * Disconnect from a platform
 */
router.post('/disconnect', authenticateToken, (req, res) => {
  try {
    const { platform } = req.body;
    const userId = req.user.id;

    if (!platform || typeof platform !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Platform is required'
      });
    }

    const userConnections = userIntegrations.get(userId) || {};
    
    if (!userConnections[platform]) {
      return res.status(400).json({
        success: false,
        error: 'Platform not connected'
      });
    }

    // Remove connection but keep imported history for potential reconnection
    delete userConnections[platform];
    userIntegrations.set(userId, userConnections);

    console.log(`🔌 User ${userId} disconnected from ${platform}`);

    res.json({
      success: true,
      data: {
        platform,
        status: 'disconnected',
        message: `Successfully disconnected from ${SUPPORTED_PLATFORMS[platform]?.displayName || platform}`
      }
    });
  } catch (error) {
    console.error('❌ Error disconnecting platform:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not disconnect from platform'
    });
  }
});

/**
 * Helper function to get user's imported content for a platform
 */
function getUserImportedContent(userId, platform) {
  const userHistory = importHistory.get(userId) || {};
  return userHistory[platform] || [];
}

/**
 * Helper function to get all user's imported content
 */
function getAllUserContent(userId) {
  const userHistory = importHistory.get(userId) || {};
  const allContent = [];
  
  Object.entries(userHistory).forEach(([platform, content]) => {
    allContent.push(...content);
  });

  return allContent;
}

module.exports = {
  router,
  getUserImportedContent,
  getAllUserContent,
  SUPPORTED_PLATFORMS
};