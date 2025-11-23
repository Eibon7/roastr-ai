/**
 * Filters utility for Roastr.ai Twitter Bot
 * Handles filtering of mentions to avoid duplicates, self-replies, and other unwanted mentions
 */

const logger = require('./logger');

class MentionFilters {
  constructor() {
    // In-memory storage for this session's processed mentions
    // TODO: In the future, this could be persisted to a database or file
    // for multi-instance deployments and persistence across restarts
    this.processedMentions = new Set();

    // Bot's own user ID to avoid self-replies (will be set by TwitterService)
    this.botUserId = null;
  }

  /**
   * Set the bot's user ID to filter out self-mentions
   * @param {string} userId - Bot's Twitter user ID
   */
  setBotUserId(userId) {
    this.botUserId = userId;
    logger.debug(`🤖 Bot user ID configurado: ${userId}`);
  }

  /**
   * Check if a mention should be processed
   * @param {object} mention - Twitter mention object
   * @returns {boolean} True if mention should be processed
   */
  shouldProcessMention(mention) {
    // Filter 1: Check if already processed
    if (this.isAlreadyProcessed(mention.id)) {
      logger.debug(`⏭️ Mención ${mention.id} ya fue procesada`);
      return false;
    }

    // Filter 2: Check if it's from the bot itself
    if (this.isFromBot(mention.author_id)) {
      logger.debug(`⏭️ Mención ${mention.id} es del propio bot`);
      return false;
    }

    // Filter 3: Check if mention has valid content
    if (!this.hasValidContent(mention.text)) {
      logger.debug(`⏭️ Mención ${mention.id} no tiene contenido válido`);
      return false;
    }

    // Filter 4: Check language (optional - could be expanded in the future)
    if (!this.isValidLanguage(mention.lang)) {
      logger.debug(`⏭️ Mención ${mention.id} en idioma no soportado: ${mention.lang}`);
      return false;
    }

    logger.debug(`✅ Mención ${mention.id} pasó todos los filtros`);
    return true;
  }

  /**
   * Check if mention has already been processed
   * @param {string} mentionId - Twitter mention ID
   * @returns {boolean} True if already processed
   */
  isAlreadyProcessed(mentionId) {
    return this.processedMentions.has(mentionId);
  }

  /**
   * Check if mention is from the bot itself
   * @param {string} authorId - Author's Twitter user ID
   * @returns {boolean} True if from bot
   */
  isFromBot(authorId) {
    return this.botUserId && authorId === this.botUserId;
  }

  /**
   * Check if mention has valid content for roasting
   * @param {string} text - Mention text
   * @returns {boolean} True if has valid content
   */
  hasValidContent(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }

    // Remove @mentions and clean text
    const cleanText = text.replace(/@\w+/g, '').trim();

    // Must have at least 3 characters of actual content
    if (cleanText.length < 3) {
      return false;
    }

    // Filter out common spam patterns (could be expanded)
    const spamPatterns = [
      /^(rt|retweet)\s/i, // Retweets
      /^(dm|mp)\s/i, // Direct message requests
      /^(follow|seguir)\s/i // Follow requests
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(cleanText)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if language is supported
   * Currently supports Spanish and English, but could be expanded
   * @param {string} lang - Language code
   * @returns {boolean} True if language is supported
   */
  isValidLanguage(lang) {
    // For now, accept all languages since our AI can detect and respond appropriately
    // In the future, this could be more restrictive based on business requirements
    const supportedLanguages = ['es', 'en', 'und', null, undefined];

    // 'und' means undetermined language
    // null/undefined means language detection failed
    return !lang || supportedLanguages.includes(lang);
  }

  /**
   * Mark a mention as processed
   * @param {string} mentionId - Twitter mention ID
   */
  markAsProcessed(mentionId) {
    this.processedMentions.add(mentionId);
    logger.debug(`✅ Mención ${mentionId} marcada como procesada`);

    // Keep only last 1000 processed mentions to prevent memory growth
    if (this.processedMentions.size > 1000) {
      const mentionsArray = Array.from(this.processedMentions);
      this.processedMentions = new Set(mentionsArray.slice(-1000));
      logger.debug('🧹 Limpieza de menciones procesadas (manteniendo últimas 1000)');
    }
  }

  /**
   * Get processed mentions count (for monitoring)
   * @returns {number} Number of processed mentions in current session
   */
  getProcessedCount() {
    return this.processedMentions.size;
  }

  /**
   * Clear processed mentions (for testing or reset)
   */
  clearProcessed() {
    this.processedMentions.clear();
    logger.debug('🗑️ Cache de menciones procesadas limpiado');
  }

  /**
   * Extract clean text from mention for roasting
   * Removes @mentions and extra whitespace
   * @param {string} text - Original mention text
   * @returns {string} Clean text for roasting
   */
  extractCleanText(text) {
    if (!text) return '';

    // Remove @mentions but keep the rest of the content
    return text
      .replace(/@\w+/g, '') // Remove @mentions
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // TODO: Future enhancements for multi-account support
  /**
   * Future: Filter mentions based on account-specific rules
   * This would be used when supporting multiple client accounts
   * @param {object} mention - Twitter mention
   * @param {object} accountConfig - Account-specific configuration
   * @returns {boolean} True if mention should be processed for this account
   */
  shouldProcessForAccount(mention, accountConfig) {
    // Future implementation for multi-account support
    // Could include account-specific filters like:
    // - Time windows (only respond during business hours)
    // - Content filters (different sensitivity levels)
    // - Rate limiting per account
    // - Custom keywords or hashtags

    return true; // For now, process all valid mentions
  }
}

// Export singleton instance
module.exports = new MentionFilters();
