/**
 * Sponsor Service (Brand Safety - Plan Plus)
 *
 * Manages sponsor/brand configuration for content moderation:
 * - CRUD operations for sponsor records
 * - Tag extraction from sponsor URLs using OpenAI
 * - Sponsor mention detection in comments (exact, tag, semantic)
 *
 * Features:
 * - Multi-tenant isolation (RLS policies)
 * - Configurable severity levels (low, medium, high, zero_tolerance)
 * - Configurable tone overrides (normal, professional, light_humor, aggressive_irony)
 * - Priority-based sponsor matching (1=highest, 5=lowest)
 * - Flexible action configuration (hide, ban, def_roast, agg_roast, report)
 *
 * @see docs/plan/issue-859.md
 * @see docs/nodes/shield.md (Brand Safety section)
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { logger } = require('../utils/logger');

class SponsorService {
  constructor() {
    this.supabase = null;
    this.openai = null;
    
    // Initialize Supabase with fail-fast validation (CodeRabbit fix)
    this.initializeSupabase();
    
    // Initialize OpenAI if configured
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  /**
   * Initialize Supabase client with fail-fast validation
   * @throws {Error} If Supabase credentials are missing
   * @private
   */
  initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    // CodeRabbit fix: Fail-fast if credentials missing
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_UNAVAILABLE: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables. ' +
        'Sponsor service requires Supabase for multi-tenant data storage.'
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('SponsorService: Supabase client initialized successfully');
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new sponsor
   * @param {string} userId - User ID (tenant)
   * @param {Object} sponsorData - Sponsor configuration
   * @param {string} sponsorData.name - Sponsor name (required)
   * @param {string} [sponsorData.url] - Sponsor website URL
   * @param {Array<string>} [sponsorData.tags] - Keywords/tags to detect
   * @param {string} [sponsorData.severity] - Severity level (low, medium, high, zero_tolerance)
   * @param {string} [sponsorData.tone] - Tone override (normal, professional, light_humor, aggressive_irony)
   * @param {number} [sponsorData.priority] - Priority 1 (high) to 5 (low), default 3
   * @param {Array<string>} [sponsorData.actions] - Actions to take (hide_comment, block_user, def_roast, etc.)
   * @returns {Promise<Object>} Created sponsor record
   * @throws {Error} If validation fails or database error occurs
   */
  async createSponsor(userId, sponsorData) {
    if (!userId) {
      throw new Error('USER_ID_REQUIRED');
    }

    if (!sponsorData || !sponsorData.name) {
      throw new Error('SPONSOR_NAME_REQUIRED');
    }

    // Sanitize inputs
    const sanitizedData = {
      user_id: userId,
      name: sponsorData.name.trim(),
      url: sponsorData.url ? this._sanitizeURL(sponsorData.url) : null,
      tags: Array.isArray(sponsorData.tags) ? sponsorData.tags : [],
      severity: sponsorData.severity || 'medium',
      tone: sponsorData.tone || 'normal',
      // CodeRabbit fix: Use numeric default and explicit null/undefined check
      priority:
        sponsorData.priority !== undefined && sponsorData.priority !== null
          ? Number(sponsorData.priority)
          : 3,
      actions: Array.isArray(sponsorData.actions) ? sponsorData.actions : [],
      active: true
    };

    // Validate priority range (1-5)
    if (sanitizedData.priority < 1 || sanitizedData.priority > 5) {
      throw new Error('INVALID_PRIORITY: Priority must be between 1 (highest) and 5 (lowest)');
    }

    const { data, error } = await this.supabase
      .from('sponsors')
      .insert([sanitizedData])
      .select()
      .single();

    if (error) {
      throw new Error(`DATABASE_ERROR: ${error.message}`);
    }

    logger.info('Sponsor created successfully', {
      userId,
      sponsorId: data.id,
      sponsorName: data.name
    });

    return data;
  }

  /**
   * Get sponsors for a user
   * @param {string} userId - User ID
   * @param {boolean} [includeInactive=false] - Include inactive sponsors
   * @returns {Promise<Array<Object>>} List of sponsors
   */
  async getSponsors(userId, includeInactive = false) {
    let query = this.supabase
      .from('sponsors')
      .select('*')
      .eq('user_id', userId);

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    // CodeRabbit fix: Sort by priority ascending (1=highest priority comes first)
    query = query
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`DATABASE_ERROR: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single sponsor by ID
   * @param {string} sponsorId - Sponsor ID
   * @param {string} userId - User ID (for RLS validation)
   * @returns {Promise<Object|null>} Sponsor record or null
   */
  async getSponsor(sponsorId, userId) {
    const { data, error } = await this.supabase
      .from('sponsors')
      .select('*')
      .eq('id', sponsorId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`DATABASE_ERROR: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a sponsor
   * @param {string} sponsorId - Sponsor ID
   * @param {string} userId - User ID (for RLS validation)
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated sponsor or null
   */
  async updateSponsor(sponsorId, userId, updates) {
    if (!sponsorId || !userId) {
      throw new Error('INVALID_PARAMS');
    }

    // Sanitize URL if being updated
    if (updates.url !== undefined) {
      updates.url = updates.url ? this._sanitizeURL(updates.url) : null;
    }

    // Validate priority if being updated
    if (updates.priority !== undefined) {
      updates.priority = Number(updates.priority);
      if (updates.priority < 1 || updates.priority > 5) {
        throw new Error('INVALID_PRIORITY: Priority must be between 1 and 5');
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('sponsors')
      .update(updates)
      .eq('id', sponsorId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`DATABASE_ERROR: ${error.message}`);
    }

    logger.info('Sponsor updated successfully', {
      userId,
      sponsorId,
      updatedFields: Object.keys(updates)
    });

    return data;
  }

  /**
   * Delete a sponsor
   * @param {string} sponsorId - Sponsor ID
   * @param {string} userId - User ID (for RLS validation)
   * @returns {Promise<boolean>} True if deleted
   * @throws {Error} If delete fails
   */
  async deleteSponsor(sponsorId, userId) {
    const { error } = await this.supabase
      .from('sponsors')
      .delete()
      .eq('id', sponsorId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`DATABASE_ERROR: ${error.message}`);
    }

    logger.info('Sponsor deleted successfully', {
      userId,
      sponsorId
    });

    return true;
  }

  // ============================================================================
  // TAG EXTRACTION (OpenAI-powered)
  // ============================================================================

  /**
   * Extract relevant tags from a sponsor URL using OpenAI
   * @param {string} url - Sponsor website URL
   * @returns {Promise<Array<string>>} Array of extracted tags (max 10)
   * @throws {Error} If URL invalid, fetch fails, or OpenAI unavailable
   */
  async extractTagsFromURL(url) {
    if (!url) {
      throw new Error('URL_REQUIRED');
    }

    if (!this.openai) {
      throw new Error('OPENAI_UNAVAILABLE: OpenAI API key not configured');
    }

    // Sanitize and validate URL
    const sanitizedUrl = this._sanitizeURL(url);
    if (!sanitizedUrl) {
      throw new Error('INVALID_URL');
    }

    try {
      // Fetch HTML content with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(sanitizedUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Roastr.ai Bot (Brand Safety Tag Extraction)'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP_ERROR: ${response.status} ${response.statusText}`);
      }

      const htmlContent = await response.text();

      // Extract text content (simple HTML stripping)
      const textContent = htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000); // Limit to 2000 chars

      // Use OpenAI to extract relevant tags
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a brand analysis assistant. Extract 5-10 relevant keywords/tags that describe this brand, product category, or industry. Return ONLY comma-separated tags, lowercase, no explanations.'
          },
          {
            role: 'user',
            content: `Website content:\n${textContent}\n\nExtract relevant brand tags:`
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      });

      const tagsText = completion.choices[0].message.content.trim();
      const tags = tagsText
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0)
        .slice(0, 10); // Max 10 tags

      logger.info('Tags extracted successfully', {
        url: sanitizedUrl,
        tagCount: tags.length
      });

      return tags;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('FETCH_TIMEOUT: URL fetch timed out after 10 seconds');
      }
      throw error;
    }
  }

  // ============================================================================
  // SPONSOR MENTION DETECTION
  // ============================================================================

  /**
   * Detect if a comment mentions any configured sponsor
   * @param {string} comment - Comment text
   * @param {Array<Object>} sponsors - List of active sponsors
   * @returns {Promise<Object>} { matched: boolean, sponsor?: Object, matchType?: string }
   */
  async detectSponsorMention(comment, sponsors) {
    if (!comment || typeof comment !== 'string') {
      return { matched: false };
    }

    if (!sponsors || sponsors.length === 0) {
      return { matched: false };
    }

    const commentLower = comment.toLowerCase();

    // Priority-based detection (sponsors already sorted by priority)
    for (const sponsor of sponsors) {
      // Only check active sponsors
      if (!sponsor.active) {
        continue;
      }

      // 1. Exact name match (case-insensitive)
      const nameRegex = new RegExp(`\\b${this._escapeRegex(sponsor.name)}\\b`, 'i');
      if (nameRegex.test(comment)) {
        return {
          matched: true,
          sponsor,
          matchType: 'exact'
        };
      }

      // 2. Tag match
      if (sponsor.tags && sponsor.tags.length > 0) {
        for (const tag of sponsor.tags) {
          const tagRegex = new RegExp(`\\b${this._escapeRegex(tag)}\\b`, 'i');
          if (tagRegex.test(comment)) {
            return {
              matched: true,
              sponsor,
              matchType: 'tag'
            };
          }
        }
      }
    }

    // No match found
    return { matched: false };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Sanitize and validate URL
   * @param {string} url - Raw URL
   * @returns {string|null} Sanitized URL or null if invalid
   * @private
   */
  _sanitizeURL(url) {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTP/HTTPS protocols
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      return parsed.href;
    } catch (error) {
      return null;
    }
  }

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = SponsorService;
