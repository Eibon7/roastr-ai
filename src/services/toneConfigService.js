/**
 * Tone Configuration Service
 *
 * Manages dynamic roast tone configuration from database.
 * Provides caching and localization for tone definitions.
 *
 * Issue #876: Dynamic Roast Tone Configuration System
 */

const { supabaseServiceClient } = require('../config/supabase');
const { logger } = require('../utils/logger');

class ToneConfigService {
  constructor() {
    this.cache = null;
    this.cacheExpiry = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutos

    logger.info('ToneConfigService initialized');
  }

  /**
   * Get all active tones with localization
   * @param {string} language - Language code (es, en)
   * @returns {Promise<Array>} Array of localized tone objects
   */
  async getActiveTones(language = 'es') {
    try {
      // Check cache
      if (this.cache && Date.now() < this.cacheExpiry) {
        logger.debug('Returning cached active tones', { language, cacheHit: true });
        return this.localizeArray(this.cache, language);
      }

      logger.info('Fetching active tones from database', { language });

      // Fetch from database
      const { data, error } = await supabaseServiceClient
        .from('roast_tones')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        logger.error('Error fetching active tones', { error: error.message });
        throw new Error(`Failed to fetch active tones: ${error.message}`);
      }

      if (!data || data.length === 0) {
        logger.warn('No active tones found in database');
        throw new Error('No active tones available. At least one tone must be active.');
      }

      // Update cache
      this.cache = data;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      logger.info('Active tones cached', {
        count: data.length,
        ttl: this.CACHE_TTL,
        cacheExpiry: new Date(this.cacheExpiry).toISOString()
      });

      return this.localizeArray(data, language);
    } catch (error) {
      logger.error('Error in getActiveTones', { error: error.message, language });
      throw error;
    }
  }

  /**
   * Get all tones (active + inactive) - Admin only
   * @returns {Promise<Array>} Array of all tone objects
   */
  async getAllTones() {
    try {
      logger.info('Fetching all tones (admin)');

      const { data, error } = await supabaseServiceClient
        .from('roast_tones')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        logger.error('Error fetching all tones', { error: error.message });
        throw new Error(`Failed to fetch tones: ${error.message}`);
      }

      logger.info('All tones fetched', { count: data.length });
      return data;
    } catch (error) {
      logger.error('Error in getAllTones', { error: error.message });
      throw error;
    }
  }

  /**
   * Get tone by ID
   * @param {string} id - Tone UUID
   * @returns {Promise<Object>} Tone object
   */
  async getToneById(id) {
    try {
      logger.info('Fetching tone by ID', { id });

      const { data, error } = await supabaseServiceClient
        .from('roast_tones')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.warn('Tone not found', { id });
          throw new Error(`Tone with ID ${id} not found`);
        }
        logger.error('Error fetching tone', { id, error: error.message });
        throw new Error(`Failed to fetch tone: ${error.message}`);
      }

      logger.info('Tone fetched successfully', { id, name: data.name });
      return data;
    } catch (error) {
      logger.error('Error in getToneById', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Create new tone
   * @param {Object} toneData - Tone configuration
   * @returns {Promise<Object>} Created tone object
   */
  async createTone(toneData) {
    try {
      logger.info('Creating new tone', { name: toneData.name });

      // Validate required fields
      this.validateToneData(toneData);

      const { data, error } = await supabaseServiceClient
        .from('roast_tones')
        .insert(toneData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique violation
          logger.warn('Tone name already exists', { name: toneData.name });
          throw new Error(`Tone with name "${toneData.name}" already exists`);
        }
        logger.error('Error creating tone', { error: error.message });
        throw new Error(`Failed to create tone: ${error.message}`);
      }

      // Invalidate cache
      this.invalidateCache();

      logger.info('Tone created successfully', {
        id: data.id,
        name: data.name,
        intensity: data.intensity
      });

      return data;
    } catch (error) {
      logger.error('Error in createTone', { error: error.message });
      throw error;
    }
  }

  /**
   * Update existing tone
   * @param {string} id - Tone UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated tone object
   */
  async updateTone(id, updates) {
    try {
      logger.info('Updating tone', { id, fields: Object.keys(updates) });

      // Validate if present
      if (updates.name || updates.display_name || updates.intensity) {
        this.validateToneData({ ...updates, name: updates.name || 'temp' }, true);
      }

      // Don't allow direct modification of created_at
      delete updates.created_at;

      const { data, error } = await supabaseServiceClient
        .from('roast_tones')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.warn('Tone not found for update', { id });
          throw new Error(`Tone with ID ${id} not found`);
        }
        if (error.code === '23505') {
          logger.warn('Tone name already exists', { name: updates.name });
          throw new Error(`Tone with name "${updates.name}" already exists`);
        }
        logger.error('Error updating tone', { id, error: error.message });
        throw new Error(`Failed to update tone: ${error.message}`);
      }

      // Invalidate cache
      this.invalidateCache();

      logger.info('Tone updated successfully', {
        id: data.id,
        name: data.name
      });

      return data;
    } catch (error) {
      logger.error('Error in updateTone', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete tone
   * @param {string} id - Tone UUID
   * @returns {Promise<void>}
   */
  async deleteTone(id) {
    try {
      logger.info('Deleting tone', { id });

      // Check if tone exists and is active
      const tone = await this.getToneById(id);

      if (tone.active) {
        // Check how many active tones exist
        const { data: activeTones } = await supabaseServiceClient
          .from('roast_tones')
          .select('id')
          .eq('active', true);

        if (activeTones.length <= 1) {
          logger.warn('Cannot delete last active tone', { id });
          throw new Error(
            'Cannot delete the last active tone. At least one tone must remain active.'
          );
        }
      }

      const { error } = await supabaseServiceClient.from('roast_tones').delete().eq('id', id);

      if (error) {
        logger.error('Error deleting tone', { id, error: error.message });
        throw new Error(`Failed to delete tone: ${error.message}`);
      }

      // Invalidate cache
      this.invalidateCache();

      logger.info('Tone deleted successfully', { id, name: tone.name });
    } catch (error) {
      logger.error('Error in deleteTone', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Activate tone
   * @param {string} id - Tone UUID
   * @returns {Promise<Object>} Updated tone object
   */
  async activateTone(id) {
    try {
      logger.info('Activating tone', { id });
      return await this.updateTone(id, { active: true });
    } catch (error) {
      logger.error('Error in activateTone', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Deactivate tone
   * @param {string} id - Tone UUID
   * @returns {Promise<Object>} Updated tone object
   */
  async deactivateTone(id) {
    try {
      logger.info('Deactivating tone', { id });

      // Check how many active tones exist
      const { data: activeTones } = await supabaseServiceClient
        .from('roast_tones')
        .select('id')
        .eq('active', true);

      if (activeTones.length <= 1 && activeTones[0].id === id) {
        logger.warn('Cannot deactivate last active tone', { id });
        throw new Error(
          'Cannot deactivate the last active tone. At least one tone must remain active.'
        );
      }

      return await this.updateTone(id, { active: false });
    } catch (error) {
      logger.error('Error in deactivateTone', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Reorder tones
   * @param {Array} orderArray - Array of {id, sort_order} objects
   * @returns {Promise<Array>} Updated tone objects
   */
  async reorderTones(orderArray) {
    try {
      logger.info('Reordering tones', { count: orderArray.length });

      const updates = [];

      for (const { id, sort_order } of orderArray) {
        const { data, error } = await supabaseServiceClient
          .from('roast_tones')
          .update({ sort_order })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          logger.error('Error reordering tone', { id, error: error.message });
          throw new Error(`Failed to reorder tone ${id}: ${error.message}`);
        }

        updates.push(data);
      }

      // Invalidate cache
      this.invalidateCache();

      logger.info('Tones reordered successfully', { count: updates.length });
      return updates;
    } catch (error) {
      logger.error('Error in reorderTones', { error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate cache
   */
  invalidateCache() {
    this.cache = null;
    this.cacheExpiry = null;
    logger.info('Tone cache invalidated');
  }

  /**
   * Localize array of tones
   * @param {Array} tones - Array of tone objects
   * @param {string} language - Language code (es, en)
   * @returns {Array} Localized tone objects
   */
  localizeArray(tones, language) {
    return tones.map((tone) => this.localizeTone(tone, language));
  }

  /**
   * Localize single tone
   * @param {Object} tone - Tone object
   * @param {string} language - Language code (es, en)
   * @returns {Object} Localized tone object
   */
  localizeTone(tone, language) {
    return {
      ...tone,
      display_name: tone.display_name[language] || tone.display_name.es || tone.display_name.en,
      description: tone.description[language] || tone.description.es || tone.description.en,
      examples: Array.isArray(tone.examples)
        ? tone.examples.map((ex) => {
            if (!ex || typeof ex !== 'object') return ex;
            return ex[language] || ex.es || ex.en || ex;
          })
        : []
    };
  }

  /**
   * Validate tone data
   * @param {Object} toneData - Tone configuration
   * @param {boolean} isPartial - Whether this is a partial update
   * @throws {Error} If validation fails
   */
  validateToneData(toneData, isPartial = false) {
    const errors = [];

    // Required fields for creation
    if (!isPartial) {
      if (!toneData.name) errors.push('name is required');
      if (!toneData.display_name) errors.push('display_name is required');
      if (!toneData.description) errors.push('description is required');
      if (toneData.intensity === undefined) errors.push('intensity is required');
      if (!toneData.personality) errors.push('personality is required');
      if (!toneData.resources) errors.push('resources is required');
      if (!toneData.restrictions) errors.push('restrictions is required');
      if (!toneData.examples) errors.push('examples is required');
    }

    // Field validations
    if (toneData.name && !/^[a-z0-9_-]+$/.test(toneData.name)) {
      errors.push('name must contain only lowercase letters, numbers, underscores and hyphens');
    }

    if (toneData.intensity !== undefined) {
      if (
        typeof toneData.intensity !== 'number' ||
        toneData.intensity < 1 ||
        toneData.intensity > 5
      ) {
        errors.push('intensity must be between 1 and 5');
      }
    }

    if (toneData.display_name && typeof toneData.display_name === 'object') {
      if (!toneData.display_name.es && !toneData.display_name.en) {
        errors.push('display_name must have at least ES or EN translation');
      }
    }

    if (toneData.description && typeof toneData.description === 'object') {
      if (!toneData.description.es && !toneData.description.en) {
        errors.push('description must have at least ES or EN translation');
      }
    }

    if (
      toneData.resources &&
      (!Array.isArray(toneData.resources) || toneData.resources.length === 0)
    ) {
      errors.push('resources must be a non-empty array');
    }

    if (
      toneData.restrictions &&
      (!Array.isArray(toneData.restrictions) || toneData.restrictions.length === 0)
    ) {
      errors.push('restrictions must be a non-empty array');
    }

    if (
      toneData.examples &&
      (!Array.isArray(toneData.examples) || toneData.examples.length === 0)
    ) {
      errors.push('examples must be a non-empty array');
    }

    // Validate examples structure (each must have ES or EN with input/output)
    if (Array.isArray(toneData.examples)) {
      toneData.examples.forEach((ex, index) => {
        if (!ex || typeof ex !== 'object') {
          errors.push(`examples[${index}] must be an object with ES/EN translations`);
        } else if (!ex.es && !ex.en) {
          errors.push(`examples[${index}] must have at least ES or EN translation`);
        } else {
          // Validate structure for present languages
          ['es', 'en'].forEach((lang) => {
            if (ex[lang]) {
              if (typeof ex[lang] !== 'object') {
                errors.push(`examples[${index}].${lang} must be an object with input/output`);
              } else if (!ex[lang].input || !ex[lang].output) {
                errors.push(`examples[${index}].${lang} must have both input and output fields`);
              }
            }
          });
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }
}

// Singleton instance
let toneConfigServiceInstance = null;

/**
 * Get ToneConfigService singleton instance
 * @returns {ToneConfigService}
 */
function getToneConfigService() {
  if (!toneConfigServiceInstance) {
    toneConfigServiceInstance = new ToneConfigService();
  }
  return toneConfigServiceInstance;
}

module.exports = {
  ToneConfigService,
  getToneConfigService
};
