/**
 * Sponsor Service - Brand Safety for Plus Plan
 *
 * Manages sponsor/brand configuration for content creator protection.
 * Allows Plus plan users to configure sponsors and automatically detect/protect
 * against negative comments that mention their sponsors.
 *
 * Features:
 * - CRUD operations for sponsor configuration
 * - AI-powered tag extraction from URLs (OpenAI GPT-4o)
 * - Multi-method sponsor detection (exact, tag, semantic)
 * - Priority-based matching for multiple sponsors
 * - Severity levels (low, medium, high, zero_tolerance)
 * - Custom tone overrides for defensive roasts
 *
 * @see docs/nodes/shield.md for Shield integration
 * @see docs/nodes/roast.md for Roast integration
 * @see docs/plan/issue-859.md for implementation details
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');
const OpenAI = require('openai');

class SponsorService {
  constructor() {
    this.initializeSupabase();
    this.initializeOpenAI();
    
    logger.info('SponsorService initialized', {
      hasSupabase: !!this.supabase,
      hasOpenAI: !!this.openai
    });
  }

  initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.warn('⚠️  Supabase credentials missing - SponsorService will not work');
      this.supabase = null;
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  initializeOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      logger.warn('⚠️  OPENAI_API_KEY not found - Tag extraction will not work');
      this.openai = null;
      return;
    }

    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Create a new sponsor configuration
   * @param {string} userId - User ID (owner)
   * @param {Object} sponsorData - Sponsor data
   * @param {string} sponsorData.name - Sponsor name (required)
   * @param {string} [sponsorData.url] - Sponsor website
   * @param {string[]} [sponsorData.tags] - Detection tags
   * @param {string} [sponsorData.severity] - low, medium, high, zero_tolerance
   * @param {string} [sponsorData.tone] - normal, professional, light_humor, aggressive_irony
   * @param {number} [sponsorData.priority] - 1 (high) to 5 (low)
   * @param {string[]} [sponsorData.actions] - Actions to apply
   * @returns {Promise<Object>} Created sponsor
   */
  async createSponsor(userId, sponsorData) {
    try {
      // Validate required fields
      if (!userId) {
        throw new Error('USER_ID_REQUIRED: userId is required');
      }
      
      if (!sponsorData.name || sponsorData.name.trim().length === 0) {
        throw new Error('SPONSOR_NAME_REQUIRED: Sponsor name is required');
      }

      // Sanitize inputs
      const sanitizedData = {
        user_id: userId,
        name: sponsorData.name.trim(),
        url: sponsorData.url ? this._sanitizeURL(sponsorData.url) : null,
        tags: Array.isArray(sponsorData.tags) ? sponsorData.tags : [],
        severity: sponsorData.severity || 'medium',
        tone: sponsorData.tone || 'normal',
        priority: sponsorData.priority || 'medium',
        actions: Array.isArray(sponsorData.actions) ? sponsorData.actions : [],
        active: true
      };

      const { data: sponsor, error } = await this.supabase
        .from('sponsors')
        .insert([sanitizedData])
        .select()
        .single();

      if (error) {
        logger.error('❌ Failed to create sponsor:', { error: error.message, userId });
        throw new Error(`DATABASE_ERROR: ${error.message}`);
      }

      logger.info('✅ Sponsor created', { sponsorId: sponsor.id, name: sponsor.name, userId });

      return sponsor;
    } catch (error) {
      logger.error('❌ Error in createSponsor:', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get sponsors for a user
   * @param {string} userId - User ID
   * @param {boolean} [includeInactive=false] - Include inactive sponsors
   * @returns {Promise<Array>} List of sponsors
   */
  async getSponsors(userId, includeInactive = false) {
    try {
      if (!userId) {
        throw new Error('USER_ID_REQUIRED: userId is required');
      }

      let query = this.supabase
        .from('sponsors')
        .select('*')
        .eq('user_id', userId);

      // Filter by active status if needed
      if (!includeInactive) {
        query = query.eq('active', true);
      }

      // Order by priority and created date
      query = query.order('priority', { ascending: false })
                   .order('created_at', { ascending: false });

      const { data: sponsors, error } = await query;

      if (error) {
        logger.error('❌ Failed to get sponsors:', { error: error.message, userId });
        throw new Error(`DATABASE_ERROR: ${error.message}`);
      }

      logger.info('✅ Sponsors retrieved', { userId, count: sponsors.length, includeInactive });

      return sponsors || [];
    } catch (error) {
      logger.error('❌ Error in getSponsors:', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get a single sponsor by ID
   * @param {string} sponsorId - Sponsor ID
   * @param {string} userId - User ID (for RLS)
   * @returns {Promise<Object|null>} Sponsor or null if not found
   */
  async getSponsorById(sponsorId, userId) {
    try {
      if (!sponsorId || !userId) {
        throw new Error('INVALID_PARAMS: sponsorId and userId are required');
      }

      const { data: sponsor, error } = await this.supabase
        .from('sponsors')
        .select('*')
        .eq('id', sponsorId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        logger.error('❌ Failed to get sponsor:', { error: error.message, sponsorId, userId });
        throw new Error(`DATABASE_ERROR: ${error.message}`);
      }

      return sponsor;
    } catch (error) {
      logger.error('❌ Error in getSponsorById:', { error: error.message, sponsorId, userId });
      throw error;
    }
  }

  /**
   * Update a sponsor
   * @param {string} sponsorId - Sponsor ID
   * @param {string} userId - User ID (for RLS)
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated sponsor
   */
  async updateSponsor(sponsorId, userId, updates) {
    try {
      if (!sponsorId || !userId) {
        throw new Error('INVALID_PARAMS: sponsorId and userId are required');
      }

      // Build update object (only allowed fields)
      const allowedFields = ['name', 'url', 'tags', 'severity', 'tone', 'priority', 'actions', 'active'];
      const sanitizedUpdates = {};

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          sanitizedUpdates[field] = updates[field];
        }
      }

      // Add updated_at
      sanitizedUpdates.updated_at = new Date().toISOString();

      const { data: sponsor, error } = await this.supabase
        .from('sponsors')
        .update(sanitizedUpdates)
        .eq('id', sponsorId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('❌ Failed to update sponsor:', { error: error.message, sponsorId, userId });
        throw new Error(`DATABASE_ERROR: ${error.message}`);
      }

      logger.info('✅ Sponsor updated', { sponsorId, userId, fields: Object.keys(sanitizedUpdates) });

      return sponsor;
    } catch (error) {
      logger.error('❌ Error in updateSponsor:', { error: error.message, sponsorId, userId });
      throw error;
    }
  }

  /**
   * Delete a sponsor
   * @param {string} sponsorId - Sponsor ID
   * @param {string} userId - User ID (for RLS)
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteSponsor(sponsorId, userId) {
    try {
      if (!sponsorId || !userId) {
        throw new Error('INVALID_PARAMS: sponsorId and userId are required');
      }

      const { error } = await this.supabase
        .from('sponsors')
        .delete()
        .eq('id', sponsorId)
        .eq('user_id', userId);

      if (error) {
        logger.error('❌ Failed to delete sponsor:', { error: error.message, sponsorId, userId });
        throw new Error(`DATABASE_ERROR: ${error.message}`);
      }

      logger.info('✅ Sponsor deleted', { sponsorId, userId });

      return true;
    } catch (error) {
      logger.error('❌ Error in deleteSponsor:', { error: error.message, sponsorId, userId });
      throw error;
    }
  }

  /**
   * Extract tags from sponsor URL using AI
   * @param {string} url - Sponsor URL
   * @returns {Promise<string[]>} Extracted tags
   */
  async extractTagsFromURL(url) {
    try {
      if (!url) {
        throw new Error('URL_REQUIRED: URL is required for tag extraction');
      }

      // Validate OpenAI availability
      if (!this.openai) {
        throw new Error('OPENAI_UNAVAILABLE: OpenAI API key not configured');
      }

      // Validate URL
      const validatedURL = this._sanitizeURL(url);
      if (!validatedURL) {
        throw new Error('INVALID_URL: URL must be a valid HTTP/HTTPS URL');
      }

      // Fetch HTML content
      logger.info('🌐 Fetching sponsor URL', { url: validatedURL });
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      let html;
      try {
        const response = await fetch(validatedURL, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Roastr.ai Bot (Brand Safety Tag Extraction)'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP_ERROR: ${response.status} ${response.statusText}`);
        }
        
        html = await response.text();
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('FETCH_TIMEOUT: URL fetch timeout after 10 seconds');
        }
        throw new Error(`FETCH_ERROR: ${fetchError.message}`);
      } finally {
        clearTimeout(timeout);
      }

      // Extract text content (basic cleanup)
      const text = html
        .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove scripts
        .replace(/<style[^>]*>.*?<\/style>/gis, '')   // Remove styles
        .replace(/<[^>]*>/g, ' ')                      // Remove HTML tags
        .replace(/\s+/g, ' ')                          // Normalize whitespace
        .substring(0, 5000);                           // Limit to 5000 chars

      // Call OpenAI for tag extraction
      logger.info('🤖 Calling OpenAI for tag extraction', { textLength: text.length });
      
      const prompt = `Extrae 3-6 tags/categorías que definan a esta marca o empresa.

Contenido del sitio web: ${text}

Responde SOLO con una lista de tags separados por comas, sin explicaciones.
Ejemplo: tecnología, software, inteligencia artificial, empresas, SaaS`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.3
      });

      const rawTags = completion.choices[0].message.content.trim();
      
      // Parse tags
      const tags = rawTags
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0 && tag.length <= 50)
        .slice(0, 10); // Max 10 tags

      logger.info('✅ Tags extracted', { url: validatedURL, count: tags.length, tags });

      return tags;
    } catch (error) {
      logger.error('❌ Error extracting tags from URL:', { error: error.message, url });
      throw error;
    }
  }

  /**
   * Detect if a comment mentions any user's sponsors
   * @param {string} commentText - Comment text to analyze
   * @param {Array<Object>} sponsors - User's active sponsors
   * @returns {Promise<Object>} { matched: boolean, sponsor?: Object, matchType?: string }
   */
  async detectSponsorMention(commentText, sponsors) {
    try {
      if (!commentText || typeof commentText !== 'string') {
        return { matched: false };
      }

      if (!Array.isArray(sponsors) || sponsors.length === 0) {
        return { matched: false };
      }

      const lowerComment = commentText.toLowerCase();

      // Check each sponsor
      for (const sponsor of sponsors) {
        // Skip inactive sponsors
        if (!sponsor.active) continue;

        // Check exact name match
        const lowerName = sponsor.name.toLowerCase();
        if (lowerComment.includes(lowerName)) {
          logger.info('🎯 Sponsor mention detected (exact)', { 
            sponsor: sponsor.name, 
            commentLength: commentText.length 
          });
          return { 
            matched: true, 
            sponsor: sponsor, 
            matchType: 'exact' 
          };
        }

        // Check tag-based match (optional)
        if (Array.isArray(sponsor.tags) && sponsor.tags.length > 0) {
          for (const tag of sponsor.tags) {
            const lowerTag = tag.toLowerCase();
            if (lowerComment.includes(lowerTag)) {
              logger.info('🎯 Sponsor mention detected (tag)', { 
                sponsor: sponsor.name, 
                tag: tag,
                commentLength: commentText.length 
              });
              return { 
                matched: true, 
                sponsor: sponsor, 
                matchType: 'tag' 
              };
            }
          }
        }
      }

      // No match found
      return { matched: false };
    } catch (error) {
      logger.error('❌ Error detecting sponsor mention:', { 
        error: error.message, 
        commentLength: commentText?.length 
      });
      return { matched: false };
    }
  }

  /**
   * Sanitize and validate URL
   * @param {string} url - URL to sanitize
   * @returns {string|null} Sanitized URL or null if invalid
   * @private
   */
  _sanitizeURL(url) {
    try {
      const parsedURL = new URL(url);
      
      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsedURL.protocol)) {
        return null;
      }

      return parsedURL.href;
    } catch (error) {
      // Invalid URL
      return null;
    }
  }
}

module.exports = SponsorService;
