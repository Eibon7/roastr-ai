const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { hasFeatureAccess } = require('./plan');
const { getAllUserContent, getUserImportedContent } = require('./integrations-new');
const StyleProfileGenerator = require('../services/styleProfileGenerator');
const { flags } = require('../config/flags');

// Mock storage for user style profiles
const userStyleProfiles = new Map(); // userId -> profileData

// Initialize style profile generator
const profileGenerator = new StyleProfileGenerator();

/**
 * GET /api/style-profile/status
 * Check if style profile feature is available for user
 */
router.get('/status', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const featureEnabled = flags.isEnabled('ENABLE_STYLE_PROFILE');
    const hasAccess = hasFeatureAccess(userId, 'styleProfile');
    const existingProfile = userStyleProfiles.get(userId);

    res.json({
      success: true,
      data: {
        featureEnabled,
        hasAccess,
        available: featureEnabled && hasAccess,
        hasExistingProfile: !!existingProfile,
        profileCount: existingProfile ? existingProfile.profiles.length : 0,
        lastGenerated: existingProfile ? existingProfile.createdAt : null
      }
    });
  } catch (error) {
    console.error('❌ Error getting style profile status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get style profile status'
    });
  }
});

/**
 * GET /api/style-profile
 * Get user's current style profile
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const hasAccess = hasFeatureAccess(userId, 'styleProfile');

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Style Profile feature requires Creator+ plan',
        upgrade: true
      });
    }

    const profile = userStyleProfiles.get(userId);

    if (!profile) {
      return res.json({
        success: true,
        data: {
          available: false,
          message: 'No style profile generated yet'
        }
      });
    }

    res.json({
      success: true,
      data: {
        available: true,
        profiles: profile.profiles,
        totalItems: profile.totalItems,
        sources: profile.sources,
        createdAt: profile.createdAt,
        stats: profileGenerator.getProfileStats(profile.profiles)
      }
    });
  } catch (error) {
    console.error('❌ Error getting style profile:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get style profile'
    });
  }
});

/**
 * POST /api/style-profile/generate
 * Generate new style profile from user's imported content
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { platforms, maxItemsPerPlatform = 300 } = req.body;

    // Check feature access
    const hasAccess = hasFeatureAccess(userId, 'styleProfile');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Style Profile generation requires Creator+ plan',
        upgrade: true
      });
    }

    // Check if feature is enabled
    if (!flags.isEnabled('ENABLE_STYLE_PROFILE')) {
      return res.status(503).json({
        success: false,
        error: 'Style Profile feature is currently disabled'
      });
    }

    // Validate platforms
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one platform is required',
        example: { platforms: ['twitter', 'instagram'] }
      });
    }

    console.log(`🎨 Starting style profile generation for user ${userId}`);
    console.log(`📱 Platforms: ${platforms.join(', ')}`);

    // Collect content from specified platforms
    const contentByPlatform = {};
    let totalCollectedItems = 0;

    for (const platform of platforms) {
      const platformContent = getUserImportedContent(userId, platform);
      if (platformContent.length > 0) {
        contentByPlatform[platform] = platformContent;
        totalCollectedItems += platformContent.length;
        console.log(`📊 ${platform}: ${platformContent.length} items`);
      }
    }

    if (totalCollectedItems === 0) {
      return res.status(400).json({
        success: false,
        error:
          'No imported content found. Please connect and import from at least one platform first.',
        hint: 'Import at least 50 items from any platform to generate a style profile'
      });
    }

    // Check minimum content threshold
    const platformsWithEnoughContent = Object.entries(contentByPlatform).filter(
      ([platform, content]) => content.length >= 50
    );

    if (platformsWithEnoughContent.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient content for style profile generation',
        details: 'At least one platform needs 50+ imported items',
        currentCounts: Object.fromEntries(
          Object.entries(contentByPlatform).map(([platform, content]) => [platform, content.length])
        )
      });
    }

    // Generate style profile
    try {
      const profileData = await profileGenerator.generateStyleProfile(userId, contentByPlatform, {
        maxItemsPerPlatform
      });

      // Store the generated profile
      userStyleProfiles.set(userId, profileData);

      console.log(`✅ Style profile generated for user ${userId}`);
      console.log(`🌍 Languages: ${profileData.profiles.map((p) => p.lang).join(', ')}`);
      console.log(`📊 Total items analyzed: ${profileData.totalItems}`);

      res.json({
        success: true,
        data: {
          message: 'Style profile generated successfully',
          profiles: profileData.profiles,
          totalItems: profileData.totalItems,
          sources: profileData.sources,
          createdAt: profileData.createdAt,
          stats: profileGenerator.getProfileStats(profileData.profiles)
        }
      });
    } catch (generationError) {
      console.error('❌ Error generating style profile:', generationError.message);
      res.status(400).json({
        success: false,
        error: generationError.message,
        type: 'generation_error'
      });
    }
  } catch (error) {
    console.error('❌ Error in style profile generation endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not generate style profile'
    });
  }
});

/**
 * GET /api/style-profile/preview/:lang
 * Get preview of style profile for specific language
 */
router.get('/preview/:lang', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { lang } = req.params;

    const hasAccess = hasFeatureAccess(userId, 'styleProfile');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Style Profile feature requires Creator+ plan'
      });
    }

    const profile = userStyleProfiles.get(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'No style profile found'
      });
    }

    const languageProfile = profile.profiles.find((p) => p.lang === lang);
    if (!languageProfile) {
      return res.status(404).json({
        success: false,
        error: 'Language profile not found',
        availableLanguages: profile.profiles.map((p) => p.lang)
      });
    }

    res.json({
      success: true,
      data: {
        language: lang,
        profile: languageProfile,
        preview: {
          prompt: languageProfile.prompt,
          examples: languageProfile.examples,
          metadata: languageProfile.metadata,
          sources: languageProfile.sources
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting style profile preview:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get style profile preview'
    });
  }
});

/**
 * DELETE /api/style-profile
 * Delete user's style profile
 */
router.delete('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const hasAccess = hasFeatureAccess(userId, 'styleProfile');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Style Profile feature requires Creator+ plan'
      });
    }

    const existingProfile = userStyleProfiles.get(userId);
    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        error: 'No style profile found to delete'
      });
    }

    userStyleProfiles.delete(userId);
    console.log(`🗑️ Deleted style profile for user ${userId}`);

    res.json({
      success: true,
      data: {
        message: 'Style profile deleted successfully'
      }
    });
  } catch (error) {
    console.error('❌ Error deleting style profile:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not delete style profile'
    });
  }
});

/**
 * GET /api/style-profile/stats
 * Get style profile generation statistics
 */
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const hasAccess = hasFeatureAccess(userId, 'styleProfile');

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Style Profile feature requires Creator+ plan'
      });
    }

    const profile = userStyleProfiles.get(userId);
    if (!profile) {
      return res.json({
        success: true,
        data: {
          hasProfile: false,
          message: 'No style profile generated yet'
        }
      });
    }

    const stats = profileGenerator.getProfileStats(profile.profiles);

    res.json({
      success: true,
      data: {
        hasProfile: true,
        ...stats,
        totalProfiles: profile.profiles.length,
        generatedAt: profile.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error getting style profile stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Could not get style profile stats'
    });
  }
});

module.exports = router;
