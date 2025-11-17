/**
 * Level Configuration Service (Issue #597)
 * Manages roast levels (1-5) and shield levels (1-5) with plan-based validation
 */

const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');

/**
 * Plan-based level restrictions
 * Starter Trial/Starter: Levels 1-3
 * Pro: Levels 1-4
 * Plus: All levels 1-5
 */
const PLAN_LEVEL_LIMITS = {
  starter_trial: { maxRoastLevel: 3, maxShieldLevel: 3 },
  starter: { maxRoastLevel: 3, maxShieldLevel: 3 },
  pro: { maxRoastLevel: 4, maxShieldLevel: 4 },
  plus: { maxRoastLevel: 5, maxShieldLevel: 5 }
};

/**
 * Roast level definitions
 */
const ROAST_LEVELS = {
  1: {
    name: 'Mild',
    description: 'Light sarcasm, no profanity, gentle humor',
    temperature: 0.6,
    allowProfanity: false,
    maxLength: 150,
    intensityMultiplier: 0.5
  },
  2: {
    name: 'Neutral',
    description: 'Balanced approach, no profanity, moderate sarcasm',
    temperature: 0.7,
    allowProfanity: false,
    maxLength: 200,
    intensityMultiplier: 0.7
  },
  3: {
    name: 'Moderate',
    description: 'Intense sarcasm, profanity allowed, strong humor',
    temperature: 0.8,
    allowProfanity: true,
    maxLength: 250,
    intensityMultiplier: 0.9
  },
  4: {
    name: 'Aggressive',
    description: 'Very intense, strong language, cutting sarcasm',
    temperature: 0.9,
    allowProfanity: true,
    maxLength: 280,
    intensityMultiplier: 1.1
  },
  5: {
    name: 'Caustic',
    description: 'Maximum intensity, no restrictions, brutal honesty',
    temperature: 1.0,
    allowProfanity: true,
    maxLength: 280,
    intensityMultiplier: 1.3
  }
};

/**
 * Shield level definitions
 */
const SHIELD_LEVELS = {
  1: {
    name: 'Tolerant',
    description: 'Blocks only highly toxic content',
    threshold: 0.85,
    autoActions: false
  },
  2: {
    name: 'Balanced-Tolerant',
    description: 'Balanced with tolerant bias',
    threshold: 0.78,
    autoActions: false
  },
  3: {
    name: 'Balanced',
    description: 'Standard moderation',
    threshold: 0.70,
    autoActions: true
  },
  4: {
    name: 'Balanced-Strict',
    description: 'Balanced with strict bias',
    threshold: 0.60,
    autoActions: true
  },
  5: {
    name: 'Strict',
    description: 'Blocks most potentially harmful content',
    threshold: 0.50,
    autoActions: true
  }
};

class LevelConfigService {
  /**
   * Get roast level configuration
   * @param {number} level - Level (1-5)
   * @returns {Object} Level configuration
   */
  getRoastLevelConfig(level) {
    if (level < 1 || level > 5) {
      throw new Error(`Invalid roast level: ${level}. Must be between 1 and 5.`);
    }
    return ROAST_LEVELS[level];
  }

  /**
   * Get shield level configuration
   * @param {number} level - Level (1-5)
   * @returns {Object} Level configuration
   */
  getShieldLevelConfig(level) {
    if (level < 1 || level > 5) {
      throw new Error(`Invalid shield level: ${level}. Must be between 1 and 5.`);
    }
    return SHIELD_LEVELS[level];
  }

  /**
   * Validate level access based on user plan
   * @param {string} userId - User ID
   * @param {number} roastLevel - Requested roast level
   * @param {number} shieldLevel - Requested shield level
   * @returns {Promise<Object>} Validation result with allowed/reason
   */
  async validateLevelAccess(userId, roastLevel, shieldLevel) {
    try {
      // Issue #734: Validate level bounds first (1-5 range)
      if (roastLevel && (roastLevel < 1 || roastLevel > 5)) {
        return {
          allowed: false,
          reason: 'invalid_roast_level',
          message: `Roast level must be between 1 and 5 (received: ${roastLevel})`
        };
      }

      if (shieldLevel && (shieldLevel < 1 || shieldLevel > 5)) {
        return {
          allowed: false,
          reason: 'invalid_shield_level',
          message: `Shield level must be between 1 and 5 (received: ${shieldLevel})`
        };
      }

      // Get user's plan
      const { data: userData, error } = await supabaseServiceClient
        .from('users')
        .select('plan')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      const userPlan = userData.plan || 'starter_trial';
      const planLimits = PLAN_LEVEL_LIMITS[userPlan] || PLAN_LEVEL_LIMITS.starter_trial;

      // Validate roast level against plan limits
      if (roastLevel && roastLevel > planLimits.maxRoastLevel) {
        return {
          allowed: false,
          reason: 'roast_level_exceeds_plan',
          message: `Roast level ${roastLevel} requires ${this.getRequiredPlanForLevel(roastLevel, 'roast')} plan or higher. Current plan: ${userPlan}`,
          maxAllowedRoastLevel: planLimits.maxRoastLevel,
          currentPlan: userPlan
        };
      }

      // Validate shield level
      if (shieldLevel && shieldLevel > planLimits.maxShieldLevel) {
        return {
          allowed: false,
          reason: 'shield_level_exceeds_plan',
          message: `Shield level ${shieldLevel} requires ${this.getRequiredPlanForLevel(shieldLevel, 'shield')} plan or higher. Current plan: ${userPlan}`,
          maxAllowedShieldLevel: planLimits.maxShieldLevel,
          currentPlan: userPlan
        };
      }

      return {
        allowed: true,
        currentPlan: userPlan,
        maxAllowedRoastLevel: planLimits.maxRoastLevel,
        maxAllowedShieldLevel: planLimits.maxShieldLevel
      };

    } catch (error) {
      logger.error('Error validating level access:', error);
      throw error;
    }
  }

  /**
   * Get required plan for a specific level
   * @param {number} level - Level
   * @param {string} type - 'roast' or 'shield'
   * @returns {string} Required plan name
   */
  getRequiredPlanForLevel(level, type) {
    // Issue #734: Starter Trial/Starter plans support levels 1-3
    if (level <= 3) return 'starter_trial';
    if (level === 4) return 'pro';
    if (level === 5) return 'plus';
    return 'starter_trial';
  }

  /**
   * Get all available roast levels
   * @returns {Object} All roast level configurations
   */
  getAllRoastLevels() {
    return ROAST_LEVELS;
  }

  /**
   * Get all available shield levels
   * @returns {Object} All shield level configurations
   */
  getAllShieldLevels() {
    return SHIELD_LEVELS;
  }

  /**
   * Get plan-specific level limits
   * @param {string} plan - Plan name
   * @returns {Object} Plan level limits
   */
  getPlanLevelLimits(plan) {
    return PLAN_LEVEL_LIMITS[plan] || PLAN_LEVEL_LIMITS.starter_trial;
  }

  /**
   * Get available levels for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Available levels for user
   */
  async getAvailableLevelsForUser(userId) {
    try {
      const { data: userData, error } = await supabaseServiceClient
        .from('users')
        .select('plan')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      const userPlan = userData.plan || 'starter_trial';
      const planLimits = PLAN_LEVEL_LIMITS[userPlan] || PLAN_LEVEL_LIMITS.starter_trial;

      // Get available roast levels
      const availableRoastLevels = {};
      for (let i = 1; i <= planLimits.maxRoastLevel; i++) {
        availableRoastLevels[i] = ROAST_LEVELS[i];
      }

      // Get available shield levels
      const availableShieldLevels = {};
      for (let i = 1; i <= planLimits.maxShieldLevel; i++) {
        availableShieldLevels[i] = SHIELD_LEVELS[i];
      }

      return {
        plan: userPlan,
        roast: {
          maxLevel: planLimits.maxRoastLevel,
          available: availableRoastLevels
        },
        shield: {
          maxLevel: planLimits.maxShieldLevel,
          available: availableShieldLevels
        }
      };

    } catch (error) {
      logger.error('Error getting available levels for user:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new LevelConfigService();
