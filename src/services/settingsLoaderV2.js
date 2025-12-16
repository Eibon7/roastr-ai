/**
 * Settings Loader v2
 * 
 * Loads settings from admin_settings (DB) and admin-controlled.yaml (static)
 * with priority: admin_settings > admin-controlled.yaml
 * 
 * Issue: ROA-267 - Refactor SSOT endpoints to use SettingsLoader v2
 * 
 * Rules:
 * - NO hardcoded values
 * - NO derivation (only projection)
 * - Cache allowed, derivation NOT allowed
 * - Changes in SSOT must reflect without redeploy
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');

class SettingsLoaderV2 {
  constructor() {
    this.cache = {
      static: null,
      dynamic: null,
      merged: null,
      lastLoad: null
    };
    this.cacheTTL = 60000; // 1 minute cache TTL
    // Try multiple possible paths for admin-controlled.yaml
    const possiblePaths = [
      path.join(__dirname, '../../apps/backend-v2/src/config/admin-controlled.yaml'),
      path.join(__dirname, '../../config/admin-controlled.yaml'),
      path.join(process.cwd(), 'apps/backend-v2/src/config/admin-controlled.yaml'),
      path.join(process.cwd(), 'config/admin-controlled.yaml')
    ];
    
    // Find first existing path
    this.yamlPath = possiblePaths.find(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || possiblePaths[0]; // Fallback to first path if none exist
  }

  /**
   * Load static configuration from admin-controlled.yaml
   * @returns {Object} Static configuration
   */
  loadStaticConfig() {
    try {
      if (this.cache.static && Date.now() - this.cache.lastLoad < this.cacheTTL) {
        return this.cache.static;
      }

      if (!fs.existsSync(this.yamlPath)) {
        logger.warn('admin-controlled.yaml not found, using empty config');
        this.cache.static = {};
        this.cache.lastLoad = Date.now();
        return {};
      }

      const fileContent = fs.readFileSync(this.yamlPath, 'utf8');
      const config = yaml.load(fileContent) || {};
      
      this.cache.static = config;
      this.cache.lastLoad = Date.now();
      
      return config;
    } catch (error) {
      logger.error('Error loading static config:', error);
      return {};
    }
  }

  /**
   * Load dynamic configuration from admin_settings table
   * @returns {Promise<Object>} Dynamic configuration as nested object
   */
  async loadDynamicConfig() {
    try {
      if (this.cache.dynamic && Date.now() - this.cache.lastLoad < this.cacheTTL) {
        return this.cache.dynamic;
      }

      const { data, error } = await supabaseServiceClient
        .from('admin_settings')
        .select('key, value');

      if (error) {
        logger.error('Error loading dynamic config:', error);
        this.cache.dynamic = {};
        return {};
      }

      // Convert flat key-value pairs to nested object
      // e.g., "shield.thresholds.critical" => { shield: { thresholds: { critical: value } } }
      const dynamic = {};
      
      if (data) {
        for (const row of data) {
          const keys = row.key.split('.');
          let current = dynamic;
          
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          
          current[keys[keys.length - 1]] = row.value;
        }
      }

      this.cache.dynamic = dynamic;
      this.cache.lastLoad = Date.now();
      
      return dynamic;
    } catch (error) {
      logger.error('Error loading dynamic config:', error);
      return {};
    }
  }

  /**
   * Merge static and dynamic config with priority: dynamic > static
   * @param {Object} staticConfig - Static configuration
   * @param {Object} dynamicConfig - Dynamic configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigs(staticConfig, dynamicConfig) {
    const merged = JSON.parse(JSON.stringify(staticConfig)); // Deep clone static

    // Deep merge: dynamic overrides static
    function deepMerge(target, source) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            target[key] = {};
          }
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }

    deepMerge(merged, dynamicConfig);
    return merged;
  }

  /**
   * Get merged configuration (static + dynamic)
   * @returns {Promise<Object>} Merged configuration
   */
  async getMergedConfig() {
    try {
      if (this.cache.merged && Date.now() - this.cache.lastLoad < this.cacheTTL) {
        return this.cache.merged;
      }

      const staticConfig = this.loadStaticConfig();
      const dynamicConfig = await this.loadDynamicConfig();
      const merged = this.mergeConfigs(staticConfig, dynamicConfig);

      this.cache.merged = merged;
      return merged;
    } catch (error) {
      logger.error('Error getting merged config:', error);
      throw error;
    }
  }

  /**
   * Get value by dot-separated key path
   * @param {string} keyPath - Dot-separated key path (e.g., "shield.thresholds.critical")
   * @returns {Promise<any>} Value at key path
   */
  async getValue(keyPath) {
    const config = await this.getMergedConfig();
    const keys = keyPath.split('.');
    let current = config;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Invalidate cache (force reload on next request)
   */
  invalidateCache() {
    this.cache = {
      static: null,
      dynamic: null,
      merged: null,
      lastLoad: null
    };
  }
}

// Export singleton instance
const settingsLoader = new SettingsLoaderV2();
module.exports = settingsLoader;

