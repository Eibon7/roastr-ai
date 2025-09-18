const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

/**
 * Shield Settings Service
 * 
 * Handles Shield configuration management for organizations and platforms.
 * Implements the business logic for Issue #362 - Shield Settings configuration.
 */
class ShieldSettingsService {
  constructor(config = {}) {
    this.supabase = config.supabase || createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    this.logger = config.logger || logger;
    
    // Aggressiveness level mappings
    this.aggressivenessLevels = {
      90: {
        name: 'Lenient',
        description: 'More tolerant approach, fewer interventions',
        tau_roast_lower: 0.30,
        tau_shield: 0.75,
        tau_critical: 0.95
      },
      95: {
        name: 'Balanced',
        description: 'Default balanced approach',
        tau_roast_lower: 0.25,
        tau_shield: 0.70,
        tau_critical: 0.90
      },
      98: {
        name: 'Strict',
        description: 'Stricter moderation, more interventions',
        tau_roast_lower: 0.20,
        tau_shield: 0.65,
        tau_critical: 0.85
      },
      100: {
        name: 'Maximum',
        description: 'Maximum protection, lowest tolerance',
        tau_roast_lower: 0.15,
        tau_shield: 0.60,
        tau_critical: 0.80
      }
    };
    
    this.logger.info('Shield Settings Service initialized');
  }
  
  /**
   * Get organization Shield settings
   */
  async getOrganizationSettings(organizationId) {
    try {
      const { data, error } = await this.supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not found error is OK
        throw error;
      }
      
      // Return default settings if none exist
      if (!data) {
        return this.getDefaultOrganizationSettings();
      }
      
      // Enrich with aggressiveness level details
      const enrichedSettings = {
        ...data,
        aggressiveness_details: this.aggressivenessLevels[data.aggressiveness] || this.aggressivenessLevels[95]
      };
      
      this.logger.debug('Retrieved organization settings', {
        organizationId,
        aggressiveness: data.aggressiveness
      });
      
      return enrichedSettings;
      
    } catch (error) {
      this.logger.error('Failed to get organization settings', {
        organizationId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Update organization Shield settings
   */
  async updateOrganizationSettings(organizationId, settings, userId) {
    try {
      // Validate settings
      this.validateOrganizationSettings(settings);
      
      const updateData = {
        aggressiveness: settings.aggressiveness,
        tau_roast_lower: settings.tau_roast_lower,
        tau_shield: settings.tau_shield,
        tau_critical: settings.tau_critical,
        shield_enabled: settings.shield_enabled,
        auto_approve_shield_actions: settings.auto_approve_shield_actions,
        corrective_messages_enabled: settings.corrective_messages_enabled,
        updated_by: userId,
        updated_at: new Date().toISOString()
      };
      
      // Upsert organization settings
      const { data, error } = await this.supabase
        .from('organization_settings')
        .upsert({
          organization_id: organizationId,
          created_by: userId,
          ...updateData
        }, {
          onConflict: 'organization_id'
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.logger.info('Updated organization settings', {
        organizationId,
        userId,
        aggressiveness: settings.aggressiveness,
        shield_enabled: settings.shield_enabled
      });
      
      return {
        ...data,
        aggressiveness_details: this.aggressivenessLevels[data.aggressiveness]
      };
      
    } catch (error) {
      this.logger.error('Failed to update organization settings', {
        organizationId,
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get platform-specific Shield settings
   */
  async getPlatformSettings(organizationId, platform) {
    try {
      const { data, error } = await this.supabase
        .from('platform_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not found error is OK
        throw error;
      }
      
      this.logger.debug('Retrieved platform settings', {
        organizationId,
        platform,
        hasSettings: !!data
      });
      
      return data || null;
      
    } catch (error) {
      this.logger.error('Failed to get platform settings', {
        organizationId,
        platform,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Update platform-specific Shield settings
   */
  async updatePlatformSettings(organizationId, platform, settings, userId) {
    try {
      // Validate platform
      this.validatePlatform(platform);
      
      // Validate settings (nulls are allowed for inheritance)
      this.validatePlatformSettings(settings);
      
      const updateData = {
        aggressiveness: settings.aggressiveness,
        tau_roast_lower: settings.tau_roast_lower,
        tau_shield: settings.tau_shield,
        tau_critical: settings.tau_critical,
        shield_enabled: settings.shield_enabled,
        auto_approve_shield_actions: settings.auto_approve_shield_actions,
        corrective_messages_enabled: settings.corrective_messages_enabled,
        response_frequency: settings.response_frequency,
        trigger_words: settings.trigger_words,
        max_responses_per_hour: settings.max_responses_per_hour,
        updated_by: userId,
        updated_at: new Date().toISOString()
      };
      
      // Remove undefined values (keep nulls for inheritance)
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      // Upsert platform settings
      const { data, error } = await this.supabase
        .from('platform_settings')
        .upsert({
          organization_id: organizationId,
          platform,
          created_by: userId,
          ...updateData
        }, {
          onConflict: 'organization_id,platform'
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.logger.info('Updated platform settings', {
        organizationId,
        platform,
        userId,
        aggressiveness: settings.aggressiveness,
        hasOverrides: Object.values(updateData).some(val => val !== null && val !== undefined)
      });
      
      return data;
      
    } catch (error) {
      this.logger.error('Failed to update platform settings', {
        organizationId,
        platform,
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get effective settings for a platform (with inheritance)
   */
  async getEffectiveSettings(organizationId, platform) {
    try {
      // Use the database function for efficient inheritance logic
      const { data, error } = await this.supabase
        .rpc('get_effective_shield_settings', {
          org_id: organizationId,
          platform_name: platform
        });
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        // Fallback to default settings
        const defaultSettings = this.getDefaultOrganizationSettings();
        return {
          ...defaultSettings,
          response_frequency: 1.0,
          trigger_words: ['roast', 'burn', 'insult'],
          max_responses_per_hour: 50,
          source: 'default'
        };
      }
      
      const effectiveSettings = data[0];
      
      // Enrich with aggressiveness details
      effectiveSettings.aggressiveness_details = this.aggressivenessLevels[effectiveSettings.aggressiveness];
      effectiveSettings.source = 'database';
      
      this.logger.debug('Retrieved effective settings', {
        organizationId,
        platform,
        aggressiveness: effectiveSettings.aggressiveness,
        shield_enabled: effectiveSettings.shield_enabled
      });
      
      return effectiveSettings;
      
    } catch (error) {
      this.logger.error('Failed to get effective settings', {
        organizationId,
        platform,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get all platform settings for an organization
   */
  async getAllPlatformSettings(organizationId) {
    try {
      const { data, error } = await this.supabase
        .from('platform_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .order('platform');
      
      if (error) {
        throw error;
      }
      
      this.logger.debug('Retrieved all platform settings', {
        organizationId,
        platformCount: data.length
      });
      
      return data;
      
    } catch (error) {
      this.logger.error('Failed to get all platform settings', {
        organizationId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Delete platform settings (revert to organization defaults)
   */
  async deletePlatformSettings(organizationId, platform, userId) {
    try {
      const { data, error } = await this.supabase
        .from('platform_settings')
        .delete()
        .eq('organization_id', organizationId)
        .eq('platform', platform)
        .select();
      
      if (error) {
        throw error;
      }
      
      this.logger.info('Deleted platform settings', {
        organizationId,
        platform,
        userId,
        deleted: data.length > 0
      });
      
      return { success: true, deleted: data.length > 0 };
      
    } catch (error) {
      this.logger.error('Failed to delete platform settings', {
        organizationId,
        platform,
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get aggressiveness level options
   */
  getAggressivenessLevels() {
    return this.aggressivenessLevels;
  }
  
  /**
   * Get supported platforms
   */
  getSupportedPlatforms() {
    return [
      'twitter', 'youtube', 'bluesky', 'instagram', 'facebook',
      'discord', 'twitch', 'reddit', 'tiktok'
    ];
  }
  
  /**
   * Get default organization settings
   */
  getDefaultOrganizationSettings() {
    return {
      aggressiveness: 95,
      tau_roast_lower: 0.25,
      tau_shield: 0.70,
      tau_critical: 0.90,
      shield_enabled: true,
      auto_approve_shield_actions: false,
      corrective_messages_enabled: true,
      aggressiveness_details: this.aggressivenessLevels[95]
    };
  }
  
  /**
   * Validate organization settings
   */
  validateOrganizationSettings(settings) {
    const errors = [];
    
    // Validate aggressiveness
    if (settings.aggressiveness !== undefined) {
      if (![90, 95, 98, 100].includes(settings.aggressiveness)) {
        errors.push('Aggressiveness must be one of: 90, 95, 98, 100');
      }
    }
    
    // Validate threshold relationships
    if (settings.tau_roast_lower !== undefined && 
        settings.tau_shield !== undefined && 
        settings.tau_critical !== undefined) {
      
      const { tau_roast_lower, tau_shield, tau_critical } = settings;
      
      if (tau_roast_lower < 0 || tau_roast_lower > 1) {
        errors.push('tau_roast_lower must be between 0 and 1');
      }
      
      if (tau_shield < 0 || tau_shield > 1) {
        errors.push('tau_shield must be between 0 and 1');
      }
      
      if (tau_critical < 0 || tau_critical > 1) {
        errors.push('tau_critical must be between 0 and 1');
      }
      
      if (tau_roast_lower >= tau_shield) {
        errors.push('tau_roast_lower must be less than tau_shield');
      }
      
      if (tau_shield >= tau_critical) {
        errors.push('tau_shield must be less than tau_critical');
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }
  
  /**
   * Validate platform settings (nulls allowed for inheritance)
   */
  validatePlatformSettings(settings) {
    const errors = [];
    
    // Validate aggressiveness if provided
    if (settings.aggressiveness !== null && settings.aggressiveness !== undefined) {
      if (![90, 95, 98, 100].includes(settings.aggressiveness)) {
        errors.push('Aggressiveness must be one of: 90, 95, 98, 100');
      }
    }
    
    // Validate thresholds if all are provided
    const { tau_roast_lower, tau_shield, tau_critical } = settings;
    if (tau_roast_lower !== null && tau_shield !== null && tau_critical !== null &&
        tau_roast_lower !== undefined && tau_shield !== undefined && tau_critical !== undefined) {
      
      if (tau_roast_lower < 0 || tau_roast_lower > 1) {
        errors.push('tau_roast_lower must be between 0 and 1');
      }
      
      if (tau_shield < 0 || tau_shield > 1) {
        errors.push('tau_shield must be between 0 and 1');
      }
      
      if (tau_critical < 0 || tau_critical > 1) {
        errors.push('tau_critical must be between 0 and 1');
      }
      
      if (tau_roast_lower >= tau_shield) {
        errors.push('tau_roast_lower must be less than tau_shield');
      }
      
      if (tau_shield >= tau_critical) {
        errors.push('tau_shield must be less than tau_critical');
      }
    }
    
    // Validate response frequency
    if (settings.response_frequency !== null && settings.response_frequency !== undefined) {
      if (settings.response_frequency < 0 || settings.response_frequency > 1) {
        errors.push('response_frequency must be between 0 and 1');
      }
    }
    
    // Validate max responses per hour
    if (settings.max_responses_per_hour !== null && settings.max_responses_per_hour !== undefined) {
      if (settings.max_responses_per_hour <= 0 || !Number.isInteger(settings.max_responses_per_hour)) {
        errors.push('max_responses_per_hour must be a positive integer');
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }
  
  /**
   * Validate platform name
   */
  validatePlatform(platform) {
    const supportedPlatforms = this.getSupportedPlatforms();
    if (!supportedPlatforms.includes(platform)) {
      throw new Error(`Unsupported platform: ${platform}. Supported platforms: ${supportedPlatforms.join(', ')}`);
    }
  }
  
  /**
   * Convert aggressiveness to thresholds (for backward compatibility)
   */
  aggressivenessToThresholds(aggressiveness) {
    const level = this.aggressivenessLevels[aggressiveness];
    if (!level) {
      throw new Error(`Invalid aggressiveness level: ${aggressiveness}`);
    }
    
    return {
      tau_roast_lower: level.tau_roast_lower,
      tau_shield: level.tau_shield,
      tau_critical: level.tau_critical
    };
  }
  
  /**
   * Get settings summary for organization
   */
  async getSettingsSummary(organizationId) {
    try {
      const [orgSettings, platformSettings] = await Promise.all([
        this.getOrganizationSettings(organizationId),
        this.getAllPlatformSettings(organizationId)
      ]);
      
      const platformOverrides = platformSettings.reduce((acc, ps) => {
        acc[ps.platform] = {
          hasOverrides: [
            ps.aggressiveness,
            ps.tau_roast_lower,
            ps.tau_shield,
            ps.tau_critical,
            ps.shield_enabled,
            ps.auto_approve_shield_actions,
            ps.corrective_messages_enabled
          ].some(val => val !== null),
          aggressiveness: ps.aggressiveness,
          shield_enabled: ps.shield_enabled
        };
        return acc;
      }, {});
      
      return {
        organization: orgSettings,
        platforms: platformOverrides,
        summary: {
          shield_enabled: orgSettings.shield_enabled,
          aggressiveness_level: orgSettings.aggressiveness_details.name,
          platform_overrides: Object.keys(platformOverrides).length,
          active_overrides: Object.values(platformOverrides).filter(p => p.hasOverrides).length
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to get settings summary', {
        organizationId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = ShieldSettingsService;