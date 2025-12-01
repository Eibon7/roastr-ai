/**
 * SSOT Settings Loader
 * 
 * Centralized module for loading configuration from Single Sources of Truth.
 * 
 * Priority:
 * 1. admin_settings (Supabase) - Runtime, dinámico
 * 2. admin-controlled.yaml - Build-time, estático
 * 
 * @module loadSettings
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

/**
 * Cache for loaded settings to avoid repeated file reads and DB queries
 */
let settingsCache: Record<string, any> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Supabase client instance (lazy-loaded)
 */
let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 * @private
 */
function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_KEY are required for loadSettings. ' +
      'This module requires admin privileges to read admin_settings.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}

/**
 * Reset Supabase client (for testing)
 * @internal
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}

/**
 * Load static configuration from admin-controlled.yaml
 * @private
 */
function loadYamlConfig(): Record<string, any> {
  // Use import.meta.url for ESM module resolution
  let configPath: string;
  try {
    const currentDir = path.dirname(new URL(import.meta.url).pathname);
    configPath = path.join(currentDir, '../config/admin-controlled.yaml');
  } catch {
    // Fallback for test environments
    configPath = path.join(process.cwd(), 'src/config/admin-controlled.yaml');
  }
  
  if (!fs.existsSync(configPath)) {
    console.warn(`Warning: admin-controlled.yaml not found at ${configPath}`);
    return {};
  }

  try {
    const fileContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.parse(fileContent);
    return config || {};
  } catch (error) {
    console.error(`Error loading admin-controlled.yaml: ${error}`);
    return {};
  }
}

/**
 * Load dynamic configuration from admin_settings table
 * @private
 */
async function loadDatabaseSettings(): Promise<Record<string, any>> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('key, value')
      .order('key');

    if (error) {
      // If table doesn't exist yet, return empty object (graceful degradation)
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.warn('Warning: admin_settings table does not exist yet. Using YAML only.');
        return {};
      }
      throw error;
    }

    // Convert array of {key, value} to nested object
    const settings: Record<string, any> = {};
    
    if (data) {
      for (const row of data) {
        const keys = row.key.split('.');
        let current = settings;
        
        // Build nested object structure
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!current[key]) {
            current[key] = {};
          }
          current = current[key];
        }
        
        // Set final value
        current[keys[keys.length - 1]] = row.value;
      }
    }

    return settings;
  } catch (error) {
    console.error(`Error loading admin_settings: ${error}`);
    // Graceful degradation: return empty object if DB fails
    return {};
  }
}

/**
 * Deep merge two objects (database settings override YAML)
 * @private
 */
function deepMerge(target: any, source: any): any {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

/**
 * Check if value is a plain object
 * @private
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Load all settings from SSOT sources
 * 
 * Combines YAML (static) and database (dynamic) settings.
 * Database settings override YAML settings.
 * 
 * @param {boolean} forceRefresh - Force reload from sources (bypass cache)
 * @returns {Promise<Record<string, any>>} Combined settings object
 * 
 * @example
 * const settings = await loadSettings();
 * const aggressiveness = settings.shield?.default_aggressiveness;
 */
export async function loadSettings(forceRefresh = false): Promise<Record<string, any>> {
  const now = Date.now();

  // Return cached settings if valid and not forcing refresh
  if (!forceRefresh && settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return settingsCache;
  }

  // Load from both sources
  const yamlConfig = loadYamlConfig();
  const dbSettings = await loadDatabaseSettings();

  // Merge: database settings override YAML
  const combined = deepMerge(yamlConfig, dbSettings);

  // Update cache
  settingsCache = combined;
  cacheTimestamp = now;

  return combined;
}

/**
 * Load settings for a specific namespace
 * 
 * @param {string} namespace - Namespace to load (e.g., 'shield', 'analysis')
 * @param {boolean} forceRefresh - Force reload from sources
 * @returns {Promise<Record<string, any>>} Settings for the namespace
 * 
 * @example
 * const shieldSettings = await loadSettings('shield');
 * const threshold = shieldSettings.thresholds?.critical;
 */
export async function loadSettingsNamespace(
  namespace: string,
  forceRefresh = false
): Promise<Record<string, any>> {
  const allSettings = await loadSettings(forceRefresh);
  return allSettings[namespace] || {};
}

/**
 * Get a specific setting value by key path
 * 
 * @param {string} keyPath - Dot-separated key path (e.g., 'shield.default_aggressiveness')
 * @param {any} defaultValue - Default value if key doesn't exist
 * @param {boolean} forceRefresh - Force reload from sources
 * @returns {Promise<any>} Setting value or default
 * 
 * @example
 * const aggressiveness = await getSetting('shield.default_aggressiveness', 0.95);
 */
export async function getSetting(
  keyPath: string,
  defaultValue: any = undefined,
  forceRefresh = false
): Promise<any> {
  const allSettings = await loadSettings(forceRefresh);
  const keys = keyPath.split('.');
  
  let current: any = allSettings;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }
  
  return current !== undefined ? current : defaultValue;
}

/**
 * Clear settings cache (useful for testing or after updates)
 */
export function clearCache(): void {
  settingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Get public settings (safe to expose to frontend)
 * 
 * Filters out internal/security settings and returns only public values.
 * 
 * @returns {Promise<Record<string, any>>} Public settings object
 * 
 * @example
 * const publicSettings = await getPublicSettings();
 * // Returns: { plans: {...}, platforms: {...}, roasting: { supported_tones: [...] } }
 */
export async function getPublicSettings(): Promise<Record<string, any>> {
  const allSettings = await loadSettings();
  
  // Define which namespaces/keys are safe to expose
  const publicNamespaces = ['plans', 'platforms', 'roasting', 'response_frequency'];
  const publicSettings: Record<string, any> = {};

  for (const namespace of publicNamespaces) {
    if (allSettings[namespace]) {
      publicSettings[namespace] = allSettings[namespace];
    }
  }

  // Filter out sensitive fields from public namespaces
  if (publicSettings.plans) {
    // Only expose limits and features, not internal config
    const filteredPlans: Record<string, any> = {};
    for (const [planName, planData] of Object.entries(publicSettings.plans)) {
      if (typeof planData === 'object' && planData !== null) {
        filteredPlans[planName] = {
          monthly_limit: (planData as any).monthly_limit,
          features: (planData as any).features,
        };
      }
    }
    publicSettings.plans = filteredPlans;
  }

  return publicSettings;
}

